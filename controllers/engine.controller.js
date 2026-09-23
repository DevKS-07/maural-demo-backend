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

    // Persist to DB for caching
    const { start, end } = resolvePeriod(startDate, endDate);
    if (labor?.laborSource) {
      prisma.laborKpi
        .upsert({
          where: {
            org_id_periodStart_periodEnd: {
              org_id,
              periodStart: start,
              periodEnd: end,
            },
          },
          create: {
            organisation: { connect: { org_id } },
            periodStart: start,
            periodEnd: end,
            ...mapLaborToSchema(labor),
          },
          update: { ...mapLaborToSchema(labor), isStale: false },
        })
        .catch((e) =>
          console.warn("[SummaryEngine] Failed to persist labor:", e.message),
        );
    }

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
    const qbLaborCost = null; // laborCost not in FinanceKpi schema yet
    const qbTotalRevenue = financial?.totalIncome ?? null;

    // Persist financial and leads to DB so the scorecard and chat have cached data
    const { start, end } = resolvePeriod(startDate, endDate);
    if (financialResult.status === "fulfilled" && financial) {
      prisma.financeKpi
        .upsert({
          where: {
            org_id_periodStart_periodEnd: { org_id, periodStart: start, periodEnd: end },
          },
          create: {
            organisation: { connect: { org_id } },
            periodStart: start,
            periodEnd: end,
            ...mapFinanceToSchema(financial),
          },
          update: { ...mapFinanceToSchema(financial), isStale: false },
        })
        .catch((e) =>
          console.warn("[SummaryEngine] Failed to persist finance:", e.message),
        );
    }
    if (leadsResult.status === "fulfilled" && leadsResult.value) {
      prisma.leadsKpi
        .upsert({
          where: {
            org_id_periodStart_periodEnd: { org_id, periodStart: start, periodEnd: end },
          },
          create: {
            organisation: { connect: { org_id } },
            periodStart: start,
            periodEnd: end,
            ...mapLeadsToSchema(leadsResult.value),
          },
          update: { ...mapLeadsToSchema(leadsResult.value), isStale: false },
        })
        .catch((e) =>
          console.warn("[SummaryEngine] Failed to persist leads:", e.message),
        );
    }

    const [laborResult] = await Promise.allSettled([
      getLaborKPIsService(org_id, {
        startDate,
        endDate,
        qbLaborCost,
        qbTotalRevenue,
      }),
    ]);

    // Persist labor data to DB for caching
    if (laborResult.status === "fulfilled" && laborResult.value?.laborSource) {
      const { start, end } = resolvePeriod(startDate, endDate);
      prisma.laborKpi
        .upsert({
          where: {
            org_id_periodStart_periodEnd: {
              org_id,
              periodStart: start,
              periodEnd: end,
            },
          },
          create: {
            organisation: { connect: { org_id } },
            periodStart: start,
            periodEnd: end,
            ...mapLaborToSchema(laborResult.value),
          },
          update: {
            ...mapLaborToSchema(laborResult.value),
            isStale: false,
          },
        })
        .catch((e) =>
          console.warn(
            "[SummaryEngine] Failed to persist labor:",
            e.message,
          ),
        );
    }

    // Fall back to the persisted KPI row for any section whose live call
    // failed. Without integration tokens all three fail, which is the normal
    // state of the demo.
    const [financialSection, leadsSection, laborSection] = await Promise.all([
      sectionOrFallback(financialResult, prisma.financeKpi, org_id, start, end, "financial"),
      sectionOrFallback(leadsResult, prisma.leadsKpi, org_id, start, end, "leads"),
      sectionOrFallback(laborResult, prisma.laborKpi, org_id, start, end, "labor"),
    ]);

    return res.status(200).json({
      financial: financialSection,
      leads: leadsSection,
      labor: laborSection,
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

// ---------------------------------------------------------------------------
// Persisted-KPI fallback
//
// getFullDashboardSummary always calls the live integration services. With no
// integration tokens connected all three reject, and the dashboard renders
// three error cards. Reading the persisted row instead makes seeded data the
// source of truth when the live call cannot succeed.
//
// Columns that describe the cache rather than the business.
// ---------------------------------------------------------------------------
const INTERNAL_KPI_FIELDS = new Set([
  "id",
  "org_id",
  "organisation",
  "createdAt",
  "updatedAt",
  "lastFetchedAt",
  "fetchSource",
  "isStale",
]);

const stripInternal = (row) =>
  Object.fromEntries(
    Object.entries(row).filter(([k]) => !INTERNAL_KPI_FIELDS.has(k)),
  );

/**
 * Read the persisted KPI row for an organisation.
 *
 * Tries the exact period first, then falls back to the most recent row.
 * The fallback is not optional: resolvePeriod() defaults to the current
 * *calendar month*, while KPI rows are seeded per *quarter*, so an
 * exact-match-only lookup finds nothing and silently leaves the error cards
 * in place — which looks identical to having no fallback at all.
 *
 * @param {object} delegate - prisma.financeKpi | prisma.leadsKpi | prisma.laborKpi
 */
const readPersistedKpi = async (delegate, org_id, start, end) => {
  try {
    const exact = await delegate.findUnique({
      where: {
        org_id_periodStart_periodEnd: { org_id, periodStart: start, periodEnd: end },
      },
    });
    if (exact) return stripInternal(exact);

    const latest = await delegate.findFirst({
      where: { org_id },
      orderBy: { periodStart: "desc" },
    });
    return latest ? stripInternal(latest) : null;
  } catch (e) {
    console.warn("[SummaryEngine] KPI fallback read failed:", e.message);
    return null;
  }
};

/**
 * Resolve one dashboard section: the live result when it succeeded, otherwise
 * the persisted row, otherwise the original error so a genuine failure is
 * still visible rather than being disguised as empty data.
 */
const sectionOrFallback = async (settled, delegate, org_id, start, end, label) => {
  if (settled.status === "fulfilled" && settled.value) return settled.value;

  const cached = await readPersistedKpi(delegate, org_id, start, end);
  if (cached) {
    console.log(`[SummaryEngine] ${label}: live call failed, served persisted row`);
    return { ...cached, fromCache: true };
  }

  return {
    error: settled.reason?.message || `Failed to fetch ${label} data`,
  };
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
              organisation: { connect: { org_id: orgId } },
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
              organisation: { connect: { org_id: orgId } },
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
        qbLaborCost: null,
      }),
    ]);

    if (laborResult.status === "fulfilled") {
      labor = laborResult.value;
      if (labor?.laborSource) {
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
              organisation: { connect: { org_id: orgId } },
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
  laborCostPerHour: l?.laborCostPerHour ?? null,
  revenuePerBillableFTE: l?.revenuePerBillableFTE ?? null,
  founderDependencyService: l?.founderDependencyService ?? null,
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
