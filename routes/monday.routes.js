const express = require("express");
const router = express.Router();
const mondayController = require("../controllers/monday.controller");

// External API Routes
router.get("/", (req, res) => {
  res.send("This is the Monday API.");
});

router.get("/install", mondayController.installMonday);

router.get("/oauth-callback", mondayController.callbackHandler);

router.get("/success", mondayController.connectionSuccessHandler);

router.get("/status", mondayController.connectionStatus);
 

module.exports = router;