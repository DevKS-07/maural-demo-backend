// labor.service.js
// Unified labor KPI layer — routes to Monday or ClickUp
// based on the organisation's laborSource field.
// summaryEngine imports only this file, never the individual services.

const { getLaborKPIsService: getMondayLaborKPIs } = require("./monday.service");
const {
  getLaborKPIsService: getClickUpLaborKPIs,
} = require("./clickup.service");
const prisma = require("../lib/prisma");

/**
 * Fetch all Labor KPIs for an organisation.
 * Routes to the correct service based on organisation.laborSource.
 *
 * Also calculates cross-source KPIs that need both labor + QB data:
 *   LABOR-2: laborCostPerHour      = qbLaborCost     / directLaborHours
 *   LABOR-7: revenuePerBillableFTE = qbTotalRevenue  / billableFTEs
 *
 * @param {string} orgId
 * @param {object} options
 * @param {string} options.startDate
 * @param {string} options.endDate
 * @param {string} [options.founderUserId]   - optional, for PS-15
 * @param {number} [options.qbLaborCost]     - pass from QB data for LABOR-2
 * @param {number} [options.qbTotalRevenue]  - pass from QB data for LABOR-7
 * @returns {Promise<object>}
 */

const getLaborKPIsService = async (
  orgId,
  {
    startDate,
    endDate,
    founderUserId = null,
    qbLaborCost = null,
    qbTotalRevenue = null,
  } = {},
) => {
  // Look up the organisation to get laborSource + the relevant board/workspace ID
  const org = await prisma.organisation.findUnique({
    where: { org_id: orgId },
    select: {
      laborSource: true, // "monday" | "clickup"
      mondayBoardId: true,
      clickupWorkspaceId: true,
    },
  });

  if (!org) throw new Error(`No organisation found for org_id: ${orgId}`);

  const { laborSource, mondayBoardId } = org;

  if (!laborSource) {
    return {
      directLaborHours: null,
      billableFTEs: null,
      nonBillableFTEs: null,
      billableUtilization: null,
      founderDependencyService: null,
      laborCostPerHour: null,
      revenuePerBillableFTE: null,
      laborSource: null,
      warning:
        "No labor integration connected. Connect Monday or ClickUp to enable labor KPIs.",
      fetchedAt: new Date().toISOString(),
    };
  }

  // ── Fetch raw labor KPIs from the correct source ──────────────
  let laborData;

  if (laborSource === "monday") {
    if (!mondayBoardId)
      throw new Error(`Organisation has laborSource=monday but no mondayBoardId set`);
    laborData = await getMondayLaborKPIs(orgId, mondayBoardId, {
      startDate,
      endDate,
      founderUserId,
    });
  } else if (laborSource === "clickup") {
    laborData = await getClickUpLaborKPIs(orgId, {
      startDate,
      endDate,
      founderUserId,
    });
  } else {
    throw new Error(
      `Unknown laborSource: ${laborSource}. Must be "monday" or "clickup"`,
    );
  }

  // ── Cross-source calculations ──────────────────────────────────
  // LABOR-2: Labor cost per hour — needs QB labor cost line item
  const laborCostPerHour =
    qbLaborCost && laborData.directLaborHours
      ? parseFloat((qbLaborCost / laborData.directLaborHours).toFixed(2))
      : null;

  // LABOR-7: Revenue per billable FTE — needs QB total revenue
  const revenuePerBillableFTE =
    qbTotalRevenue && laborData.billableFTEs
      ? parseFloat((qbTotalRevenue / laborData.billableFTEs).toFixed(2))
      : null;

  return {
    ...laborData,
    laborCostPerHour, // LABOR-2
    revenuePerBillableFTE, // LABOR-7
  };
};

module.exports = { getLaborKPIsService };
