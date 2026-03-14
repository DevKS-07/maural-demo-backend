// Pure data/business logic — no req, no res, no Express.
// Import this anywhere: other controllers, cron jobs, webhooks, etc.

const axios = require("axios");
const OAuthClient = require("intuit-oauth");
const prisma = require("../lib/prisma");

const CLIENT_ID = process.env.QUICKBOOKS_CLIENT_ID;
const CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET;
const REDIRECT_URI = process.env.QUICKBOOKS_REDIRECT_URI;
const ENVIRONMENT = process.env.QUICKBOOKS_ENVIRONMENT || "sandbox";
const QB_BASE_URL =
  process.env.QUICKBOOKS_BASE_URL || "https://quickbooks.api.intuit.com";

// ─────────────────────────────────────────────────────────────────
//  AUTH HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Rebuild an authenticated OAuthClient from stored DB tokens.
 * Never relies on in-memory state — safe across server restarts.
 */
const getAuthenticatedClient = async (clientId) => {
  const token = await prisma.quickbooksToken.findUnique({
    where: { client_Id: clientId },
  });
  if (!token)
    throw new Error(`No QuickBooks token found for user: ${clientId}`);

  const client = new OAuthClient({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    environment: ENVIRONMENT,
    redirectUri: REDIRECT_URI,
    logging: false,
  });

  client.setToken({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    token_type: token.token_type,
    expires_in: token.expires_in,
    x_refresh_token_expires_in: token.x_refresh_token_expires_in,
    realmId: token.realmId,
  });

  return { client, token };
};

/**
 * Refresh tokens and persist back to DB.
 * Called automatically on 401 — can also be called directly.
 */
const refreshAndPersistTokenService = async (clientId) => {
  const { client, token } = await getAuthenticatedClient(clientId);
  const authResponse = await client.refresh();
  const {
    access_token,
    refresh_token,
    expires_in,
    x_refresh_token_expires_in,
    token_type,
  } = authResponse.json;

  await prisma.quickbooksToken.update({
    where: { client_Id: clientId },
    data: {
      access_token,
      refresh_token,
      expires_in,
      x_refresh_token_expires_in,
      token_type,
    },
  });

  return { access_token, realmId: token.realmId };
};

// ─────────────────────────────────────────────────────────────────
//  CORE FETCHER
// ─────────────────────────────────────────────────────────────────

const fetchQBReport = async (
  clientId,
  reportName,
  params = {},
  retry = true,
) => {
  const { token } = await getAuthenticatedClient(clientId);
  const url = `${QB_BASE_URL}/v3/company/${token.realmId}/reports/${reportName}`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        Accept: "application/json",
      },
      params: { minorversion: 65, ...params },
    });
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const message =
      error.response?.data?.Fault?.Error?.[0]?.Message || error.message;

    if (status === 401 && retry) {
      console.log(
        `[QB] 401 on ${reportName} — refreshing for user: ${clientId}`,
      );
      await refreshAndPersistTokenService(clientId);
      return fetchQBReport(clientId, reportName, params, false);
    }
    if (status === 429) {
      const wait = parseInt(error.response.headers["retry-after"] || "60", 10);
      await new Promise((r) => setTimeout(r, wait * 1000));
      return fetchQBReport(clientId, reportName, params, retry);
    }
    throw new Error(`[QB] ${reportName} failed (${status}): ${message}`);
  }
};

// ─────────────────────────────────────────────────────────────────
//  ROW PARSER
// ─────────────────────────────────────────────────────────────────

const findRowValue = (rows = [], label) => {
  for (const row of rows) {
    if (row.Summary?.ColData) {
      const rowLabel = row.Summary.ColData[0]?.value || "";
      if (rowLabel.toLowerCase().includes(label.toLowerCase()))
        return parseFloat(row.Summary.ColData[1]?.value || "0");
    }
    if (row.ColData) {
      const rowLabel = row.ColData[0]?.value || "";
      if (rowLabel.toLowerCase().includes(label.toLowerCase()))
        return parseFloat(row.ColData[1]?.value || "0");
    }
    if (row.Rows?.Row) {
      const found = findRowValue(row.Rows.Row, label);
      if (found !== null) return found;
    }
  }
  return null;
};

// ─────────────────────────────────────────────────────────────────
//  REPORT SERVICES — pure data, returns plain objects
// ─────────────────────────────────────────────────────────────────

const getProfitAndLossService = async (
  clientId,
  { startDate, endDate, accounting = "Accrual" } = {},
) => {
  const params = { accounting_method: accounting };
  if (startDate && endDate) {
    params.start_date = startDate;
    params.end_date = endDate;
  } else params.date_macro = "This Month";

  const report = await fetchQBReport(clientId, "ProfitAndLoss", params);
  const rows = report.Rows?.Row || [];

  const totalIncome = findRowValue(rows, "Total Income") ?? 0;
  const cogs = Math.abs(
    findRowValue(rows, "Total Cost of Goods Sold") ??
      findRowValue(rows, "Total COGS") ??
      0,
  );
  const grossProfit = findRowValue(rows, "Gross Profit") ?? totalIncome - cogs;
  const totalExpenses = Math.abs(findRowValue(rows, "Total Expenses") ?? 0);
  const netIncome = findRowValue(rows, "Net Income") ?? 0;
  const depreciation = Math.abs(findRowValue(rows, "Depreciation") ?? 0);
  const amortization = Math.abs(findRowValue(rows, "Amortization") ?? 0);
  const interest = Math.abs(findRowValue(rows, "Interest Expense") ?? 0);
  const tax = Math.abs(findRowValue(rows, "Income Tax") ?? 0);
  const ebitda = netIncome + depreciation + amortization + interest + tax;

  return {
    totalIncome,
    cogs,
    grossProfit,
    grossMargin: totalIncome
      ? parseFloat(((grossProfit / totalIncome) * 100).toFixed(2))
      : 0,
    totalExpenses,
    netIncome,
    netMargin: totalIncome
      ? parseFloat(((netIncome / totalIncome) * 100).toFixed(2))
      : 0,
    ebitda: parseFloat(ebitda.toFixed(2)),
    ebitdaMargin: totalIncome
      ? parseFloat(((ebitda / totalIncome) * 100).toFixed(2))
      : 0,
    operatingExpenses: totalExpenses,
    period: { startDate, endDate, accounting },
  };
};

const getBalanceSheetService = async (clientId, { asOfDate } = {}) => {
  const params = asOfDate
    ? { date_macro: "Custom", end_date: asOfDate }
    : { date_macro: "Today" };
  const report = await fetchQBReport(clientId, "BalanceSheet", params);
  const rows = report.Rows?.Row || [];

  const cashOnHand =
    findRowValue(rows, "Total Bank Accounts") ??
    findRowValue(rows, "Cash and Cash Equivalents") ??
    findRowValue(rows, "Checking") ??
    0;
  const accountsReceivable = findRowValue(rows, "Accounts Receivable") ?? 0;
  const totalCurrentAssets = findRowValue(rows, "Total Current Assets") ?? 0;
  const totalCurrentLiabilities =
    findRowValue(rows, "Total Current Liabilities") ?? 0;

  return {
    cashPosition: cashOnHand,
    cashOnHand,
    accountsReceivable,
    totalCurrentAssets,
    totalCurrentLiabilities,
    workingCapital: totalCurrentAssets - totalCurrentLiabilities,
    asOfDate: asOfDate || "Today",
  };
};

const getBudgetVsActualsService = async (
  clientId,
  { startDate, endDate } = {},
) => {
  const params =
    startDate && endDate
      ? { start_date: startDate, end_date: endDate }
      : { date_macro: "This Fiscal Year" };
  const report = await fetchQBReport(clientId, "BudgetVsActuals", params);
  const rows = report.Rows?.Row || [];

  const findBudgetRow = (rows, label) => {
    for (const row of rows) {
      const colData = row.Summary?.ColData || row.ColData;
      if (colData?.[0]?.value?.toLowerCase().includes(label.toLowerCase()))
        return {
          actual: parseFloat(colData[1]?.value || "0"),
          budget: parseFloat(colData[2]?.value || "0"),
        };
      if (row.Rows?.Row) {
        const found = findBudgetRow(row.Rows.Row, label);
        if (found) return found;
      }
    }
    return null;
  };

  const calcVariancePct = (actual, budget) =>
    !budget
      ? null
      : parseFloat((((actual - budget) / budget) * 100).toFixed(2));

  const revenue = findBudgetRow(rows, "Total Income");
  const cogs =
    findBudgetRow(rows, "Total Cost of Goods Sold") ??
    findBudgetRow(rows, "Total COGS");
  const grossProfit = findBudgetRow(rows, "Gross Profit");
  const opex = findBudgetRow(rows, "Total Expenses");
  const netIncome = findBudgetRow(rows, "Net Income");

  return {
    varianceRevenuePct: calcVariancePct(revenue?.actual, revenue?.budget),
    varianceCOGSPct: calcVariancePct(cogs?.actual, cogs?.budget),
    varianceGrossProfitPct: calcVariancePct(
      grossProfit?.actual,
      grossProfit?.budget,
    ),
    varianceOperatingExpensesPct: calcVariancePct(opex?.actual, opex?.budget),
    varianceNetIncomePct: calcVariancePct(netIncome?.actual, netIncome?.budget),
    period: { startDate, endDate },
  };
};

/**
 * getFinancialKPIsService — the function you import everywhere.
 * Returns all Financial & Cash KPIs as a plain object.
 * No req, no res. Call it from any controller, cron, or webhook.
 *
 * @param {string} clientId
 * @param {object} options - { startDate, endDate, asOfDate }
 * @returns {Promise<object>}
 */
const getFinancialKPIsService = async (
  clientId,
  { startDate, endDate, asOfDate } = {},
) => {
  const [pl, bs, bva] = await Promise.all([
    getProfitAndLossService(clientId, { startDate, endDate }),
    getBalanceSheetService(clientId, { asOfDate: asOfDate || endDate }),
    getBudgetVsActualsService(clientId, { startDate, endDate }),
  ]);

  const monthlyBurn = pl.cogs + pl.operatingExpenses;
  const netBurnRate = Math.max(monthlyBurn - pl.totalIncome, 0);
  const runwayMonths =
    netBurnRate > 0
      ? parseFloat((bs.cashOnHand / netBurnRate).toFixed(1))
      : null;
  const dayCount =
    startDate && endDate
      ? Math.ceil((new Date(endDate) - new Date(startDate)) / 86400000)
      : 30;
  const dso =
    pl.totalIncome > 0
      ? parseFloat(
          (bs.accountsReceivable / (pl.totalIncome / dayCount)).toFixed(1),
        )
      : null;

  return {
    totalIncome: pl.totalIncome,
    cogs: pl.cogs,
    grossProfit: pl.grossProfit,
    grossMargin: pl.grossMargin,
    netIncome: pl.netIncome,
    netMargin: pl.netMargin,
    ebitda: pl.ebitda,
    ebitdaMargin: pl.ebitdaMargin,
    cashPosition: bs.cashOnHand,
    workingCapital: bs.workingCapital,
    accountsReceivable: bs.accountsReceivable,
    monthlyBurn,
    netBurnRate,
    runwayMonths,
    dso,
    varianceRevenuePct: bva.varianceRevenuePct,
    varianceCOGSPct: bva.varianceCOGSPct,
    varianceGrossProfitPct: bva.varianceGrossProfitPct,
    varianceOperatingExpensesPct: bva.varianceOperatingExpensesPct,
    varianceNetIncomePct: bva.varianceNetIncomePct,
    fetchedAt: new Date().toISOString(),
    period: { startDate, endDate, asOfDate: asOfDate || endDate },
  };
};

module.exports = {
  refreshAndPersistTokenService,
  getProfitAndLossService,
  getBalanceSheetService,
  getBudgetVsActualsService,
  getFinancialKPIsService,
};
