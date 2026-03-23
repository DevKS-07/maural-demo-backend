// quickbooks.controller.js

const OAuthClient = require("intuit-oauth");
const crypto = require("crypto");
const prisma = require("../lib/prisma");
const {
  refreshAndPersistTokenService,
  getFinancialKPIsService,
} = require("../services/finance.service");

const {
  QUICKBOOKS_CLIENT_ID,
  QUICKBOOKS_CLIENT_SECRET,
  QUICKBOOKS_REDIRECT_URI,
  QUICKBOOKS_ENVIRONMENT,
  FRONTEND_REDIRECT_URI,
} = require("../config/env");

const CLIENT_ID = QUICKBOOKS_CLIENT_ID;
const CLIENT_SECRET = QUICKBOOKS_CLIENT_SECRET;
const REDIRECT_URI = QUICKBOOKS_REDIRECT_URI;
const ENVIRONMENT = QUICKBOOKS_ENVIRONMENT;

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

/**
 * Install QuickBooks - Initiates the OAuth 2.0 flow
 */
const installQuickbooks = async (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI)
    return res
      .status(400)
      .send("QuickBooks integration is not properly configured.");

  const org_id = await getOrgId(req);
  if (!org_id) return res.status(401).json({ error: "Not authenticated" });

  // Skip OAuth if the org already has a connected token
  const existing = await prisma.quickbooksToken.findUnique({ where: { org_id } });
  if (existing) {
    return res.json({ redirect: `${FRONTEND_REDIRECT_URI}?already_connected=quickbooks` });
  }

  try {
    const client = new OAuthClient({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      environment: ENVIRONMENT,
      redirectUri: REDIRECT_URI,
      logging: false,
    });
    const authState = crypto.randomBytes(32).toString("hex");
    oauthStates.set(authState, { org_id });
    setTimeout(() => oauthStates.delete(authState), STATE_TTL_MS);
    const authUri = client.authorizeUri({
      scope: [OAuthClient.scopes.Accounting],
      state: authState,
      response_type: "code",
    });
    res.json({ authUrl: authUri });
  } catch (error) {
    console.error("Error generating QuickBooks authorization URL:", error);
    res
      .status(500)
      .json({ error: "Error initiating QuickBooks installation. Please try again." });
  }
};

/**
 * Handle OAuth callback from QuickBooks
 */
const callbackHandler = async (req, res) => {
  const { code, state, realmId } = req.query;
  if (!code || !state)
    return res.status(400).send("Missing required query parameters.");
  if (!oauthStates.has(state))
    return res.status(400).send("Invalid authentication request.");

  const { org_id } = oauthStates.get(state);
  oauthStates.delete(state);

  try {
    const client = new OAuthClient({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      environment: ENVIRONMENT,
      redirectUri: REDIRECT_URI,
      logging: false,
    });
    const authResponse = await client.createToken(req.url);
    const {
      access_token,
      refresh_token,
      expires_in,
      x_refresh_token_expires_in,
      token_type,
    } = authResponse.json;

    await prisma.quickbooksToken.upsert({
      where: { org_id },
      create: {
        org_id,
        access_token,
        refresh_token,
        token_type,
        realmId,
        expires_in,
        x_refresh_token_expires_in,
      },
      update: {
        access_token,
        refresh_token,
        token_type,
        expires_in,
        x_refresh_token_expires_in,
      },
    });

    await prisma.organisation.update({
      where: { org_id },
      data: { quickbooks_connected: true },
    });

    res.redirect("/api/integrations/quickbooks/success");
  } catch (error) {
    console.error("Error fetching access tokens:", error);
    res.status(500).send("Error connecting QuickBooks. Please try again.");
  }
};

/**
 * Handle logic after successful connection to QuickBooks
 */
const connectionSuccessHandler = async (req, res) => {
  const org_id = await getOrgId(req);
  if (!org_id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const token = await prisma.quickbooksToken.findUnique({
      where: { org_id },
    });
    if (!token)
      return res
        .status(404)
        .send("Token not found after successful connection.");
    res.redirect(`${FRONTEND_REDIRECT_URI}?connected=quickbooks`);
  } catch (_error) {
    res.status(500).send("Error connecting QuickBooks!");
  }
};

/**
 * Check if the user is connected to Quickbooks or not.
 */
const connectionStatus = async (req, res) => {
  try {
    const org_id = await getOrgId(req);
    if (!org_id) return res.status(200).json({ connected: false });
    const token = await prisma.quickbooksToken.findUnique({
      where: { org_id },
    });
    return res.status(200).json({ connected: Boolean(token) });
  } catch (_error) {
    return res.status(500).json({
      connected: false,
      error: "Failed to check QuickBooks connection status",
    });
  }
};

/**
 * Refresh the access-token
 */
const refreshAccessToken = async (req, res) => {
  const org_id = await getOrgId(req);
  if (!org_id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const { access_token } = await refreshAndPersistTokenService(org_id);
    return res.status(200).json({ success: true, access_token });
  } catch (_error) {
    return res.status(500).json({ error: "Failed to refresh token" });
  }
};

/**
 * Retrieves all Financial & Cash KPIs in a Company.
 */
const getFinancialKPIs = async (req, res) => {
  const org_id = await getOrgId(req);
  if (!org_id) return res.status(401).json({ error: "Not authenticated" });
  const { startDate, endDate, asOfDate } = req.query;
  try {
    const kpis = await getFinancialKPIsService(org_id, {
      startDate,
      endDate,
      asOfDate,
    });
    return res.status(200).json(kpis);
  } catch (error) {
    console.error("[QB] getFinancialKPIs error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

const disconnectQuickBooks = async (req, res) => {
  const org_id = await getOrgId(req);
  if (!org_id) return res.status(401).json({ error: "Not authenticated" });

  try {
    await prisma.quickbooksToken.deleteMany({ where: { org_id } });
    await prisma.organisation.update({
      where: { org_id },
      data: { quickbooks_connected: false },
    });
    return res.status(200).json({ disconnected: true });
  } catch (error) {
    console.error("[QuickBooks] disconnect error:", error.message);
    return res.status(500).json({ error: "Failed to disconnect QuickBooks" });
  }
};

module.exports = {
  installQuickbooks,
  callbackHandler,
  connectionSuccessHandler,
  connectionStatus,
  disconnectQuickBooks,
  refreshAccessToken,
  getFinancialKPIs,
};
