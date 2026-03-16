// monday.controller.js
// OAuth flow only — all data logic lives in monday.service.js

const axios = require("axios");
const crypto = require("crypto");
const prisma = require("../lib/prisma");

const {
  MONDAY_CLIENT_ID,
  MONDAY_CLIENT_SECRET,
  MONDAY_REDIRECT_URI,
} = require("../config/env");

const CLIENT_ID = MONDAY_CLIENT_ID;
const CLIENT_SECRET = MONDAY_CLIENT_SECRET;
const REDIRECT_URI = MONDAY_REDIRECT_URI;
const API_VERSION = "2025-07";

const SCOPES = [
  "boards:read",
  "account:read",
  "teams:read",
  "workspaces:read",
  "me:read",
].join(" ");

// ─────────────────────────────────────────────────────────────────
//  OAUTH HANDLERS
// ─────────────────────────────────────────────────────────────────

const installMonday = (req, res) => {
  const state = crypto.randomBytes(32).toString("hex");
  req.session.oauthState = state;

  const authUrl =
    "https://auth.monday.com/oauth2/authorize" +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&state=${state}`;

  res.redirect(authUrl);
};

const callbackHandler = async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).send("Missing authorization code.");
  if (!req.session.oauthState || state !== req.session.oauthState)
    return res.status(400).send("Invalid authentication request.");
  delete req.session.oauthState;

  try {
    const response = await axios.post(
      "https://auth.monday.com/oauth2/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
      }),
    );

    const { access_token, refresh_token, expires_in } = response.data;

    // Monday access tokens are long-lived and don't always include expires_in.
    // Default to 1 year if not provided.
    // Get Monday user ID
    const userRes = await axios.post(
      "https://api.monday.com/v2",
      { query: "query { me { id } }" },
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
          "API-Version": API_VERSION,
        },
      },
    );
    // TODO: Replace with Clerk user ID once auth is integrated
    const user_id = String(userRes.data.data.me.id);
    req.session.user_id = user_id;

    await prisma.mondayToken.upsert({
      where: { user_id },
      create: {
        user_id,
        access_token,
        refresh_token: refresh_token ?? null,
        expires_in: expires_in ?? null,
      },
      update: {
        access_token,
        refresh_token: refresh_token ?? null,
        expires_in: expires_in ?? null,
      },
    });

    res.redirect("/api/integrations/monday/success");
  } catch (error) {
    console.error("[Monday] Token exchange error:", error.message);
    res.status(500).send("Error connecting Monday. Please try again.");
  }
};

const connectionSuccessHandler = async (req, res) => {
  const user_id = req.session.user_id;
  try {
    const token = await prisma.mondayToken.findUnique({ where: { user_id } }); // fixed: added await
    if (!token) return res.status(404).send("Token not found.");
    res.redirect("/api/integrations/monday/status");
  } catch (error) {
    res.status(500).send("Error connecting Monday!");
  }
};

const connectionStatus = async (req, res) => {
  try {
    const user_id = req.session.user_id;
    if (!user_id) return res.status(200).json({ connected: false });
    const token = await prisma.mondayToken.findUnique({ where: { user_id } });
    return res.status(200).json({ connected: Boolean(token) });
  } catch (error) {
    return res.status(500).json({
      connected: false,
      error: "Failed to check Monday connection status",
    });
  }
};

module.exports = {
  installMonday,
  callbackHandler,
  connectionSuccessHandler,
  connectionStatus,
};
