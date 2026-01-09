const express = require("express");
const router = express.Router();

const hubspotController = require("../controllers/hubspot.controller");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// External API Routes
router.get("/", (req, res) => {
  res.send("This is the External API Integrations route.");
});

router.get("/hubspot/install", hubspotController.installHubSpot);

router.get("/hubspot/oauth-callback", hubspotController.getHubSpotCallback);

router.get("/hubspot/success", (req, res) => {
  const user_id = req.session.user_id;
  console.log(`User: ${user_id}`);

  const token = prisma.hubspotToken.findUnique({
    where: { user_id: user_id },
  });
  console.log(`Token: ${token}`);

  res.send(`HubSpot Integration Successful!`);
});

/**
 *
 * TODO ------- Implmenting OAuth 2.0 Flow -------
 * - Handle the callback and exchanging of the authorization code for an access token.
 * - Store the access token securely for future API requests.
 * - Implement token refresh logic to maintain access.
 *
 *
 * TODO ------- Testing the Integration -------
 * - Test the OAuth 2.0 flow end-to-end to ensure users can successfully connect their HubSpot accounts.
 * - Verify that the access token is valid and can be used to make API requests.
 * - Log and handle errors appropriately during the OAuth process.
 * - Verify access token storage and retrieval.
 *
 *
 * TODO ------- Interacting with HubSpot's API -------
 * - Use the access token to make authenticated requests to HubSpot's API.
 * - Implement Embedded App functionality (if needed).
 * - Implement routes to interact with HubSpot's API (e.g., fetch contacts, create deals).
 *
 * - Add authentication and error handling as needed.
 *
 */

module.exports = router;
