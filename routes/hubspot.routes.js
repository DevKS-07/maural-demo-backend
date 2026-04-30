const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth.middleware");

const hubspotController = require("../controllers/hubspot.controller");

// External API Routes
router.get("/", (req, res) => {
  res.send("This is the HubSpot API.");
});

router.get("/install", requireAuth, hubspotController.installHubSpot);

router.get("/oauth-callback", hubspotController.callbackHandler);

router.get("/success", hubspotController.connectionSuccessHandler);

router.get("/status", requireAuth, hubspotController.connectionStatus);

router.delete("/disconnect", requireAuth, hubspotController.disconnectHubSpot);

/**
router.get("/contacts", hubspotController.getContacts);

router.get("/carts", hubspotController.getCarts);

router.get("/companies", hubspotController.getCompanies);

*/

/**
 *
 * TODO:
 *
 * TODO ------- Interacting with HubSpot's API -------
 * - Use the access token to make authenticated requests to HubSpot's API.
 * - Implement routes to interact with HubSpot's API (e.g., fetch contacts, create deals).
 *
 * - Add authentication and error handling as needed.
 *
 */

module.exports = router;
