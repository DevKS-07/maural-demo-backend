const express = require("express");

// Route modules
const homeRoutes = require("./routes/home.routes");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const orgRoutes = require("./routes/org.routes");
const docsRoutes = require("./routes/docs.routes");
const chatRoutes = require("./routes/chat.routes");
const integrations = require("./routes/integrations.routes");
const summaryRoutes = require("./routes/summary.routes");
const vtoRoutes = require("./routes/vto.routes");

// Auth middleware
const { requireAuth } = require("./middleware/auth.middleware");

const router = express.Router();

router.use(express.json());

// ****************************  PUBLIC ROUTES  ****************************

router.use("/", homeRoutes);

// Clerk webhook endpoint — must be public (no requireAuth).
// express.raw() body parser for this path is applied in app.js
// so Svix can verify the raw request body signature.
router.use("/webhooks", authRoutes);

// ****************************  PROTECTED ROUTES  *************************
// All routes below require a valid Clerk JWT (returns 401 if missing/invalid)

router.use("/auth", requireAuth, authRoutes); // GET /api/auth/me

router.use("/user", requireAuth, userRoutes); // User CRUD + activity/files/comments/permissions

router.use("/org", requireAuth, orgRoutes); // Organisation CRUD + users/files

router.use("/docs", requireAuth, docsRoutes); // Documents + comments + activity

router.use("/integrations", integrations); // HubSpot, QuickBooks, Monday, ClickUp (auth handled per-route)

router.use("/summary", requireAuth, summaryRoutes); // KPI summary routes

router.use("/chat", requireAuth, chatRoutes); // AI chat

router.use("/vto", requireAuth, vtoRoutes); // VTO CRUD

module.exports = router;
