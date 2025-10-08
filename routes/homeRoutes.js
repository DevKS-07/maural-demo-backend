const express = require("express");
const router = express.Router();

// Home route for testing
router.get("/", (req, res) => {
  res.send("Welcome to the Maural KMS API");
});

module.exports = router;
