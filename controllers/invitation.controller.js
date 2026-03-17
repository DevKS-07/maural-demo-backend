/**
 * Invitation Controller
 *
 * Manages user invitations via Clerk's built-in invitation API.
 * Only admins (or higher) can invite new users. The invitation email
 * is sent by Clerk; when the invitee signs up, their publicMetadata
 * (role + org_id) is copied to the new Clerk user and picked up by
 * the webhook handler to auto-assign org and role in the database.
 *
 * POST   /api/user/invite              — Send an invitation
 * GET    /api/user/invitations          — List all invitations
 * DELETE /api/user/invite/:invitationId — Revoke a pending invitation
 */

const { clerkClient } = require("@clerk/express");
const prisma = require("../lib/prisma");
const { VALID_CLERK_ROLES } = require("../config/roles");

// ---------------------------------------------------------------------------
// POST /api/user/invite — Create and send an invitation
// ---------------------------------------------------------------------------
exports.createInvitation = async (req, res) => {
  const { email_address, role, org_id } = req.body;

  if (!email_address) {
    return res.status(400).json({ message: "email_address is required" });
  }

  if (role && !VALID_CLERK_ROLES.includes(role)) {
    return res.status(400).json({
      message: `Invalid role "${role}". Valid roles: ${VALID_CLERK_ROLES.join(", ")}`,
    });
  }

  // Validate that the organisation exists (if provided)
  if (org_id) {
    try {
      const org = await prisma.organisation.findUnique({
        where: { org_id },
      });
      if (!org) {
        return res.status(404).json({ message: `Organisation with ID ${org_id} not found` });
      }
    } catch (error) {
      console.error("[invitation] Failed to validate organisation:", error.message);
      return res.status(500).json({ message: "Failed to validate organisation" });
    }
  }

  try {
    const invitation = await clerkClient.invitations.createInvitation({
      emailAddress: email_address,
      publicMetadata: {
        role: role || "org_staff",
        org_id: org_id || null,
      },
    });

    console.log(`[invitation] Invited ${email_address} (role: ${role || "org_staff"}, org: ${org_id || "none"})`);
    return res.status(201).json(invitation);
  } catch (error) {
    // Clerk throws specific errors for duplicate invitations / existing users
    if (error.status === 422 || error.errors?.[0]?.code === "duplicate_record") {
      return res.status(409).json({
        message: "An invitation has already been sent to this email address, or the user already exists.",
      });
    }

    console.error("[invitation] Failed to create invitation:", error.message);
    return res.status(500).json({ message: "Failed to create invitation" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/user/invitations — List invitations
// ---------------------------------------------------------------------------
exports.listInvitations = async (req, res) => {
  const { status } = req.query;

  try {
    const invitations = await clerkClient.invitations.getInvitationList();

    // Filter by status if query param provided (pending, accepted, revoked)
    const filtered = status
      ? invitations.data.filter((inv) => inv.status === status)
      : invitations.data;

    return res.status(200).json(filtered);
  } catch (error) {
    console.error("[invitation] Failed to list invitations:", error.message);
    return res.status(500).json({ message: "Failed to retrieve invitations" });
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/user/invite/:invitationId — Revoke a pending invitation
// ---------------------------------------------------------------------------
exports.revokeInvitation = async (req, res) => {
  const { invitationId } = req.params;

  try {
    const revoked = await clerkClient.invitations.revokeInvitation(invitationId);

    console.log(`[invitation] Revoked invitation: ${invitationId}`);
    return res.status(200).json({ message: "Invitation revoked", invitation: revoked });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ message: `Invitation with ID ${invitationId} not found` });
    }

    console.error("[invitation] Failed to revoke invitation:", error.message);
    return res.status(500).json({ message: "Failed to revoke invitation" });
  }
};
