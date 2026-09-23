require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const { clerkMiddleware } = require("@clerk/express");
const { ALLOWED_ORIGINS, isProduction, DISABLE_AUTH } = require("./config/env");
const { demoAuth } = require("./middleware/demoAuth.middleware");
const routes = require("./routes");

// Allow JSON.stringify() to serialize Prisma BigInt fields
BigInt.prototype.toJSON = function () {
  return Number(this);
};

const app = express();

// Trust the first proxy (Railway, AWS ALB, nginx) so req.ip is the real client IP
app.set("trust proxy", 1);

// Health check — before any auth middleware so Docker/Railway probes always work
app.get("/api/health", (req, res) => {
  const mem = process.memoryUsage();
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024), // total allocated (MB)
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024), // JS heap in use (MB)
    },
    environment: process.env.NODE_ENV || "development",
  });
});

// CORS — must be before Clerk so preflight OPTIONS requests get proper headers
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

// Clerk middleware — must be before routes so req.auth() is available everywhere.
// In demo mode Clerk is replaced rather than merely bypassed: twelve controller
// call sites read req.auth() directly, and with Clerk mounted but no session
// they resolve no user and fail quietly. See middleware/demoAuth.middleware.js.
app.use(DISABLE_AUTH ? demoAuth : clerkMiddleware());

// Raw body parser for Clerk webhook route — must come before express.json()
// Svix needs the unparsed request body to verify the webhook signature
app.use("/api/webhooks", express.raw({ type: "application/json" }));

// General middlewares
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(express.json({ limit: "1mb" }));
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  compression({
    // Skip compression for SSE streams — compressed chunked responses break
    // HTTP/2 framing on Railway/Vercel proxies, causing ERR_HTTP2_PROTOCOL_ERROR
    filter: (req, res) => {
      if (req.path === "/api/chat/stream") return false;
      return compression.filter(req, res);
    },
  }),
);
app.use(cookieParser());

// Rate limiting — protects against brute-force and denial-of-service
// Relaxed limits in development to avoid 429s during testing
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // TODO: lower back to 100 after development
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  message: { error: "Too many requests, please try again later." },
});
app.use(globalLimiter);

// Stricter limit for chat — LLM calls are expensive
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // TODO: lower back to 20 after development
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Chat rate limit exceeded, please try again later." },
});
app.use("/api/chat", chatLimiter);
// Request logging — JSON in production (machine-parseable), dev format locally (colorized)
if (isProduction) {
  app.use(
    morgan((tokens, req, res) =>
      JSON.stringify({
        method: tokens.method(req, res),
        url: tokens.url(req, res),
        status: Number(tokens.status(req, res)),
        responseTime: Number(tokens["response-time"](req, res)),
        contentLength: tokens.res(req, res, "content-length"),
        timestamp: new Date().toISOString(),
      }),
    ),
  );
} else {
  app.use(morgan("dev"));
}

// Routes
app.use("/api", routes);

// #######################################################
// ############# 404 & Error Handling Routes #############
// #######################################################

// 500 handler for server errors — never leak internals to the client
app.use((err, req, res, _next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({
    message:
      status === 500
        ? "Something went wrong on our side. We're working to fix it!"
        : err.message,
  });
});

// 404 handler for undefined routes — JSON for API consistency
app.use((req, res) => {
  res.status(404).json({ message: "Not Found" });
});

module.exports = app;
