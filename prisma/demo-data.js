/**
 * Demo tenant data — the seeded half of `demo-content/COMPANY_BRIEF.md`.
 *
 * The brief is the source of truth. If a number changes, change it there
 * first, then here, then in any document that quotes it. A dashboard that
 * disagrees with the documents is the most likely thing a reviewer notices.
 *
 * Fictional throughout. No real client data appears anywhere in this demo.
 */

// ── Fixed ids ────────────────────────────────────────────────────────────
// Pinned so a reseed converges instead of creating duplicates, and so the
// storage bucket names never drift.
const PLATFORM_ORG_ID = "00000000-0000-4000-a000-000000000001";
const PLATFORM_BUCKET = "00000000-0000-4000-a000-000000000002";
const DEMO_ORG_ID = "00000000-0000-4000-a000-000000000003";
const DEMO_BUCKET = "00000000-0000-4000-a000-000000000004";

const PLATFORM_ORG = {
  org_id: PLATFORM_ORG_ID,
  org_name: "Maural Solutions",
  is_platform: true,
  storage_bucket: PLATFORM_BUCKET,
};

const DEMO_ORG = {
  org_id: DEMO_ORG_ID,
  org_name: "Thornbury Energy Group",
  is_platform: false,
  storage_bucket: DEMO_BUCKET,
  industry: "Commercial Building Energy Retrofit & Commissioning",
  founded: new Date("2015-03-02T00:00:00Z"),
  company_location: "Seattle, WA",
  laborSource: "monday",
  mondayBoardId: "demo-board-4417",
  // Integration flags stay false: the demo's connect flow is frontend-only
  // local state (Decision 3), so the DB must not claim a live connection.
  hubspot_connected: false,
  quickbooks_connected: false,
  monday_connected: false,
  clickup_connected: false,
};

/**
 * Personas. `clerk_id` values are part of the backend/frontend shared
 * contract and must match `DEMO_USERS` in middleware/demoAuth.middleware.js.
 * Super Admin and Admin sit in the platform org, mirroring how
 * `auth.controller.js:62` provisions admins; admins bypass the org check
 * anyway (`docs.controller.js:172`).
 *
 * `reports_to` is resolved after insert, since `user_id` autogenerates.
 */
const USERS = [
  {
    clerk_id: "demo_super_admin",
    first_name: "Avery",
    last_name: "Nakamura",
    email: "avery.nakamura@mauralsolutions.com",
    phone: "+1 206 555 0118",
    job_title: "Platform Administrator",
    status: "active",
    role_id: 1n,
    org_id: PLATFORM_ORG_ID,
    last_login: new Date("2026-09-21T16:42:00Z"),
    reports_to_clerk_id: null,
  },
  {
    clerk_id: "demo_admin",
    first_name: "Priya",
    last_name: "Raghunathan",
    email: "priya.raghunathan@mauralsolutions.com",
    phone: "+1 206 555 0173",
    job_title: "Customer Success Lead",
    status: "active",
    role_id: 2n,
    org_id: PLATFORM_ORG_ID,
    last_login: new Date("2026-09-22T09:05:00Z"),
    reports_to_clerk_id: "demo_super_admin",
  },
  {
    clerk_id: "demo_org_executive",
    first_name: "Dana",
    last_name: "Thornbury",
    email: "dana.thornbury@thornburyenergy.com",
    phone: "+1 206 555 0142",
    job_title: "Founder & CEO",
    status: "active",
    role_id: 3n,
    org_id: DEMO_ORG_ID,
    last_login: new Date("2026-09-22T07:51:00Z"),
    reports_to_clerk_id: null,
  },
  {
    clerk_id: "demo_org_staff",
    first_name: "Marcus",
    last_name: "Oyelaran",
    email: "marcus.oyelaran@thornburyenergy.com",
    phone: "+1 503 555 0164",
    job_title: "Senior Commissioning Engineer",
    status: "active",
    role_id: 4n,
    org_id: DEMO_ORG_ID,
    last_login: new Date("2026-09-22T08:30:00Z"),
    reports_to_clerk_id: "demo_org_executive",
  },
];

// ── Periods ──────────────────────────────────────────────────────────────
// Fiscal calendar = calendar year. Q3 2026 is the *current* period, carried
// period-to-date as of Sep 22 — which is what a live KPI cache would hold.
// Q2 2026 is the prior closed quarter, seeded so the dashboard can compare.
// Only the period bounds are shared. `asOfDate` is a FinanceKpi-only column —
// spreading it into the leads and labor rows is a validation error.
const Q3_2026 = {
  periodStart: new Date("2026-07-01T00:00:00Z"),
  periodEnd: new Date("2026-09-30T23:59:59Z"),
};

const Q2_2026 = {
  periodStart: new Date("2026-04-01T00:00:00Z"),
  periodEnd: new Date("2026-06-30T23:59:59Z"),
};

const Q3_AS_OF = new Date("2026-09-22T00:00:00Z");
const Q2_AS_OF = new Date("2026-06-30T00:00:00Z");

/**
 * Finance. Every field is populated, not just the five the live persist path
 * writes, so the dashboard has no empty cells.
 *
 * On `runwayMonths`: the schema defines it as cashPosition / monthlyBurn with
 * monthlyBurn gross (COGS + OpEx + distributions). For a cash-generating
 * project business that yields well under a month, which is a poor signal but
 * is what the field means. Seeded faithfully rather than flattered —
 * `netBurnRate` is the field that actually shows the company is near
 * breakeven on cash.
 */
const FINANCE_KPIS = [
  {
    ...Q3_2026,
    asOfDate: Q3_AS_OF,
    totalIncome: 5_980_000,
    cogs: 3_812_000,
    grossProfit: 2_168_000,
    grossMargin: 36.3,
    totalExpenses: 1_974_000,
    netIncome: 116_000,
    netMargin: 1.9,
    ebitda: 312_000,
    ebitdaMargin: 5.2,
    cashPosition: 1_840_000,
    accountsReceivable: 6_720_000,
    totalCurrentAssets: 9_410_000,
    totalCurrentLiabilities: 5_980_000,
    monthlyBurn: 2_181_000,
    netBurnRate: 14_000,
    runwayMonths: 0.84,
    workingCapital: 3_430_000,
    dso: 68,
    ruleOf40: 28.1,
    enterpriseValue: 13_650_000,
    varianceRevenuePct: -6.8,
    varianceCOGSPct: 2.1,
    varianceGrossProfitPct: -14.2,
    varianceOperatingExpensesPct: 1.4,
    varianceNetIncomePct: -61.3,
    varianceEBITDAPct: -44.6,
  },
  {
    ...Q2_2026,
    asOfDate: Q2_AS_OF,
    totalIncome: 7_620_000,
    cogs: 4_793_000,
    grossProfit: 2_827_000,
    grossMargin: 37.1,
    totalExpenses: 2_208_000,
    netIncome: 439_000,
    netMargin: 5.8,
    ebitda: 737_000,
    ebitdaMargin: 9.7,
    cashPosition: 2_140_000,
    accountsReceivable: 6_180_000,
    totalCurrentAssets: 9_080_000,
    totalCurrentLiabilities: 5_410_000,
    monthlyBurn: 2_419_000,
    netBurnRate: -121_000,
    runwayMonths: 0.88,
    workingCapital: 3_670_000,
    dso: 61,
    ruleOf40: 29.8,
    enterpriseValue: 14_200_000,
    varianceRevenuePct: -3.5,
    varianceCOGSPct: 0.8,
    varianceGrossProfitPct: -8.9,
    varianceOperatingExpensesPct: 1.1,
    varianceNetIncomePct: -24.6,
    varianceEBITDAPct: -18.4,
  },
];

/**
 * Leads. `recurringRevenue` here is period-scoped, not trailing-twelve-month:
 * it must reconcile with `totalIncome` for the same period, since
 * `oneTimeRevenue` is the remainder. The TTM recurring figure (~$3.24M) is a
 * narrative number for the documents, not this field.
 */
const LEADS_KPIS = [
  {
    ...Q3_2026,
    leads: 147,
    calls: 412,
    proposals: 34,
    dealsWon: 7,
    conversionRate: 20.6,
    pipelineCoverage: 1.72,
    recurringRevenue: 741_000,
    recurringPercent: 12.4,
    oneTimeRevenue: 5_239_000,
    clientConcentration: 58.2,
    founderDependencySales: 43.0,
    dealVelocity: 94,
    forecastAccuracy: 92.4,
    retentionRate: 88.0,
    customerEngagement: 71,
    revenuePerSegment: {
      retrofit_delivery: 3_635_000,
      commissioning: 1_126_000,
      mbcx_recurring: 741_000,
      energy_audits: 478_000,
    },
  },
  {
    ...Q2_2026,
    leads: 163,
    calls: 448,
    proposals: 39,
    dealsWon: 11,
    conversionRate: 28.2,
    pipelineCoverage: 1.94,
    recurringRevenue: 907_000,
    recurringPercent: 11.9,
    oneTimeRevenue: 6_713_000,
    clientConcentration: 56.4,
    founderDependencySales: 41.5,
    dealVelocity: 88,
    forecastAccuracy: 96.5,
    retentionRate: 88.0,
    customerEngagement: 74,
    revenuePerSegment: {
      retrofit_delivery: 4_690_000,
      commissioning: 1_448_000,
      mbcx_recurring: 907_000,
      energy_audits: 575_000,
    },
  },
];

/**
 * Labor. `directLaborHours` is billable hours actually delivered, which is
 * why it tracks utilization rather than headcount x calendar.
 */
const LABOR_KPIS = [
  {
    ...Q3_2026,
    laborSource: "monday",
    directLaborHours: 15_300,
    billableFTEs: 48,
    nonBillableFTEs: 20,
    billableUtilization: 66.4,
    laborCostPerHour: 64.5,
    revenuePerBillableFTE: 124_583,
    founderDependencyService: 18.0,
    hasBillableColumn: true,
  },
  {
    ...Q2_2026,
    laborSource: "monday",
    directLaborHours: 17_770,
    billableFTEs: 47,
    nonBillableFTEs: 20,
    billableUtilization: 71.2,
    laborCostPerHour: 63.8,
    revenuePerBillableFTE: 162_128,
    founderDependencyService: 17.2,
    hasBillableColumn: true,
  },
];

const VTO = {
  title: "Thornbury Energy Group — 2026 Vision/Traction Organizer",
  year: "2026",
  core_values: [
    "Measure it or it didn't happen",
    "Leave the building better than the drawings",
    "Say the hard number early",
    "Train your replacement",
  ],
  mission: "Make the buildings that already exist worth keeping.",
  vision:
    "The Pacific Northwest's default partner for proving building performance — not predicting it.",
  ten_year_targets: [
    "$100M revenue with 40% of it recurring",
    "Founder involved in under 5% of closed revenue",
    "Sellable without a key-person discount",
    "Measured savings verified on every project, every year",
  ],
  target_market:
    "Owner-occupied commercial and institutional buildings over 75,000 sq ft in Washington and Oregon — healthcare, higher education and light industrial — with an in-house facilities team and a board-level decarbonization commitment.",
  proven_process: "Baseline → Retrofit → Verify → Monitor",
  differentiators:
    "Measured-savings guarantee, not modeled estimates. Commissioning agents on staff rather than subcontracted. Twenty-four months of post-retrofit monitoring included in every project.",
  guarantee:
    "If measured savings fall short of the modeled figure in year one, we true up the difference or keep working the building until they don't.",
  future_date: "December 31, 2028",
  revenue: "$52M",
  profit: "$6.2M EBITDA (12%)",
  measurables:
    "Recurring revenue 28% of total; billable utilization 74%; top-five client concentration under 40%; founder-closed revenue under 15%; DSO under 45 days.",
  look_like:
    "Three offices — Seattle, Portland, and a new Spokane branch opened in 2027. A Monitoring-Based Commissioning book of business large enough that January starts with $14M already contracted. A sales team of four closing the majority of new work, with Dana in the room only for the largest accounts. Cascadia Health retained through a competitive rebid, but no longer large enough to be existential. Every building we have touched since 2024 still reporting verified savings on a dashboard the client can see without calling us.",
};

module.exports = {
  PLATFORM_ORG_ID,
  DEMO_ORG_ID,
  PLATFORM_ORG,
  DEMO_ORG,
  USERS,
  FINANCE_KPIS,
  LEADS_KPIS,
  LABOR_KPIS,
  VTO,
};
