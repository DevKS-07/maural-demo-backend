/**
 * Demo deployment gate — the shared-password check and the destructive-route
 * block. Both are demo-only shims and are mounted together from app.js when
 * DISABLE_AUTH is on.
 *
 * The password is not a security boundary in the usual sense: it is published
 * alongside the demo link. Its job is to stop a crawler or a drive-by visitor
 * from running the chat pipeline, which costs real money per message.
 */

const crypto = require("crypto");
const { DEMO_ACCESS_KEY } = require("../config/env");

// Paths that skip the password check. Kept minimal and explicit — see the
// "Shared contract" table in DEMO_RUNBOOK.md, which the frontend builds against.
// /api/health is registered in app.js before this middleware is mounted, so it
// is already unreachable from here; it is listed anyway so the exemption is
// stated in one obvious place rather than resting on mount order.
const EXEMPT_PATHS = new Set(["/api/health"]);

// Fail at startup rather than per-request: a missing key would otherwise leave
// the demo either wide open or uniformly 401, both discovered only in the
// browser. Mirrors demoAuth's startup check.
if (!DEMO_ACCESS_KEY) {
  throw new Error(
    "demoGate: DEMO_ACCESS_KEY is not set. It is required whenever DISABLE_AUTH " +
      "is on — without it the demo would be publicly writable and the chat " +
      "endpoint publicly billable.",
  );
}

/**
 * Constant-time compare, so the endpoint does not leak the key's prefix through
 * response timing. Length is compared first because timingSafeEqual throws on a
 * length mismatch.
 */
function keyMatches(candidate) {
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(DEMO_ACCESS_KEY, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Rejects any request that does not carry `Authorization: Bearer <key>`.
 */
const requireDemoKey = (req, res, next) => {
  // CORS preflight carries no Authorization header by design. cors() normally
  // answers OPTIONS before this runs; this is belt-and-braces so a mount-order
  // change cannot turn every cross-origin request into a 401.
  if (req.method === "OPTIONS") return next();
  if (EXEMPT_PATHS.has(req.path)) return next();

  const header = req.get("Authorization") || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token || !keyMatches(token)) {
    return res.status(401).json({
      message:
        "This demo is password protected. Enter the demo passphrase to continue.",
      demo: true,
    });
  }

  next();
};

/**
 * Blocks the routes that would let a visitor damage the demo tenant.
 *
 * `POST /api/docs` is deliberately NOT here — uploading is part of what the
 * demo shows, and the deferred Phase 3 ingestion step goes through it.
 *
 * `POST /api/chat/ingest` is the expensive one: it re-embeds every file in the
 * database on demand, so an unauthenticated caller could run up the OpenAI bill
 * repeatedly.
 */
const BLOCKED_ROUTES = [
  // Org: delete, rename/update, and create. Create is included because new
  // organisations appear on the admin scorecard, so an anonymous POST would
  // visibly pollute the demo for the next visitor.
  { methods: ["POST"], pattern: /^\/api\/org\/?$/ },
  { methods: ["PUT", "DELETE"], pattern: /^\/api\/org\/[^/]+\/?$/ },

  { methods: ["PUT", "DELETE"], pattern: /^\/api\/user\/[^/]+\/?$/ },

  // Document delete and metadata update (rename / recategorise). Note this
  // pattern requires an id segment, so POST /api/docs — the upload route — is
  // deliberately unaffected.
  { methods: ["PUT", "DELETE"], pattern: /^\/api\/docs\/[^/]+\/?$/ },

  { methods: ["POST"], pattern: /^\/api\/chat\/ingest\/?$/ },

  // VTO create / update / delete. The VTO is free text that every later visitor
  // sees and that businessDataService feeds into the chat prompt, so a write
  // would let one visitor put words in the chatbot's mouth for everyone after
  // them. The frontend keeps the editor, saving to the visitor's browser only.
  { methods: ["POST", "PUT", "DELETE"], pattern: /^\/api\/vto\/[^/]+\/?$/ },

  // Labor KPI source override. Guarded only by requireAuth (a pass-through in
  // demo mode), so any persona could change it, and nothing in the demo needs it.
  { methods: ["PUT"], pattern: /^\/api\/integrations\/labor-config\/?$/ },

  // Integration disconnects — also requireAuth-only. Disconnecting Monday
  // clears the org's laborSource, after which the labor service returns a
  // "not configured" result instead of failing, so the dashboard's seeded
  // fallback never runs and the labor section goes blank for every visitor.
  // The frontend's connect flow is browser-only and never calls these.
  {
    methods: ["DELETE"],
    pattern: /^\/api\/integrations\/(hubspot|quickbooks|monday|clickup)\/disconnect\/?$/,
  },
];

const blockDestructiveRoutes = (req, res, next) => {
  const blocked = BLOCKED_ROUTES.some(
    (r) => r.methods.includes(req.method) && r.pattern.test(req.path),
  );

  if (blocked) {
    return res.status(403).json({
      message:
        "This action is disabled in the demo. The underlying feature works in " +
        "the full application.",
      demo: true,
    });
  }

  next();
};

module.exports = { requireDemoKey, blockDestructiveRoutes, BLOCKED_ROUTES };
