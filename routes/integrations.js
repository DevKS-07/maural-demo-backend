const express = require("express");
const router = express.Router();

const hubspotRoutes = require("./hubspotRoutes");
const quickbooksRoutes = require("./quickbooksRoutes");
const mondayRoutes = require("./monday.Routes");
const clickupRoutes = require("./clickup.Routes");

// External API Routes
router.get("/", (req, res) => {
  res.send("This is the External API Integrations route.");
});

router.use("/hubspot", hubspotRoutes);

router.use("/quickbooks", quickbooksRoutes);

router.use("/monday", mondayRoutes);

router.use("/clickup", clickupRoutes);

module.exports = router;
