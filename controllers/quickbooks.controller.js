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
} = require("../config/env");

const CLIENT_ID = QUICKBOOKS_CLIENT_ID;
const CLIENT_SECRET = QUICKBOOKS_CLIENT_SECRET;
const REDIRECT_URI = QUICKBOOKS_REDIRECT_URI;
const ENVIRONMENT = QUICKBOOKS_ENVIRONMENT;

/**
 * Install QuickBooks - Initiates the OAuth 2.0 flow
 */
const installQuickbooks = async (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI)
    return res
      .status(400)
      .send("QuickBooks integration is not properly configured.");
  try {
    const client = new OAuthClient({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      environment: ENVIRONMENT,
      redirectUri: REDIRECT_URI,
      logging: false,
    });
    const authState = crypto.randomBytes(32).toString("hex");
    req.session.oauthState = authState;
    const authUri = client.authorizeUri({
      scope: [OAuthClient.scopes.Accounting],
      state: authState,
      response_type: "code",
    });
    res.redirect(authUri);
  } catch (error) {
    console.error("Error generating QuickBooks authorization URL:", error);
    res
      .status(500)
      .send("Error initiating QuickBooks installation. Please try again.");
  }
};

/**
 * Handle OAuth callback from QuickBooks
 */
const callbackHandler = async (req, res) => {
  const { code, state, realmId } = req.query;
  if (!code || !state)
    return res.status(400).send("Missing required query parameters.");
  if (!req.session.oauthState || state !== req.session.oauthState)
    return res.status(400).send("Invalid authentication request.");
  delete req.session.oauthState;
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
    // TODO: Replace realmId with Clerk user ID once auth is integrated
    const user_id = realmId;
    req.session.user_id = user_id;
    await prisma.quickbooksToken.upsert({
      where: { user_id },
      create: {
        user_id,
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
  try {
    const token = await prisma.quickbooksToken.findUnique({
      where: { user_id: req.session.user_id },
    });
    if (!token)
      return res
        .status(404)
        .send("Token not found after successful connection.");
    res.redirect("/api/integrations/quickbooks/status");
  } catch (_error) {
    res.status(500).send("Error connecting QuickBooks!");
  }
};

/**
 * Check if the user is connected to Quickbooks or not.
 * @param {*} req
 * @param {*} res sends {connected: true} if the user is connected, otherwise {connected: false}.
 */
const connectionStatus = async (req, res) => {
  try {
    const user_id = req.session.user_id;
    if (!user_id) return res.status(200).json({ connected: false });
    const token = await prisma.quickbooksToken.findUnique({
      where: { user_id },
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
  const user_id = req.session.user_id;
  if (!user_id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const { access_token } = await refreshAndPersistTokenService(user_id);
    return res.status(200).json({ success: true, access_token });
  } catch (_error) {
    return res.status(500).json({ error: "Failed to refresh token" });
  }
};

/**
 * Retrieves all Financial & Cash KPIs in a Company.
 */
const getFinancialKPIs = async (req, res) => {
  const user_id = req.session.user_id;
  if (!user_id) return res.status(401).json({ error: "Not authenticated" });
  const { startDate, endDate, asOfDate } = req.query;
  try {
    // Calls the service — no business logic here
    const kpis = await getFinancialKPIsService(user_id, {
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

module.exports = {
  installQuickbooks,
  callbackHandler,
  connectionSuccessHandler,
  connectionStatus,
  refreshAccessToken,
  getFinancialKPIs,
};
