require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const { clerkMiddleware } = require("@clerk/express");
const { ALLOWED_ORIGINS, isProduction } = require("./config/env");
const routes = require("./routes");

const app = express();

// Trust the first proxy (Railway, AWS ALB, nginx) so req.ip is the real client IP
app.set("trust proxy", 1);

// Clerk middleware — must be first so req.auth() is available everywhere
app.use(clerkMiddleware());

// Raw body parser for Clerk webhook route — must come before express.json()
// Svix needs the unparsed request body to verify the webhook signature
app.use("/api/webhooks", express.raw({ type: "application/json" }));

// General middlewares
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(express.json({ limit: "10kb" }));
app.use(helmet());
app.use(compression());

// Rate limiting — protects against brute-force and denial-of-service
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // 100 requests per window per IP
  standardHeaders: true,     // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,      // Disable X-RateLimit-* headers
  message: { error: "Too many requests, please try again later." },
});
app.use(globalLimiter);

// Stricter limit for chat — LLM calls are expensive
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Chat rate limit exceeded, please try again later." },
});
app.use("/api/chat", chatLimiter);
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  }),
);
app.use(cookieParser());
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

// Health check — used by Docker HEALTHCHECK and Railway deploy checks
app.get("/api/health", (req, res) => {
  const mem = process.memoryUsage();
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024),       // total allocated (MB)
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024), // JS heap in use (MB)
    },
    environment: process.env.NODE_ENV || "development",
  });
});

// Routes
app.use("/api", routes);

// #######################################################
// ############# 404 & Error Handling Routes #############
// #######################################################

// 500 handler for server errors — never leak internals to the client
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({
    message: status === 500
      ? "Something went wrong on our side. We're working to fix it!"
      : err.message,
  });
});

// 404 handler for undefined routes
app.use((req, res) => {
  console.log("Error 404: Not Found");
  res.status(404).send("Error 404: Not Found");
});

module.exports = app;
