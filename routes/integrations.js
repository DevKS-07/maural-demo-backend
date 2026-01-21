const express = require("express");
const router = express.Router();

const hubspotRoutes = require("./hubspotRoutes");
const quickbooksRoutes = require("./quickbooksRoutes");
//const mondayRoutes = require("./monday.Routes.js");

// External API Routes
router.get("/", (req, res) => {
  res.send("This is the External API Integrations route.");
});

router.use("/hubspot", hubspotRoutes);

router.use("/quickbooks", quickbooksRoutes);

//router.use("/monday", mondayRoutes);

module.exports = router;
