// hubspot.controller.js
// HTTP layer only — no business logic lives here.
// All data logic is in hubspot.service.js

const axios = require("axios");
const crypto = require("crypto");
const prisma = require("../lib/prisma");
const { getLeadsKPIsService } = require("../services/leads.service");

const {
  HUBSPOT_CLIENT_ID,
  HUBSPOT_CLIENT_SECRET,
  HUBSPOT_REDIRECT_URI,
} = require("../config/env");

const CLIENT_ID = HUBSPOT_CLIENT_ID;
const CLIENT_SECRET = HUBSPOT_CLIENT_SECRET;
const REDIRECT_URI = HUBSPOT_REDIRECT_URI;

const SCOPES = [
  "crm.objects.deals.read",
  "crm.objects.contacts.read",
  "crm.objects.companies.read",
].join(" ");

// ─────────────────────────────────────────────────────────────────
//  OAUTH HANDLERS
// ─────────────────────────────────────────────────────────────────

const installHubSpot = (req, res) => {
  const state = crypto.randomBytes(32).toString("hex");
  req.session.oauthState = state;

  const authUrl =
    "https://app.hubspot.com/oauth/authorize" +
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
    // Exchange code for tokens
    const response = await axios.post(
      "https://api.hubapi.com/oauth/v1/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
      }),
    );

    const { access_token, refresh_token, expires_in } = response.data;
    const expires_at = new Date(Date.now() + expires_in * 1000);

    // Get portal ID
    const metaRes = await axios.get(
      `https://api.hubapi.com/oauth/v1/access-tokens/${access_token}`,
    );
    const org_id = String(metaRes.data.hub_id);
    req.session.org_id = org_id;

    await prisma.hubspotToken.upsert({
      where: { org_id },
      create: { org_id, access_token, refresh_token, expires_at },
      update: { access_token, refresh_token, expires_at },
    });

    await prisma.organisation.update({
      where: { org_id },
      data: { hubspot_connected: true },
    });

    res.redirect("/api/integrations/hubspot/success");
  } catch (error) {
    console.error("[HubSpot] Token exchange error:", error.message);
    res.status(500).send("Error connecting HubSpot. Please try again.");
  }
};

const connectionSuccessHandler = async (req, res) => {
  const org_id = req.session.org_id;
  try {
    const token = await prisma.hubspotToken.findUnique({ where: { org_id } });
    if (!token) return res.status(404).send("Token not found.");
    res.redirect("/api/integrations/hubspot/status");
  } catch (_error) {
    res.status(500).send("Error connecting HubSpot!");
  }
};

const connectionStatus = async (req, res) => {
  try {
    const org_id = req.session.org_id;
    if (!org_id) return res.status(200).json({ connected: false });
    const token = await prisma.hubspotToken.findUnique({ where: { org_id } });
    return res.status(200).json({ connected: Boolean(token) });
  } catch (_error) {
    return res.status(500).json({
      connected: false,
      error: "Failed to check HubSpot connection status",
    });
  }
};

// ─────────────────────────────────────────────────────────────────
//  HTTP HANDLERS — thin wrappers over service functions
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/integrations/hubspot/kpis/leads
 */
const getLeadsKPIs = async (req, res) => {
  const org_id = req.session.org_id;
  if (!org_id) return res.status(401).json({ error: "Not authenticated" });

  const { startDate, endDate } = req.query;
  try {
    const kpis = await getLeadsKPIsService(org_id, { startDate, endDate });
    return res.status(200).json(kpis);
  } catch (error) {
    console.error("[HubSpot] getLeadsKPIs error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  // OAuth
  installHubSpot,
  callbackHandler,
  connectionSuccessHandler,
  connectionStatus,

  // HTTP handlers
  getLeadsKPIs,
};
