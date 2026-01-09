const axios = require("axios");
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI;

let SCOPES = ["crm.objects.contacts.read"];
if (process.env.SCOPE) {
  SCOPES = process.env.SCOPE.split(/ |, ?|%20/).join(" ");
}

/**
 * Build the authorization URL to redirect a user to when they choose to install the app
 * @param {*} req
 * @param {*} res
 */
const installHubSpot = (req, res) => {
  console.log(" ");
  console.log("=== Initiating OAuth 2.0 flow with HubSpot ===");
  console.log(" ");
  // Create the authorization URL
  const authUrl =
    "https://app.hubspot.com/oauth/authorize" +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` + // app's client ID
    `&scope=${encodeURIComponent(SCOPES)}` + // scopes being requested by the app
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`; // where to send the user after the consent page

  console.log("===> Step 1: Redirecting user to your app's OAuth URL");
  res.redirect(authUrl);
  console.log("===> Step 2: User is being prompted for consent by HubSpot");
};

/**
 * Receive the authorization code from the OAuth 2.0 Server, and process it based on the query parameters that are passed
 * @param {*} req
 * @param {*} res
 */
const getHubSpotCallback = async (req, res) => {
  console.log("===> Step 3: Handling the request sent by the server");

  if (req.query.code) {
    console.log("> Received an authorization token");
    const authCodeProof = {
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code: req.query.code,
    };

    // Exchange the authorization code for an access token and refresh token
    // TODO: Later use userID from clerk auth to identify the user
    const tokenData = await exchangeAuthCodeForTokens(authCodeProof);

    if (tokenData.message) {
      res.status(500).send("Error during token exchange. Please try again.");
    }

    // Storing user_id in session for future use
    req.session.user_id = tokenData.user_id;

    // Once the tokens have been retrieved to redirect to success page i.e. HubSpot Dashboard page
    res.redirect("/api/integrations/hubspot/success");
  }
};

module.exports = {
  installHubSpot,
  getHubSpotCallback,
};

// ##################### Utility Functions #####################
/**
 * Exchange the authorization code for an access token and refresh token
 * @param {*} userId
 * @param {*} authCodeProof
 */
const exchangeAuthCodeForTokens = async (exchangeProof) => {
  try {
    const response = await axios.post(
      "https://api.hubapi.com/oauth/v1/token",
      new URLSearchParams(exchangeProof)
    );

    const { access_token, refresh_token, expires_in } = response.data;
    const expires_at = new Date(Date.now() + expires_in * 1000);

    console.log("       > Received an access token and refresh token");

    // Fetching user metadata using access token
    const userMetadataRes = await axios.get(
      `https://api.hubapi.com/oauth/v1/access-tokens/${access_token}`
    );
    // extracting hubspot_user_id from response
    console.log(userMetadataRes.data);

    const user_id = userMetadataRes.data.hub_id;

    console.log(
      `User ${user_id} Tokens:\n
      \nAccess Token: ${access_token} \nRefresh Token: ${refresh_token}\nExpires In: ${expires_in} seconds`
    );

    // Storing these tokens in DB
    await prisma.hubspotToken.upsert({
      where: { user_id: user_id },
      create: {
        user_id: user_id,
        access_token,
        refresh_token,
        expires_at,
      },
      update: {
        access_token,
        refresh_token,
        expires_at,
      },
    });

    return { user_id, access_token };
  } catch (err) {
    console.error(
      `> Error exchanging ${exchangeProof.grant_type} for access token`
    );
    console.error(err);
    return err;
  }
};

/**
 * Use a previously obtained refresh token to generate a new access token.
 * @param {*} refreshToken previous refresh token
 * @returns
 */
const refreshHubSpotToken = async (refreshToken) => {
  const response = await axios.post(
    "https://api.hubapi.com/oauth/v1/token",
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
    })
  );

  return response.data;
};
