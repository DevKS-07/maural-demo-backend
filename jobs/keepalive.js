/**
 * Supabase keep-alive — one real database read, then exit.
 *
 * Supabase's free tier pauses a project after about a week without database
 * activity, and a portfolio demo can easily sit idle that long. /api/health
 * never touches the database, so neither it nor Railway's healthcheck keeps
 * the project awake; this job does.
 *
 * Deployed as a Railway cron service built from this repo (same Dockerfile):
 *   start command:  node jobs/keepalive.js
 *   schedule:       "0 9 * * 1,3,5" — 09:00 UTC Mon/Wed/Fri; the longest gap is
 *                   three days, leaving room for a missed run inside the ~7-day window
 *   variables:      DIRECT_URL only — a reference to the API service's value
 *
 * Deliberately self-contained: it does not load config/env, which exits unless
 * all of the API's required variables are set, and it lives in jobs/ because
 * .dockerignore excludes scripts/.
 *
 * Run locally with:  node -r dotenv/config jobs/keepalive.js
 *
 * Exits non-zero on any failure, so a failed run shows as failed in Railway.
 */

const { Client } = require("pg");

const TIMEOUT_MS = 30_000;

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DIRECT_URL (or DATABASE_URL) is not set");
  }

  const client = new Client({
    connectionString,
    connectionTimeoutMillis: TIMEOUT_MS,
    query_timeout: TIMEOUT_MS,
  });

  await client.connect();
  try {
    // A real table read rather than `select 1`, so the activity is
    // unambiguous and a missing or emptied table fails loudly.
    const { rows } = await client.query(
      'SELECT count(*)::int AS orgs FROM "Organisation"',
    );
    const orgs = rows[0].orgs;
    if (orgs < 1) throw new Error('"Organisation" is empty — has the demo been wiped?');
    console.log(`[keepalive] ok — ${orgs} organisation(s) at ${new Date().toISOString()}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(`[keepalive] FAILED: ${e.message}`);
  process.exit(1);
});
