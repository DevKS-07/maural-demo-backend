const { requireAuth } = require("@clerk/express");

// ---------------------------------------------------------------------------
// requireAuth
// Rejects unauthenticated requests with 401.
// Use this on any route that requires the user to be signed in.
// ---------------------------------------------------------------------------
exports.requireAuth = requireAuth();

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
//
// Usage:
//   router.delete("/:id", requireAuth, requireRole("admin"), handler);
//
// @param {string} minRole - Minimum role required (e.g. "admin", "super_admin")
// ---------------------------------------------------------------------------
exports.requireRole = (minRole) => (req, res, next) => {
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
