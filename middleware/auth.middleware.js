const { requireAuth: clerkRequireAuth } = require("@clerk/express");
const { DISABLE_AUTH } = require("../config/env");
const prisma = require("../lib/prisma");

// ---------------------------------------------------------------------------
// Auth toggle — set DISABLE_AUTH=true in .env.development.local or
// .env.test.local to bypass all auth checks during development/testing.
// Blocked in production by config/env.js.
// ---------------------------------------------------------------------------
const AUTH_DISABLED = DISABLE_AUTH;

if (AUTH_DISABLED) {
  console.warn(
    "[auth] WARNING !!! DISABLE_AUTH=true — all routes are publicly accessible",
  );
}

const passThrough = (req, res, next) => next();

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
// RBAC middleware — reads the role from the Clerk JWT's publicMetadata and
// rejects requests where the user's role is below the required minimum.
// Bypassed when DISABLE_AUTH=true.
//
// Usage:
//   router.delete("/:id", requireAuth, requireRole("admin"), handler);
//
// @param {string} minRole - Minimum role required (e.g. "admin", "super_admin")
// ---------------------------------------------------------------------------
exports.requireRole = (minRole) => {
  if (AUTH_DISABLED) return passThrough;

  return (req, res, next) => {
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
// @param {"params"|"body"} orgIdSource
//   - "params": validates req.params.orgId matches the user's org (403 if not)
//   - "body":   force-overrides req.body.orgIds with the user's org
//
// Usage:
//   router.get("/:orgId", requireOrgAccess("params"), handler);
//   router.post("/", requireOrgAccess("body"), handler);
// ---------------------------------------------------------------------------
exports.requireOrgAccess = (orgIdSource = "params") => {
  if (AUTH_DISABLED) return passThrough;

  return async (req, res, next) => {
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
