const express = require("express");
const router = express.Router();

// AI route for testing. Maybe implemented later.
router.get("/", (req, res) => {
  res.send("This is the AI Routes endpoint. Under construction. ");
});

module.exports = router;
