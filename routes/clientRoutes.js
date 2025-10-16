const express = require("express");

const userController = require("../controllers/userController");

const router = express.Router();

// Home route for testing
router.get("/", userController.user_Testing);

///////////////////////////////  GET ROUTES ///////////////////////////////

router.get("/profile/:id", userController.getUserProfile); // Get user's profile by ID

///////////////////////////////  POST ROUTES ///////////////////////////////

router.post("/register", userController.registerUser); // Register a new user

///////////////////////////////  PUT ROUTES ///////////////////////////////

router.put("/profile/:id", userController.updateUserProfile); // Update user's profile by ID

/////////////////////////////// DELETE ROUTES ///////////////////////////////

router.delete("/profile/:id", userController.deleteUser); // Delete user by ID

module.exports = router;
