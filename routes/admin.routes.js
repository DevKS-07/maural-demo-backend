const express = require("express");

const router = express.Router();

// Home route for testing
router.get("/", (req, res) => {
  res.status(200).send("Admin API is working");
});

// router.get("/clients"); // Get all Clients
// router.get("/clients/:id"); // Get a single Client by ID
// router.get("/analytics"); // Get analytics data (Can be implemented later)
// router.get("/profile/:id"); // Get user's profile by ID
// router.post("/register-client"); // Add a new Client
// router.put("/profile/:id"); // Update user's profile by ID
// router.delete("/profile/:id"); // Delete user by ID

module.exports = router;
