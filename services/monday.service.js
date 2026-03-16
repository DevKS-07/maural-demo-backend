// monday.service.js
// Pure data/business logic — no req, no res.
// Handles auth, token refresh, and Labor KPI fetching.
//
// Board structure varies per client — this service detects
// the time tracking column at runtime rather than assuming
// a fixed column ID or name.

const axios  = require("axios");
const prisma = require("../lib/prisma");

const {
  MONDAY_CLIENT_ID,
  MONDAY_CLIENT_SECRET,
} = require("../config/env");

const CLIENT_ID     = MONDAY_CLIENT_ID;
const CLIENT_SECRET = MONDAY_CLIENT_SECRET;
const MONDAY_API    = "https://api.monday.com/v2";
const API_VERSION   = "2025-07";

// ─────────────────────────────────────────────────────────────────
//  AUTH HELPERS
// ─────────────────────────────────────────────────────────────────

const getTokenRecord = async (userId) => {
  const token = await prisma.mondayToken.findUnique({ where: { user_id: userId } });
  if (!token) throw new Error(`No Monday token found for user: ${userId}`);
  return token;
};

const refreshAndPersistToken = async (userId, refreshToken) => {
  const response = await axios.post(
    "https://auth.monday.com/oauth2/token",
    new URLSearchParams({
      grant_type:    "refresh_token",
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
    })
  );

  const { access_token, refresh_token, expires_in } = response.data;
  const expires_at = new Date(Date.now() + expires_in * 1000);

  await prisma.mondayToken.update({
    where: { user_id: userId },
    data:  { access_token, refresh_token, expires_at },
  });

  console.log(`[Monday] Tokens refreshed for user: ${userId}`);
  return access_token;
};

const getValidAccessToken = async (userId) => {
  const token     = await getTokenRecord(userId);
  const isExpired = new Date() >= new Date(token.expires_at);
  if (isExpired) {
    if (!token.refresh_token) {
      // Monday long-lived tokens don't refresh — user needs to reconnect
      throw new Error("Monday token expired and no refresh token available. Please reconnect Monday.");
    }
    console.log(`[Monday] Token expired for user: ${userId} — refreshing...`);
    return await refreshAndPersistToken(userId, token.refresh_token);
  }
  return token.access_token;
};

// ─────────────────────────────────────────────────────────────────
//  CORE GRAPHQL FETCHER
// ─────────────────────────────────────────────────────────────────

/**
 * Execute a Monday GraphQL query.
 * Auto-refreshes token on 401, backs off on 429.
 */
const mondayQuery = async (userId, query, variables = {}, retry = true) => {
  const accessToken = await getValidAccessToken(userId);

  try {
    const response = await axios.post(
      MONDAY_API,
      { query, variables },
      {
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "API-Version":  API_VERSION,
        },
      }
    );

    // Monday returns errors inside the response body, not as HTTP errors
    if (response.data.errors?.length) {
      const msg = response.data.errors.map((e) => e.message).join(", ");
      throw new Error(`[Monday] GraphQL error: ${msg}`);
    }

    return response.data.data;

  } catch (error) {
    const status  = error.response?.status;
    const message = error.response?.data?.error_message || error.message;

    if (status === 401 && retry) {
      console.log(`[Monday] 401 — refreshing token for user: ${userId}`);
      const token = await getTokenRecord(userId);
      await refreshAndPersistToken(userId, token.refresh_token);
      return mondayQuery(userId, query, variables, false);
    }

    if (status === 429) {
      const wait = parseInt(error.response?.headers?.["retry-after"] || "10", 10);
      console.warn(`[Monday] Rate limited. Waiting ${wait}s...`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      return mondayQuery(userId, query, variables, retry);
    }

    throw new Error(`[Monday] Query failed (${status}): ${message}`, { cause: error });
  }
};

// ─────────────────────────────────────────────────────────────────
//  COLUMN DETECTION
//  Board structure varies per client. We inspect columns at runtime
//  to find the time tracking column rather than hardcoding an ID.
// ─────────────────────────────────────────────────────────────────

// Column types Monday uses for time tracking
const TIME_TRACKING_TYPES = ["time_tracking", "duration"];

// Column types that could hold billable status (for future use)
const BILLABLE_COLUMN_TYPES = ["checkbox", "status", "dropdown", "boolean"];

/**
 * Fetch all columns for a board and identify which ones are relevant.
 * Returns { timeColumnId, billableColumnId } — either may be null.
 *
 * @param {string} userId
 * @param {string} boardId
 * @returns {Promise<{ timeColumnId: string|null, billableColumnId: string|null }>}
 */
const detectBoardColumns = async (userId, boardId) => {
  const data = await mondayQuery(userId, `
    query ($boardId: [ID!]) {
      boards(ids: $boardId) {
        columns {
          id
          title
          type
        }
      }
    }
  `, { boardId: [boardId] });

  const columns = data.boards?.[0]?.columns || [];

  // Find time tracking column — prefer type match, fallback to title keyword
  const timeCol = columns.find((c) => TIME_TRACKING_TYPES.includes(c.type))
    || columns.find((c) => /time|hours|duration/i.test(c.title));

  // Find billable column — not set up yet for most clients, so this will be null
  const billableCol = columns.find((c) =>
    BILLABLE_COLUMN_TYPES.includes(c.type) &&
    /billable|billing/i.test(c.title)
  );

  return {
    timeColumnId:     timeCol?.id     || null,
    billableColumnId: billableCol?.id || null,
  };
};

// ─────────────────────────────────────────────────────────────────
//  LABOR KPI FETCHERS
// ─────────────────────────────────────────────────────────────────

/**
 * Fetch all items with time tracking data from a board.
 * Paginates using Monday's cursor-based pagination.
 *
 * @param {string} userId
 * @param {string} boardId
 * @param {string} timeColumnId
 * @returns {Promise<Array>} flat array of items with column values
 */
const fetchBoardItems = async (userId, boardId, timeColumnId) => {
  const items  = [];
  let   cursor = null;

  do {
    const data = await mondayQuery(userId, `
      query ($boardId: [ID!], $columnIds: [String], $cursor: String) {
        boards(ids: $boardId) {
          items_page(limit: 100, cursor: $cursor) {
            cursor
            items {
              id
              name
              column_values(ids: $columnIds) {
                id
                type
                value
                text
              }
              subitems {
                id
                column_values(ids: $columnIds) {
                  id
                  type
                  value
                  text
                }
              }
            }
          }
        }
      }
    `, {
      boardId:   [boardId],
      columnIds: [timeColumnId],
      cursor,
    });

    const page = data.boards?.[0]?.items_page;
    items.push(...(page?.items || []));
    cursor = page?.cursor || null;

  } while (cursor);

  return items;
};

/**
 * Parse time tracking column values from board items.
 * Monday's time_tracking columns return duration in seconds.
 * Filters to entries within the requested date range.
 *
 * @param {Array}  items
 * @param {string} timeColumnId
 * @param {string} startDate
 * @param {string} endDate
 * @returns {{ totalHours: number, assigneeSet: Set<string> }}
 */
const parseItemHours = (items, timeColumnId, startDate, endDate) => {
  const start = new Date(startDate);
  const end   = new Date(endDate);

  let totalSeconds = 0;
  const assigneeSet = new Set();

  for (const item of items) {
    const allValues = [
      ...(item.column_values || []),
      ...(item.subitems || []).flatMap((s) => s.column_values || []),
    ];

    for (const col of allValues) {
      if (col.id !== timeColumnId || !col.value) continue;

      try {
        const parsed = JSON.parse(col.value);

        // time_tracking columns store an array of session objects
        // Each session: { started_at, ended_at, duration (seconds), started_user_id }
        if (Array.isArray(parsed)) {
          for (const session of parsed) {
            const sessionStart = new Date(session.started_at * 1000);
            const sessionEnd   = new Date(session.ended_at   * 1000);

            // Only count sessions within the requested period
            if (sessionEnd >= start && sessionStart <= end) {
              totalSeconds += parseInt(session.duration || 0);
              if (session.started_user_id) {
                assigneeSet.add(String(session.started_user_id));
              }
            }
          }
        }

        // duration columns store a plain number (seconds)
        if (typeof parsed === "number") {
          totalSeconds += parsed;
        }

      } catch {
        // Fallback: text field sometimes shows "Xh Ym" — parse it
        const match = col.text?.match(/(\d+)h\s*(\d*)m?/);
        if (match) {
          totalSeconds += parseInt(match[1] || 0) * 3600 + parseInt(match[2] || 0) * 60;
        }
      }
    }
  }

  return {
    totalHours:  parseFloat((totalSeconds / 3600).toFixed(2)),
    assigneeSet,
  };
};

// ─────────────────────────────────────────────────────────────────
//  COMBINED LABOR KPI SERVICE
// ─────────────────────────────────────────────────────────────────

/**
 * Fetch all Labor KPIs from Monday for a user and period.
 * Pure data — no req/res.
 *
 * Since billable columns aren't set up yet, billableFTEs = all tracked
 * assignees and billableUtilization = 100% until a billable column exists.
 *
 * LABOR-2 (laborCostPerHour) and LABOR-7 (revenuePerBillableFTE)
 * require QB data and are calculated in summaryEngine.
 *
 * @param {string} userId
 * @param {string} boardId     - the client's Monday board ID
 * @param {object} options     - { startDate, endDate, founderUserId? }
 * @returns {Promise<object>}
 */
const getLaborKPIsService = async (userId, boardId, { startDate, endDate, founderUserId = null } = {}) => {
  const now   = new Date();
  const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end   = endDate   || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  // Step 1: Detect which column holds time data for this board
  const { timeColumnId, billableColumnId } = await detectBoardColumns(userId, boardId);

  if (!timeColumnId) {
    console.warn(`[Monday] No time tracking column found on board ${boardId}`);
    return {
      directLaborHours:        null,
      billableFTEs:            null,
      nonBillableFTEs:         null,
      billableUtilization:     null,
      founderDependencyService: null,
      laborSource:             "monday",
      warning:                 "No time tracking column found on this board. Set up a Time Tracking column in Monday to enable labor KPIs.",
      fetchedAt:               new Date().toISOString(),
      period:                  { startDate: start, endDate: end },
    };
  }

  // Step 2: Fetch all items with time data
  const items = await fetchBoardItems(userId, boardId, timeColumnId);

  // Step 3: Parse hours from items
  const { totalHours, assigneeSet } = parseItemHours(items, timeColumnId, start, end);

  // Step 4: Billable split
  // Billable column not set up yet — treat all tracked time as billable
  // Once a billable column exists, detectBoardColumns will find it and
  // you can filter assigneeSet by billable items here
  const hasBillableColumn  = Boolean(billableColumnId);
  const billableFTEs        = assigneeSet.size;
  const nonBillableFTEs     = 0; // unknown until billable column exists
  const billableUtilization = hasBillableColumn ? null : 100; // can't calculate without split

  // Step 5: Founder dependency — tasks with founder / total tasks
  let founderDependencyService = null;
  if (founderUserId) {
    const founderItems = items.filter((item) => {
      const colValue = item.column_values?.find((c) => c.id === timeColumnId)?.value;
      if (!colValue) return false;
      try {
        const sessions = JSON.parse(colValue);
        return Array.isArray(sessions) &&
          sessions.some((s) => String(s.started_user_id) === String(founderUserId));
      } catch { return false; }
    });

    founderDependencyService = items.length > 0
      ? parseFloat(((founderItems.length / items.length) * 100).toFixed(2))
      : null;
  }

  return {
    directLaborHours:         totalHours,         // LABOR-3
    billableFTEs,                                  // LABOR-4
    nonBillableFTEs,                               // LABOR-5
    billableUtilization,                           // LABOR-6 (null until billable col exists)
    founderDependencyService,                      // PS-15

    laborSource:              "monday",
    hasBillableColumn,        // flag for frontend to show "set up billable column" prompt
    fetchedAt:                new Date().toISOString(),
    period:                   { startDate: start, endDate: end },
    // LABOR-2 and LABOR-7 calculated in summaryEngine:
    // laborCostPerHour      = QB labor cost     / directLaborHours
    // revenuePerBillableFTE = QB total revenue  / billableFTEs
  };
};

module.exports = {
  getLaborKPIsService,       // primary export for summaryEngine
  getValidAccessToken,
  refreshAndPersistToken,
  detectBoardColumns,        // export for testing and admin tooling
};