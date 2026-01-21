const express = require("express");
const router = express.Router();

const hubspotController = require("../controllers/hubspot.controller");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// External API Routes
router.get("/", (req, res) => {
  res.send("This is the HubSpot API.");
});

router.get("/install", hubspotController.installHubSpot);

router.get("/oauth-callback", hubspotController.callbackHandler);

router.get("/success", hubspotController.connectionSuccessHandler);

router.get("/status", hubspotController.connectionStatus);

router.get("/contacts", hubspotController.getContacts);

router.get("/carts", hubspotController.getCarts);

router.get("/companies", hubspotController.getCompanies);

/**
 *
 * TODO: Implement token refresh logic to maintain access.
 *
 * TODO ------- Interacting with HubSpot's API -------
 * - Use the access token to make authenticated requests to HubSpot's API.
 * - Implement routes to interact with HubSpot's API (e.g., fetch contacts, create deals).
 *
 * - Add authentication and error handling as needed.
 *
 */

module.exports = router;
