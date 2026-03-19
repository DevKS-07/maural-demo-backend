/**
 * Business Data Service
 *
 * Fetches the latest KPI snapshots (Financial, Leads, Labor) and VTO data
 * from the database and formats them as human-readable text blocks that can
 * be injected into the chatbot's system prompt alongside document chunks.
 *
 * Each function returns null if no data exists for the org (graceful
 * degradation — the chatbot simply won't have that context).
 */

const prisma = require("../lib/prisma");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a number as currency: $1,234.56 */
function fmtCurrency(val) {
  if (val == null) return "N/A";
  return `$${Number(val).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/** Format a number as percentage: 42.5% */
function fmtPct(val) {
  if (val == null) return "N/A";
  return `${Number(val).toFixed(1)}%`;
}

/** Format a number with one decimal: 9.4 */
function fmtNum(val) {
  if (val == null) return "N/A";
  return Number(val).toFixed(1);
}

/** Format a date range as "Jan 1, 2026 – Mar 1, 2026" */
function fmtPeriod(start, end) {
  const opts = { month: "short", day: "numeric", year: "numeric" };
  const s = new Date(start).toLocaleDateString("en-US", opts);
  const e = new Date(end).toLocaleDateString("en-US", opts);
  return `${s} – ${e}`;
}

/** Short period label for source citations: "Jan–Mar 2026" */
function shortPeriod(start, end) {
  const s = new Date(start).toLocaleDateString("en-US", { month: "short" });
  const e = new Date(end).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return `${s}–${e}`;
}

// Only include a line if the value is not null/undefined
function line(label, value) {
  if (value === "N/A") return null;
  return `${label}: ${value}`;
}

function filterLines(lines) {
  return lines.filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------
// Financial KPIs
// ---------------------------------------------------------------------------

async function getFinancialContext(orgId) {
  const kpi = await prisma.financeKpi.findFirst({
    where: { org_id: orgId },
    orderBy: { periodEnd: "desc" },
  });

  if (!kpi) return null;

  const period = fmtPeriod(kpi.periodStart, kpi.periodEnd);

  const text = filterLines([
    `=== FINANCIAL KPIs (Period: ${period}) ===`,
    line("Total Income", fmtCurrency(kpi.totalIncome)),
    line("Cost of Goods Sold (COGS)", fmtCurrency(kpi.cogs)),
    line("Gross Profit", kpi.grossProfit != null
      ? `${fmtCurrency(kpi.grossProfit)} (Gross Margin: ${fmtPct(kpi.grossMargin)})`
      : null),
    line("Total Expenses", fmtCurrency(kpi.totalExpenses)),
    line("Net Income", kpi.netIncome != null
      ? `${fmtCurrency(kpi.netIncome)} (Net Margin: ${fmtPct(kpi.netMargin)})`
      : null),
    line("EBITDA", kpi.ebitda != null
      ? `${fmtCurrency(kpi.ebitda)} (EBITDA Margin: ${fmtPct(kpi.ebitdaMargin)})`
      : null),
    "",
    line("Cash Position", fmtCurrency(kpi.cashPosition)),
    line("Accounts Receivable", fmtCurrency(kpi.accountsReceivable)),
    line("Working Capital", fmtCurrency(kpi.workingCapital)),
    line("Days Sales Outstanding (DSO)", kpi.dso != null ? `${fmtNum(kpi.dso)} days` : null),
    "",
    line("Monthly Burn Rate", fmtCurrency(kpi.monthlyBurn)),
    line("Cash Runway", kpi.runwayMonths != null ? `${fmtNum(kpi.runwayMonths)} months` : null),
    "",
    line("Rule of 40 Score", kpi.ruleOf40 != null ? fmtNum(kpi.ruleOf40) : null),
    line("Enterprise Value (est.)", fmtCurrency(kpi.enterpriseValue)),
    "",
    // Budget variance section (only if any variance data exists)
    ...(kpi.varianceRevenuePct != null || kpi.varianceNetIncomePct != null
      ? [
          "Budget vs Actuals Variance:",
          line("  Revenue Variance", fmtPct(kpi.varianceRevenuePct)),
          line("  COGS Variance", fmtPct(kpi.varianceCOGSPct)),
          line("  Gross Profit Variance", fmtPct(kpi.varianceGrossProfitPct)),
          line("  Operating Expenses Variance", fmtPct(kpi.varianceOperatingExpensesPct)),
          line("  Net Income Variance", fmtPct(kpi.varianceNetIncomePct)),
          line("  EBITDA Variance", fmtPct(kpi.varianceEBITDAPct)),
        ]
      : []),
  ]);

  return {
    text,
    source: {
      title: `Financial KPIs (${shortPeriod(kpi.periodStart, kpi.periodEnd)})`,
      type: "KPI Data",
      snippet: `Financial snapshot: Income ${fmtCurrency(kpi.totalIncome)}, Net ${fmtCurrency(kpi.netIncome)}, Cash ${fmtCurrency(kpi.cashPosition)}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Leads KPIs
// ---------------------------------------------------------------------------

async function getLeadsContext(orgId) {
  const kpi = await prisma.leadsKpi.findFirst({
    where: { org_id: orgId },
    orderBy: { periodEnd: "desc" },
  });

  if (!kpi) return null;

  const period = fmtPeriod(kpi.periodStart, kpi.periodEnd);

  // Format revenue per segment if available
  let segmentText = null;
  if (kpi.revenuePerSegment && typeof kpi.revenuePerSegment === "object") {
    const entries = Object.entries(kpi.revenuePerSegment);
    if (entries.length > 0) {
      segmentText = "Revenue by Segment: " +
        entries.map(([seg, val]) => `${seg}: ${fmtCurrency(val)}`).join(", ");
    }
  }

  const text = filterLines([
    `=== LEADS & SALES KPIs (Period: ${period}) ===`,
    "Pipeline Funnel:",
    line("  Leads (MQLs + SQLs)", kpi.leads),
    line("  Calls", kpi.calls),
    line("  Proposals", kpi.proposals),
    line("  Deals Won", kpi.dealsWon),
    line("  Conversion Rate (deals/proposals)", fmtPct(kpi.conversionRate)),
    "",
    line("Pipeline Coverage", kpi.pipelineCoverage != null ? `${fmtNum(kpi.pipelineCoverage)}x` : null),
    line("Deal Velocity", kpi.dealVelocity != null ? `${fmtNum(kpi.dealVelocity)} days avg` : null),
    "",
    line("Recurring Revenue", kpi.recurringRevenue != null
      ? `${fmtCurrency(kpi.recurringRevenue)} (${fmtPct(kpi.recurringPercent)} of total)`
      : null),
    line("One-Time Revenue", fmtCurrency(kpi.oneTimeRevenue)),
    segmentText,
    "",
    line("Client Concentration (top 5)", fmtPct(kpi.clientConcentration)),
    line("Founder Dependency (sales)", fmtPct(kpi.founderDependencySales)),
    line("Retention Rate", fmtPct(kpi.retentionRate)),
    line("Forecast Accuracy", fmtPct(kpi.forecastAccuracy)),
  ]);

  return {
    text,
    source: {
      title: `Leads KPIs (${shortPeriod(kpi.periodStart, kpi.periodEnd)})`,
      type: "KPI Data",
      snippet: `Sales pipeline: ${kpi.leads ?? "N/A"} leads, ${kpi.dealsWon ?? "N/A"} won, ${fmtPct(kpi.conversionRate)} conversion`,
    },
  };
}

// ---------------------------------------------------------------------------
// Labor KPIs
// ---------------------------------------------------------------------------

async function getLaborContext(orgId) {
  const kpi = await prisma.laborKpi.findFirst({
    where: { org_id: orgId },
    orderBy: { periodEnd: "desc" },
  });

  if (!kpi) return null;

  const period = fmtPeriod(kpi.periodStart, kpi.periodEnd);

  const text = filterLines([
    `=== LABOR KPIs (Period: ${period}, Source: ${kpi.laborSource}) ===`,
    line("Direct Labor Hours", kpi.directLaborHours != null ? fmtNum(kpi.directLaborHours) : null),
    line("Billable FTEs", kpi.billableFTEs),
    line("Non-Billable FTEs", kpi.nonBillableFTEs),
    line("Billable Utilization", fmtPct(kpi.billableUtilization)),
    "",
    line("Labor Cost per Hour", fmtCurrency(kpi.laborCostPerHour)),
    line("Revenue per Billable FTE", fmtCurrency(kpi.revenuePerBillableFTE)),
    line("Founder Dependency (service delivery)", fmtPct(kpi.founderDependencyService)),
  ]);

  return {
    text,
    source: {
      title: `Labor KPIs (${shortPeriod(kpi.periodStart, kpi.periodEnd)})`,
      type: "KPI Data",
      snippet: `Labor: ${kpi.billableFTEs ?? "N/A"} billable FTEs, ${fmtPct(kpi.billableUtilization)} utilization`,
    },
  };
}

// ---------------------------------------------------------------------------
// VTO (Vision/Traction Organizer)
// ---------------------------------------------------------------------------

async function getVTOContext(orgId) {
  const vto = await prisma.vTO.findUnique({
    where: { org_id: orgId },
  });

  if (!vto) return null;

  // Parse JSON arrays safely
  const coreValues = Array.isArray(vto.core_values) ? vto.core_values : [];
  const tenYearTargets = Array.isArray(vto.ten_year_targets) ? vto.ten_year_targets : [];

  const text = filterLines([
    `=== VTO — Vision/Traction Organizer (${vto.title}, ${vto.year}) ===`,
    "",
    coreValues.length > 0 ? `Core Values: ${coreValues.join(", ")}` : null,
    "",
    "Core Focus:",
    line("  Mission", vto.mission),
    line("  Vision", vto.vision),
    "",
    tenYearTargets.length > 0
      ? `10-Year Targets:\n${tenYearTargets.map((t) => `  - ${t}`).join("\n")}`
      : null,
    "",
    "Marketing Strategy:",
    line("  Target Market", vto.target_market),
    line("  Proven Process", vto.proven_process),
    line("  Differentiators", vto.differentiators),
    line("  Guarantee", vto.guarantee),
    "",
    "3-Year Picture:",
    line("  Future Date", vto.future_date),
    line("  Revenue Target", vto.revenue),
    line("  Profit Target", vto.profit),
    line("  Measurables", vto.measurables),
    line("  What It Looks Like", vto.look_like),
  ]);

  return {
    text,
    source: {
      title: `VTO — ${vto.title} (${vto.year})`,
      type: "VTO",
      snippet: `Vision/Traction Organizer: ${vto.mission || "No mission set"} | ${coreValues.length} core values`,
    },
  };
}

// ---------------------------------------------------------------------------
// Main entry point — fetch all business data for given org(s)
// ---------------------------------------------------------------------------

/**
 * Fetch and format all available business context (KPIs + VTO) for the
 * specified organisation(s).
 *
 * @param {string|string[]|"all"|null} orgIds
 * @returns {Promise<{ text: string, sources: Array<{title,type,snippet}> }>}
 */
async function getBusinessContext(orgIds) {
  // Normalise orgIds into an array (or null for "all")
  let orgIdList;
  if (!orgIds || orgIds === "all") {
    orgIdList = null;
  } else {
    orgIdList = Array.isArray(orgIds) ? orgIds : [orgIds];
  }

  // If "all" orgs, we don't inject business data — it would be too much
  // context across all orgs. Business data only makes sense when scoped.
  if (!orgIdList || orgIdList.length === 0) {
    return { text: "", sources: [] };
  }

  const allTexts = [];
  const allSources = [];

  // Fetch business data for each org in parallel
  await Promise.all(
    orgIdList.map(async (orgId) => {
      const [financial, leads, labor, vto] = await Promise.all([
        getFinancialContext(orgId).catch(() => null),
        getLeadsContext(orgId).catch(() => null),
        getLaborContext(orgId).catch(() => null),
        getVTOContext(orgId).catch(() => null),
      ]);

      for (const result of [financial, leads, labor, vto]) {
        if (result) {
          allTexts.push(result.text);
          allSources.push(result.source);
        }
      }
    }),
  );

  return {
    text: allTexts.join("\n\n"),
    sources: allSources,
  };
}

module.exports = { getBusinessContext };
