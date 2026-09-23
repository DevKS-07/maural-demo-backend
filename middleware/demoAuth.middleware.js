/**
 * Demo identity stub — replaces clerkMiddleware() when DISABLE_AUTH is on.
 *
 * Twelve call sites across the controllers resolve identity by calling
 * `req.auth()` directly rather than going through the auth middleware, so
 * simply disabling auth is not enough: with Clerk mounted and no session they
 * get `{ userId: null }` and fail *quietly* — 401/403/404 rather than an
 * error. `docs.controller.js:169` is the one that matters most here, because
 * its inline org check is what rejects document uploads before anything is
 * ingested.
 *
 * Stubbing `req.auth` fixes all twelve at once. The persona comes from the
 * `X-Demo-Role` request header, which is what the frontend's persona switcher
 * sets.
 */

const { VALID_CLERK_ROLES } = require("../config/roles");

/** Persona used when the header is absent or not recognised. */
const DEFAULT_ROLE = "org_executive";

/**
 * Persona -> seeded `clerk_id`. These strings are part of the backend/frontend
 * shared contract and must match the ids seeded by `prisma/seed.js`: a
 * mismatch resolves no user, and non-admin personas then fail the org check
 * with a 403 that looks like a permissions bug rather than a seeding one.
 */
const DEMO_USERS = {
  super_admin: "demo_super_admin",
  admin: "demo_admin",
  org_executive: "demo_org_executive",
  org_staff: "demo_org_staff",
};

// Fail at startup rather than per-request if the persona list ever drifts from
// config/roles.js — the runtime symptom would otherwise be a silent fallback
// to the default persona.
const missing = VALID_CLERK_ROLES.filter((r) => !DEMO_USERS[r]);
if (missing.length) {
  throw new Error(
    `demoAuth: no demo user mapped for role(s): ${missing.join(", ")}`,
  );
}

/**
 * An unrecognised header value falls back to the default persona rather than
 * producing an undefined `userId`, which would surface downstream as a failed
 * user lookup instead of a bad-header problem.
 */
function resolveRole(req) {
  const requested = req.get("X-Demo-Role");
  return VALID_CLERK_ROLES.includes(requested) ? requested : DEFAULT_ROLE;
}

/**
 * Shapes `req.auth` exactly like Clerk's: a function returning `userId` and
 * `sessionClaims.publicMetadata.role`.
 */
const demoAuth = (req, res, next) => {
  const role = resolveRole(req);
  const userId = DEMO_USERS[role];

  req.auth = () => ({
    userId,
    sessionClaims: { publicMetadata: { role } },
  });

  next();
};

module.exports = { demoAuth, DEMO_USERS, DEFAULT_ROLE };
