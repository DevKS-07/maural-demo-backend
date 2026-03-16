const express = require("express");
const authController = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

// ************************** PUBLIC ROUTES **************************

// Clerk webhook — must be public (no requireAuth).
// express.raw() is applied at the app level for /api/webhooks so Svix
// can verify the raw request body signature.
router.post("/clerk", authController.handleClerkWebhook);

// ************************** PROTECTED ROUTES **************************

// Get the current authenticated user's full DB profile (with role + permissions)
router.get("/me", requireAuth, authController.getMe);

// Get the current authenticated user's organisation
router.get("/org", requireAuth, authController.getMyOrg);

module.exports = router;
