const { requireAuth: clerkRequireAuth } = require("@clerk/express");

// ---------------------------------------------------------------------------
// Auth toggle — set DISABLE_AUTH=true in .env.development.local or
// .env.test.local to bypass all auth checks during development/testing.
// Never set this in production.
// ---------------------------------------------------------------------------
const AUTH_DISABLED = process.env.DISABLE_AUTH === "true";

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
  client_executive: 2,
  client_staff: 1,
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
