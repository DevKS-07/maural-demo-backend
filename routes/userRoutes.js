const express = require("express");
// const bcrypt = require("bcryptjs");

const router = express.Router();

// const jwt = require("jsonwebtoken");
// const JWT_SECRET = "your_jwt_secret_key"; // Use env variable in production

// Mock data
const users = []; // use a database when the setup is ready

// Register a new user
// router.post("/register", async (req, res) => {
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
//   res.status(201).json({ message: "User registered successfully" });
// });

// Home route for testing
router.get("/", (req, res) => {
  res.send("User API is working");
});

module.exports = router;
