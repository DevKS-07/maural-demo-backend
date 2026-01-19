const express = require("express");
const router = express.Router();

// Home route for testing
router.get("/", (req, res) => {
  res.send("Welcome to the Maural KMS API");
});

router.get("/favicon.ico", (req, res) => res.sendStatus(204)); // to suppress 404 errors due to "GET /favicon.ico" browser requests

module.exports = router;
