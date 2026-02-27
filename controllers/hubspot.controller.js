const axios = require("axios");
const express = require("express");

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

// SUMMARY ENGINE UTILITIES
const getCRMSummary = async (req, res) => {
  const user_id = req.session.user_id;
  const tokenRecord = await getTokenRecord(user_id);
  const { access_token } = tokenRecord; // HubSpot uses access_token (no realmId)

  try {
    if (!access_token) {
      return res.status(401).send("No access token found for the user");
    }

    const baseURL = "https://api.hubapi.com"; // HubSpot API base

    // Helper to fetch HubSpot data
    const fetchHubSpot = async (
      endpoint,
      params = {},
      method = "GET",
      body = null,
    ) => {
      const url = `${baseURL}${endpoint}`;
      const config = {
        params,
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      };
      if (method === "POST" && body) config.data = body;
      const response = await axios({ method, url, ...config });
      return response.data;
    };

    // Pipeline Coverage: Fetch deals in pipeline, sum weighted amounts (amount * probability)
    const dealsData = await fetchHubSpot("/crm/v3/objects/deals", {
      properties: "amount,probability,pipeline,dealstage",
      limit: 100, // Paginate if more
    });
    let totalWeightedPipeline = 0;
    dealsData.results.forEach((deal) => {
      const amount = parseFloat(deal.properties.amount) || 0;
      const probability = parseFloat(deal.properties.probability) || 0;
      totalWeightedPipeline += amount * (probability / 100);
    });
    const salesTarget = 850000; // Example target; fetch from custom property or config
    const pipelineCoverage = salesTarget
      ? (totalWeightedPipeline / salesTarget).toFixed(2)
      : 0;

    // Deal Velocity: Fetch closed deals, avg time from create to close
    const closedDealsData = await fetchHubSpot("/crm/v3/objects/deals", {
      properties: "createdate,closedate,dealstage",
      filter: "dealstage__eq__closedwon", // Adjust for closed stages
      limit: 100,
    });
    let totalTime = 0;
    let closedCount = 0;
    closedDealsData.results.forEach((deal) => {
      if (deal.properties.closedate) {
        const createDate = new Date(deal.properties.createdate);
        const closeDate = new Date(deal.properties.closedate);
        const timeDiff = (closeDate - createDate) / (1000 * 60 * 60 * 24); // Days
        totalTime += timeDiff;
        closedCount++;
      }
    });
    const dealVelocity = closedCount ? (totalTime / closedCount).toFixed(2) : 0;

    // Recurring vs One-Time Revenue: Fetch line items, filter by recurringbillingfrequency
    const lineItemsData = await fetchHubSpot("/crm/v3/objects/line_items", {
      properties: "amount,recurringbillingfrequency",
      limit: 100,
    });
    let recurringRevenue = 0;
    let oneTimeRevenue = 0;
    lineItemsData.results.forEach((item) => {
      const amount = parseFloat(item.properties.amount) || 0;
      if (item.properties.recurringbillingfrequency) {
        recurringRevenue += amount;
      } else {
        oneTimeRevenue += amount;
      }
    });
    const recurringPercent =
      recurringRevenue + oneTimeRevenue
        ? (
            (recurringRevenue / (recurringRevenue + oneTimeRevenue)) *
            100
          ).toFixed(2)
        : 0;

    // Customer Engagement: Fetch engagements, count activities
    const engagementsData = await fetchHubSpot("/crm/v3/objects/engagements", {
      limit: 100,
    });
    const customerEngagement = engagementsData.total || 0; // Total count; refine with filters

    // Forecast Accuracy: Fetch closed deals, compare forecasted vs actual (assuming forecast property)
    const forecastData = await fetchHubSpot("/crm/v3/objects/deals", {
      properties: "forecast_amount,amount,closedate",
      filter: "closedate__gte__2025-01-01", // Recent closed
      limit: 100,
    });
    let totalForecasted = 0;
    let totalActual = 0;
    forecastData.results.forEach((deal) => {
      totalForecasted += parseFloat(deal.properties.forecast_amount) || 0;
      totalActual += parseFloat(deal.properties.amount) || 0;
    });
    const forecastAccuracy = totalForecasted
      ? ((totalActual / totalForecasted) * 100).toFixed(2)
      : 0;

    // Deal Stage Conversion: Fetch pipelines, then deals to count transitions
    const pipelinesData = await fetchHubSpot("/crm/v3/pipelines/deals");
    const stages = pipelinesData.results[0]?.stages || []; // Assume first pipeline
    // Fetch deals for stage counts (simplified; use analytics API for better)
    const dealStagesData = await fetchHubSpot("/crm/v3/objects/deals", {
      properties: "dealstage",
      limit: 100,
    });
    const stageCounts = {};
    dealStagesData.results.forEach((deal) => {
      const stage = deal.properties.dealstage;
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    });
    const conversionRates = {}; // Compute rates between stages (e.g., stage1 to stage2 = count2 / count1)
    // Example: loop through stages and calculate sequential conversions

    // Revenue per Segment: Fetch deals with company associations, group by segment
    const segmentedDeals = await fetchHubSpot("/crm/v3/objects/deals", {
      properties: "amount",
      associations: "companies",
      limit: 100,
    });
    const revenuePerSegment = {};
    for (const deal of segmentedDeals.results) {
      const amount = parseFloat(deal.properties.amount) || 0;
      const companyId = deal.associations.companies?.results[0]?.id;
      if (companyId) {
        const company = await fetchHubSpot(
          `/crm/v3/objects/companies/${companyId}`,
          { properties: "segment" },
        );
        const segment = company.properties.segment || "Unknown";
        revenuePerSegment[segment] = (revenuePerSegment[segment] || 0) + amount;
      }
    }

    // Churn/Retention: Fetch contacts, count by lifecyclestage
    const contactsData = await fetchHubSpot("/crm/v3/objects/contacts", {
      properties: "lifecyclestage",
      limit: 100,
    });
    let totalCustomers = 0;
    let retainedCustomers = 0;
    contactsData.results.forEach((contact) => {
      const stage = contact.properties.lifecyclestage;
      if (stage === "customer") totalCustomers++;
      // Retained = active customers; churned = lost (e.g., stage !== 'customer')
    });
    const retentionRate = totalCustomers
      ? ((retainedCustomers / totalCustomers) * 100).toFixed(2)
      : 0;

    // Send parsed values (no summary JSON - you can normalize further)
    res.status(200).json({
      pipelineCoverage,
      dealVelocity,
      recurringRevenue,
      oneTimeRevenue,
      recurringPercent,
      customerEngagement,
      forecastAccuracy,
      conversionRates, // Object of stage conversions
      revenuePerSegment,
      retentionRate,
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send("Error fetching CRM summary");
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
