// clickup.controller.js

const axios = require("axios");
const crypto = require("crypto");
const prisma = require("../lib/prisma");

const {
  CLICKUP_CLIENT_ID,
  CLICKUP_CLIENT_SECRET,
  CLICKUP_REDIRECT_URI,
  FRONTEND_REDIRECT_URI,
} = require("../config/env");

const CLIENT_ID = CLICKUP_CLIENT_ID;
const CLIENT_SECRET = CLICKUP_CLIENT_SECRET;
const REDIRECT_URI = CLICKUP_REDIRECT_URI;

// In-memory store for OAuth state tokens (expires after 10 min)
// Maps state → { org_id }
const STATE_TTL_MS = 10 * 60 * 1000;
const oauthStates = new Map();

// Resolves org_id from the Clerk JWT on the request
const getOrgId = async (req) => {
  const { userId: clerkId } = req.auth();
  if (!clerkId) return null;
  const user = await prisma.user.findUnique({
    where: { clerk_id: clerkId },
    select: { org_id: true },
  });
  return user?.org_id ?? null;
};

const installClickUp = async (req, res) => {
  const org_id = await getOrgId(req);
  if (!org_id) return res.status(401).json({ error: "Not authenticated" });

  const state = crypto.randomBytes(32).toString("hex");
  oauthStates.set(state, { org_id });
  setTimeout(() => oauthStates.delete(state), STATE_TTL_MS);

  // ClickUp v2 OAuth only accepts client_id and redirect_uri on the authorize URL.
  // The state token is passed via redirect_uri as a query param so we can recover org_id on callback.
  const callbackWithState = `${REDIRECT_URI}?state=${state}`;
  const authUrl =
    "https://app.clickup.com/api" +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(callbackWithState)}`;

  res.redirect(authUrl);
};

const callbackHandler = async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).send("Missing authorization code.");
  if (!state || !oauthStates.has(state))
    return res.status(400).send("Invalid authentication request.");

  const { org_id } = oauthStates.get(state);
  oauthStates.delete(state);

  try {
    const response = await axios.post(
      "https://api.clickup.com/api/v2/oauth/token",
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      }),
    );

    const { access_token, token_type } = response.data;

    await prisma.clickUpToken.upsert({
      where: { org_id },
      create: {
        org_id,
        access_token,
        token_type: token_type ?? null,
      },
      update: {
        access_token,
        token_type: token_type ?? null,
      },
    });

    await prisma.organisation.update({
      where: { org_id },
      data: { clickup_connected: true },
    });

    res.redirect(FRONTEND_REDIRECT_URI);
  } catch (error) {
    console.error("[ClickUp] Token exchange error:", error.message);
    res.status(500).send("Error connecting ClickUp. Please try again.");
  }
};

const connectionSuccessHandler = async (req, res) => {
  const org_id = await getOrgId(req);
  if (!org_id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const token = await prisma.clickUpToken.findUnique({ where: { org_id } });
    if (!token) return res.status(404).send("Token not found.");
    res.redirect(FRONTEND_REDIRECT_URI);
  } catch (_error) {
    res.status(500).send("Error connecting ClickUp!");
  }
};

const connectionStatus = async (req, res) => {
  try {
    const org_id = await getOrgId(req);
    if (!org_id) return res.status(200).json({ connected: false });
    const token = await prisma.clickUpToken.findUnique({ where: { org_id } });
    return res.status(200).json({ connected: Boolean(token) });
  } catch (_error) {
    return res.status(500).json({
      connected: false,
      error: "Failed to check ClickUp connection status",
    });
  }
};

module.exports = {
  installClickUp,
  callbackHandler,
  connectionSuccessHandler,
  connectionStatus,
};

// ##################### Utility Functions #####################

const refreshClickUpToken = async (refreshToken) => {
  const response = await axios.post(
    "https://api.clickup.com/api/v2/oauth/token",
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  );
  return response.data;
};

const getTokenRecord = async (org_id) => {
  return await prisma.clickUpToken.findUnique({
    where: { org_id },
  });
};

const _checkAndRefreshToken = async (org_id) => {
  const tokenRecord = await getTokenRecord(org_id);
  if (!tokenRecord) {
    throw new Error("No token record found for organisation");
  }
  const now = new Date();
  if (now >= tokenRecord.expires_at) {
    console.log("> Access token has expired. Refreshing...");
    const newTokens = await refreshClickUpToken(tokenRecord.refresh_token);
    const expires_at = new Date(Date.now() + newTokens.expires_in * 1000);
    await prisma.clickUpToken.update({
      where: { org_id },
      data: {
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_at,
      },
    });
    return newTokens.access_token;
  } else {
    return tokenRecord.access_token;
  }
};
