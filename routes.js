const express = require("express");

// Import route modules
const homeRoutes = require("./routes/homeRoutes");
const adminRoutes = require("./routes/adminRoutes");
const clientRoutes = require("./routes/clientRoutes");
const docsRoutes = require("./routes/docsRoutes");
const { loginUser, logoutUser } = require("./controllers/userController");

const router = express.Router();

// Home route
router.use("/", homeRoutes);

// Login route (Open to all users; Restrict access for logged in users)
router.post("/login", loginUser);

//////////////////////////////////////////////////////////////////////////////////////////////
//            RESTRICTED ROUTES (only logged in users can access these routes)
//////////////////////////////////////////////////////////////////////////////////////////////

// TODO: Add a restricted_access middleware for protected routes (i.e only logged in users can access the routes)
// TODO: Add role based access control (RBAC) middlewares (i.e. super admin, admin, client executive, employee (client), etc.)

// Admin routes (Protected routes, only accessible by admin users)
router.use("/admin", adminRoutes);

// Client routes (Public routes, accessible by all users)
router.use("/client", clientRoutes);

// Docs routes
router.use("/docs", docsRoutes);

// AI routes (Can be implemented later) -- Can also be implemented in the frontend instead
router.use("/ai", aiRoutes);

// Login route (Open to all users; Restrict access for logged in users)
router.post("/logout", logoutUser);

module.exports = router;
