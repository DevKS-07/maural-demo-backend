const express = require("express");
const router = express.Router();
const clickupController = require("../controllers/clickup.controller");

// External API Routes
router.get("/", (req, res) => {
  res.send("This is the ClickUp API.");
});

router.get("/install", clickupController.installClickUp);

router.get("/oauth-callback", clickupController.callbackHandler);

router.get("/success", clickupController.connectionSuccessHandler);

router.get("/status", clickupController.connectionStatus);

module.exports = router;