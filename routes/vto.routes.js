const express = require("express");
const { requireRole } = require("../middleware/auth.middleware");
const vtoController = require("../controllers/vto.controller");

const router = express.Router();

// **************************  GET ROUTES **************************

router.get("/:orgId", vtoController.getVTOByOrgId); // Get VTO for an organisation

// **************************  POST ROUTES **************************

router.post("/:orgId", requireRole("org_executive"), vtoController.createVTO); // Create VTO

// **************************  PUT ROUTES **************************

router.put("/:orgId", requireRole("org_executive"), vtoController.updateVTO); // Update VTO

// ************************** DELETE ROUTES **************************

router.delete("/:orgId", requireRole("org_executive"), vtoController.deleteVTO); // Delete VTO

module.exports = router;
