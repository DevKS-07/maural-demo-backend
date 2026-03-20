const express = require("express");
const { requireRole, requireOrgAccess } = require("../middleware/auth.middleware");
const vtoController = require("../controllers/vto.controller");

const router = express.Router();

// **************************  GET ROUTES **************************

router.get("/:orgId", requireOrgAccess("params"), vtoController.getVTOByOrgId); // Get VTO for an organisation

// **************************  POST ROUTES **************************

router.post("/:orgId", requireOrgAccess("params"), requireRole("org_executive"), vtoController.createVTO); // Create VTO

// **************************  PUT ROUTES **************************

router.put("/:orgId", requireOrgAccess("params"), requireRole("org_executive"), vtoController.updateVTO); // Update VTO

// ************************** DELETE ROUTES **************************

router.delete("/:orgId", requireOrgAccess("params"), requireRole("org_executive"), vtoController.deleteVTO); // Delete VTO

module.exports = router;
