const express = require("express");
const router = express.Router();

// External API Routes
router.get("/", (req, res) => {
  res.send("This is the External API route.");
});

// HubSpot route - Under constrsuction.
router.get("/hubspot", (req, res) => {
  res.send("This is the External API route.");
});

module.exports = router;
