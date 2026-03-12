const { Webhook } = require("svix");
const { clerkClient } = require("@clerk/express");
const prisma = require("../lib/prisma");
const { CLERK_WEBHOOK_SECRET } = require("../config/env");

const DEFAULT_CLERK_ROLE = "client_staff";

// ---------------------------------------------------------------------------
// Clerk role name → DB role_name mapping
// These must match exactly what is defined in the Clerk dashboard
// and what exists in the Role table in the database.
// ---------------------------------------------------------------------------
const CLERK_ROLE_TO_DB_ROLE = {
  super_admin: "Super Admin",
  admin: "Admin",
  client_executive: "Client Executive",
  client_staff: "Client Staff",
};

// ---------------------------------------------------------------------------
// handleClerkWebhook
// Receives and processes Clerk webhook events.
// Verifies the Svix signature, then syncs user data to our DB.
//
// Handled events:
//   user.created → create User record in DB
//   user.updated → update User record in DB (name, email, role changes)
//   user.deleted → delete User record from DB
//
// @route POST /api/webhooks/clerk
// @access Public (no auth — must be verified via Svix signature)
// ---------------------------------------------------------------------------
exports.handleClerkWebhook = async (req, res) => {
  if (!CLERK_WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SECRET is not set");
    return res.status(500).json({ message: "Webhook secret not configured" });
  }

  // Svix requires these three headers to verify the signature
  const svixId = req.headers["svix-id"];
  const svixTimestamp = req.headers["svix-timestamp"];
  const svixSignature = req.headers["svix-signature"];

  if (!svixId || !svixTimestamp || !svixSignature) {
    return res.status(400).json({ message: "Missing Svix headers" });
  }

  // Verify signature — req.body is a raw Buffer because of the
  // express.raw() middleware applied to /api/webhooks in app.js
  let event;
  try {
    const wh = new Webhook(CLERK_WEBHOOK_SECRET);
    event = wh.verify(req.body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ message: "Invalid webhook signature" });
  }

  const { type, data } = event;
  console.log(`[Clerk Webhook] Received event: ${type}`);

  try {
    switch (type) {
      case "user.created": {
        const clerkRole = data.public_metadata?.role || DEFAULT_CLERK_ROLE;
        let role_id = undefined;

        if (CLERK_ROLE_TO_DB_ROLE[clerkRole]) {
          const dbRole = await prisma.role.findFirst({
            where: { role_name: CLERK_ROLE_TO_DB_ROLE[clerkRole] },
          });
          if (dbRole) role_id = dbRole.role_id;
        }

        // If the user signed up without a role in public_metadata,
        // sync the default role back to Clerk so sessionClaims stay in sync
        if (!data.public_metadata?.role) {
          await clerkClient.users.updateUserMetadata(data.id, {
            publicMetadata: { role: clerkRole },
          });
          console.log(`[Clerk Webhook] Set default role "${clerkRole}" on Clerk user: ${data.id}`);
        }

        const primaryEmail = data.email_addresses?.find(
          (e) => e.id === data.primary_email_address_id,
        )?.email_address;

        await prisma.user.create({
          data: {
            clerk_id: data.id,
            first_name: data.first_name || "",
            last_name: data.last_name || "",
            email: primaryEmail || "",
            role_id: role_id ?? undefined,
          },
        });

        console.log(`[Clerk Webhook] Created user: ${data.id}`);
        break;
      }

      case "user.updated": {
        const clerkRole = data.public_metadata?.role;
        let role_id = undefined;

        if (clerkRole && CLERK_ROLE_TO_DB_ROLE[clerkRole]) {
          const dbRole = await prisma.role.findFirst({
            where: { role_name: CLERK_ROLE_TO_DB_ROLE[clerkRole] },
          });
          if (dbRole) role_id = dbRole.role_id;
        }

        const primaryEmail = data.email_addresses?.find(
          (e) => e.id === data.primary_email_address_id,
        )?.email_address;

        await prisma.user.update({
          where: { clerk_id: data.id },
          data: {
            first_name: data.first_name || undefined,
            last_name: data.last_name || undefined,
            email: primaryEmail || undefined,
            role_id: role_id ?? undefined,
          },
        });

        console.log(`[Clerk Webhook] Updated user: ${data.id}`);
        break;
      }

      case "user.deleted": {
        const deleted = await prisma.user.deleteMany({
          where: { clerk_id: data.id },
        });

        if (deleted.count === 0) {
          console.warn(`[Clerk Webhook] User not found in DB, skipping delete: ${data.id}`);
        } else {
          console.log(`[Clerk Webhook] Deleted user: ${data.id}`);
        }
        break;
      }

      default:
        console.log(`[Clerk Webhook] Unhandled event type: ${type}`);
    }

    res.status(200).json({ message: "Webhook processed" });
  } catch (error) {
    console.error(`[Clerk Webhook] Error processing event ${type}:`, error.message);
    res.status(500).json({ message: "Failed to process webhook event", error: error.message });
  }
};

// ---------------------------------------------------------------------------
// getMe
// Returns the current authenticated user's full DB record.
// Uses the Clerk userId from the JWT to look up the user by clerk_id.
//
// @route GET /api/auth/me
// @access Protected (requireAuth)
// ---------------------------------------------------------------------------
exports.getMe = async (req, res) => {
  const { userId: clerkId } = req.auth();

  try {
    const user = await prisma.user.findUnique({
      where: { clerk_id: clerkId },
      include: {
        Role: {
          include: {
            RolePermission: {
              include: { Permission: true },
            },
          },
        },
        Client: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found in database" });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve user profile", error: error.message });
  }
};
