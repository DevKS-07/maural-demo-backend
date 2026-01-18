const express = require("express");
const router = express.Router();

const hubspotRoutes = require("./hubspotRoutes");
const quickbooksRoutes = require("./quickbooksRoutes");

// External API Routes
router.get("/", (req, res) => {
  res.send("This is the External API Integrations route.");
});

router.use("/hubspot", hubspotRoutes);

router.use("/quickbooks", quickbooksRoutes);

module.exports = router;
