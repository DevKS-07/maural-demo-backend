const { requireAuth: clerkRequireAuth } = require("@clerk/express");
const { DISABLE_AUTH } = require("../config/env");
const prisma = require("../lib/prisma");

// ---------------------------------------------------------------------------
// Auth toggle — set DISABLE_AUTH=true to bypass *authentication* (the "are you
// logged in?" check) during development/testing and in the demo deployment.
// Blocked in production by config/env.js.
//
// It does NOT bypass authorization. requireRole and requireOrgAccess still
// evaluate, against whatever identity is mounted on req.auth — Clerk's session
// normally, or the demo persona stub (middleware/demoAuth.middleware.js) when
// DISABLE_AUTH is on. app.js mounts exactly one of the two, so req.auth is
// always populated and the role/org checks always have something real to read.
//
// They used to short-circuit under this flag as well, which made the demo's
// four-persona switcher cosmetic: org_staff received the admin-only scorecard
// with a 200. See the [CONFLICT] decision in DEMO_RUNBOOK.md.
// ---------------------------------------------------------------------------
const AUTH_DISABLED = DISABLE_AUTH;

if (AUTH_DISABLED) {
  console.warn(
    "[auth] WARNING !!! DISABLE_AUTH=true — authentication is bypassed; " +
      "role and organisation checks still apply",
  );
}

const passThrough = (req, res, next) => next();

// Guard for the (unreachable) case where neither Clerk nor the demo stub is
// mounted: req.auth would be undefined and calling it would throw a 500 out of
// a security middleware. Mirrors the inline check at docs.controller.js:169.
const hasIdentity = (req) => typeof req.auth === "function";

// ---------------------------------------------------------------------------
// requireAuth
// Rejects unauthenticated requests with 401.
// Bypassed when DISABLE_AUTH=true.
// ---------------------------------------------------------------------------
exports.requireAuth = AUTH_DISABLED ? passThrough : clerkRequireAuth();

// ---------------------------------------------------------------------------
// Role hierarchy — maps Clerk role names to numeric privilege levels.
// Matches the roles defined in the Clerk dashboard.
// ---------------------------------------------------------------------------
const ROLE_HIERARCHY = {
  super_admin: 4,
  admin: 3,
  org_executive: 2,
  org_staff: 1,
};

// ---------------------------------------------------------------------------
// requireRole(minRole)
// RBAC middleware — reads the role from publicMetadata and rejects requests
// where the user's role is below the required minimum. Under DISABLE_AUTH the
// role comes from the demo persona stub rather than a Clerk JWT; the check
// itself runs either way.
//
// Usage:
//   router.delete("/:id", requireAuth, requireRole("admin"), handler);
//
// @param {string} minRole - Minimum role required (e.g. "admin", "super_admin")
// ---------------------------------------------------------------------------
exports.requireRole = (minRole) => {
  return (req, res, next) => {
    if (!hasIdentity(req)) return next();

    const { sessionClaims } = req.auth();
    const userRole = sessionClaims?.publicMetadata?.role;

    if (!userRole) {
      return res.status(403).json({ message: "No role assigned to this user" });
    }

    if (ROLE_HIERARCHY[userRole] === undefined) {
      return res.status(403).json({ message: `Unknown role: ${userRole}` });
    }

    if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[minRole]) {
      return res.status(403).json({
        message: `Insufficient permissions. Required: ${minRole}, your role: ${userRole}`,
      });
    }

    next();
  };
};

// ---------------------------------------------------------------------------
// requireOrgAccess(orgIdSource)
// Ensures non-admin users can only access their own organisation's data.
// Admins and super_admins bypass the check (cross-org access allowed).
//
// Runs under DISABLE_AUTH too, resolving the org from the demo persona's
// seeded clerk_id. The "body" form is also the only thing sanitising
// req.body.orgIds before it reaches ragService — see the SQL-injection finding
// in DEMO_RUNBOOK.md. It does not cover the admin personas, which bypass this
// check entirely, so the query is parameterised as well.
//
// @param {"params"|"body"} orgIdSource
//   - "params": validates req.params.orgId matches the user's org (403 if not)
//   - "body":   force-overrides req.body.orgIds with the user's org
//
// Usage:
//   router.get("/:orgId", requireOrgAccess("params"), handler);
//   router.post("/", requireOrgAccess("body"), handler);
// ---------------------------------------------------------------------------
exports.requireOrgAccess = (orgIdSource = "params") => {
  return async (req, res, next) => {
    if (!hasIdentity(req)) return next();

    const { sessionClaims, userId: clerkId } = req.auth();
    const userRole = sessionClaims?.publicMetadata?.role;

    // Admins have cross-org access
    if (userRole === "admin" || userRole === "super_admin") {
      return next();
    }

    // Look up user's org from DB
    const user = await prisma.user.findUnique({
      where: { clerk_id: clerkId },
      select: { org_id: true },
    });

    if (!user?.org_id) {
      return res
        .status(403)
        .json({ message: "You are not assigned to any organisation" });
    }

    if (orgIdSource === "params") {
      const requestedOrgId = req.params.orgId;
      if (requestedOrgId && requestedOrgId !== user.org_id) {
        return res.status(403).json({
          message: "You can only access your own organisation's data",
        });
      }
    } else if (orgIdSource === "body") {
      req.body.orgIds = user.org_id;
    }

    next();
  };
};
