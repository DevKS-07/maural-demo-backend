const { getFinancialKPIsService } = require("../services/finance.service");
const { getLeadsKPIsService } = require("../services/leads.service");
const { getLaborKPIsService } = require("../services/labour.service");
const prisma = require("../lib/prisma");

/**
 * GET /api/summary/financial/:orgId
 */
const getFinancialSummary = async (req, res) => {
  const { orgId: org_id } = req.params;
  if (!org_id) return res.status(400).json({ error: "Missing orgId parameter" });

  const { startDate, endDate, asOfDate } = req.query;
  try {
    const financial = await getFinancialKPIsService(org_id, {
      startDate,
      endDate,
      asOfDate,
    });
    return res.status(200).json({ financial });
  } catch (error) {
    console.error("[SummaryEngine] getFinancialSummary error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/summary/leads/:orgId
 */
const getLeadsSummary = async (req, res) => {
  const { orgId: org_id } = req.params;
  if (!org_id) return res.status(400).json({ error: "Missing orgId parameter" });

  const { startDate, endDate } = req.query;
  try {
    const leads = await getLeadsKPIsService(org_id, { startDate, endDate });
    return res.status(200).json({ leads });
  } catch (error) {
    console.error("[SummaryEngine] getLeadsSummary error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/summary/labor/:orgId
 */
const getLaborSummary = async (req, res) => {
  const { orgId: org_id } = req.params;
  if (!org_id) return res.status(400).json({ error: "Missing orgId parameter" });

  const { startDate, endDate } = req.query;
  try {
    const labor = await getLaborKPIsService(org_id, { startDate, endDate });
    return res.status(200).json({ labor });
  } catch (error) {
    console.error("[SummaryEngine] getLaborSummary error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/summary/summary/:orgId
 * Master dashboard — all integrations in parallel.
 * Each fails independently via Promise.allSettled.
 */
const getFullDashboardSummary = async (req, res) => {
  const { orgId: org_id } = req.params;
  if (!org_id) return res.status(400).json({ error: "Missing orgId parameter" });

  const { startDate, endDate, asOfDate } = req.query;

  try {
    // Run financial and leads in parallel first
    const [financialResult, leadsResult] = await Promise.allSettled([
      getFinancialKPIsService(org_id, { startDate, endDate, asOfDate }),
      getLeadsKPIsService(org_id, { startDate, endDate }),
    ]);

    // Pass QB values into labor for cross-source KPIs (LABOR-2, LABOR-7)
    // These are best-effort — if QB failed, labor still runs without them
    const financial =
      financialResult.status === "fulfilled" ? financialResult.value : null;
    const qbLaborCost = financial?.laborCost ?? null;
    const qbTotalRevenue = financial?.totalIncome ?? null;

    const [laborResult] = await Promise.allSettled([
      getLaborKPIsService(org_id, {
        startDate,
        endDate,
        qbLaborCost,
        qbTotalRevenue,
      }),
    ]);

    return res.status(200).json({
      financial: financial ?? {
        error:
          financialResult.reason?.message || "Failed to fetch financial data",
      },

      leads:
        leadsResult.status === "fulfilled"
          ? leadsResult.value
          : {
              error:
                leadsResult.reason?.message || "Failed to fetch leads data",
            },

      labor:
        laborResult.status === "fulfilled"
          ? laborResult.value
          : {
              error:
                laborResult.reason?.message || "Failed to fetch labor data",
            },

      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "[SummaryEngine] getFullDashboardSummary error:",
      error.message,
    );
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/summary/scorecard
 * Returns a scorecard entry for each organisation — DB first, API fallback if stale/missing.
 *
 * Response:
 * {
 *   orgs: [
 *     {
 *       org_id, name,
 *       score: { totalPipelineValue, pipelineCoverageRatio, totalRevenue,
 *                ebitdaPct, revenuePerHead, workingCapital, billableUtilization }
 *     }
 *   ]
 * }
 */
const getScorecardSummary = async (req, res) => {
  const { startDate, endDate, asOfDate } = req.query;

  try {
    const orgs = await prisma.organisation.findMany({
      select: { org_id: true, org_name: true },
    });

    if (!orgs.length) {
      return res
        .status(200)
        .json({ orgs: [], fetchedAt: new Date().toISOString() });
    }

    const results = await Promise.allSettled(
      orgs.map((org) =>
        fetchOrgScorecardData(org, { startDate, endDate, asOfDate }),
      ),
    );

    const orgScores = results.map((result, i) => {
      if (result.status === "fulfilled") {
        const { org_id, name, financial, leads, labor } = result.value;
        return {
          org_id: org_id,
          name,
          score: buildOrgScore({ financial, leads, labor }),
        };
      }
      console.warn(
        `[Scorecard] Failed for ${orgs[i].org_name}: ${result.reason?.message}`,
      );
      return {
        org_id: orgs[i].org_id,
        name: orgs[i].org_name,
        score: buildEmptyScorecard(),
        error: result.reason?.message,
      };
    });

    return res
      .status(200)
      .json({ orgs: orgScores, fetchedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[SummaryEngine] getScorecardSummary error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

// How old a DB record can be before we re-fetch from the API (6 hours)
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const isFresh = (updatedAt) =>
  updatedAt && Date.now() - new Date(updatedAt).getTime() < CACHE_TTL_MS;

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
 * Fetch scorecard data for a single organisation.
 * Strategy per KPI table:
 *   1. Check DB for a record matching org_id + period
 *   2. If found and fresh (<6h)  → return DB data immediately
 *   3. If found but stale (>6h)  → return DB data + trigger background API refresh
 *   4. If not found (cold)       → fetch from API, persist to DB, return result
 */
const fetchOrgScorecardData = async (
  org,
  { startDate, endDate, asOfDate },
) => {
  const { start, end } = resolvePeriod(startDate, endDate);
  const orgId = org.org_id;

  // ── 1. Read all three KPI tables from DB in parallel ────────────
  const [dbFinance, dbLeads, dbLabor] = await Promise.all([
    prisma.financeKpi.findUnique({
      where: {
        org_id_periodStart_periodEnd: {
          org_id: orgId,
          periodStart: start,
          periodEnd: end,
        },
      },
    }),
    prisma.leadsKpi.findUnique({
      where: {
        org_id_periodStart_periodEnd: {
          org_id: orgId,
          periodStart: start,
          periodEnd: end,
        },
      },
    }),
    prisma.laborKpi.findUnique({
      where: {
        org_id_periodStart_periodEnd: {
          org_id: orgId,
          periodStart: start,
          periodEnd: end,
        },
      },
    }),
  ]);

  // ── 2. Determine what needs a live fetch ────────────────────────
  const needsFinance = !dbFinance || !isFresh(dbFinance.updatedAt);
  const needsLeads = !dbLeads || !isFresh(dbLeads.updatedAt);
  const needsLabor = !dbLabor || !isFresh(dbLabor.updatedAt);

  // ── 3. Fetch stale/missing data from APIs ───────────────────────
  let financial = dbFinance;
  let leads = dbLeads;
  let labor = dbLabor;

  if (needsFinance || needsLeads) {
    const [financialResult, leadsResult] = await Promise.allSettled([
      needsFinance
        ? getFinancialKPIsService(orgId, { startDate, endDate, asOfDate })
        : Promise.resolve(dbFinance),
      needsLeads
        ? getLeadsKPIsService(orgId, { startDate, endDate })
        : Promise.resolve(dbLeads),
    ]);

    if (financialResult.status === "fulfilled") {
      financial = financialResult.value;
      // Persist fresh finance data to DB
      if (needsFinance) {
        await prisma.financeKpi
          .upsert({
            where: {
              org_id_periodStart_periodEnd: {
                org_id: orgId,
                periodStart: start,
                periodEnd: end,
              },
            },
            create: {
              org_id: orgId,
              periodStart: start,
              periodEnd: end,
              ...mapFinanceToSchema(financial),
            },
            update: { ...mapFinanceToSchema(financial), isStale: false },
          })
          .catch((e) =>
            console.warn(
              `[Scorecard] Failed to persist finance for ${org.org_name}:`,
              e.message,
            ),
          );
      }
    }

    if (leadsResult.status === "fulfilled") {
      leads = leadsResult.value;
      // Persist fresh leads data to DB
      if (needsLeads) {
        await prisma.leadsKpi
          .upsert({
            where: {
              org_id_periodStart_periodEnd: {
                org_id: orgId,
                periodStart: start,
                periodEnd: end,
              },
            },
            create: {
              org_id: orgId,
              periodStart: start,
              periodEnd: end,
              ...mapLeadsToSchema(leads),
            },
            update: { ...mapLeadsToSchema(leads), isStale: false },
          })
          .catch((e) =>
            console.warn(
              `[Scorecard] Failed to persist leads for ${org.org_name}:`,
              e.message,
            ),
          );
      }
    }
  }

  if (needsLabor) {
    const [laborResult] = await Promise.allSettled([
      getLaborKPIsService(orgId, {
        startDate,
        endDate,
        qbTotalRevenue: financial?.totalIncome ?? null,
        qbLaborCost: financial?.laborCost ?? null,
      }),
    ]);

    if (laborResult.status === "fulfilled") {
      labor = laborResult.value;
      await prisma.laborKpi
        .upsert({
          where: {
            org_id_periodStart_periodEnd: {
              org_id: orgId,
              periodStart: start,
              periodEnd: end,
            },
          },
          create: {
            org_id: orgId,
            periodStart: start,
            periodEnd: end,
            ...mapLaborToSchema(labor),
          },
          update: { ...mapLaborToSchema(labor), isStale: false },
        })
        .catch((e) =>
          console.warn(
            `[Scorecard] Failed to persist labor for ${org.org_name}:`,
            e.message,
          ),
        );
    }
  }

  return { org_id: orgId, name: org.org_name, financial, leads, labor };
};

// ─────────────────────────────────────────────────────────────────
//  SCHEMA MAPPERS
//  Map API response shapes to Prisma model field names.
//  Only picks the fields the scorecard needs — extend as required.
// ─────────────────────────────────────────────────────────────────

const mapFinanceToSchema = (f) => ({
  totalIncome: f?.totalIncome ?? null,
  ebitda: f?.ebitda ?? null,
  workingCapital: f?.workingCapital ?? null,
  laborCost: f?.laborCost ?? null,
  netIncome: f?.netIncome ?? null,
  grossMargin: f?.grossMargin ?? null,
});

const mapLeadsToSchema = (l) => ({
  pipelineCoverage: l?.pipelineCoverage ?? null,
  leads: l?.leads ?? null,
  dealsWon: l?.dealsWon ?? null,
  conversionRate: l?.conversionRate ?? null,
  recurringPercent: l?.recurringPercent ?? null,
});

const mapLaborToSchema = (l) => ({
  directLaborHours: l?.directLaborHours ?? null,
  billableFTEs: l?.billableFTEs ?? null,
  nonBillableFTEs: l?.nonBillableFTEs ?? null,
  billableUtilization: l?.billableUtilization ?? null,
  laborSource: l?.laborSource ?? null,
  hasBillableColumn: l?.hasBillableColumn ?? false,
});

/**
 * Build the scorecard score object for a single organisation.
 */
const buildOrgScore = ({ financial, leads, labor }) => {
  const totalRevenue = financial?.totalIncome ?? null;
  const netRevenue = financial?.netIncome ?? null;
  const ebitda = financial?.ebitda ?? null;
  const totalPipelineValue = leads?.pipelineCoverage ?? null;
  const headcount =
    (labor?.billableFTEs ?? 0) + (labor?.nonBillableFTEs ?? 0) || null;

  // EBITDA % = EBITDA / net revenue
  const ebitdaPct =
    ebitda !== null && netRevenue
      ? parseFloat(((ebitda / netRevenue) * 100).toFixed(1))
      : null;

  // Revenue per head = total revenue / total headcount
  const revenuePerHead =
    totalRevenue && headcount
      ? parseFloat((totalRevenue / headcount).toFixed(0))
      : null;

  // Pipeline coverage ratio = pipeline / revenue (target >= 2)
  const pipelineCoverageRatio =
    totalPipelineValue !== null && totalRevenue
      ? parseFloat((totalPipelineValue / totalRevenue).toFixed(2))
      : null;

  return {
    totalPipelineValue:
      totalPipelineValue !== null
        ? parseFloat(totalPipelineValue.toFixed(2))
        : null,
    pipelineCoverageRatio,
    totalRevenue:
      totalRevenue !== null ? parseFloat(totalRevenue.toFixed(2)) : null,
    netRevenue: netRevenue !== null ? parseFloat(netRevenue.toFixed(2)) : null,
    ebitda: ebitda !== null ? parseFloat(ebitda.toFixed(2)) : null,
    ebitdaPct,
    revenuePerHead,
    headcount,
    workingCapital: financial?.workingCapital ?? null,
    billableUtilization: labor?.billableUtilization ?? null,
  };
};

/**
 * Empty scorecard shape — returned when an organisation has no data yet.
 */
const buildEmptyScorecard = () => ({
  totalPipelineValue: null,
  pipelineCoverageRatio: null,
  totalRevenue: null,
  netRevenue: null,
  ebitda: null,
  ebitdaPct: null,
  revenuePerHead: null,
  headcount: null,
  workingCapital: null,
  billableUtilization: null,
});

module.exports = {
  getFinancialSummary,
  getLeadsSummary,
  getLaborSummary,
  getFullDashboardSummary,
  getScorecardSummary,
};
