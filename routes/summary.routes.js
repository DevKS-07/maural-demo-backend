const {
  getFullDashboardSummary,
  getScorecardSummary,
  getFinancialSummary,
  getLeadsSummary,
  getLaborSummary,
} = require("../controllers/engine.controller");
const router = require("express").Router();

// ─────────────────────────────────────────────────────────────────
//  ROUTES
// ────────────────────────────────────────────────────────────────────────────

router.get("/financial/:orgId", getFinancialSummary);
router.get("/leads/:orgId", getLeadsSummary);
router.get("/labor/:orgId", getLaborSummary);
router.get("/scorecard", getScorecardSummary);
router.get("/summary/:orgId", getFullDashboardSummary);

module.exports = router;
