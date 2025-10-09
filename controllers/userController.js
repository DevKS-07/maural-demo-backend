const express = require("express");

const bcrypt = require("bcryptjs");

// const jwt = require("jsonwebtoken");
// const JWT_SECRET = "your_jwt_secret_key"; // Use env variable in production

// Mock data
const users = []; // use a database when the setup is ready

// Home route for testing
exports.user_Testing = (req, res) => {
  res.status(200).send("User API is working");
};

// ######################## GET ROUTES ########################

// Get all users
exports.getAllUsers = (req, res) => {
  // TODO: Implement logic to fetch all users
  res.status(200).json({ message: "Getting all users" });
};

// Get a single user by ID
exports.getUserById = (req, res) => {
  const userId = req.params.id;
  // TODO: Implement logic to fetch user by ID
  res.status(200).json({ message: `Get user with ID ${userId}` });
};

// Get a single user by ID
exports.getUserProfile = (req, res) => {
  const userId = req.params.id;
  // TODO: Implement logic to fetch user by ID
  res.status(200).json({ message: `Get user Profile with ID ${userId}` });
};

// ######################## PUT ROUTES ########################

// Create a new user
exports.registerUser = async (req, res) => {
  // TODO: Implement logic to create a new user
  // Example implementation:

  //   const { username, password } = req.body;
  //   if (!username || !password) {
  //     return res
  //       .status(400)
  //       .json({ message: "Username and password are required" });
  //   }

  //   const existingUser = users.find((user) => user.username === username);

  //   if (existingUser) {
  //     return res.status(400).json({ message: "Username already exists" });
  //   }

  //   const hashedPassword = await bcrypt.hash(password, 10);
  //   users.push({ username, password: hashedPassword });
  res.status(201).json({ message: "User registered successfully" });
};

exports.loginUser = async (req, res) => {
  const userId = req.params.id;
  // TODO: Implement logic to delete user by ID
  res.status(200).json({ message: `User with ID ${userId} deleted` });
};

// Update a user by ID
exports.updateUserProfile = (req, res) => {
  // TODO: Implement logic to update user profile by ID
  const userId = req.params.id;
  res
    .status(200)
    .json({ message: `Profile of User with ID ${userId} updated` });
};

// Delete a user by ID
exports.deleteUser = (req, res) => {
  const userId = req.params.id;
  // TODO: Implement logic to delete user by ID
  res.status(200).json({ message: `User with ID ${userId} deleted` });
};
