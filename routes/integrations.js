const express = require("express");
const router = express.Router();

const hubspotRoutes = require("./hubspotRoutes");

// External API Routes
router.get("/", (req, res) => {
  res.send("This is the External API Integrations route.");
});

router.use("/hubspot", hubspotRoutes);

module.exports = router;
