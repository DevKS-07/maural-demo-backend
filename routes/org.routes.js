const express = require("express");

const orgController = require("../controllers/org.controller");
const router = express.Router();

// Home route for testing
router.get("/", orgController.orgTesting);

// **************************  GET ROUTES **************************

router.get("/all", orgController.getAllOrgs); // Get all organisations (Super Admin, Admin)

router.get("/:orgId", orgController.getOrgById); // Get an organisation by ID

router.get("/:orgId/users", orgController.getOrgUsers); // Get all users belonging to an organisation

router.get("/:orgId/files", orgController.getOrgFiles); // Get all files/documents of an organisation

router.get("/:orgId/chart", orgController.getOrgChart); // Get the organisation chart as a nested tree

// **************************  POST ROUTES **************************

router.post("/", orgController.createOrg); // Register/create a new organisation

// **************************  PUT ROUTES **************************

router.put("/:orgId", orgController.updateOrg); // Update organisation's profile by ID

// ************************** DELETE ROUTES **************************

router.delete("/:orgId", orgController.deleteOrg); // Delete an organisation by ID

module.exports = router;
