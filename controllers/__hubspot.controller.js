const axios = require("axios");
const express = require("express");

const prisma = require("../lib/prisma");

const CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI;

// TODO: Adjust scopes as needed
// TODO: Implement refresh token logic
// TODO: Fetch more data from HubSpot APIs as needed

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
  const authUrl =
    "https://app.hubspot.com/oauth/authorize" +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  res.redirect(authUrl);
};

/**
 * Receive the authorization code from the OAuth 2.0 Server, and process it based on the query parameters that are passed
 * @param {*} req
 * @param {*} res
 */
const callbackHandler = async (req, res) => {
  if (req.query.code) {
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

    req.session.user_id = tokenData.user_id;

    res.redirect("/api/integrations/hubspot/success");
  }
};

/**
 * Handle logic after successful connection to HubSpot
 * @param {*} req
 * @param {*} res
 */
const connectionSuccessHandler = (req, res) => {
  const user_id = req.session.user_id;
  console.log(`User: ${user_id}`);

  const token = prisma.hubspotToken.findUnique({
    where: { user_id: user_id },
  });
  console.log(`Token: ${token}`);

  console.log(`HubSpot Integration Successful!`);
  res.redirect("http://localhost:3000/hubspot"); // Redirecting to frontend HubSpot Dashboard page
};

/**
 * Check if the logged-in user has connected their HubSpot account
 * @param {*} req
 * @param {*} res
 * @returns true/false based on connection status
 */
const connectionStatus = async (req, res) => {
  try {
    const user_id = req.session.user_id;

    if (!user_id) {
      return res.status(200).json({ connected: false });
    }

    const token = await prisma.hubspotToken.findUnique({
      where: { user_id },
    });

    return res.status(200).json({
      connected: Boolean(token),
    });
  } catch (error) {
    console.error("HubSpot status error:", error);
    return res.status(500).json({
      connected: false,
      error: "Failed to check HubSpot connection status",
    });
  }
};

/**
 * Get contacts from HubSpot for the logged-in user
 * @param {*} req
 * @param {*} res
 */
const getContacts = async (req, res) => {
  const user_id = req.session.user_id;
  const tokenRecord = await getTokenRecord(user_id);

  try {
    if (tokenRecord.access_token) {
      const fetchContactsRes = await axios.get(
        `https://api.hubapi.com/crm/v3/objects/contacts?limit=50`,
        {
          headers: {
            Authorization: `Bearer ${tokenRecord.access_token}`,
          },
        },
      );
      res.status(200).json(fetchContactsRes.data);
    } else {
      res.status(400).send("No access token found for the user");
    }
  } catch (error) {
    res.status(500).send("Error fetching contacts");
  }
};

/**
 * Get carts data from HubSpot for logged-in user
 * @param {*} req
 * @param {*} res
 */
const getCarts = async (req, res) => {
  const user_id = req.session.user_id;
  const tokenRecord = await getTokenRecord(user_id);

  try {
    if (tokenRecord.access_token) {
      const fetchCartsRes = await axios.get(
        `https://api.hubapi.com/crm/v3/objects/carts?limit=50`,
        {
          headers: {
            Authorization: `Bearer ${tokenRecord.access_token}`,
          },
        },
      );
      res.status(200).json(fetchCartsRes.data);
    } else {
      res.status(400).send("No access token found for user");
    }
  } catch (error) {
    res.status(500).send("Error fetching contacts");
  }
};

/**
 * Get Companies data from HubSpot for logged-in user
 * @param {*} req
 * @param {*} res
 */
const getCompanies = async (req, res) => {
  const user_id = req.session.user_id;
  const tokenRecord = await getTokenRecord(user_id);

  try {
    if (tokenRecord.access_token) {
      const fetchCompaniesRes = await axios.get(
        `https://api.hubapi.com/crm/v3/objects/companies?limit=50`,
        {
          headers: {
            Authorization: `Bearer ${tokenRecord.access_token}`,
          },
        },
      );
      res.status(200).json(fetchCompaniesRes.data);
    } else {
      res.status(400).send("No access token found for user");
    }
  } catch (error) {
    res.status(500).send("Error fetching contacts");
  }
};


module.exports = {
  installHubSpot,
  callbackHandler,
  connectionStatus,
  connectionSuccessHandler,
  getContacts,
  getCarts,
  getCompanies,
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
      new URLSearchParams(exchangeProof),
    );

    const { access_token, refresh_token, expires_in } = response.data;
    const expires_at = new Date(Date.now() + expires_in * 1000);

    // Fetching user metadata using access token
    const userMetadataRes = await axios.get(
      `https://api.hubapi.com/oauth/v1/access-tokens/${access_token}`,
    );

    const user_id = userMetadataRes.data.hub_id;

    // console.log(
    //   `User ${user_id} Tokens:\n
    //   \nAccess Token: ${access_token} \nRefresh Token: ${refresh_token}\nExpires In: ${expires_in} seconds`
    // );

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
      `> Error exchanging ${exchangeProof.grant_type} for access token`,
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
    }),
  );

  return response.data;
};

/**
 * Get the token record for a specific user
 * @param {*} user_id user ID
 * @returns The token record from the database
 */
const getTokenRecord = async (user_id) => {
  return await prisma.hubspotToken.findUnique({
    where: { user_id: user_id },
  });
};

const checkAndRefreshToken = async (user_id) => {
  const tokenRecord = await getTokenRecord(user_id);
  if (!tokenRecord) {
    throw new Error("No token record found for user");
  }
  const now = new Date();
  if (now >= tokenRecord.expires_at) {
    console.log("> Access token has expired. Refreshing...");
    const newTokens = await refreshHubSpotToken(tokenRecord.refresh_token);
    const expires_at = new Date(Date.now() + newTokens.expires_in * 1000);
    await prisma.hubspotToken.update({
      where: { user_id: user_id },
      data: {
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_at: expires_at,
      },
    });
    return newTokens.access_token;
  } else {
    return tokenRecord.access_token;
  }
};
