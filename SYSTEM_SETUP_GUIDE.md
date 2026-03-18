# System Setup & User Management Guide

This guide documents the complete workflow for bootstrapping the Maural KMS system — from creating the first Super Admin to onboarding organisations and users.

---

## Prerequisites

Before starting, ensure you have:

- A [Clerk](https://clerk.com) account with a project configured
- The following environment variables set in `.env.development.local`:
  - `CLERK_SECRET_KEY` — your Clerk secret key
  - `CLERK_PUBLISHABLE_KEY` — your Clerk publishable key
  - `CLERK_WEBHOOK_SECRET` — the Svix signing secret for the Clerk webhook
- The database migrated and seeded with the four roles:
  - **Super Admin** — full system access
  - **Admin** — manages users, organisations, and invitations
  - **Org Executive** — organisation-level management
  - **Org Staff** — standard organisation member

---

## Role Hierarchy

| Clerk Role (publicMetadata) | DB Role Name  | Description |
|------------------------------|---------------|-------------|
| `super_admin`                | Super Admin   | Full system access, manages all organisations and admins |
| `admin`                      | Admin         | Manages users, invitations, and organisations |
| `org_executive`              | Org Executive | Organisation-level management and reporting |
| `org_staff`                  | Org Staff     | Standard member, can access assigned organisation's resources |

---

## Step 1: Enable Invitation-Only Sign-up in Clerk

1. Go to your **Clerk Dashboard**
2. Navigate to **Configure → Restrictions**
3. Set sign-up mode to **Invitation only** (or enable **Allowlist**)
4. This blocks public sign-ups — only users who receive an invitation link can create an account

---

## Step 2: Create the First Super Admin

Since sign-ups are invitation-only and there are no admins yet to send invitations, the first Super Admin must be created manually through the Clerk dashboard.

1. Go to **Clerk Dashboard → Users → Create User**
2. Enter the Super Admin's email, first name, and last name
3. **Before saving**, go to **Public Metadata** and set:
   ```json
   {
     "role": "super_admin"
   }
   ```
4. Save the user

**What happens automatically:**
- Clerk fires a `user.created` webhook event
- The webhook handler ([auth.controller.js](controllers/auth.controller.js)) receives it
- It reads `publicMetadata.role` → maps `"super_admin"` to the DB role "Super Admin"
- Creates a User record in the database with the correct `role_id`

5. **Assign an organisation** (optional at this stage):
   - Use `PUT /api/user/:userId` to set `org_id` on the Super Admin's DB record
   - Or set `org_id` in `publicMetadata` before creating the user in Clerk

---

## Step 3: Create Organisations

The Super Admin can now create organisations via the API.

**Endpoint:** `POST /api/org/`

```json
{
  "org_name": "Acme Corp",
  "industry": "Technology",
  "company_location": "Toronto, ON"
}
```

**Response:** Returns the created Organisation object with a UUID `org_id`. A dedicated Supabase storage bucket is automatically created for the organisation using its `storage_bucket` UUID — no manual bucket setup is needed.

Repeat this step for each organisation that needs to be onboarded.

---

## Step 4: Invite Admin Users

The Super Admin can now invite Admins via the invitation API.

**Endpoint:** `POST /api/user/invite`

```json
{
  "email_address": "admin@acmecorp.com",
  "role": "admin",
  "org_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**What happens:**
1. Clerk sends an invitation email to `admin@acmecorp.com`
2. The invitee clicks the link and signs up through Clerk
3. Clerk fires a `user.created` webhook with `publicMetadata: { role: "admin", org_id: "..." }`
4. The webhook handler creates the DB record with:
   - `role_id` → mapped from `"admin"` to the DB "Admin" role
   - `org_id` → auto-assigned from the invitation's `publicMetadata`
5. The new Admin can immediately log in and start managing their organisation

---

## Step 5: Invite Organisation Members

Admins, Super Admins, and Org Executives can invite members. Each role has restrictions on who they can invite:

| Inviter Role | Can Invite | Org Restriction |
|---|---|---|
| Super Admin | `admin`, `org_executive`, `org_staff` | Any org |
| Admin | `org_executive`, `org_staff` | Any org |
| Org Executive | `org_executive`, `org_staff` | Own org only (auto-filled) |

**Invite an Org Executive:**
```json
{
  "email_address": "jane@acmecorp.com",
  "role": "org_executive",
  "org_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Invite Org Staff:**
```json
{
  "email_address": "john@acmecorp.com",
  "role": "org_staff",
  "org_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

> **Note:** When an Org Executive sends an invitation, the `org_id` is automatically set to their own organisation. They cannot invite users into other organisations.

The same automated flow applies — Clerk sends the email, the user signs up, the webhook creates the DB record with the correct role and org assignment.

---

## Invitation Management

### List All Invitations

`GET /api/user/invitations`

Optional query parameter: `?status=pending` (values: `pending`, `accepted`, `revoked`)

### Revoke a Pending Invitation

`DELETE /api/user/invite/:invitationId`

Revokes the invitation so the link can no longer be used.

---

## Updating Users After Sign-up

To update a user's profile (e.g., assign them to a different organisation, change job title):

`PUT /api/user/:userId`

```json
{
  "org_id": "new-org-uuid",
  "job_title": "Senior Analyst",
  "phone": "+1-555-0100"
}
```

---

## Complete Workflow Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    BOOTSTRAP PHASE                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Enable invitation-only in Clerk Dashboard               │
│                     ↓                                       │
│  2. Create Super Admin manually in Clerk Dashboard          │
│     (set publicMetadata.role = "super_admin")               │
│                     ↓                                       │
│  3. Webhook auto-creates DB record with Super Admin role    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                   ONBOARDING PHASE                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  4. Super Admin creates Organisations                       │
│     POST /api/org/                                          │
│                     ↓                                       │
│  5. Super Admin invites Admins                              │
│     POST /api/user/invite (role: "admin", org_id: "...")    │
│                     ↓                                       │
│  6. Admins invite Org Executives & Org Staff                │
│     POST /api/user/invite (role: "org_staff", org_id: "...") │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                   ONGOING OPERATIONS                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  • Manage invitations: GET /api/user/invitations            │
│  • Revoke invitations: DELETE /api/user/invite/:id          │
│  • Update user profiles: PUT /api/user/:userId              │
│  • Manage organisations: PUT/DELETE /api/org/:orgId         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### Webhook not firing
- Ensure `CLERK_WEBHOOK_SECRET` is set correctly
- In Clerk Dashboard → Webhooks, verify the endpoint URL points to `POST /api/webhooks/clerk`
- Check that the `user.created`, `user.updated`, and `user.deleted` events are enabled

### User created but no role assigned
- Check that the four roles (Super Admin, Admin, Org Executive, Org Staff) exist in the `Role` table
- Verify `publicMetadata.role` matches one of: `super_admin`, `admin`, `org_executive`, `org_staff`
- If no role is set in `publicMetadata`, the webhook defaults to `org_staff`

### User created but no org assigned
- Ensure `publicMetadata.org_id` was set on the invitation (or on the Clerk user)
- If the user was created without an org, use `PUT /api/user/:userId` to assign one after the fact
