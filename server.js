require("dotenv").config({
  path: `.env.${process.env.NODE_ENV || "development"}.local`,
});

// Centralized env validation — will exit with a clear error if required vars are missing
const { PORT, HOST } = require("./config/env");
const app = require("./app");
const prisma = require("./lib/prisma");

/* Start the server */
const server = app.listen(PORT, HOST, () => {
  console.log(`Server is running at http://${HOST}:${PORT}/api`);
});

/* Graceful shutdown — Railway/Docker sends SIGTERM before stopping the container */
const shutdown = async (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`);

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    console.error("Forcefully shutting down.");
    process.exit(1);
  }, 10_000);

  server.close(async () => {
    console.log("HTTP server closed.");
    await prisma.$disconnect();
    console.log("Database connections closed.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

/* Safety nets — log and exit on truly unexpected errors */
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  shutdown("unhandledRejection");
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  shutdown("uncaughtException");
});
