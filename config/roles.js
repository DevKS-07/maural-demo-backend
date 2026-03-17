/**
 * Shared Clerk role → DB role mapping.
 *
 * Used by the auth webhook (to resolve role_id on user creation)
 * and the invitation controller (to validate the role before inviting).
 *
 * These keys must match exactly what is defined in the Clerk dashboard
 * and what exists in the Role table in the database.
 */
const CLERK_ROLE_TO_DB_ROLE = {
  super_admin: "Super Admin",
  admin: "Admin",
  org_executive: "Org Executive",
  org_staff: "Org Staff",
};

const VALID_CLERK_ROLES = Object.keys(CLERK_ROLE_TO_DB_ROLE);

module.exports = { CLERK_ROLE_TO_DB_ROLE, VALID_CLERK_ROLES };
