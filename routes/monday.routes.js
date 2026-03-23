const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth.middleware");
const mondayController = require("../controllers/monday.controller");

// External API Routes
router.get("/", (req, res) => {
  res.send("This is the Monday API.");
});

router.get("/install", requireAuth, mondayController.installMonday);

router.get("/oauth-callback", mondayController.callbackHandler);

router.get("/success", requireAuth, mondayController.connectionSuccessHandler);

router.get("/status", requireAuth, mondayController.connectionStatus);

router.delete("/disconnect", requireAuth, mondayController.disconnectMonday);
 

module.exports = router;