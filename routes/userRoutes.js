const express = require("express");

const userController = require("../controllers/userController");
const router = express.Router();

// Home route for testing
router.get("/", userController.user_Testing);

// GET ROUTES
router.get("/all", userController.getAllUsers);

router.get("/:id", userController.getUserById);

router.get("/profile/:id", userController.getUserProfile);

// POST ROUTES
router.post("/register", userController.registerUser);

router.post("/login", userController.loginUser);

// PUT ROUTES
router.put("/profile/:id", userController.updateUserProfile);

// DELETE ROUTES
router.delete("/profile/:id", userController.deleteUser);

module.exports = router;
