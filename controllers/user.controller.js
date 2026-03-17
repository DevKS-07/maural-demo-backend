const prisma = require("../lib/prisma");

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
 * ### FOR SUPER ADMIN / ADMIN ONLY ###
 * Get all users
 * @route GET /users/all
 * @returns {array} - An array of user objects
 * */
exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.status(200).json(users);
  } catch (error) {
    console.error("Failed to retrieve users:", error.message);
    res.status(500).json({ message: "Failed to retrieve users" });
  }
};

/**
 * Get a single user by ID
 * @route GET /users/:userId
 * @param {string} req.params.userId - The ID of the user to retrieve
 * @returns {object} - The user object if found, otherwise an error message
 * */
exports.getUserById = async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { user_id: BigInt(userId) },
    });
    if (!user) {
      return res.status(404).json({ message: `User with ID ${userId} not found` });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error("Failed to retrieve user:", error.message);
    res.status(500).json({ message: "Failed to retrieve user" });
  }
};

/**
 * Get all activity logs for a user
 * @route GET /users/:userId/activity
 * @param {string} req.params.userId - The ID of the user
 * @returns {array} - An array of activity log entries for the user
 * */
exports.getUserActivity = async (req, res) => {
  const { userId } = req.params;
  try {
    const activity = await prisma.activity_Log.findMany({
      where: { user_id: BigInt(userId) },
      include: { ActivityType: true },
    });
    res.status(200).json(activity);
  } catch (error) {
    console.error("Failed to retrieve user activity:", error.message);
    res.status(500).json({ message: "Failed to retrieve user activity" });
  }
};

/**
 * Get all files uploaded by a user
 * @route GET /users/:userId/files
 * @param {string} req.params.userId - The ID of the user
 * @returns {array} - An array of file objects uploaded by the user
 * */
exports.getUserFiles = async (req, res) => {
  const { userId } = req.params;
  try {
    const files = await prisma.file.findMany({
      where: { user_id: BigInt(userId) },
    });
    res.status(200).json(files);
  } catch (error) {
    console.error("Failed to retrieve user files:", error.message);
    res.status(500).json({ message: "Failed to retrieve user files" });
  }
};

/**
 * Get all comments made by a user
 * @route GET /users/:userId/comments
 * @param {string} req.params.userId - The ID of the user
 * @returns {array} - An array of comment objects made by the user
 * */
exports.getUserComments = async (req, res) => {
  const { userId } = req.params;
  try {
    const comments = await prisma.comment.findMany({
      where: { user_id: BigInt(userId) },
    });
    res.status(200).json(comments);
  } catch (error) {
    console.error("Failed to retrieve user comments:", error.message);
    res.status(500).json({ message: "Failed to retrieve user comments" });
  }
};

/**
 * Get all permissions for a user via their assigned role
 * @route GET /users/:userId/permissions
 * @param {string} req.params.userId - The ID of the user
 * @returns {array} - An array of permission objects associated with the user's role
 * */
exports.getUserPermissions = async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { user_id: BigInt(userId) },
      include: {
        Role: {
          include: {
            RolePermission: {
              include: { Permission: true },
            },
          },
        },
      },
    });
    if (!user) {
      return res.status(404).json({ message: `User with ID ${userId} not found` });
    }
    const permissions = user.Role?.RolePermission.map((rp) => rp.Permission) ?? [];
    res.status(200).json(permissions);
  } catch (error) {
    console.error("Failed to retrieve user permissions:", error.message);
    res.status(500).json({ message: "Failed to retrieve user permissions" });
  }
};

///////////////////////////////  PUT ROUTES ///////////////////////////////

/**
 * Update a user's profile by ID
 * @route PUT /users/:userId
 * @param {string} req.params.userId - The ID of the user to update
 * @param {string} req.body.first_name - Updated first name
 * @param {string} req.body.last_name - Updated last name
 * @param {string} req.body.email - Updated email
 * @param {string} req.body.org_id - Updated organisation UUID
 * @param {number} req.body.role_id - Updated role ID
 * @param {string} req.body.phone - Updated phone number
 * @param {string} req.body.gender - Updated gender
 * @param {string} req.body.status - Updated status
 * @param {string} req.body.job_title - Updated job title
 * @returns {object} - The updated user object
 * */
exports.updateUser = async (req, res) => {
  const { userId } = req.params;
  const { first_name, last_name, email, org_id, role_id, phone, gender, status, job_title } = req.body;

  try {
    const updatedUser = await prisma.user.update({
      where: { user_id: BigInt(userId) },
      data: {
        first_name,
        last_name,
        email,
        phone,
        gender,
        status,
        job_title,
        org_id: org_id || undefined,
        role_id: role_id ? BigInt(role_id) : undefined,
      },
    });
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error(`Failed to update user with ID ${userId}:`, error.message);
    res.status(500).json({ message: `Failed to update user with ID ${userId}` });
  }
};

///////////////////////////////  DELETE ROUTES ///////////////////////////////

/**
 * ### FOR SUPER ADMIN / ADMIN ONLY ###
 * Delete a user by ID
 * @route DELETE /users/:userId
 * @param {string} req.params.userId - The ID of the user to delete
 * @returns {object} - A success message
 * */
exports.deleteUser = async (req, res) => {
  const { userId } = req.params;
  try {
    await prisma.user.delete({
      where: { user_id: BigInt(userId) },
    });
    res.status(200).json({ message: `User with ID ${userId} deleted` });
  } catch (error) {
    console.error(`Failed to delete user with ID ${userId}:`, error.message);
    res.status(500).json({ message: `Failed to delete user with ID ${userId}` });
  }
};
