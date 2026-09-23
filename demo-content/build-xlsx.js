/**
 * Generates the demo tenant's financial workbook.
 *
 *   node demo-content/build-xlsx.js
 *
 * The figures are imported from prisma/demo-data.js — the same constants that
 * seed the KPI tables — so the spreadsheet a reviewer opens cannot disagree
 * with the dashboard it sits next to.
 *
 * Uses the `xlsx` package, which is already a dependency (ingestion reads
 * spreadsheets with it), so this adds nothing to package.json.
 *
 * Number formats are set per row, not per column range. Ingestion extracts a
 * spreadsheet as formatted text, so a percentage carrying an integer money
 * format is extracted as "37" rather than "37.1" — the stored value is right
 * but the text the chatbot reads is wrong.
 */

const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");

const {
  FISCAL_HISTORY,
  FY2026_QUARTERS,
  FINANCE_KPIS,
  LEADS_KPIS,
  LABOR_KPIS,
} = require("../prisma/demo-data");

const OUT_DIR = path.resolve(__dirname, "..", "uploads");
const OUT_FILE = path.join(OUT_DIR, "FY2026 Financial Summary and KPI Detail.xlsx");

const MONEY = "#,##0";
const DEC1 = "0.0";
const INT = "#,##0";

/** Q2 is seeded before Q3 in period order; label rows by their start date. */
const label = (row) =>
  row.periodStart.toISOString().slice(0, 7) === "2026-07"
    ? "Q3 2026 (to 22 Sep)"
    : "Q2 2026 (closed)";

const byPeriod = (rows) => [...rows].sort((a, b) => a.periodStart - b.periodStart);

/** A plain row with no numeric formatting. */
const text = (...cells) => ({ cells });

/**
 * Builds a sheet from rows that each declare their own number format, and
 * applies that format to every numeric cell in the row.
 */
function buildSheet(rows, widths) {
  const sheet = XLSX.utils.aoa_to_sheet(rows.map((r) => r.cells));

  rows.forEach((row, r) => {
    if (!row.fmt) return;
    for (let c = 1; c < row.cells.length; c++) {
      const ref = XLSX.utils.encode_cell({ c, r });
      if (sheet[ref] && sheet[ref].t === "n") sheet[ref].z = row.fmt;
    }
  });

  sheet["!cols"] = widths.map((w) => ({ wch: w }));
  return sheet;
}

/** Curries a row builder over a fixed set of periods. */
function lineFactory(periods) {
  return (name, key, fmt) => ({
    cells: [name, ...periods.map((p) => p[key])],
    fmt,
  });
}

// ── Sheet 1: Profit & Loss ───────────────────────────────────────────────
function profitAndLoss() {
  const periods = byPeriod(FINANCE_KPIS);
  const line = lineFactory(periods);

  return buildSheet(
    [
      text("Thornbury Energy Group — Profit & Loss"),
      text("All figures in USD. Q3 2026 is period-to-date at 22 September 2026."),
      text(),
      text("Measure", ...periods.map(label)),
      line("Total income", "totalIncome", MONEY),
      line("Cost of goods sold", "cogs", MONEY),
      line("Gross profit", "grossProfit", MONEY),
      line("Gross margin %", "grossMargin", DEC1),
      line("Operating expenses", "totalExpenses", MONEY),
      line("EBITDA", "ebitda", MONEY),
      line("EBITDA margin %", "ebitdaMargin", DEC1),
      line("Net income", "netIncome", MONEY),
      line("Net margin %", "netMargin", DEC1),
      text(),
      text("Variance vs plan (%)"),
      line("Revenue", "varianceRevenuePct", DEC1),
      line("Cost of goods sold", "varianceCOGSPct", DEC1),
      line("Gross profit", "varianceGrossProfitPct", DEC1),
      line("Operating expenses", "varianceOperatingExpensesPct", DEC1),
      line("EBITDA", "varianceEBITDAPct", DEC1),
      line("Net income", "varianceNetIncomePct", DEC1),
    ],
    [28, 22, 22],
  );
}

// ── Sheet 2: Balance sheet and cash ──────────────────────────────────────
function balanceSheet() {
  const periods = byPeriod(FINANCE_KPIS);
  const line = lineFactory(periods);

  return buildSheet(
    [
      text("Balance Sheet & Cash"),
      text(),
      text("Measure", ...periods.map(label)),
      line("Cash position", "cashPosition", MONEY),
      line("Accounts receivable", "accountsReceivable", MONEY),
      line("Total current assets", "totalCurrentAssets", MONEY),
      line("Total current liabilities", "totalCurrentLiabilities", MONEY),
      line("Working capital", "workingCapital", MONEY),
      text(),
      line("Monthly burn (gross)", "monthlyBurn", MONEY),
      line("Net burn rate (negative = generating cash)", "netBurnRate", MONEY),
      line("Runway (months)", "runwayMonths", DEC1),
      line("Days sales outstanding", "dso", DEC1),
      text(),
      line("Rule of 40", "ruleOf40", DEC1),
      line("Enterprise value", "enterpriseValue", MONEY),
      text(),
      text("Note: runway is cash divided by GROSS monthly burn, which treats every dollar of"),
      text("cost of goods sold as if no revenue were arriving to cover it. For a project business"),
      text("it is close to meaningless — net burn is the figure that shows cash generation."),
      text("Thornbury manages cash against DSO and working capital, not runway."),
    ],
    [40, 22, 22],
  );
}

// ── Sheet 3: Pipeline and clients ────────────────────────────────────────
function pipeline() {
  const periods = byPeriod(LEADS_KPIS);
  const line = lineFactory(periods);

  const segments = [
    ["retrofit_delivery", "Retrofit delivery"],
    ["commissioning", "Commissioning"],
    ["mbcx_recurring", "MBCx recurring"],
    ["energy_audits", "Energy audits"],
  ];

  return buildSheet(
    [
      text("Pipeline, Clients & Revenue Mix"),
      text(),
      text("Measure", ...periods.map(label)),
      line("Leads (MQL + SQL)", "leads", INT),
      line("Calls", "calls", INT),
      line("Proposals issued", "proposals", INT),
      line("Deals won", "dealsWon", INT),
      line("Conversion rate %", "conversionRate", DEC1),
      line("Pipeline coverage (x)", "pipelineCoverage", DEC1),
      line("Deal velocity (days)", "dealVelocity", DEC1),
      line("Forecast accuracy %", "forecastAccuracy", DEC1),
      line("Client retention %", "retentionRate", DEC1),
      text(),
      line("Recurring revenue", "recurringRevenue", MONEY),
      line("Recurring %", "recurringPercent", DEC1),
      line("One-time revenue", "oneTimeRevenue", MONEY),
      text(),
      line("Top-five client concentration %", "clientConcentration", DEC1),
      line("Revenue closed by founder %", "founderDependencySales", DEC1),
      text(),
      text("Revenue by segment", ...periods.map(label)),
      ...segments.map(([key, name]) => ({
        cells: [name, ...periods.map((p) => p.revenuePerSegment[key])],
        fmt: MONEY,
      })),
      text(),
      text("Recurring revenue above is period-scoped, not trailing-twelve-month: one-time revenue"),
      text("is its remainder against the same period's total income. The TTM recurring book is"),
      text("approximately $3.24M, about 12.4% of TTM revenue."),
    ],
    [34, 22, 22],
  );
}

// ── Sheet 4: Labour and utilization ──────────────────────────────────────
function labour() {
  const periods = byPeriod(LABOR_KPIS);
  const line = lineFactory(periods);

  return buildSheet(
    [
      text("Labour & Utilization"),
      text(),
      text("Measure", ...periods.map(label)),
      line("Billable FTEs", "billableFTEs", INT),
      line("Non-billable FTEs", "nonBillableFTEs", INT),
      {
        cells: ["Total headcount", ...periods.map((p) => p.billableFTEs + p.nonBillableFTEs)],
        fmt: INT,
      },
      line("Direct labour hours (billable delivered)", "directLaborHours", INT),
      line("Billable utilization %", "billableUtilization", DEC1),
      { cells: ["Utilization target %", ...periods.map(() => 72)], fmt: DEC1 },
      line("Labour cost per hour", "laborCostPerHour", DEC1),
      line("Revenue per billable FTE", "revenuePerBillableFTE", MONEY),
      line("Founder dependency, delivery %", "founderDependencyService", DEC1),
      text(),
      text("Q3 utilization of 66.4% is the worst in two years. The cause is recorded in the"),
      text("leadership meeting notes of 8 September 2026: the audit backfill rule approved at the"),
      text("Q2 review was triggered twice and executed zero times, because audit scoping required"),
      text("founder sign-off and the founder was committed to Cascadia rebid preparation."),
    ],
    [40, 22, 22],
  );
}

// ── Sheet 5: Fiscal year history ─────────────────────────────────────────
function history() {
  return buildSheet(
    [
      text("Fiscal Year History & FY2026 Plan"),
      text("Fiscal calendar equals calendar year."),
      text(),
      text("Fiscal year", "Revenue", "EBITDA", "EBITDA %"),
      ...FISCAL_HISTORY.map((f) => ({
        cells: [f.year, f.revenue, f.ebitda, f.ebitdaMargin],
        fmt: MONEY,
      })),
      text(),
      text("FY2026 by quarter", "Plan", "Actual / forecast", "Status", "Note"),
      ...FY2026_QUARTERS.map((q) => ({
        cells: [q.quarter, q.plan, q.actual, q.status, q.note],
        fmt: MONEY,
      })),
    ],
    [22, 18, 20, 22, 58],
  );
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, profitAndLoss(), "P&L");
  XLSX.utils.book_append_sheet(book, balanceSheet(), "Balance Sheet & Cash");
  XLSX.utils.book_append_sheet(book, pipeline(), "Pipeline & Clients");
  XLSX.utils.book_append_sheet(book, labour(), "Labour & Utilization");
  XLSX.utils.book_append_sheet(book, history(), "FY History");

  XLSX.writeFile(book, OUT_FILE);
  console.log(`[docs] Wrote ${OUT_FILE}`);
}

main();
