const axios = require("axios");
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { createClient } = require("@supabase/supabase-js");
const prisma = new PrismaClient();
const OAuthClient = require("intuit-oauth");
const crypto = require("crypto");

const CLIENT_ID = process.env.QUICKBOOKS_CLIENT_ID;
const CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET;
const REDIRECT_URI = process.env.QUICKBOOKS_REDIRECT_URI;
const ENVIRONMENT = process.env.QUICKBOOKS_ENVIRONMENT || "sandbox";
const baseURL = process.env.QUICKBOOKS_BASE_URL;

let oauthClient = null;

/**
 * Install QuickBooks - Initiates the OAuth 2.0 flow
 * @param {*} req
 * @param {*} res
 */
const installQuickbooks = async (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    return res
      .status(400)
      .send(
        "QuickBooks integration is not properly configured. Please contact the administrator.",
      );
  }

  try {
    oauthClient = new OAuthClient({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      environment: ENVIRONMENT,
      redirectUri: REDIRECT_URI,
      logging: false, // by default the value is `false`
    });

    // Change the scopes required for the application as needed
    const scopes = [
      OAuthClient.scopes.Accounting,
      // OAuthClient.scopes.Payment,
      // OAuthClient.scopes.Address,
      // OAuthClient.scopes.Email,
      // OAuthClient.scopes.OpenId,
      // OAuthClient.scopes.Profile,
      // OAuthClient.scopes.Phone,
      // OAuthClient.scopes.TimeTracking,
    ];

    // Generate a random state secret
    const authState = crypto.randomBytes(32).toString("hex");

    req.session.oauthState = authState; // Store the state secret on server-side for validating it in the callback.

    const authUri = oauthClient.authorizeUri({
      scope: scopes,
      state: authState, // You can enter any string value for the state.
      // The server should return the exact state : value pair sent in the original request.
      // Include an anti-forgery token for the state and confirm it in the response.
      // This prevents cross-site request forgery.
      response_type: "code",
    });

    oauthClient.state = res.redirect(authUri);
  } catch (error) {
    console.error("Error generating QuickBooks authorization URL: ", error);
    res
      .status(500)
      .send("Error initiating QuickBooks installation. Please try again.");
  }
};

/**
 * Handle OAuth callback from QuickBooks
 * @param {*} req
 * @param {*} res
 */
const callbackHandler = async (req, res) => {
  const { code, state, realmId } = req.query;
  const callbackUrl = req.url;

  console.log("\n=== OAuth Callback Received ===");
  console.log("Query params:", req.query);
  console.log("===============================\n");

  if (!code || !state) {
    return res.status(400).send("Missing required query parameters.");
  }

  const expectedState = req.session.oauthState;

  // Validating state secret to prevent CSRF attacks
  if (!expectedState || state !== expectedState) {
    return res.status(400).send("Invalid authentication request.");
  }

  // Invalidate state secret once auth is successful (to prevent replay)
  delete req.session.oauthState;

  try {
    const authResponse = await oauthClient.createToken(callbackUrl);
    const {
      access_token,
      refresh_token,
      expires_in,
      x_refresh_token_expires_in,
      token_type,
    } = authResponse.json;

    // console.log(authResponse.json);
    // console.log(`
    //   token_type: ${token_type}\n
    //   access_token: ${access_token}\n
    //   refresh_token: ${refresh_token}\n
    //   expires_in: ${expires_in}\n
    //   x_refresh_token_expires_in: ${x_refresh_token_expires_in}\n
    //   `);

    // ! TODO: Later change this to use user_id from Clerk Auth
    const user_id = realmId;
    req.session.user_id = user_id;
    console.log(`User ID: ${user_id}`);

    // Storing these tokens in DB
    await prisma.quickbooksToken.upsert({
      where: { user_id: user_id },
      create: {
        user_id: user_id,
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
        x_refresh_token_expires_in,
      },
    });

    // TODO: Redirect to /success route
    res.redirect("/api/integrations/quickbooks/success");

    // res.status(200).json(authResponse.json);
  } catch (error) {
    console.error("Error fetching access tokens: ", error);
    res.status(500).send("Error connecting QuickBooks. Please try again.");
  }
};

const connectionSuccessHandler = async (req, res) => {
  const user_id = req.session.user_id;
  console.log(`User (realmId): ${user_id}`);

  try {
    const token = prisma.quickbooksToken.findUnique({
      where: { user_id: user_id },
    });
    console.log(`Token: ${token}`);

    console.log(`QuickBooks Integration Successful!`);
    // res.redirect("http://localhost:3000/quickbooks"); // Redirecting to frontend QuickBooks Dashboard page
    res.redirect("/api/integrations/quickbooks/status");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error connecting QuickBooks!");
  }
};

/**
 * Check if the user is connected to Quickbooks or not.
 * @param {*} req
 * @param {*} res
 * @returns true if the user is connected, otherwise false.
 */
const connectionStatus = async (req, res) => {
  try {
    const user_id = req.session.user_id;

    if (!user_id) {
      return res.status(200).json({ connected: false });
    }

    const token = await prisma.quickbooksToken.findUnique({
      where: { user_id },
    });

    return res.status(200).json({
      connected: Boolean(token),
    });
  } catch (error) {
    console.error("Quickbooks status error:", error);
    return res.status(500).json({
      connected: false,
      error: "Failed to check Quickbooks connection status",
    });
  }
};

module.exports = {
  installQuickbooks,
  callbackHandler,
  connectionSuccessHandler,
  connectionStatus,
};
