// hubspot.service.js
// Pure data/business logic — no req, no res, no Express.
// Import this anywhere: summaryEngine, cron jobs, webhooks, etc.

const axios = require("axios");
const prisma = require("../lib/prisma");

const {
  HUBSPOT_CLIENT_ID,
  HUBSPOT_CLIENT_SECRET,
} = require("../config/env");

const CLIENT_ID = HUBSPOT_CLIENT_ID;
const CLIENT_SECRET = HUBSPOT_CLIENT_SECRET;

// ─────────────────────────────────────────────────────────────────
//  AUTH HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Get token record from DB for an organisation.
 * @param {string} orgId
 * @returns {Promise<object>}
 */
const getTokenRecord = async (orgId) => {
  const token = await prisma.hubspotToken.findUnique({
    where: { org_id: orgId },
  });
  if (!token) throw new Error(`No HubSpot token found for organisation: ${orgId}`);
  return token;
};

/**
 * Use refresh token to get a new access token and persist to DB.
 * @param {string} orgId
 * @param {string} refreshToken
 * @returns {Promise<string>} new access token
 */
const refreshAndPersistToken = async (orgId, refreshToken) => {
  const response = await axios.post(
    "https://api.hubapi.com/oauth/v1/token",
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  );

  const { access_token, refresh_token, expires_in } = response.data;
  const expires_at = new Date(Date.now() + expires_in * 1000);

  await prisma.hubspotToken.update({
    where: { org_id: orgId },
    data: { access_token, refresh_token, expires_at },
  });

  console.log(`[HubSpot] Tokens refreshed and persisted for organisation: ${orgId}`);
  return access_token;
};

/**
 * Returns a valid access token — auto-refreshes if expired.
 * Call this before every HubSpot API request.
 * @param {string} orgId
 * @returns {Promise<string>} valid access token
 */
const getValidAccessToken = async (orgId) => {
  const token = await getTokenRecord(orgId);
  const isExpired = new Date() >= new Date(token.expires_at);

  if (isExpired) {
    console.log(
      `[HubSpot] Token expired for organisation: ${orgId} — refreshing...`,
    );
    return await refreshAndPersistToken(orgId, token.refresh_token);
  }

  return token.access_token;
};

// ─────────────────────────────────────────────────────────────────
//  CORE FETCHER
//  Handles pagination, auth, and auto-refresh on 401.
// ─────────────────────────────────────────────────────────────────

/**
 * Fetch all pages of a HubSpot CRM object.
 * HubSpot paginates at 100 — loops until all records are fetched.
 * Retries once with a refreshed token on 401.
 *
 * @param {string} orgId
 * @param {string} objectType  - "deals" | "contacts" | "companies"
 * @param {object} params      - query params (properties, filterGroups etc.)
 * @param {boolean} retry      - internal flag to prevent infinite retry loop
 * @returns {Promise<Array>}   - flat array of all results
 */
const fetchAllPages = async (
  orgId,
  objectType,
  params = {},
  retry = true,
) => {
  const results = [];
  let after = undefined;

  try {
    do {
      const accessToken = await getValidAccessToken(orgId);

      const response = await axios.get(
        `https://api.hubapi.com/crm/v3/objects/${objectType}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { limit: 100, ...(after ? { after } : {}), ...params },
        },
      );

      results.push(...(response.data.results || []));
      after = response.data.paging?.next?.after;
    } while (after);

    return results;
  } catch (error) {
    const status = error.response?.status;

    // Token rejected mid-pagination — refresh and retry once
    if (status === 401 && retry) {
      console.log(
        `[HubSpot] 401 on ${objectType} — refreshing token for organisation: ${orgId}`,
      );
      const token = await getTokenRecord(orgId);
      await refreshAndPersistToken(orgId, token.refresh_token);
      return fetchAllPages(orgId, objectType, params, false);
    }

    // Rate limit — HubSpot allows 100 req/10s on free, 150/10s on paid
    if (status === 429) {
      const wait = parseInt(error.response.headers["retry-after"] || "10", 10);
      console.warn(`[HubSpot] Rate limited. Waiting ${wait}s...`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      return fetchAllPages(orgId, objectType, params, retry);
    }

    const message = error.response?.data?.message || error.message;
    throw new Error(
      `[HubSpot] ${objectType} fetch failed (${status}): ${message}`,
      { cause: error },
    );
  }
};

// ─────────────────────────────────────────────────────────────────
//  INDIVIDUAL KPI FETCHERS
//  Each maps to specific KPIs from the library.
//  All take orgId + date range, return plain objects.
// ─────────────────────────────────────────────────────────────────

/**
 * LEADS-1: Total leads (MQLs + SQLs) created in the period.
 * @param {string} orgId
 * @param {string} startDate - 'YYYY-MM-DD'
 * @param {string} endDate   - 'YYYY-MM-DD'
 * @returns {Promise<number>}
 */
const getLeadsCountService = async (orgId, { startDate, endDate }) => {
  const contacts = await fetchAllPages(orgId, "contacts", {
    properties: "lifecyclestage,createdate",
    filterGroups: JSON.stringify([
      {
        filters: [
          {
            propertyName: "lifecyclestage",
            operator: "IN",
            values: ["marketingqualifiedlead", "salesqualifiedlead"],
          },
          {
            propertyName: "createdate",
            operator: "GTE",
            value: new Date(startDate).getTime(),
          },
          {
            propertyName: "createdate",
            operator: "LTE",
            value: new Date(endDate).getTime(),
          },
        ],
      },
    ]),
  });

  return contacts.length;
};

/**
 * LEADS-2 to LEADS-5, PS-6: Pipeline activity metrics.
 *
 * LEADS-2: calls logged
 * LEADS-3: proposals sent (deals in proposal stages)
 * LEADS-4: deals won count
 * LEADS-5: conversion rate (won / proposals)
 * PS-6:    total open pipeline value (for coverage ratio)
 *
 * @param {string} orgId
 * @param {string} startDate
 * @param {string} endDate
 * @returns {Promise<object>}
 */
const getPipelineMetricsService = async (orgId, { startDate, endDate }) => {
  const deals = await fetchAllPages(orgId, "deals", {
    properties: "dealstage,amount,closedate,createdate,hs_activity_type",
  });

  // Filter to deals created in the period
  const periodDeals = deals.filter((d) => {
    const created = new Date(d.properties.createdate);
    return created >= new Date(startDate) && created <= new Date(endDate);
  });

  // LEADS-3: proposals — deals in mid-funnel stages
  // Note: verify these stage keys match your HubSpot pipeline
  // GET /crm/v3/pipelines/deals to see your exact stage IDs
  const proposals = periodDeals.filter((d) =>
    ["presentationscheduled", "decisionmakerboughtin", "contractsent"].includes(
      d.properties.dealstage,
    ),
  );

  // LEADS-4: deals won
  const dealsWon = periodDeals.filter(
    (d) => d.properties.dealstage === "closedwon",
  );

  // LEADS-5: conversion rate
  const conversionRate =
    proposals.length > 0
      ? parseFloat(((dealsWon.length / proposals.length) * 100).toFixed(2))
      : 0;

  // LEADS-2: calls — activity type CALL on deals
  const calls = periodDeals.filter(
    (d) => d.properties.hs_activity_type === "CALL",
  ).length;

  // PS-6: total open pipeline value (excludes closed lost)
  const totalPipelineValue = periodDeals
    .filter((d) => d.properties.dealstage !== "closedlost")
    .reduce((sum, d) => sum + parseFloat(d.properties.amount || "0"), 0);

  return {
    proposals: proposals.length,
    dealsWon: dealsWon.length,
    conversionRate,
    calls,
    totalPipelineValue,
  };
};

/**
 * PS-9: Recurring vs one-time revenue breakdown.
 * Requires deal_type or recurring_revenue_amount custom property in HubSpot.
 *
 * @param {string} orgId
 * @param {string} startDate
 * @param {string} endDate
 * @returns {Promise<object>}
 */
const getRevenueBreakdownService = async (orgId, { startDate, endDate }) => {
  const deals = await fetchAllPages(orgId, "deals", {
    properties: "dealstage,amount,deal_type,closedate,recurring_revenue_amount",
  });

  // Only closed-won deals in the period
  const periodWon = deals.filter((d) => {
    const closed = new Date(d.properties.closedate);
    return (
      d.properties.dealstage === "closedwon" &&
      closed >= new Date(startDate) &&
      closed <= new Date(endDate)
    );
  });

  const totalRevenue = periodWon.reduce(
    (sum, d) => sum + parseFloat(d.properties.amount || "0"),
    0,
  );

  const recurringRevenue = periodWon
    .filter(
      (d) =>
        d.properties.deal_type === "recurring" ||
        d.properties.recurring_revenue_amount,
    )
    .reduce(
      (sum, d) =>
        sum +
        parseFloat(
          d.properties.recurring_revenue_amount || d.properties.amount || "0",
        ),
      0,
    );

  const oneTimeRevenue = totalRevenue - recurringRevenue;
  const recurringPercent =
    totalRevenue > 0
      ? parseFloat(((recurringRevenue / totalRevenue) * 100).toFixed(2))
      : 0;

  return {
    recurringRevenue: parseFloat(recurringRevenue.toFixed(2)),
    oneTimeRevenue: parseFloat(oneTimeRevenue.toFixed(2)),
    recurringPercent,
  };
};

/**
 * PS-8, custom: Client concentration, deal velocity, retention rate.
 *
 * PS-8:         top 5 company revenue as % of total
 * dealVelocity: avg days from deal created → closed won
 * retentionRate: % of last-period companies that returned this period
 *
 * @param {string} orgId
 * @param {string} startDate
 * @param {string} endDate
 * @returns {Promise<object>}
 */
const getClientMetricsService = async (orgId, { startDate, endDate }) => {
  const deals = await fetchAllPages(orgId, "deals", {
    properties: "dealstage,amount,closedate,createdate",
    associations: "companies",
  });

  // Closed-won in current period
  const closedWon = deals.filter((d) => {
    const closed = new Date(d.properties.closedate);
    return (
      d.properties.dealstage === "closedwon" &&
      closed >= new Date(startDate) &&
      closed <= new Date(endDate)
    );
  });

  const totalWonValue = closedWon.reduce(
    (sum, d) => sum + parseFloat(d.properties.amount || "0"),
    0,
  );

  // PS-8: group revenue by company → find top 5
  const revenueByCompany = {};
  for (const deal of closedWon) {
    const companyId =
      deal.associations?.companies?.results?.[0]?.id || "unknown";
    revenueByCompany[companyId] =
      (revenueByCompany[companyId] || 0) +
      parseFloat(deal.properties.amount || "0");
  }

  const top5Revenue = Object.values(revenueByCompany)
    .sort((a, b) => b - a)
    .slice(0, 5)
    .reduce((sum, v) => sum + v, 0);

  const clientConcentration =
    totalWonValue > 0
      ? parseFloat(((top5Revenue / totalWonValue) * 100).toFixed(2))
      : 0;

  // Deal velocity: avg days create → close for won deals
  const velocities = closedWon
    .filter((d) => d.properties.createdate && d.properties.closedate)
    .map(
      (d) =>
        (new Date(d.properties.closedate) - new Date(d.properties.createdate)) /
        (1000 * 60 * 60 * 24),
    );

  const dealVelocity =
    velocities.length > 0
      ? parseFloat(
          (velocities.reduce((a, b) => a + b, 0) / velocities.length).toFixed(
            1,
          ),
        )
      : null;

  // Retention: companies that appeared in the previous equivalent period
  const prevStart = new Date(
    new Date(startDate).setMonth(new Date(startDate).getMonth() - 1),
  );
  const prevEnd = new Date(startDate);

  const prevWon = deals.filter((d) => {
    const closed = new Date(d.properties.closedate);
    return (
      d.properties.dealstage === "closedwon" &&
      closed >= prevStart &&
      closed < prevEnd
    );
  });

  const currentCompanyIds = new Set(
    closedWon
      .map((d) => d.associations?.companies?.results?.[0]?.id)
      .filter(Boolean),
  );
  const prevCompanyIds = new Set(
    prevWon
      .map((d) => d.associations?.companies?.results?.[0]?.id)
      .filter(Boolean),
  );

  const retained = [...prevCompanyIds].filter((id) =>
    currentCompanyIds.has(id),
  ).length;
  const retentionRate =
    prevCompanyIds.size > 0
      ? parseFloat(((retained / prevCompanyIds.size) * 100).toFixed(2))
      : null;

  return {
    clientConcentration,
    dealVelocity,
    retentionRate,
  };
};

// ─────────────────────────────────────────────────────────────────
//  COMBINED LEADS KPI SERVICE
//  This is what summaryEngine.controller.js imports.
// ─────────────────────────────────────────────────────────────────

/**
 * Fetch all Leads & Pipeline KPIs for an organisation and period.
 * Pure data — no req/res. Safe to call from anywhere.
 *
 * @param {string} orgId
 * @param {object} options - { startDate, endDate }
 * @returns {Promise<object>} all Leads KPIs
 */
const getLeadsKPIsService = async (orgId, { startDate, endDate } = {}) => {
  // Default to current month if no dates provided
  const now = new Date();
  const start =
    startDate ||
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end =
    endDate ||
    new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);

  // All four fetchers run in parallel
  const [leadsCount, pipeline, revenue, clients] = await Promise.all([
    getLeadsCountService(orgId, { startDate: start, endDate: end }),
    getPipelineMetricsService(orgId, { startDate: start, endDate: end }),
    getRevenueBreakdownService(orgId, { startDate: start, endDate: end }),
    getClientMetricsService(orgId, { startDate: start, endDate: end }),
  ]);

  return {
    // LEADS-1 to LEADS-5
    leads: leadsCount,
    calls: pipeline.calls,
    proposals: pipeline.proposals,
    dealsWon: pipeline.dealsWon,
    conversionRate: pipeline.conversionRate,

    // PS-6: pipeline coverage value (divide by revenue goal in summaryEngine)
    pipelineCoverage: pipeline.totalPipelineValue,

    // PS-9
    recurringRevenue: revenue.recurringRevenue,
    oneTimeRevenue: revenue.oneTimeRevenue,
    recurringPercent: revenue.recurringPercent,

    // PS-8 + custom
    clientConcentration: clients.clientConcentration,
    dealVelocity: clients.dealVelocity,
    retentionRate: clients.retentionRate,

    // Meta
    fetchedAt: new Date().toISOString(),
    period: { startDate: start, endDate: end },
  };
};

module.exports = {
  // Primary export — use this in summaryEngine
  getLeadsKPIsService,

  // Individual fetchers — export for unit testing or targeted use
  getLeadsCountService,
  getPipelineMetricsService,
  getRevenueBreakdownService,
  getClientMetricsService,

  // Auth helpers — export for use in controller OAuth flow
  getValidAccessToken,
  refreshAndPersistToken,
};
