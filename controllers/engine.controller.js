

const { getFinancialKPIsService } = require("../services/finance.service");
const { getLeadsKPIsService }     = require("../services/leads.service");
const { getLaborKPIsService }     = require("../services/labour.service");
const prisma                              = require("../lib/prisma");


/**
 * GET /api/summary/financial
 */
const getFinancialSummary = async (req, res) => {
  const user_id = req.session.user_id;
  if (!user_id) return res.status(401).json({ error: "Not authenticated" });

  const { startDate, endDate, asOfDate } = req.query;
  try {
    const financial = await getFinancialKPIsService(user_id, { startDate, endDate, asOfDate });
    return res.status(200).json({ financial });
  } catch (error) {
    console.error("[SummaryEngine] getFinancialSummary error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/summary/leads
 */
const getLeadsSummary = async (req, res) => {
  const user_id = req.session.user_id;
  if (!user_id) return res.status(401).json({ error: "Not authenticated" });

  const { startDate, endDate } = req.query;
  try {
    const leads = await getLeadsKPIsService(user_id, { startDate, endDate });
    return res.status(200).json({ leads });
  } catch (error) {
    console.error("[SummaryEngine] getLeadsSummary error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/summary/labor
 */
const getLaborSummary = async (req, res) => {
  const user_id = req.session.user_id;
  if (!user_id) return res.status(401).json({ error: "Not authenticated" });

  const { startDate, endDate } = req.query;
  try {
    const labor = await getLaborKPIsService(user_id, { startDate, endDate });
    return res.status(200).json({ labor });
  } catch (error) {
    console.error("[SummaryEngine] getLaborSummary error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/summary
 * Master dashboard — all integrations in parallel.
 * Each fails independently via Promise.allSettled.
 */
const getFullDashboardSummary = async (req, res) => {
  const user_id = req.session.user_id;
  if (!user_id) return res.status(401).json({ error: "Not authenticated" });

  const { startDate, endDate, asOfDate } = req.query;

  try {
    // Run financial and leads in parallel first
    const [financialResult, leadsResult] = await Promise.allSettled([
      getFinancialKPIsService(user_id, { startDate, endDate, asOfDate }),
      getLeadsKPIsService(user_id,     { startDate, endDate }),
    ]);

    // Pass QB values into labor for cross-source KPIs (LABOR-2, LABOR-7)
    // These are best-effort — if QB failed, labor still runs without them
    const financial        = financialResult.status === "fulfilled" ? financialResult.value : null;
    const qbLaborCost      = financial?.laborCost    ?? null;
    const qbTotalRevenue   = financial?.totalIncome  ?? null;

    const [laborResult] = await Promise.allSettled([
      getLaborKPIsService(user_id, { startDate, endDate, qbLaborCost, qbTotalRevenue }),
    ]);

    return res.status(200).json({
      financial: financial
        ?? { error: financialResult.reason?.message || "Failed to fetch financial data" },

      leads: leadsResult.status === "fulfilled"
        ? leadsResult.value
        : { error: leadsResult.reason?.message || "Failed to fetch leads data" },

      labor: laborResult.status === "fulfilled"
        ? laborResult.value
        : { error: laborResult.reason?.message || "Failed to fetch labor data" },

      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[SummaryEngine] getFullDashboardSummary error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/summary/scorecard
 * Aggregates 6 headline KPIs across ALL clients for Fintelligent's overview.
 *
 * Returned metrics:
 *   totalPipelineValue      — sum of all client pipeline values (HubSpot)
 *   pipelineCoverageRatio   — totalPipelineValue / totalRevenue (target: 2:1)
 *   totalRevenue            — sum of all client revenue (QuickBooks)
 *   ebitdaPct               — weighted avg EBITDA % across clients (QuickBooks)
 *   revenuePerHead          — totalRevenue / totalHeadcount (QB + labor)
 *   workingCapital          — sum of all client working capital in months (QuickBooks)
 *   billableUtilization     — weighted avg billable utilization % (ClickUp/Monday)
 *
 * Each client runs in parallel. Failures are skipped — partial results returned.
 */
const getScorecardSummary = async (req, res) => {
  if (!req.session.user_id) return res.status(401).json({ error: "Not authenticated" });

  const { startDate, endDate, asOfDate } = req.query;

  try {
    // Fetch all clients Fintelligent manages
    const clients = await prisma.client.findMany({
      select: { id: true, name: true },
    });

    if (!clients.length) {
      return res.status(200).json({
        scorecard: buildEmptyScorecard(),
        clientCount: 0,
        fetchedAt: new Date().toISOString(),
      });
    }

    // Run all three services for every client in parallel
    // Promise.allSettled means one client failing won't block others
    const clientResults = await Promise.allSettled(
      clients.map((client) => fetchClientScorecardData(client, { startDate, endDate, asOfDate }))
    );

    // Separate successful results from failures
    const successful = [];
    const failed     = [];

    clientResults.forEach((result, i) => {
      if (result.status === "fulfilled") {
        successful.push(result.value);
      } else {
        failed.push({ clientId: clients[i].id, name: clients[i].name, error: result.reason?.message });
        console.warn(`[Scorecard] Skipping client ${clients[i].name}: ${result.reason?.message}`);
      }
    });

    // Aggregate across all successful clients
    const scorecard = aggregateScorecardMetrics(successful);

    return res.status(200).json({
      scorecard,
      clientCount:      clients.length,
      successfulClients: successful.length,
      skippedClients:   failed.length > 0 ? failed : undefined,
      fetchedAt:        new Date().toISOString(),
    });

  } catch (error) {
    console.error("[SummaryEngine] getScorecardSummary error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

// How old a DB record can be before we re-fetch from the API (6 hours)
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const isFresh = (updatedAt) =>
  updatedAt && (Date.now() - new Date(updatedAt).getTime()) < CACHE_TTL_MS;

/**
 * Resolve the period start/end dates for DB lookups.
 * Defaults to the current calendar month if not provided.
 */
const resolvePeriod = (startDate, endDate) => {
  const now = new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate
    ? new Date(endDate)
    : new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start, end };
};

/**
 * Fetch scorecard data for a single client.
 * Strategy per KPI table:
 *   1. Check DB for a record matching clientId + period
 *   2. If found and fresh (<6h)  → return DB data immediately
 *   3. If found but stale (>6h)  → return DB data + trigger background API refresh
 *   4. If not found (cold)       → fetch from API, persist to DB, return result
 */
const fetchClientScorecardData = async (client, { startDate, endDate, asOfDate }) => {
  const { start, end } = resolvePeriod(startDate, endDate);
  const clientId       = client.id;

  // ── 1. Read all three KPI tables from DB in parallel ────────────
  const [dbFinance, dbLeads, dbLabor] = await Promise.all([
    prisma.financeKpi.findUnique({
      where: { clientId_periodStart_periodEnd: { clientId, periodStart: start, periodEnd: end } },
    }),
    prisma.leadsKpi.findUnique({
      where: { clientId_periodStart_periodEnd: { clientId, periodStart: start, periodEnd: end } },
    }),
    prisma.laborKpi.findUnique({
      where: { clientId_periodStart_periodEnd: { clientId, periodStart: start, periodEnd: end } },
    }),
  ]);

  // ── 2. Determine what needs a live fetch ────────────────────────
  const needsFinance = !dbFinance || !isFresh(dbFinance.updatedAt);
  const needsLeads   = !dbLeads   || !isFresh(dbLeads.updatedAt);
  const needsLabor   = !dbLabor   || !isFresh(dbLabor.updatedAt);

  // ── 3. Fetch stale/missing data from APIs ───────────────────────
  let financial = dbFinance;
  let leads     = dbLeads;
  let labor     = dbLabor;

  if (needsFinance || needsLeads) {
    const [financialResult, leadsResult] = await Promise.allSettled([
      needsFinance ? getFinancialKPIsService(clientId, { startDate, endDate, asOfDate }) : Promise.resolve(dbFinance),
      needsLeads   ? getLeadsKPIsService(clientId, { startDate, endDate })               : Promise.resolve(dbLeads),
    ]);

    if (financialResult.status === "fulfilled") {
      financial = financialResult.value;
      // Persist fresh finance data to DB
      if (needsFinance) {
        await prisma.financeKpi.upsert({
          where:  { clientId_periodStart_periodEnd: { clientId, periodStart: start, periodEnd: end } },
          create: { clientId, periodStart: start, periodEnd: end, ...mapFinanceToSchema(financial) },
          update: { ...mapFinanceToSchema(financial), isStale: false },
        }).catch((e) => console.warn(`[Scorecard] Failed to persist finance for ${client.name}:`, e.message));
      }
    }

    if (leadsResult.status === "fulfilled") {
      leads = leadsResult.value;
      // Persist fresh leads data to DB
      if (needsLeads) {
        await prisma.leadsKpi.upsert({
          where:  { clientId_periodStart_periodEnd: { clientId, periodStart: start, periodEnd: end } },
          create: { clientId, periodStart: start, periodEnd: end, ...mapLeadsToSchema(leads) },
          update: { ...mapLeadsToSchema(leads), isStale: false },
        }).catch((e) => console.warn(`[Scorecard] Failed to persist leads for ${client.name}:`, e.message));
      }
    }
  }

  if (needsLabor) {
    const [laborResult] = await Promise.allSettled([
      getLaborKPIsService(clientId, {
        startDate, endDate,
        qbTotalRevenue: financial?.totalIncome ?? null,
        qbLaborCost:    financial?.laborCost   ?? null,
      }),
    ]);

    if (laborResult.status === "fulfilled") {
      labor = laborResult.value;
      await prisma.laborKpi.upsert({
        where:  { clientId_periodStart_periodEnd: { clientId, periodStart: start, periodEnd: end } },
        create: { clientId, periodStart: start, periodEnd: end, ...mapLaborToSchema(labor) },
        update: { ...mapLaborToSchema(labor), isStale: false },
      }).catch((e) => console.warn(`[Scorecard] Failed to persist labor for ${client.name}:`, e.message));
    }
  }

  return { clientId, name: client.name, financial, leads, labor };
};

// ─────────────────────────────────────────────────────────────────
//  SCHEMA MAPPERS
//  Map API response shapes to Prisma model field names.
//  Only picks the fields the scorecard needs — extend as required.
// ─────────────────────────────────────────────────────────────────

const mapFinanceToSchema = (f) => ({
  totalIncome:     f?.totalIncome     ?? null,
  ebitda:          f?.ebitda          ?? null,
  workingCapital:  f?.workingCapital  ?? null,
  laborCost:       f?.laborCost       ?? null,
  netIncome:       f?.netIncome       ?? null,
  grossMargin:     f?.grossMargin     ?? null,
});

const mapLeadsToSchema = (l) => ({
  pipelineCoverage: l?.pipelineCoverage ?? null,
  leads:            l?.leads            ?? null,
  dealsWon:         l?.dealsWon         ?? null,
  conversionRate:   l?.conversionRate   ?? null,
  recurringPercent: l?.recurringPercent ?? null,
});

const mapLaborToSchema = (l) => ({
  directLaborHours:     l?.directLaborHours     ?? null,
  billableFTEs:         l?.billableFTEs          ?? null,
  nonBillableFTEs:      l?.nonBillableFTEs        ?? null,
  billableUtilization:  l?.billableUtilization   ?? null,
  laborSource:          l?.laborSource           ?? null,
  hasBillableColumn:    l?.hasBillableColumn     ?? false,
});

/**
 * Aggregate individual client data into the 6 scorecard metrics.
 */
const aggregateScorecardMetrics = (clientDataArray) => {
  let totalRevenue        = 0;
  let totalPipelineValue  = 0;
  let totalEbitda         = 0;
  let totalHeadcount      = 0;
  let totalWorkingCapital = 0;
  let totalBillableHours  = 0;
  let totalLaborHours     = 0;
  let clientsWithRevenue  = 0;

  for (const { financial, leads, labor } of clientDataArray) {
    // Revenue (QB)
    const revenue = financial?.totalIncome ?? 0;
    totalRevenue += revenue;
    if (revenue > 0) clientsWithRevenue++;

    // Pipeline (HubSpot)
    totalPipelineValue += leads?.pipelineCoverage ?? 0;

    // EBITDA — accumulate raw EBITDA value for weighted avg
    totalEbitda += financial?.ebitda ?? 0;

    // Headcount — billable + non-billable FTEs from labor
    const billable    = labor?.billableFTEs    ?? 0;
    const nonBillable = labor?.nonBillableFTEs ?? 0;
    totalHeadcount += billable + nonBillable;

    // Working capital — sum in dollars, convert to months at the end
    // workingCapital from QB is already in months — sum and average
    totalWorkingCapital += financial?.workingCapital ?? 0;

    // Billable utilization — accumulate hours for weighted avg
    // weighted by directLaborHours so larger clients count more
    const laborHours    = labor?.directLaborHours    ?? 0;
    const billableHours = laborHours * ((labor?.billableUtilization ?? 0) / 100);
    totalBillableHours += billableHours;
    totalLaborHours    += laborHours;
  }

  const count = clientDataArray.length || 1; // avoid divide-by-zero

  // EBITDA % — total EBITDA / total revenue
  const ebitdaPct = totalRevenue > 0
    ? parseFloat(((totalEbitda / totalRevenue) * 100).toFixed(1))
    : null;

  // Revenue per head — total revenue / total headcount
  const revenuePerHead = totalHeadcount > 0
    ? parseFloat((totalRevenue / totalHeadcount).toFixed(0))
    : null;

  // Pipeline coverage ratio — total pipeline / total revenue (target 2:1)
  const pipelineCoverageRatio = totalRevenue > 0
    ? parseFloat((totalPipelineValue / totalRevenue).toFixed(2))
    : null;

  // Working capital — average months across clients
  const workingCapital = clientsWithRevenue > 0
    ? parseFloat((totalWorkingCapital / clientsWithRevenue).toFixed(1))
    : null;

  // Billable utilization — weighted average across all labor hours
  const billableUtilization = totalLaborHours > 0
    ? parseFloat(((totalBillableHours / totalLaborHours) * 100).toFixed(1))
    : null;

  return {
    totalPipelineValue:   parseFloat(totalPipelineValue.toFixed(2)),
    pipelineCoverageRatio,                    // e.g. 2.1 = 2.1:1 (target ≥ 2)
    totalRevenue:         parseFloat(totalRevenue.toFixed(2)),
    ebitdaPct,                                // e.g. 20 = 20%
    revenuePerHead,                           // e.g. 200000 = $200,000
    workingCapital,                           // avg months across clients
    billableUtilization,                      // weighted avg % e.g. 78.5
  };
};

/**
 * Empty scorecard shape — returned when no clients exist yet.
 */
const buildEmptyScorecard = () => ({
  totalPipelineValue:   null,
  pipelineCoverageRatio: null,
  totalRevenue:         null,
  ebitdaPct:            null,
  revenuePerHead:       null,
  workingCapital:       null,
  billableUtilization:  null,
});

module.exports = {
  getFinancialSummary,
  getLeadsSummary,
  getLaborSummary,
  getFullDashboardSummary,
  getScorecardSummary,
};