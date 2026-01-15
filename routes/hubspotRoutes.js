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

router.get("/oauth-callback", hubspotController.getHubSpotCallback);

router.get("/success", hubspotController.connectionSuccessHandler);

router.get("/status", hubspotController.getHubSpotStatus);

router.get("/contacts", hubspotController.getHubSpotContacts);

router.get("/carts", hubspotController.getHubSpotCarts);

router.get("/companies", hubspotController.getHubSpotCompanies);

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
