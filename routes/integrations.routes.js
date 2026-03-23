const express = require("express");
const router = express.Router();

const hubspotRoutes = require("./hubspot.routes");
const quickbooksRoutes = require("./quickbooks.routes");
const mondayRoutes = require("./monday.routes");
const clickupRoutes = require("./clickup.routes");
const laborConfigRoutes = require("./laborConfig.routes");

// External API Routes
router.get("/", (req, res) => {
  res.send("This is the External API Integrations route.");
});

router.use("/hubspot", hubspotRoutes);

router.use("/quickbooks", quickbooksRoutes);

router.use("/monday", mondayRoutes);

router.use("/clickup", clickupRoutes);

router.use("/labor-config", laborConfigRoutes);

module.exports = router;
