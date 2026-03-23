// monday.controller.js
// OAuth flow only — all data logic lives in monday.service.js

const axios = require("axios");
const crypto = require("crypto");
const prisma = require("../lib/prisma");

const {
  MONDAY_CLIENT_ID,
  MONDAY_CLIENT_SECRET,
  MONDAY_REDIRECT_URI,
  FRONTEND_REDIRECT_URI,
} = require("../config/env");
const { autoConfigureMonday } = require("../services/laborConfig.service");

const CLIENT_ID = MONDAY_CLIENT_ID;
const CLIENT_SECRET = MONDAY_CLIENT_SECRET;
const REDIRECT_URI = MONDAY_REDIRECT_URI;

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

// ─────────────────────────────────────────────────────────────────
//  OAUTH HANDLERS
// ─────────────────────────────────────────────────────────────────

const installMonday = async (req, res) => {
  const org_id = await getOrgId(req);
  if (!org_id) return res.status(401).json({ error: "Not authenticated" });

  // Skip OAuth if the org already has a connected token
  const existing = await prisma.mondayToken.findUnique({ where: { org_id } });
  if (existing) {
    return res.json({ redirect: `${FRONTEND_REDIRECT_URI}?already_connected=monday` });
  }

  const state = crypto.randomBytes(32).toString("hex");
  oauthStates.set(state, { org_id });
  setTimeout(() => oauthStates.delete(state), STATE_TTL_MS);

  const authUrl =
    "https://auth.monday.com/oauth2/authorize" +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&state=${state}`;

  res.json({ authUrl });
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

    await prisma.mondayToken.upsert({
      where: { org_id },
      create: {
        org_id,
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

    await prisma.organisation.update({
      where: { org_id },
      data: { monday_connected: true },
    });

    // Fire-and-forget: auto-detect default board for labor KPIs
    autoConfigureMonday(org_id).catch(() => {});

    res.redirect(`${FRONTEND_REDIRECT_URI}?connected=monday`);
  } catch (error) {
    console.error("[Monday] Token exchange error:", error.message);
    res.status(500).send("Error connecting Monday. Please try again.");
  }
};

const connectionSuccessHandler = async (req, res) => {
  const org_id = await getOrgId(req);
  if (!org_id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const token = await prisma.mondayToken.findUnique({ where: { org_id } });
    if (!token) return res.status(404).send("Token not found.");
    res.redirect(`${FRONTEND_REDIRECT_URI}?connected=monday`);
  } catch (_error) {
    res.status(500).send("Error connecting Monday!");
  }
};

const connectionStatus = async (req, res) => {
  try {
    const org_id = await getOrgId(req);
    if (!org_id) return res.status(200).json({ connected: false });
    const token = await prisma.mondayToken.findUnique({ where: { org_id } });
    const org = await prisma.organisation.findUnique({
      where: { org_id },
      select: { laborSource: true, mondayBoardId: true },
    });
    return res.status(200).json({
      connected: Boolean(token),
      laborConfigured:
        org?.laborSource === "monday" && Boolean(org?.mondayBoardId),
    });
  } catch (_error) {
    return res.status(500).json({
      connected: false,
      error: "Failed to check Monday connection status",
    });
  }
};

const disconnectMonday = async (req, res) => {
  const org_id = await getOrgId(req);
  if (!org_id) return res.status(401).json({ error: "Not authenticated" });

  try {
    await prisma.mondayToken.deleteMany({ where: { org_id } });

    // Clear connected flag and labor config if Monday was the active source
    const org = await prisma.organisation.findUnique({
      where: { org_id },
      select: { laborSource: true },
    });
    const updateData = { monday_connected: false };
    if (org?.laborSource === "monday") {
      updateData.laborSource = null;
      updateData.mondayBoardId = null;
    }
    await prisma.organisation.update({ where: { org_id }, data: updateData });

    return res.status(200).json({ disconnected: true });
  } catch (error) {
    console.error("[Monday] disconnect error:", error.message);
    return res.status(500).json({ error: "Failed to disconnect Monday" });
  }
};

module.exports = {
  installMonday,
  callbackHandler,
  connectionSuccessHandler,
  connectionStatus,
  disconnectMonday,
};
