const {
  getFullDashboardSummary,
  getScorecardSummary,
  getFinancialSummary,
  getLeadsSummary,
  getLaborSummary,
} = require("../controllers/engine.controller");
const { requireRole, requireOrgAccess } = require("../middleware/auth.middleware");
const router = require("express").Router();

// ─────────────────────────────────────────────────────────────────
//  ROUTES
// ────────────────────────────────────────────────────────────────────────────

router.get("/financial/:orgId", requireOrgAccess("params"), getFinancialSummary);
router.get("/leads/:orgId", requireOrgAccess("params"), getLeadsSummary);
router.get("/labor/:orgId", requireOrgAccess("params"), getLaborSummary);
router.get("/scorecard", requireRole("admin"), getScorecardSummary);
router.get("/summary/:orgId", requireOrgAccess("params"), getFullDashboardSummary);

module.exports = router;
