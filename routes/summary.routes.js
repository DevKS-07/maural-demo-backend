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

router.get("/financial", getFinancialSummary);
router.get("/leads", getLeadsSummary);
router.get("/labor", getLaborSummary);
router.get("/scorecard", getScorecardSummary);
router.get("/summary", getFullDashboardSummary);

module.exports = router;
