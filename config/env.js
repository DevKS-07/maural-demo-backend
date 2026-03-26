// ─────────────────────────────────────────────────────────────────────────────
// Centralized environment configuration
// Import from here instead of using process.env directly in controllers.
// ─────────────────────────────────────────────────────────────────────────────

const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

// ── Required variables (app won't start without these) ───────────────────────
const REQUIRED = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "CLERK_SECRET_KEY",
];

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `[env] Missing required environment variables:\n  ${missing.join("\n  ")}`,
  );
  process.exit(1);
}

// ── Export all env vars from one place ────────────────────────────────────────
module.exports = {
  // App
  NODE_ENV,
  isProduction,
  PORT: process.env.PORT || 3000,
  HOST: process.env.HOST || "0.0.0.0",
  API_VERSION: process.env.apiVersion || "v1",

  // CORS — comma-separated origins, e.g. "https://app.maural.com,https://staging.maural.com"
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : ["http://localhost:3000", "http://localhost:5173"],

  // Auth
  DISABLE_AUTH: !isProduction && process.env.DISABLE_AUTH === "true",
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
  CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET,

  // Database
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  // Ollama / LLM
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  OLLAMA_API_KEY: process.env.OLLAMA_API_KEY || "",
  OLLAMA_CHAT_MODEL: process.env.OLLAMA_CHAT_MODEL || "qwen3.5:9b",
  OLLAMA_EMBED_MODEL: process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text",
  GUARDRAIL_CONFIDENCE_THRESHOLD:
    process.env.GUARDRAIL_CONFIDENCE_THRESHOLD || "90",

  // HubSpot
  HUBSPOT_CLIENT_ID: process.env.HUBSPOT_CLIENT_ID,
  HUBSPOT_CLIENT_SECRET: process.env.HUBSPOT_CLIENT_SECRET,
  HUBSPOT_REDIRECT_URI: process.env.HUBSPOT_REDIRECT_URI,

  // QuickBooks
  QUICKBOOKS_CLIENT_ID: process.env.QUICKBOOKS_CLIENT_ID,
  QUICKBOOKS_CLIENT_SECRET: process.env.QUICKBOOKS_CLIENT_SECRET,
  QUICKBOOKS_REDIRECT_URI: process.env.QUICKBOOKS_REDIRECT_URI,
  QUICKBOOKS_ENVIRONMENT: process.env.QUICKBOOKS_ENVIRONMENT || "sandbox",
  QUICKBOOKS_BASE_URL: process.env.QUICKBOOKS_BASE_URL,

  // Monday.com
  MONDAY_CLIENT_ID: process.env.MONDAY_CLIENT_ID,
  MONDAY_CLIENT_SECRET: process.env.MONDAY_CLIENT_SECRET,
  MONDAY_REDIRECT_URI: process.env.MONDAY_REDIRECT_URI,

  // ClickUp
  CLICKUP_CLIENT_ID: process.env.CLICKUP_CLIENT_ID,
  CLICKUP_CLIENT_SECRET: process.env.CLICKUP_CLIENT_SECRET,
  CLICKUP_REDIRECT_URI: process.env.CLICKUP_REDIRECT_URI,

  // Frontend
  FRONTEND_REDIRECT_URI: process.env.FRONTEND_REDIRECT_URI || "http://localhost:5173/integrations",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
};
