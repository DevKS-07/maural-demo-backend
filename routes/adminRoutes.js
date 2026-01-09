const express = require("express");

const userController = require("../controllers/user.controller");
const router = express.Router();

// Home route for testing
router.get("/", userController.user_Testing);

///////////////////////////////  GET ROUTES ///////////////////////////////

router.get("/clients", userController.getAllUsers); // Get all Clients
router.get("/clients/:id", userController.getUserById); // Get a single Client by ID
router.get("/analytics", userController.getAnalyticsData); // Get analytics data (Can be implemented later)
router.get("/profile/:id", userController.getUserProfile); // Get user's profile by ID

///////////////////////////////  POST ROUTES ///////////////////////////////

router.post("/register-client", userController.registerUser); // Add a new Client

///////////////////////////////  PUT ROUTES ///////////////////////////////

router.put("/profile/:id", userController.updateUserProfile); // Update user's profile by ID

/////////////////////////////// DELETE ROUTES ///////////////////////////////

router.delete("/profile/:id", userController.deleteUser); // Delete user by ID

module.exports = router;
