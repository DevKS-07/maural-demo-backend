// clickup.service.js
// Pure data/business logic — no req, no res.
// Handles auth, token refresh, and Labor KPI fetching.

const axios  = require("axios");
const prisma = require("../lib/prisma");

const {
  CLICKUP_CLIENT_ID,
  CLICKUP_CLIENT_SECRET,
} = require("../config/env");

const CLIENT_ID     = CLICKUP_CLIENT_ID;
const CLIENT_SECRET = CLICKUP_CLIENT_SECRET;

// ─────────────────────────────────────────────────────────────────
//  AUTH HELPERS
// ─────────────────────────────────────────────────────────────────

const getTokenRecord = async (orgId) => {
  const token = await prisma.clickupToken.findUnique({ where: { org_id: orgId } });
  if (!token) throw new Error(`No ClickUp token found for organisation: ${orgId}`);
  return token;
};

const refreshAndPersistToken = async (orgId, refreshToken) => {
  const response = await axios.post(
    "https://api.clickup.com/api/v2/oauth/token",
    new URLSearchParams({
      grant_type:    "refresh_token",
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
    })
  );

  const { access_token, refresh_token, expires_in } = response.data;
  const expires_at = new Date(Date.now() + expires_in * 1000);

  await prisma.clickupToken.update({
    where: { org_id: orgId },
    data:  { access_token, refresh_token, expires_at },
  });

  console.log(`[ClickUp] Tokens refreshed for organisation: ${orgId}`);
  return access_token;
};

/**
 * Returns a valid access token — auto-refreshes if expired.
 */
const getValidAccessToken = async (orgId) => {
  const token     = await getTokenRecord(orgId);
  const isExpired = new Date() >= new Date(token.expires_at);
  if (isExpired) {
    console.log(`[ClickUp] Token expired for organisation: ${orgId} — refreshing...`);
    return await refreshAndPersistToken(orgId, token.refresh_token);
  }
  return token.access_token;
};

// ─────────────────────────────────────────────────────────────────
//  CORE FETCHER
// ─────────────────────────────────────────────────────────────────

/**
 * Make an authenticated GET request to the ClickUp REST API.
 * Auto-refreshes token on 401, backs off on 429.
 */
const fetchClickUp = async (orgId, endpoint, params = {}, retry = true) => {
  const accessToken = await getValidAccessToken(orgId);

  try {
    const response = await axios.get(
      `https://api.clickup.com/api/v2${endpoint}`,
      {
        headers: { Authorization: accessToken },
        params,
      }
    );
    return response.data;

  } catch (error) {
    const status  = error.response?.status;
    const message = error.response?.data?.err || error.message;

    if (status === 401 && retry) {
      console.log(`[ClickUp] 401 — refreshing token for organisation: ${orgId}`);
      const token = await getTokenRecord(orgId);
      await refreshAndPersistToken(orgId, token.refresh_token);
      return fetchClickUp(orgId, endpoint, params, false);
    }

    if (status === 429) {
      const wait = parseInt(error.response.headers["retry-after"] || "10", 10);
      console.warn(`[ClickUp] Rate limited. Waiting ${wait}s...`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      return fetchClickUp(orgId, endpoint, params, retry);
    }

    throw new Error(`[ClickUp] ${endpoint} failed (${status}): ${message}`, { cause: error });
  }
};

// ─────────────────────────────────────────────────────────────────
//  WORKSPACE HELPERS
//  ClickUp requires teamId (workspaceId) for most calls.
//  We fetch it once from the token record or the API.
// ─────────────────────────────────────────────────────────────────

/**
 * Get the workspace/team ID for the user.
 * Uses externalId stored on ClientIntegration if available,
 * otherwise fetches from the ClickUp API.
 */
const getTeamId = async (orgId) => {
  const token = await getTokenRecord(orgId);

  // If teamId was stored during OAuth, use it directly
  if (token.team_id) return token.team_id;

  // Otherwise fetch from API and cache it
  const data   = await fetchClickUp(orgId, "/team");
  const teamId = data.teams?.[0]?.id;
  if (!teamId) throw new Error("[ClickUp] No workspace found for organisation");

  // Persist for future calls
  await prisma.clickupToken.update({
    where: { org_id: orgId },
    data:  { team_id: teamId },
  });

  return teamId;
};

/**
 * Get all members of the workspace.
 * NOTE: ClickUp requires iterating per user to fetch time entries —
 * we need this member list to build those calls.
 */
const getWorkspaceMembers = async (userId, teamId) => {
  const data = await fetchClickUp(userId, `/team/${teamId}`);
  return data.team?.members?.map((m) => m.user) || [];
};

// ─────────────────────────────────────────────────────────────────
//  LABOR KPI FETCHERS
// ─────────────────────────────────────────────────────────────────

/**
 * LABOR-3, LABOR-4, LABOR-5, LABOR-6:
 * Fetch all time entries for all workspace members in the period.
 *
 * ClickUp limitation: must fetch per user — no "all users" filter.
 * We batch these calls to stay within rate limits.
 *
 * Returns a flat array of all time entry objects.
 */
const getAllTimeEntries = async (userId, teamId, { startDate, endDate }) => {
  const members    = await getWorkspaceMembers(userId, teamId);
  const startMs    = new Date(startDate).getTime();
  const endMs      = new Date(endDate).getTime();

  // Batch member calls — ClickUp rate limit is 100 req/min on most plans
  // Process in groups of 10 to stay safe
  const BATCH_SIZE = 10;
  const allEntries = [];

  for (let i = 0; i < members.length; i += BATCH_SIZE) {
    const batch   = members.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((member) =>
        fetchClickUp(userId, `/team/${teamId}/time_entries`, {
          start_date: startMs,
          end_date:   endMs,
          assignee:   member.id,
        }).catch((err) => {
          console.warn(`[ClickUp] Failed to fetch entries for member ${member.id}: ${err.message}`);
          return { data: [] }; // don't let one member failure break the whole batch
        })
      )
    );

    for (const result of results) {
      allEntries.push(...(result.data || []));
    }

    // Small delay between batches to respect rate limits
    if (i + BATCH_SIZE < members.length) {
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  return allEntries;
};

/**
 * Parse raw time entries into Labor KPI values.
 * duration in ClickUp is in milliseconds.
 *
 * Maps to: LABOR-3, LABOR-4, LABOR-5, LABOR-6, PS-15
 */
const parseTimeEntries = (entries, founderUserId = null) => {
  const billableEntries    = entries.filter((e) => e.billable === true);
  const nonBillableEntries = entries.filter((e) => e.billable === false || e.billable == null);

  // LABOR-3: total direct labor hours (all entries)
  const totalMs       = entries.reduce((sum, e) => sum + parseInt(e.duration || 0), 0);
  const directLaborHours = parseFloat((totalMs / (1000 * 60 * 60)).toFixed(2));

  // LABOR-4: unique billable assignees = billable FTEs
  const billableUserIds = new Set(billableEntries.map((e) => e.user?.id).filter(Boolean));
  const billableFTEs    = billableUserIds.size;

  // LABOR-5: unique non-billable assignees
  const nonBillableUserIds = new Set(nonBillableEntries.map((e) => e.user?.id).filter(Boolean));
  const nonBillableFTEs    = nonBillableUserIds.size;

  // LABOR-6: billable utilization %
  const billableMs        = billableEntries.reduce((sum, e) => sum + parseInt(e.duration || 0), 0);
  const billableUtilization = totalMs > 0
    ? parseFloat(((billableMs / totalMs) * 100).toFixed(2))
    : 0;

  // PS-15: founder dependency — projects with founder billing / total projects
  let founderDependencyService = null;
  if (founderUserId) {
    const founderEntries  = entries.filter((e) => String(e.user?.id) === String(founderUserId));
    const totalTaskIds    = new Set(entries.map((e) => e.task?.id).filter(Boolean));
    const founderTaskIds  = new Set(founderEntries.map((e) => e.task?.id).filter(Boolean));
    founderDependencyService = totalTaskIds.size > 0
      ? parseFloat(((founderTaskIds.size / totalTaskIds.size) * 100).toFixed(2))
      : null;
  }

  return {
    directLaborHours,       // LABOR-3
    billableFTEs,           // LABOR-4
    nonBillableFTEs,        // LABOR-5
    billableUtilization,    // LABOR-6
    founderDependencyService, // PS-15
  };
};

// ─────────────────────────────────────────────────────────────────
//  COMBINED LABOR KPI SERVICE
// ─────────────────────────────────────────────────────────────────

/**
 * Fetch all Labor KPIs from ClickUp for a user and period.
 * Pure data — no req/res.
 *
 * LABOR-2 and LABOR-7 require QB data (labor cost, total revenue)
 * and are calculated in summaryEngine after combining both sources.
 *
 * @param {string} userId
 * @param {object} options - { startDate, endDate, founderUserId? }
 * @returns {Promise<object>}
 */
const getLaborKPIsService = async (userId, { startDate, endDate, founderUserId = null } = {}) => {
  const now   = new Date();
  const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end   = endDate   || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const teamId  = await getTeamId(userId);
  const entries = await getAllTimeEntries(userId, teamId, { startDate: start, endDate: end });
  const kpis    = parseTimeEntries(entries, founderUserId);

  return {
    ...kpis,
    laborSource: "clickup",
    fetchedAt:   new Date().toISOString(),
    period:      { startDate: start, endDate: end },
    // LABOR-2 and LABOR-7 are cross-source — calculated in summaryEngine:
    // laborCostPerHour    = QB labor cost    / directLaborHours
    // revenuePerBillableFTE = QB total revenue / billableFTEs
  };
};

// ─────────────────────────────────────────────────────────────────
//  WORKSPACE LISTING & AUTO-DETECTION
// ─────────────────────────────────────────────────────────────────

/**
 * List all ClickUp workspaces (teams) the authenticated user has access to.
 */
const listWorkspaces = async (orgId) => {
  const data = await fetchClickUp(orgId, "/team");
  return (data.teams || []).map((t) => ({ id: String(t.id), name: t.name }));
};

/**
 * Return the first workspace as the default.
 * Most ClickUp accounts have a single workspace.
 * Returns { workspaceId, workspaceName } or null.
 */
const detectDefaultWorkspace = async (orgId) => {
  const workspaces = await listWorkspaces(orgId);
  if (workspaces.length === 0) return null;
  return { workspaceId: workspaces[0].id, workspaceName: workspaces[0].name };
};

module.exports = {
  getLaborKPIsService,        // primary export for summaryEngine
  getValidAccessToken,
  refreshAndPersistToken,
  listWorkspaces,
  detectDefaultWorkspace,
  // Exposed for testing
  _helpers: { parseTimeEntries, getAllTimeEntries },
};