const bcrypt = require("bcryptjs");

// const jwt = require("jsonwebtoken");
// const JWT_SECRET = "your_jwt_secret_key"; // Use env variable in production

// Mock data
const users = []; // use a database when the setup is ready

///////////////////////////////  HOME ROUTE (Test Route) ///////////////////////////////

/**
 * A simple route to test if the User API is working
 * @route GET /users/
 * @returns {string} - A success message - "User API is working"
 * */
exports.user_Testing = (req, res) => {
  res.status(200).send("User API is working");
};

///////////////////////////////  GET ROUTES ///////////////////////////////

/**
 * ### FOR ADMINS ONLY ###
 * Get all clients
 * @route GET /admin/all-clients
 * @return {array} - An array of user objects
 * */
exports.getAllUsers = (req, res) => {
  // TODO: Implement logic to fetch all clients
  res.status(200).json({ message: "Getting all users" });
};

/**
 * ### FOR ADMINS ONLY ###
 * Get a single client by ID
 * @route GET /admin/client/:id
 * @param {string} req.params.id The ID of the client to retrieve
 * @return {object} The user object if found, otherwise an error message
 * */
exports.getUserById = (req, res) => {
  const userId = req.params.id;
  // TODO: Implement logic to fetch client by ID
  res.status(200).json({ message: `Get user with ID ${userId}` });
};

/**
 * ### FOR ADMINS ONLY ###
 * Get analytics data (Can be implemented later)
 * @route GET /admin/analytics
 * @return {object} An object containing analytics data
 * */
exports.getAnalyticsData = (req, res) => {
  // TODO: Implement logic to fetch analytics data
  res.status(200).json({ message: "Getting analytics data" });
};

/**
 * Get user's profile by ID
 * @route GET /client/profile/:id
 * @route GET /admin/profile/:id
 * @param {string} req.params.id The ID of the user to retrieve
 * @return {object} The user object if found, otherwise an error message
 * */
exports.getUserProfile = (req, res) => {
  const userId = req.params.id;
  // TODO: Implement logic to fetch user profile by ID
  res.status(200).json({ message: `Get user with ID ${userId}` });
};

///////////////////////////////  POST ROUTES ///////////////////////////////

/**
 * Register a new user
 * @param {string} req.body.username The username of the new user
 * @param {string} req.body.email The email of the new user
 * @param {string} req.body.fullName The full name of the new user
 * @param {string} req.body.role The role of the new user (e.g., admin, client, etc.)
 * @param {string} req.body.password The password of the new user
 * @return {object} A success message or an error message
 * */
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

/**
 * Login a user
 * @param {string} req.body.username The username of the user
 * @param {string} req.body.password The password of the user
 * @return {object} A success message with user details or an error message
 * */
exports.loginUser = async (req, res) => {
  const { username, password } = req.body;
  // TODO: Implement logic to login user by ID
  res.status(200).json({ message: `${username} successfully logged in.` });
};

/** Logout a user
 * @param {string} req.params.id The ID of the user to logout
 * @return {object} A success message or an error message
 * */
exports.logoutUser = (req, res) => {
  const userId = req.params.id;
  // TODO: Implement logic to logout user by ID
  res.status(200).json({ message: `User successfully logged out.` });
};

///////////////////////////////  PUT ROUTES ///////////////////////////////

/**
 * Update user profile by ID
 * @param {string} req.params.id The ID of the user to update
 * @param {object} req.body The updated user data
 * @return {object} A success message or an error message
 * */
exports.updateUserProfile = (req, res) => {
  // TODO: Implement logic to update user profile by ID
  const userId = req.params.id;
  res
    .status(200)
    .json({ message: `Profile of User with ID ${userId} updated` });
};

///////////////////////////// DELETE ROUTES ///////////////////////////////

/**
 * ### For Admins only ###
 * Delete a user by ID
 * @param {string} req.params.id The ID of the user to delete
 * @return {object} A success message or an error message
 * */
exports.deleteUser = (req, res) => {
  const userId = req.params.id;
  // TODO: Implement logic to delete user by ID
  res.status(200).json({ message: `User with ID ${userId} deleted` });
};
