const express = require("express");

// Import route modules
const userRoutes = require("./routes/userRoutes");
const docsRoutes = require("./routes/docsRoutes");
const homeRoutes = require("./routes/homeRoutes");

const router = express.Router();

// TODO: Add a restrict middleware for protected routes (i.e only logged in users can access the routes)

// TODO: Add role based access control (RBAC) middleware (i.e. super admin, admin, client executive, employee (client), etc.)

// Home route
router.use("/", homeRoutes);

// User routes
router.use("/users", userRoutes);

// Docs routes
router.use("/docs", docsRoutes);

module.exports = router;
