const express = require("express");

// Import route modules
const homeRoutes = require("./routes/homeRoutes");
const adminRoutes = require("./routes/adminRoutes");
const clientRoutes = require("./routes/clientRoutes");
const docsRoutes = require("./routes/docsRoutes");
const aiRoutes = require("./routes/aiRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const integrations = require("./routes/integrations");
const { loginUser, logoutUser, registerUser } = require("./controllers/user.controller");

const router = express.Router();

// Home route
router.use("/", homeRoutes);

router.use("/upload", uploadRoutes);

router.post("/signup", registerUser);

// Login route (Open to all users; Restrict access for logged in users)
router.post("/login", loginUser);

//////////////////////////////////////////////////////////////////////////////////////////////
//            RESTRICTED ROUTES (only logged in users can access these routes)
//////////////////////////////////////////////////////////////////////////////////////////////

// TODO: Add a restricted_access middleware for protected routes (i.e only logged in users can access the routes)
// TODO: Add role based access control (RBAC) middlewares (i.e. super admin, admin, client executive, employee (client), etc.)

router.use("/admin", adminRoutes); // Admin routes (Protected routes, only accessible by admin users)

router.use("/client", clientRoutes); // Client routes (Protected routes, only accessible by all clients)

router.use("/docs", docsRoutes); // Docs routes

router.use("/ai", aiRoutes); // AI routes (Can be implemented later) -- Can also be implemented in the frontend instead

router.use("/integrations", integrations); // External API routes (Protected routes, only accessible by logged in users)

router.post("/logout", logoutUser); // Logout route (Protected route, only accessible by logged in users)

//////////////////////////////////////////////////////////////////////////////////////////////
//                          END OF RESTRICTED ROUTES
//////////////////////////////////////////////////////////////////////////////////////////////

module.exports = router;
