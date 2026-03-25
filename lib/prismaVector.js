/**
 * Dedicated Prisma client for vector similarity queries.
 *
 * Uses DIRECT_URL (bypasses pgbouncer) because pgbouncer rejects or truncates
 * very long query strings — which our 768-dimensional vector literals produce
 * (≈19 KB SQL). The regular prisma client uses DATABASE_URL with pgbouncer=true.
 */
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { DIRECT_URL } = require("../config/env");

// Fall back to DATABASE_URL if DIRECT_URL is not set
const connectionString = DIRECT_URL || process.env.DATABASE_URL;

const adapter = new PrismaPg({ connectionString });

const prismaVector =
  global.__prismaVector ??
  new PrismaClient({
    adapter,
    log: ["warn", "error"],
  });

// Cache to avoid multiple instances during hot-reload
global.__prismaVector = prismaVector;

module.exports = prismaVector;
