const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { DATABASE_URL, isProduction } = require("../config/env");
const adapter = new PrismaPg({
  connectionString: DATABASE_URL,
});

// Singleton pattern — prevents multiple PrismaClient instances during hot-reload in dev
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: isProduction ? ["warn", "error"] : ["query", "warn", "error"],
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
