const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth.middleware");
const clickupController = require("../controllers/clickup.controller");

// External API Routes
router.get("/", (req, res) => {
  res.send("This is the ClickUp API.");
});

router.get("/install", requireAuth, clickupController.installClickUp);

router.get("/oauth-callback", clickupController.callbackHandler);

router.get("/success", clickupController.connectionSuccessHandler);

router.get("/status", requireAuth, clickupController.connectionStatus);

router.delete("/disconnect", requireAuth, clickupController.disconnectClickUp);

module.exports = router;