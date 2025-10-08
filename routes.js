const express = require("express");

// Import route modules
const userRoutes = require("./routes/userRoutes");
const docsRoutes = require("./routes/docsRoutes");
const homeRoutes = require("./routes/homeRoutes");

const router = express.Router();

// Home route
router.use("/", homeRoutes);

// User routes
router.use("/users", userRoutes);

// Docs routes
router.use("/docs", docsRoutes);

module.exports = router;
