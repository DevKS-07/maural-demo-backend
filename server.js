require("dotenv").config({
  path: `.env.${process.env.NODE_ENV || "development"}.local`,
});

// Centralized env validation — will exit with a clear error if required vars are missing
const { PORT, HOST } = require("./config/env");
const app = require("./app");

/* Start the server */
const server = app.listen(PORT, HOST, () => {
  console.log(`Server is running at http://${HOST}:${PORT}/api`);
});

/* Graceful shutdown — Railway/Docker sends SIGTERM before stopping the container */
const shutdown = (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    console.error("Forcefully shutting down.");
    process.exit(1);
  }, 10_000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
