//* TODO: Remove this import if not needed, instead import prisma client directly from lib/prisma.js
// const { createClient } = require("@supabase/supabase-js");
// const { PrismaClient } = require("@prisma/client");
// const { PrismaPg } = require("@prisma/adapter-pg");
// const adapter = new PrismaPg({
//   connectionString: process.env.DATABASE_URL,
// });
// const prisma = new PrismaClient({ adapter });

const { createClient } = require("@supabase/supabase-js");
const prisma = require("../lib/prisma");
const {
  MONDAY_CLIENT_ID,
  MONDAY_CLIENT_SECRET,
  MONDAY_REDIRECT_URI,
} = require("../config/env");

const axios = require("axios");
const CLIENT_ID = MONDAY_CLIENT_ID;
const CLIENT_SECRET = MONDAY_CLIENT_SECRET;
const REDIRECT_URI = MONDAY_REDIRECT_URI;

let SCOPES = [
  "boards:read account:read assets:read teams:read workspaces:read tags:read me:read",
];
if (process.env.SCOPE) {
  SCOPES = process.env.SCOPE.split(/ |, ?|%20/).join(" ");
}

// ################## OAuth Flow Handlers ##################

/**
 * Install Monday - Initiates the OAuth 2.0 flow
 */

const installMonday = async (req, res) => {
  const authUrl =
    "https://auth.monday.com/oauth2/authorize" +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  res.redirect(authUrl);
};

/**
 * Handle OAuth callback from Monday
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
    res.redirect("/api/integrations/monday/success");
  }
};

const connectionSuccessHandler = (req, res) => {
  const user_id = req.session.user_id;
  console.log(`User: ${user_id}`);

  const token = prisma.mondayToken.findUnique({
    where: { user_id: user_id },
  });

  console.log(`Monday Integration Successful!`);
  res.redirect("http://localhost:3000/integrations");
};

const connectionStatus = async (req, res) => {
  try {
    const user_id = req.session.user_id;
    if (!user_id) {
      return res.status(200).json({ connected: false });
    }
    const token = await prisma.mondayToken.findUnique({
      where: { user_id },
    });
    return res.status(200).json({
      connected: Boolean(token),
    });
  } catch (error) {
    console.error("Monday status error:", error);
    return res.status(500).json({
      connected: false,
      error: "Failed to check Monday connection status",
    });
  }
};

//
// Utility Functions

async function mondayQuery(accessToken, query, variables = {}) {
  const response = await axios.post(
    "https://api.monday.com/v2",
    { query, variables },
    {
      headers: {
        Authorization: accessToken,
        "Content-Type": "application/json",
      },
    },
  );
  return response.data;
}

module.exports = {
  installMonday,
  callbackHandler,
  connectionSuccessHandler,
  connectionStatus,
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
      "https://auth.monday.com/oauth2/token",
      new URLSearchParams(exchangeProof),
    );

    const { access_token, refresh_token, expires_in } = response.data;
    const expires_at = new Date(Date.now() + expires_in * 1000);

    // Fetching user metadata using access token
    const userMetadataRes = await axios.post(
      "https://api.monday.com/v2",
      { query: `query { me { id } }` },
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
          "API-Version": "2025-07",
        },
      },
    );

    const user_id = userMetadataRes.data.data.me.id;

    console.log(
      `User ${user_id} Tokens:\n
      \nAccess Token: ${access_token} \nRefresh Token: ${refresh_token}\nExpires In: ${expires_in} seconds`,
    );

    // Storing these tokens in DB

    await prisma.mondayToken.upsert({
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

const refreshMondayToken = async (refreshToken) => {
  const response = await axios.post(
    "https://auth.monday.com/oauth2/token",
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
  return await prisma.mondayToken.findUnique({
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
    const newTokens = await refreshMondayToken(tokenRecord.refresh_token);
    const expires_at = new Date(Date.now() + newTokens.expires_in * 1000);
    await prisma.mondayToken.update({
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
