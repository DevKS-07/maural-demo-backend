# Demo tenant — company brief

**This file is the single source of truth for all demo content.** Every seeded KPI, the VTO, and
every uploaded document must agree with the numbers below. If a number needs to change, change it
here first, then propagate. Inconsistency between the dashboard and the documents is the most
likely thing a sharp reviewer notices.

Fictional. No resemblance to a real company is intended, and no real client data appears anywhere
in this demo.

---

## The platform vs. the tenant

| | Organisation | Role in the demo |
| --- | --- | --- |
| Platform org | **Maural Solutions** | The vendor — owns the product. `is_platform: true` |
| Demo tenant | **Thornbury Energy Group** | The customer whose data fills the app |

---

## Thornbury Energy Group

**Commercial building energy retrofit and commissioning.** Founded 2015 by Dana Thornbury, still
founder-led and majority founder-owned. Headquarters in Seattle, WA; a second office opened in
Portland, OR in 2023. Runs on EOS — hence the VTO.

Thornbury makes existing commercial buildings use less energy: it audits a building, engineers and
delivers the retrofit, commissions the result, and verifies the savings actually showed up. Its
clients are healthcare systems, universities and light-industrial owners with buildings over
75,000 sq ft, in-house facilities teams, and a board-level decarbonization commitment.

**Scale:** 68 employees — 48 billable (engineers, commissioning agents, field technicians) and 20
non-billable (project management, sales, finance, leadership).

**Revenue shape:** project-based and lumpy. Roughly 88% of revenue is one-time retrofit and
commissioning work that restarts from zero every January. The remaining 12% is recurring
Monitoring-Based Commissioning (MBCx) — annual contracts to keep tuning a building after the
retrofit lands. **The transition from the first to the second is the company's whole strategy**,
and it is the thesis of the strategic plan document.

| Fiscal year (= calendar year) | Revenue | EBITDA | EBITDA % |
| --- | --- | --- | --- |
| FY2023 actual | $17.2M | $0.9M | 5.2% |
| FY2024 actual | $21.1M | $1.4M | 6.6% |
| FY2025 actual | $24.8M | $1.8M | 7.3% |
| FY2026 plan | $31.5M | $2.9M | 9.2% |
| FY2026 current forecast | $29.8M | $2.3M | 7.7% |

Thornbury is behind plan. That gap is the tension the documents and the dashboard both explain.

### Why Thornbury bought Maural

In-fiction rationale, worth one line in the documents: fifteen years of building documentation —
baselines, sequences of operation, commissioning reports, savings models — lives in individual
engineers' folders. When an engineer leaves, the building's history leaves with them. Thornbury
has 14% annual attrition and is trying to sell a business whose value is partly that institutional
knowledge. A knowledge base with retrieval over it is the fix.

---

## The five problems

Each maps to a KPI on the dashboard, so the chatbot can connect a number to a narrative.

1. **Billable utilization is 66.4% against a 72% target.** ~5.6 points of 48 billable FTEs is
   roughly $1.6M of unbilled annual capacity. Cause per the Q2 review: two large retrofits slipped
   their construction windows, and bench time was not backfilled with audit work. → `LABOR-6`
2. **Client concentration: top five clients are 58.2% of revenue.** Cascadia Health System alone
   is 19.4%, and its master agreement goes out to rebid in Q1 2027. → `PS-8`
3. **Founder dependency: Dana Thornbury personally closes 43% of revenue.** The single biggest
   drag on enterprise value, and the reason the 10-year target is written in terms of owner
   independence rather than revenue alone. → `PS-14`
4. **Only 12.4% of revenue recurs.** Every January the company starts at zero. → `PS-9`
5. **Cash conversion: DSO is 68 days against a 45-day target**, with $1.9M of AR past 90 days.
   Milestone billing lags construction progress. → `PS-5`

---

## Seeded figures

Fiscal calendar = calendar year. **Current period = Q3 2026 (Jul 1 – Sep 30), figures as of
Sep 22, 2026** — period-to-date, which is what a live KPI cache would hold. Q2 2026 is seeded as
the prior closed period so the dashboard has a comparison.

### Finance — Q3 2026 to date

| Field | Value |
| --- | --- |
| `totalIncome` | $5,980,000 |
| `cogs` | $3,812,000 |
| `grossProfit` | $2,168,000 |
| `grossMargin` | 36.3% |
| `totalExpenses` | $1,974,000 |
| `ebitda` | $312,000 |
| `ebitdaMargin` | 5.2% |
| `netIncome` | $116,000 |
| `netMargin` | 1.9% |
| `cashPosition` | $1,840,000 |
| `accountsReceivable` | $6,720,000 |
| `totalCurrentAssets` | $9,410,000 |
| `totalCurrentLiabilities` | $5,980,000 |
| `workingCapital` | $3,430,000 |
| `dso` | 68 days |
| `ruleOf40` | 28.1 |
| `enterpriseValue` | $13,650,000 |

Variance vs. Q3 plan: revenue −6.8%, COGS +2.1%, gross profit −14.2%, OpEx +1.4%, EBITDA −44.6%,
net income −61.3%.

### Leads — Q3 2026 to date

`leads` 147 · `calls` 412 · `proposals` 34 · `dealsWon` 7 · `conversionRate` 20.6% ·
`pipelineCoverage` 1.72 · `recurringRevenue` $3,240,000 · `recurringPercent` 12.4% ·
`clientConcentration` 58.2% · `founderDependencySales` 43.0% · `dealVelocity` 94 days ·
`forecastAccuracy` 92.4% · `retentionRate` 88.0%

Segment split: retrofit delivery 61%, commissioning 19%, MBCx recurring 12%, energy audits 8%.

### Labor — Q3 2026 to date

`laborSource` monday · `directLaborHours` 41,280 · `billableFTEs` 48 · `nonBillableFTEs` 20 ·
`billableUtilization` 66.4% · `laborCostPerHour` $64.50 · `revenuePerBillableFTE` $124,583 ·
`founderDependencyService` 18.0%

---

## VTO (2026)

- **Core values:** Measure it or it didn't happen · Leave the building better than the drawings ·
  Say the hard number early · Train your replacement
- **Mission:** Make the buildings that already exist worth keeping.
- **Vision:** The Pacific Northwest's default partner for proving building performance — not
  predicting it.
- **Target market:** Owner-occupied commercial and institutional buildings over 75,000 sq ft in
  WA and OR — healthcare, higher education, light industrial — with an in-house facilities team
  and a board-level decarbonization commitment.
- **Proven process:** Baseline → Retrofit → Verify → Monitor
- **Differentiators:** Measured-savings guarantee; commissioning agents on staff rather than
  subcontracted; 24 months of post-retrofit monitoring included in every project.
- **Guarantee:** If measured savings fall short of the modeled figure in year one, we true up the
  difference or keep working the building until they don't.
- **Three-year picture (Dec 31, 2028):** $52M revenue · $6.2M EBITDA (12%) · recurring at 28% of
  revenue · utilization 74% · top-5 concentration under 40% · founder-closed revenue under 15% ·
  DSO under 45 days.
- **Ten-year targets:** $100M revenue with 40% recurring; founder involved in under 5% of closed
  revenue; sellable without a key-person discount.

---

## Personas

Two in the platform org, two in the tenant — mirroring how `auth.controller.js:62` provisions
admins.

| Clerk id | Name | Title | Org | DB role | `publicMetadata.role` |
| --- | --- | --- | --- | --- | --- |
| `demo_super_admin` | Avery Nakamura | Platform Administrator | Maural Solutions | Super Admin | `super_admin` |
| `demo_admin` | Priya Raghunathan | Customer Success Lead | Maural Solutions | Admin | `admin` |
| `demo_org_executive` | Dana Thornbury | Founder & CEO | Thornbury Energy Group | Org Executive | `org_executive` |
| `demo_org_staff` | Marcus Oyelaran | Senior Commissioning Engineer | Thornbury Energy Group | Org Staff | `org_staff` |

Dana as the executive persona is deliberate: the founder-dependency story only lands if the
default persona is the founder looking at their own numbers.

---

## Documents

Six. Between them they cover every ingestible format that matters and every `Category` id,
including the null case.

| # | Document | Format | Category | Why it's here |
| --- | --- | --- | --- | --- |
| 1 | FY2026 Strategic Plan — The Recurring Revenue Transition | PDF | Sales (1) | The thesis. Exported as PDF — `pptx` is not ingestible. |
| 2 | Q2 2026 Quarterly Business Review | DOCX | Finance (3) | Explains the utilization miss and the plan variance. |
| 3 | FY2026 Financial Summary & KPI Detail | XLSX | Finance (3) | Exercises the spreadsheet extraction path; ties to the seeded finance KPIs. |
| 4 | MBCx Delivery Standard v3 | PDF | Technical (5) | The proven process, in operational detail. |
| 5 | Client Master Services Agreement — Template | DOCX | Legal (4) | Gives the Legal filter content; a plausible retrieval target. |
| 6 | Leadership Team Meeting Notes — Sep 8, 2026 | DOCX | *none* (null) | Exercises the null `ctg_id` path. The most recent, most specific source. |

**Planned retrieval demonstrations** — the two questions the runbook's end-to-end check needs:

- *Document-only:* "Why did Thornbury miss its Q3 utilization target?" — answerable only from
  documents 2 and 6, and it requires combining them.
- *KPI-only:* "What is our current DSO and how does it compare to target?" — answerable only from
  the seeded finance KPI row.

---

## Open questions for the user

1. **Marketing has no document**, so that filter renders empty. Adding a seventh (a positioning
   and pricing one-pager) would complete category coverage. The runbook says five or six — say the
   word and I'll add it.
2. **`runwayMonths` is defined in the schema as `cashPosition / monthlyBurn`**, where `monthlyBurn`
   is gross (COGS + OpEx + distributions). For a cash-generating services business that yields
   ~0.8 months, which reads as alarming rather than informative. I propose seeding it faithfully
   to the formula and having the financial document explain that Thornbury tracks DSO and working
   capital instead, because runway is a startup metric that doesn't fit a project business. The
   alternative is to seed a flattering number that doesn't match the stated formula. I'd rather be
   faithful to the code — but it's your call.
3. **Document domain** is `@thornburyenergy.com` in emails and the MSA. Fictional; say if you'd
   rather it were obviously unregistrable.
