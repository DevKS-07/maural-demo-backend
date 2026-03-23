# Maural KMS API Reference

> **Base URL:** `http://localhost:<PORT>/api`
> **Version:** 1.0.0
> **Authentication:** [Clerk](https://clerk.com/) JWT Bearer tokens
> **Content-Type:** `application/json` (unless otherwise noted)

---

## Table of Contents

- [Overview](#overview)
- [Authentication & Authorization](#authentication--authorization)
- [Rate Limiting](#rate-limiting)
- [Error Responses](#error-responses)
- [Endpoints](#endpoints)
  - [Health](#health)
  - [Home](#home)
  - [Webhooks](#webhooks)
  - [Auth](#auth)
  - [Users](#users)
  - [Organisations](#organisations)
  - [Documents](#documents)
  - [Chat / AI](#chat--ai)
  - [VTO (Vision/Traction Organizer)](#vto-visiontraction-organizer)
  - [KPI Summary](#kpi-summary)
  - [Integrations — HubSpot](#integrations--hubspot)
  - [Integrations — QuickBooks](#integrations--quickbooks)
  - [Integrations — Monday.com](#integrations--mondaycom)
  - [Integrations — ClickUp](#integrations--clickup)
  - [Integrations — Labor Config](#integrations---labor-config)
- [Data Models](#data-models)

---

## Overview

The Maural KMS (Knowledge Management System) API is a Node.js/Express backend that provides:

- **Document management** — upload, download, and organize files stored in Supabase Storage.
- **AI-powered chat** — multi-intent RAG (Retrieval-Augmented Generation) pipeline with guardrails.
- **User & organisation management** — CRUD with role-based access control.
- **Third-party integrations** — OAuth 2.0 connections to HubSpot, QuickBooks, Monday.com, and ClickUp.

### Global Middleware

| Middleware | Description |
|---|---|
| **Helmet** | Sets security-related HTTP headers |
| **CORS** | Restricts origins to `ALLOWED_ORIGINS` env var |
| **Compression** | gzip response compression |
| **Morgan** | Request logging (JSON in production, `dev` format locally) |
| **cookie-parser** | Parses cookies from incoming requests |

---

## Authentication & Authorization

### Clerk JWT

All protected endpoints require a valid Clerk JWT passed as a **Bearer token** in the `Authorization` header:

```
Authorization: Bearer <clerk_jwt_token>
```

The `requireAuth` middleware (in `middleware/auth.middleware.js`) validates the token using the Clerk SDK. Authentication can be disabled in development by setting `DISABLE_AUTH=true`.

### Role-Based Access Control (RBAC)

The `requireRole(minRole)` middleware enforces a role hierarchy:

| Role | Level | Description |
|---|---|---|
| `super_admin` | 4 | Full system access |
| `admin` | 3 | Administrative access |
| `org_executive` | 2 | Organisation-level management |
| `org_staff` | 1 | Basic organisation access |

A user must have a role level **≥ the minimum required level** to access the endpoint.

### Organisation-Level Access Control

The `requireOrgAccess(orgIdSource)` middleware enforces tenant isolation, preventing users from accessing data belonging to other organisations:

| Role | Access Scope |
|---|---|
| `super_admin` / `admin` | Cross-org — can access any organisation's data |
| `org_executive` / `org_staff` | Own org only — locked to their assigned organisation |

**How it works:**

- **Param-based routes** (e.g. `/api/summary/financial/:orgId`): The middleware validates that `req.params.orgId` matches the authenticated user's organisation. Returns `403` if the user attempts to access a different org.
- **Body-based routes** (e.g. `/api/chat`): The middleware force-overrides `req.body.orgIds` with the user's own organisation ID, regardless of what was sent in the request.

This middleware is applied to all chat, KPI summary, and VTO endpoints. The user's `org_id` is looked up from the database using their Clerk `clerk_id`.

---

## Rate Limiting

| Scope | Window | Max Requests |
|---|---|---|
| **Global** (all `/api/*`) | 15 minutes | 100 |
| **Chat** (`/api/chat/*`) | 15 minutes | 20 |

When rate-limited, the API responds with `429 Too Many Requests`.

---

## Error Responses

All errors follow a consistent JSON structure:

```json
{
  "message": "Human-readable error description"
}
```

### Standard HTTP Status Codes

| Code | Meaning |
|---|---|
| `200` | OK — Request succeeded |
| `201` | Created — Resource created successfully |
| `204` | No Content — Request succeeded with no body |
| `400` | Bad Request — Validation error or missing required fields |
| `401` | Unauthorized — Missing or invalid JWT |
| `403` | Forbidden — Insufficient role/permissions |
| `404` | Not Found — Resource does not exist |
| `429` | Too Many Requests — Rate limit exceeded |
| `500` | Internal Server Error — Unexpected server failure |

> In **production**, 500 errors return `"Something went wrong..."` to avoid leaking internals.

---

## Endpoints

---

### Health

#### `GET /api/health`

Returns the health status of the API server. **No authentication required.**

**Response `200 OK`**

```json
{
  "status": "ok",
  "timestamp": "2026-03-11T12:00:00.000Z",
  "uptime": 3600.5,
  "memory": {
    "rss": 85.2,
    "heapUsed": 42.1
  },
  "environment": "production"
}
```

| Field | Type | Description |
|---|---|---|
| `status` | `string` | Always `"ok"` |
| `timestamp` | `string` (ISO 8601) | Server time |
| `uptime` | `number` | Server uptime in seconds |
| `memory.rss` | `number` | Resident Set Size in MB |
| `memory.heapUsed` | `number` | V8 heap usage in MB |
| `environment` | `string` | `NODE_ENV` value |

---

### Home

#### `GET /api/`

**Auth:** None

**Response `200 OK`**

```
Welcome to the Maural KMS API
```

---

#### `GET /api/favicon.ico`

**Auth:** None

**Response `204 No Content`**

---

### Webhooks

#### `POST /api/webhooks/clerk`

Receives webhook events from Clerk for user lifecycle management. Verified using **Svix** signature headers.

**Auth:** Svix signature verification (not JWT)

**Headers Required:**

| Header | Description |
|---|---|
| `svix-id` | Svix event ID |
| `svix-timestamp` | Event timestamp |
| `svix-signature` | HMAC signature |

**Request Body:** Raw JSON payload from Clerk

**Supported Events:**

| Event | Action |
|---|---|
| `user.created` | Creates a new user in the database. Maps Clerk public metadata `role` to a DB role and auto-assigns `org_id` from public metadata (set by invitations). |
| `user.updated` | Updates user fields (name, email, phone, etc.) based on Clerk data. |
| `user.deleted` | Deletes user from the database by `clerk_id`. |

**Role Mapping (Clerk → Database):**

| Clerk Role (`publicMetadata.role`) | DB Role Name |
|---|---|
| `super_admin` | Super Admin |
| `admin` | Admin |
| `org_executive` | Org Executive |
| `org_staff` | Org Staff |

**Response `200 OK`**

```json
{
  "message": "Webhook processed"
}
```

**Error `400 Bad Request`** — Invalid Svix signature

---

### Auth

#### `GET /api/auth/me`

Returns the profile of the currently authenticated user.

**Auth:** Required (Clerk JWT)

**Response `200 OK`**

```json
{
  "user_id": "1",
  "clerk_id": "user_2abc123",
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane@example.com",
  "phone": "+1234567890",
  "gender": "female",
  "status": "active",
  "role_id": "2",
  "org_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "job_title": "Engineering Manager",
  "Role": {
    "role_id": "2",
    "role_name": "Admin",
    "RolePermission": [
      {
        "Permission": {
          "permission_id": "1",
          "permission_name": "read:documents"
        }
      }
    ]
  },
  "Organisation": {
    "org_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "org_name": "Acme Corp"
  }
}
```

> **Note:** BigInt fields are serialized as strings.

**Error `404 Not Found`** — User not found in database

---

#### `GET /api/auth/org`

Returns the organisation of the currently authenticated user.

**Auth:** Required (Clerk JWT)

**Response `200 OK`**

```json
{
  "org_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "org_name": "Acme Corp",
  "industry": "Technology",
  "founded": "2010-01-15T00:00:00.000Z",
  "key_contacts": "5",
  "company_location": "New York, NY",
  "storage_bucket": "b2c3d4e5-...",
  "hubspot_connected": true,
  "quickbooks_connected": false,
  "monday_connected": true,
  "clickup_connected": false
}
```

**Error `404 Not Found`** — User not found or not assigned to any organisation

---

### Users

All user endpoints require authentication (`requireAuth`). Invitation endpoints additionally require `requireRole("org_executive")` or higher.

Users are created exclusively through Clerk invitations — there is no public sign-up. Authorised users invite others via `POST /api/user/invite`, Clerk sends the invitation email, and when the invitee signs up, the webhook auto-assigns their `org_id` and `role` from the invitation metadata.

**Invitation Role Permissions:**

| Inviter Role | Can Invite |
|---|---|
| `super_admin` | `admin`, `org_executive`, `org_staff` |
| `admin` | `org_executive`, `org_staff` |
| `org_executive` | `org_executive`, `org_staff` (own organisation only) |
| `org_staff` | Cannot invite |

> **Note:** Org Executives are automatically locked to their own organisation. If they omit `org_id`, it is auto-filled from their DB record. They cannot invite users into a different organisation.

---

#### `POST /api/user/invite`

Sends an invitation to a new user via Clerk. The invitee receives an email with a sign-up link. When they sign up, the webhook automatically assigns the specified `org_id` and `role`.

**Auth:** Required + `org_executive` role or higher

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `email_address` | `string` | Yes | Email address to invite |
| `role` | `string` | No | Clerk role key (default: `org_staff`). Must be within the inviter's allowed roles (see table above) |
| `org_id` | `string` (UUID) | No | Organisation to assign the user to on sign-up. Auto-filled for Org Executives |

**Response `201 Created`**

```json
{
  "id": "inv_abc123",
  "email_address": "newuser@example.com",
  "status": "pending",
  "public_metadata": {
    "role": "org_staff",
    "org_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  },
  "created_at": 1700000000000
}
```

**Error `400 Bad Request`** — Missing `email_address` or invalid `role`

**Error `403 Forbidden`** — Role not allowed to invite the specified target role, or Org Executive attempting to invite into a different organisation

**Error `404 Not Found`** — `org_id` does not exist

**Error `409 Conflict`** — Email already invited or user already exists

---

#### `GET /api/user/invitations`

Lists all invitations. Optionally filter by status.

**Auth:** Required + `org_executive` role or higher

**Scoping:** Org Executives only see invitations where `publicMetadata.org_id` matches their own organisation. Admins and Super Admins see all invitations.

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `status` | `string` | Filter by status: `pending`, `accepted`, or `revoked` |

**Response `200 OK`**

```json
[
  {
    "id": "inv_abc123",
    "email_address": "newuser@example.com",
    "status": "pending",
    "public_metadata": { "role": "org_staff", "org_id": "..." },
    "created_at": 1700000000000
  }
]
```

**Error `403 Forbidden`** — User is not assigned to any organisation

---

#### `DELETE /api/user/invite/:invitationId`

Revokes a pending invitation.

**Auth:** Required + `org_executive` role or higher

**Scoping:** Org Executives can only revoke invitations where `publicMetadata.org_id` matches their own organisation. Returns `403` if the invitation belongs to a different organisation. Admins and Super Admins can revoke any invitation.

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `invitationId` | `string` | The Clerk invitation ID |

**Response `200 OK`**

```json
{
  "message": "Invitation revoked",
  "invitation": { "id": "inv_abc123", "status": "revoked" }
}
```

**Error `403 Forbidden`** — Org Executive attempting to revoke another organisation's invitation, or user not assigned to any organisation

**Error `404 Not Found`** — Invitation does not exist

---

#### `GET /api/user/`

**Response `200 OK`**

```
User API is working
```

---

#### `GET /api/user/all`

Returns all users in the system.

**Auth:** Required

**Response `200 OK`**

```json
[
  {
    "user_id": "1",
    "clerk_id": "user_2abc123",
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane@example.com",
    "phone": "+1234567890",
    "gender": "female",
    "status": "active",
    "role_id": "2",
    "org_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "last_login": "2026-03-10T08:30:00.000Z"
  }
]
```

---

#### `GET /api/user/:userId`

Returns a single user by ID.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `userId` | `BigInt` (string) | The user's ID |

**Response `200 OK`** — User object (same shape as above)

**Error `404 Not Found`** — User does not exist

---

#### `GET /api/user/:userId/activity`

Returns the activity log for a user.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `userId` | `BigInt` (string) | The user's ID |

**Response `200 OK`**

```json
[
  {
    "activity_id": "1",
    "file_id": "a1b2c3d4-...",
    "activity_type": "1",
    "activity_datetime": "2026-03-10T10:00:00.000Z",
    "user_id": "1",
    "ActivityType": {
      "activity_type_id": "1",
      "activity_name": "Viewed"
    }
  }
]
```

---

#### `GET /api/user/:userId/files`

Returns all files uploaded by a user.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `userId` | `BigInt` (string) | The user's ID |

**Response `200 OK`**

```json
[
  {
    "file_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "file_name": "report.pdf",
    "file_size": "2048",
    "file_source": "b2c3d4e5-bucket-uuid/uploads/report.pdf",
    "ctg_id": "1",
    "org_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "user_id": "1",
    "created_at": "2026-03-01T12:00:00.000Z",
    "updated_at": "2026-03-01T12:00:00.000Z"
  }
]
```

---

#### `GET /api/user/:userId/comments`

Returns all comments made by a user.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `userId` | `BigInt` (string) | The user's ID |

**Response `200 OK`**

```json
[
  {
    "comment_id": "1",
    "file_id": "a1b2c3d4-...",
    "comment": "This section needs revision.",
    "created_at": "2026-03-10T15:00:00.000Z",
    "user_id": "1"
  }
]
```

---

#### `GET /api/user/:userId/permissions`

Returns all permissions associated with a user's role.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `userId` | `BigInt` (string) | The user's ID |

**Response `200 OK`**

```json
[
  {
    "permission_id": "1",
    "permission_name": "read:documents"
  },
  {
    "permission_id": "2",
    "permission_name": "write:documents"
  }
]
```

---

#### `PUT /api/user/:userId`

Updates an existing user. Users are created exclusively via Clerk webhook (`user.created` event) — there is no manual `POST` endpoint. Use this endpoint to assign `org_id`, `job_title`, `role_id`, and other profile fields after the user signs up through Clerk.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `userId` | `BigInt` (string) | The user's ID |

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `first_name` | `string` | No | User's first name |
| `last_name` | `string` | No | User's last name |
| `email` | `string` | No | User's email address |
| `org_id` | `string` (UUID) | No | Associated organisation ID |
| `role_id` | `BigInt` | No | Role ID to assign |
| `phone` | `string` | No | Phone number |
| `gender` | `string` | No | Gender |
| `status` | `string` | No | Account status |
| `job_title` | `string` | No | Job title |

**Response `200 OK`** — The updated User object

**Error `404 Not Found`** — User does not exist

---

#### `DELETE /api/user/:userId`

Deletes a user.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `userId` | `BigInt` (string) | The user's ID |

**Response `200 OK`**

```json
{
  "message": "User with ID 1 deleted"
}
```

---

### Organisations

All organisation endpoints require authentication (`requireAuth`).

---

#### `GET /api/org/`

**Response `200 OK`**

```
Organisation API is working
```

---

#### `GET /api/org/all`

Returns all organisations in the system.

**Auth:** Required

**Response `200 OK`**

```json
[
  {
    "org_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "org_name": "Acme Corp",
    "industry": "Technology",
    "founded": "2010-01-15T00:00:00.000Z",
    "key_contacts": "5",
    "company_location": "New York, NY",
    "organization_chart": "https://...",
    "gpt_types": "general",
    "storage_bucket": "b2c3d4e5-...",
    "hubspot_connected": true,
    "quickbooks_connected": false,
    "monday_connected": false,
    "clickup_connected": false
  }
]
```

---

#### `GET /api/org/:orgId`

Returns a single organisation by ID.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `orgId` | `string` (UUID) | The organisation's ID |

**Response `200 OK`** — Organisation object

**Error `404 Not Found`** — Organisation does not exist

---

#### `GET /api/org/:orgId/users`

Returns all users belonging to an organisation.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `orgId` | `string` (UUID) | The organisation's ID |

**Response `200 OK`** — Array of User objects

---

#### `GET /api/org/:orgId/files`

Returns all files belonging to an organisation.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `orgId` | `string` (UUID) | The organisation's ID |

**Response `200 OK`** — Array of File objects

---

#### `POST /api/org/`

Creates a new organisation.

**Auth:** Required

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `org_name` | `string` | Yes | Organisation/company name |
| `industry` | `string` | No | Industry sector |
| `founded` | `string` (ISO date) | No | Date founded |
| `key_contacts` | `BigInt` | No | Primary contact user ID |
| `company_location` | `string` | No | Headquarters location |
| `organization_chart` | `string` | No | URL to org chart |
| `gpt_types` | `string` | No | AI model preferences |

**Response `201 Created`** — The created Organisation object. A dedicated Supabase storage bucket is automatically created using the organisation's `storage_bucket` UUID.

**Error `400 Bad Request`** — Missing `org_name`

---

#### `PUT /api/org/:orgId`

Updates an existing organisation.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `orgId` | `string` (UUID) | The organisation's ID |

**Request Body:** Any subset of the fields from `POST /api/org/`

**Response `200 OK`** — The updated Organisation object

---

#### `DELETE /api/org/:orgId`

Deletes an organisation. Also empties and deletes the organisation's Supabase storage bucket (best-effort — bucket cleanup failures do not block the deletion).

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `orgId` | `string` (UUID) | The organisation's ID |

**Response `200 OK`**

```json
{
  "message": "Organisation with ID a1b2c3d4-... deleted"
}
```

---

### Documents

All document endpoints require authentication (`requireAuth`).

File uploads use `multipart/form-data` with a **50 MB** size limit (via Multer).

---

#### `GET /api/docs/`

**Response `200 OK`**

```
Docs API is working
```

---

#### `GET /api/docs/all`

Returns metadata for all documents.

**Auth:** Required

**Response `200 OK`**

```json
[
  {
    "file_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "file_name": "report.pdf",
    "file_size": "2048576",
    "file_source": "b2c3d4e5-bucket-uuid/uploads/report.pdf",
    "ctg_id": "1",
    "org_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "user_id": "1",
    "created_at": "2026-03-01T12:00:00.000Z",
    "updated_at": "2026-03-01T12:00:00.000Z"
  }
]
```

---

#### `GET /api/docs/category/:ctgId`

Returns all documents in a specific category.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `ctgId` | `BigInt` (string) | Category ID |

**Response `200 OK`**

```json
[
  {
    "file_id": "a1b2c3d4-...",
    "file_name": "report.pdf",
    "file_size": "2048576",
    "file_source": "b2c3d4e5-bucket-uuid/uploads/report.pdf",
    "ctg_id": "1",
    "org_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "user_id": "1",
    "Category": {
      "ctg_id": "1",
      "ctg_name": "Financial Reports"
    }
  }
]
```

---

#### `GET /api/docs/:id`

Downloads/streams a document file from Supabase Storage.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` (UUID) | The file's UUID |

**Response `200 OK`**

- **Content-Type:** Set based on file extension (e.g., `application/pdf`, `image/png`)
- **Body:** Binary file stream

**Error `404 Not Found`** — File not found in storage or database

---

#### `POST /api/docs/`

Uploads a new document to Supabase Storage and creates metadata in the database.

**Auth:** Required

**Authorization:**

- `admin` / `super_admin` — can upload to **any** organisation's bucket by passing any valid `org_id`
- `org_executive` / `org_staff` — can only upload to their **own** organisation (the `org_id` must match their assigned org)

**Content-Type:** `multipart/form-data`

**Form Fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | `File` | Yes | The file to upload (max 50 MB) |
| `ctg_id` | `BigInt` | No | Category ID |
| `org_id` | `string` (UUID) | **Yes** | Organisation owner ID (determines storage bucket) |
| `user_id` | `BigInt` | No | Uploader user ID |

**Response `201 Created`**

```json
{
  "file_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "file_name": "report.pdf",
  "file_size": "2048576",
  "file_source": "b2c3d4e5-bucket-uuid/uploads/report.pdf",
  "ctg_id": "1",
  "org_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "user_id": "1",
  "created_at": "2026-03-11T12:00:00.000Z",
  "updated_at": "2026-03-11T12:00:00.000Z"
}
```

**Error `400 Bad Request`** — No file provided, or `org_id` is missing

**Error `403 Forbidden`** — Non-admin user attempting to upload to a different organisation

---

#### `PUT /api/docs/:id`

Updates document metadata (does not replace the file itself).

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` (UUID) | The file's UUID |

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `file_name` | `string` | No | New file name |
| `ctg_id` | `BigInt` | No | New category ID |
| `org_id` | `string` (UUID) | No | New organisation owner |

**Response `200 OK`** — The updated File metadata object

---

#### `DELETE /api/docs/:id`

Deletes a document from both Supabase Storage and the database. Also removes all associated embeddings.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` (UUID) | The file's UUID |

**Response `200 OK`**

```json
{
  "message": "Document with ID a1b2c3d4-... deleted"
}
```

---

#### `GET /api/docs/:id/comments`

Returns all comments on a document.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` (UUID) | The file's UUID |

**Response `200 OK`**

```json
[
  {
    "comment_id": "1",
    "file_id": "a1b2c3d4-...",
    "comment": "This section needs revision.",
    "created_at": "2026-03-10T15:00:00.000Z",
    "user_id": "1"
  }
]
```

---

#### `POST /api/docs/:id/comments`

Adds a comment to a document.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` (UUID) | The file's UUID |

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `comment` | `string` | Yes | Comment text |
| `user_id` | `BigInt` | No | Author's user ID |

**Response `201 Created`** — The created Comment object

**Error `400 Bad Request`** — Missing `comment` field

---

#### `DELETE /api/docs/:id/comments/:commentId`

Deletes a comment from a document.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` (UUID) | The file's UUID |
| `commentId` | `BigInt` (string) | The comment's ID |

**Response `200 OK`**

```json
{
  "message": "Comment with ID 1 deleted"
}
```

---

#### `GET /api/docs/:id/activity`

Returns the activity log for a document.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` (UUID) | The file's UUID |

**Response `200 OK`**

```json
[
  {
    "activity_id": "1",
    "file_id": "a1b2c3d4-...",
    "activity_type": "1",
    "activity_datetime": "2026-03-10T10:00:00.000Z",
    "user_id": "1",
    "ActivityType": {
      "activity_type_id": "1",
      "activity_name": "Viewed"
    }
  }
]
```

---

### Chat / AI

All chat endpoints require authentication (`requireAuth`) and are subject to the **stricter rate limit** of 20 requests per 15 minutes.

> **Org-level isolation:** For `org_executive` and `org_staff` users, the `orgIds` field in the request body is **automatically overridden** with the user's own organisation ID. Admins and super admins retain cross-org access. See [Organisation-Level Access Control](#organisation-level-access-control).

---

#### `GET /api/chat/`

**Response `200 OK`**

```
Welcome to the ChatBot!
```

---

#### `POST /api/chat/`

Sends a message to the AI chatbot. The pipeline:

1. Detects user intents (summarize, predict, reason, compare, etc.)
1. Retrieves relevant document chunks via pgvector semantic search
1. Fetches business data context (Financial/Leads/Labor KPIs + VTO) from the database for the scoped organisation(s)
1. Runs specialized agents per detected intent (with both document and business data context)
1. Combines multi-intent answers
1. Runs guardrail checks for confidence and hallucination

**Auth:** Required
**Rate Limit:** 20 requests / 15 minutes

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `message` | `string` | Yes | The user's question or prompt |
| `orgIds` | `string` or `string[]` or `"all"` | No | Organisation ID(s) to scope document search, or `"all"` (default: `"all"`) |
| `history` | `array` | No | Previous conversation history for context |

**Response `200 OK`**

```json
{
  "answer": "Based on the Q3 financial reports, revenue increased by 15%...",
  "sources": [
    {
      "file_id": "a1b2c3d4-...",
      "file_name": "Q3-report.pdf",
      "similarity": 0.89
    }
  ],
  "intents": ["summarize", "reason"],
  "guardrail": {
    "confidence": 0.92,
    "issues": []
  }
}
```

| Field | Type | Description |
|---|---|---|
| `answer` | `string` | The AI-generated response |
| `sources` | `array` | Documents and business data sources used to generate the answer |
| `sources[].title` | `string` | Source name (document filename, or KPI/VTO label like "Financial KPIs (Jan–Mar 2026)") |
| `sources[].type` | `string` | Source type: `"Knowledge Base"`, `"KPI Data"`, or `"VTO"` |
| `sources[].snippet` | `string` | Short preview of the source content (max ~200 chars) |
| `intents` | `string[]` | Detected user intents |
| `guardrail.confidence` | `number` | Confidence score (0–100) |
| `guardrail.issues` | `string[]` | Any flagged issues (e.g., potential hallucination) |

---

#### `POST /api/chat/stream`

Same as `POST /api/chat/` but returns a **Server-Sent Events (SSE)** stream for real-time token delivery.

**Auth:** Required
**Rate Limit:** 20 requests / 15 minutes

**Request Body:** Same as `POST /api/chat/`

**Response `200 OK`**

**Headers:**

| Header | Value |
|---|---|
| `Content-Type` | `text/event-stream` |
| `Cache-Control` | `no-cache` |
| `Connection` | `keep-alive` |
| `X-Accel-Buffering` | `no` |

**SSE Event Sequence:**

```
data: {"type":"intent","intents":["summarize","reason"]}

data: {"type":"chunk","text":"Base"}

data: {"type":"chunk","text":"d on"}

data: {"type":"chunk","text":" the"}

...

data: {"type":"sources","sources":[{"file_id":"...","file_name":"...","similarity":0.89}]}

data: {"type":"guardrail","confidence":0.92,"issues":[]}

data: [DONE]
```

| Event Type | Description |
|---|---|
| `intent` | Detected intents for the query |
| `chunk` | Incremental text (≈4 characters per chunk) |
| `sources` | Source documents used |
| `guardrail` | Confidence and issue report |
| `[DONE]` | Stream complete signal |

---

#### `POST /api/chat/ingest`

Triggers the document ingestion pipeline. Processes **all** files in the database:

1. Downloads files from Supabase Storage
2. Extracts text (supports PDF with OCR fallback, XLSX, DOCX, TXT, MD, CSV, JSON, images)
3. Splits into chunks (1000 characters, 150-character overlap)
4. Generates embeddings via Ollama (`nomic-embed-text`)
5. Upserts into Supabase `document_embeddings` table (pgvector)

**Auth:** Required

**Request Body:** Empty (`{}`)

**Response `200 OK`**

```json
{
  "message": "Ingestion complete",
  "totalFiles": 25,
  "successFiles": 23,
  "totalChunks": 412,
  "errors": [
    {
      "file": "corrupted.pdf",
      "error": "Failed to extract text"
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `totalFiles` | `number` | Total files found in database |
| `successFiles` | `number` | Files successfully processed |
| `totalChunks` | `number` | Total chunks created and embedded |
| `errors` | `array` | Files that failed processing (omitted if none) |

---

### VTO (Vision/Traction Organizer)

CRUD endpoints for managing an organisation's VTO document. Each organisation has at most one VTO (one-to-one relationship). All endpoints require authentication (`requireAuth`). Write operations (create, update, delete) additionally require `requireRole("org_executive")` or higher.

> **Org-level isolation:** All VTO endpoints are protected by `requireOrgAccess("params")` — `org_executive` and `org_staff` users can only access their own organisation's VTO (403 otherwise). See [Organisation-Level Access Control](#organisation-level-access-control).

---

#### `GET /api/vto/:orgId`

Returns the VTO for a given organisation.

**Auth:** Required (Clerk JWT)

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `orgId` | `string` (UUID) | The organisation's ID |

**Response `200 OK`**

```json
{
  "vto_id": "a1b2c3d4-...",
  "title": "2026 Vision",
  "year": "2026",
  "org_id": "e9d52719-...",
  "core_values": ["Integrity", "Innovation"],
  "mission": "To empower businesses...",
  "vision": "A world where every team...",
  "ten_year_targets": ["$100M revenue", "5000 customers"],
  "target_market": "Mid-market SaaS companies",
  "proven_process": "Discovery → Onboarding → Growth",
  "differentiators": "AI-powered insights",
  "guarantee": "ROI within 90 days",
  "future_date": "2029-12-31",
  "revenue": "$50M",
  "profit": "$10M",
  "measurables": "NPS > 70, churn < 5%",
  "look_like": "500 employees, 3 offices",
  "created_at": "2026-01-15T10:00:00.000Z",
  "updated_at": "2026-03-10T14:30:00.000Z"
}
```

**Error `404 Not Found`** — No VTO exists for this organisation

---

#### `POST /api/vto/:orgId`

Creates a VTO for the organisation. Fails with `409` if one already exists.

**Auth:** Required + `org_executive` role or higher

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `orgId` | `string` (UUID) | The organisation's ID |

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | `string` | Yes | VTO title |
| `year` | `string` | Yes | Target year |
| `core_values` | `JSON array` | No | List of core values (default `[]`) |
| `mission` | `string` | No | Mission statement |
| `vision` | `string` | No | Vision statement |
| `ten_year_targets` | `JSON array` | No | Long-term targets (default `[]`) |
| `target_market` | `string` | No | Target market description |
| `proven_process` | `string` | No | Proven process description |
| `differentiators` | `string` | No | Unique differentiators |
| `guarantee` | `string` | No | Company guarantee |
| `future_date` | `string` | No | 3-year picture target date |
| `revenue` | `string` | No | 3-year revenue target |
| `profit` | `string` | No | 3-year profit target |
| `measurables` | `string` | No | 3-year measurables |
| `look_like` | `string` | No | What the company looks like in 3 years |

**Response `201 Created`** — The created VTO object

**Error `400 Bad Request`** — Missing `title` or `year`

**Error `409 Conflict`** — A VTO already exists for this organisation

---

#### `PUT /api/vto/:orgId`

Updates the existing VTO for the organisation.

**Auth:** Required + `org_executive` role or higher

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `orgId` | `string` (UUID) | The organisation's ID |

**Request Body:** Same fields as `POST` (all optional — only provided fields are updated)

**Response `200 OK`** — The updated VTO object

**Error `500 Internal Server Error`** — No VTO found for this organisation (Prisma record-not-found)

---

#### `DELETE /api/vto/:orgId`

Deletes the VTO for the organisation.

**Auth:** Required + `org_executive` role or higher

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `orgId` | `string` (UUID) | The organisation's ID |

**Response `200 OK`**

```json
{
  "message": "VTO for organisation e9d52719-... deleted"
}
```

**Error `500 Internal Server Error`** — No VTO found for this organisation

---

### KPI Summary

All KPI summary endpoints require authentication (`requireAuth`). These endpoints aggregate data from connected integrations (QuickBooks, HubSpot, Monday.com) to provide financial, leads, and labor KPIs for a specific organisation.

> **Org-level isolation:** Endpoints with `:orgId` are protected by `requireOrgAccess("params")` — `org_executive` and `org_staff` users can only access their own organisation's data (403 otherwise). The scorecard endpoint requires `admin` role or higher. See [Organisation-Level Access Control](#organisation-level-access-control).

---

#### `GET /api/summary/financial/:orgId`

Returns financial KPIs for the specified organisation (sourced from QuickBooks).

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `orgId` | `string` (UUID) | The organisation's ID |

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `startDate` | `string` (ISO date) | Period start date |
| `endDate` | `string` (ISO date) | Period end date |
| `asOfDate` | `string` (ISO date) | Balance sheet as-of date |

**Response `200 OK`**

```json
{
  "financial": {
    "totalIncome": 250000.00,
    "netIncome": 45000.00,
    "ebitda": 62000.00,
    "grossMargin": 0.42,
    "laborCost": 120000.00,
    "workingCapital": 85000.00
  }
}
```

**Error `400 Bad Request`** — Missing `orgId` parameter

---

#### `GET /api/summary/leads/:orgId`

Returns leads/pipeline KPIs for the specified organisation (sourced from HubSpot).

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `orgId` | `string` (UUID) | The organisation's ID |

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `startDate` | `string` (ISO date) | Period start date |
| `endDate` | `string` (ISO date) | Period end date |

**Response `200 OK`**

```json
{
  "leads": {
    "pipelineCoverage": 500000.00,
    "leads": 42,
    "dealsWon": 8,
    "conversionRate": 0.19,
    "recurringPercent": 0.65
  }
}
```

**Error `400 Bad Request`** — Missing `orgId` parameter

---

#### `GET /api/summary/labor/:orgId`

Returns labor/workforce KPIs for the specified organisation (sourced from Monday.com/ClickUp).

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `orgId` | `string` (UUID) | The organisation's ID |

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `startDate` | `string` (ISO date) | Period start date |
| `endDate` | `string` (ISO date) | Period end date |

**Response `200 OK`**

```json
{
  "labor": {
    "directLaborHours": 1200,
    "billableFTEs": 8,
    "nonBillableFTEs": 3,
    "billableUtilization": 0.73,
    "laborSource": "monday",
    "hasBillableColumn": true
  }
}
```

**Error `400 Bad Request`** — Missing `orgId` parameter

---

#### `GET /api/summary/summary/:orgId`

Master dashboard endpoint — returns financial, leads, and labor KPIs in parallel for the specified organisation. Each integration fails independently via `Promise.allSettled`.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `orgId` | `string` (UUID) | The organisation's ID |

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `startDate` | `string` (ISO date) | Period start date |
| `endDate` | `string` (ISO date) | Period end date |
| `asOfDate` | `string` (ISO date) | Balance sheet as-of date |

**Response `200 OK`**

```json
{
  "financial": { "totalIncome": 250000.00, "..." : "..." },
  "leads": { "pipelineCoverage": 500000.00, "..." : "..." },
  "labor": { "directLaborHours": 1200, "..." : "..." },
  "fetchedAt": "2026-03-19T12:00:00.000Z"
}
```

> **Note:** If an individual integration fails, its key will contain an `error` field instead of KPI data. The other integrations still return successfully.

**Error `400 Bad Request`** — Missing `orgId` parameter

---

#### `GET /api/summary/scorecard`

Returns a scorecard entry for every organisation in the system. Uses a DB-first strategy with a 6-hour cache TTL — stale or missing data triggers a background API refresh.

**Auth:** Required

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `startDate` | `string` (ISO date) | Period start date |
| `endDate` | `string` (ISO date) | Period end date |
| `asOfDate` | `string` (ISO date) | Balance sheet as-of date |

**Response `200 OK`**

```json
{
  "orgs": [
    {
      "org_id": "a1b2c3d4-...",
      "name": "Acme Corp",
      "score": {
        "totalPipelineValue": 500000.00,
        "pipelineCoverageRatio": 2.00,
        "totalRevenue": 250000.00,
        "netRevenue": 45000.00,
        "ebitda": 62000.00,
        "ebitdaPct": 13.8,
        "revenuePerHead": 22727,
        "headcount": 11,
        "workingCapital": 85000.00,
        "billableUtilization": 0.73
      }
    }
  ],
  "fetchedAt": "2026-03-19T12:00:00.000Z"
}
```

---

### Integrations — HubSpot

All integration endpoints (except OAuth callbacks) require authentication (`requireAuth`). The authenticated user's `org_id` is resolved from the Clerk JWT via a database lookup — no session middleware is used.

**Database Table:** `hubspot_tokens`

---

#### `GET /api/integrations/hubspot/`

**Response `200 OK`**

```
This is the HubSpot API.
```

---

#### `GET /api/integrations/hubspot/install`

Initiates the HubSpot OAuth 2.0 flow. If the organisation already has a valid (non-expired) access token, skips OAuth and redirects directly to the frontend.

**Auth:** Required

**OAuth Scopes:** `crm.objects.contacts.read` (configurable)

**Response:**
- `302 Redirect` → `FRONTEND_REDIRECT_URI` (if already connected with valid token)
- `302 Redirect` → HubSpot OAuth authorize URL (if not connected)

---

#### `GET /api/integrations/hubspot/oauth-callback`

OAuth callback handler. Validates the `state` parameter against an in-memory store (which also carries the `org_id`), exchanges the authorization code for access/refresh tokens, and stores them keyed by `org_id`.

**Auth:** None (OAuth callback — `org_id` is retrieved from the OAuth state map)

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `code` | `string` | Authorization code from HubSpot |
| `state` | `string` | State parameter for CSRF protection (also encodes `org_id`) |

**Response:** `302 Redirect` → `/api/integrations/hubspot/success`

---

#### `GET /api/integrations/hubspot/success`

Post-OAuth success redirect.

**Auth:** Required

**Response:** `302 Redirect` → `FRONTEND_REDIRECT_URI`

---

#### `GET /api/integrations/hubspot/status`

Checks whether the user has an active HubSpot connection.

**Auth:** Required

**Response `200 OK`**

```json
{
  "connected": true
}
```

---

#### `GET /api/integrations/hubspot/contacts`

Returns contacts from the connected HubSpot account.

**Auth:** Required

**Response `200 OK`** — HubSpot contacts array (limit 50)

---

#### `GET /api/integrations/hubspot/carts`

Returns carts from the connected HubSpot account.

**Auth:** Required

**Response `200 OK`** — HubSpot carts array (limit 50)

---

#### `GET /api/integrations/hubspot/companies`

Returns companies from the connected HubSpot account.

**Auth:** Required

**Response `200 OK`** — HubSpot companies array (limit 50)

---

### Integrations — QuickBooks

All integration endpoints (except OAuth callbacks) require authentication (`requireAuth`). The authenticated user's `org_id` is resolved from the Clerk JWT via a database lookup.

**Database Table:** `quickbooks_tokens`

---

#### `GET /api/integrations/quickbooks/`

**Response `200 OK`**

```
This is the QuickBooks API.
```

---

#### `GET /api/integrations/quickbooks/install`

Initiates the QuickBooks OAuth 2.0 flow with a generated state secret for CSRF protection. If the organisation already has a connected token, skips OAuth and redirects directly to the frontend.

**Auth:** Required

**OAuth Scopes:** `com.intuit.quickbooks.accounting`

**Response:**
- `302 Redirect` → `FRONTEND_REDIRECT_URI` (if already connected)
- `302 Redirect` → QuickBooks OAuth authorize URL (if not connected)

---

#### `GET /api/integrations/quickbooks/oauth-callback`

OAuth callback handler. Validates the `state` parameter against an in-memory store (which also carries the `org_id`), exchanges the code for tokens, and stores them keyed by `org_id`.

**Auth:** None (OAuth callback — `org_id` is retrieved from the OAuth state map)

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `code` | `string` | Authorization code |
| `state` | `string` | State for CSRF validation (also encodes `org_id`) |
| `realmId` | `string` | QuickBooks company realm ID |

**Response:** `302 Redirect` → `/api/integrations/quickbooks/success`

---

#### `GET /api/integrations/quickbooks/success`

Post-OAuth redirect.

**Auth:** Required

**Response:** `302 Redirect` → `FRONTEND_REDIRECT_URI`

---

#### `GET /api/integrations/quickbooks/status`

**Auth:** Required

**Response `200 OK`**

```json
{
  "connected": true
}
```

---

#### `GET /api/integrations/quickbooks/company-info`

Returns company information from QuickBooks.

**Auth:** Required

**Response `200 OK`** — QuickBooks CompanyInfo object

---

#### `GET /api/integrations/quickbooks/accounts`

Returns all accounts from QuickBooks (paginated internally, up to 1000 per request).

**Auth:** Required

**Response `200 OK`** — Array of QuickBooks Account objects

---

#### `GET /api/integrations/quickbooks/accounts/:accountId`

Returns a single account by ID.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `accountId` | `integer` | QuickBooks account ID |

**Response `200 OK`** — QuickBooks Account object

**Error `404 Not Found`** — Account does not exist

---

#### `GET /api/integrations/quickbooks/bills`

Returns all bills from QuickBooks (paginated internally, up to 1000 per request).

**Auth:** Required

**Response `200 OK`** — Array of QuickBooks Bill objects

---

#### `GET /api/integrations/quickbooks/bills/:billId`

Returns a single bill by ID.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `billId` | `integer` | QuickBooks bill ID |

**Response `200 OK`** — QuickBooks Bill object

**Error `404 Not Found`** — Bill does not exist

---

#### `GET /api/integrations/quickbooks/invoices`

Returns all invoices from QuickBooks (paginated internally, up to 1000 per request).

**Auth:** Required

**Response `200 OK`** — Array of QuickBooks Invoice objects

---

#### `GET /api/integrations/quickbooks/invoices/:invoiceId`

Returns a single invoice by ID.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `invoiceId` | `integer` | QuickBooks invoice ID |

**Response `200 OK`** — QuickBooks Invoice object

**Error `404 Not Found`** — Invoice does not exist

---

#### `GET /api/integrations/quickbooks/invoices/:invoiceId/pdf`

Downloads an invoice as a PDF file.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `invoiceId` | `integer` | QuickBooks invoice ID |

**Response `200 OK`**

- **Content-Type:** `application/pdf`
- **Body:** PDF binary stream

---

#### `GET /api/integrations/quickbooks/customers`

Returns all customers from QuickBooks (paginated internally).

**Auth:** Required

**Response `200 OK`** — Array of QuickBooks Customer objects

---

#### `GET /api/integrations/quickbooks/customers/:customerId`

Returns a single customer by ID.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `customerId` | `integer` | QuickBooks customer ID |

**Response `200 OK`** — QuickBooks Customer object

**Error `404 Not Found`** — Customer does not exist

---

#### `GET /api/integrations/quickbooks/tax-agency`

Returns all tax agencies from QuickBooks (paginated internally).

**Auth:** Required

**Response `200 OK`** — Array of QuickBooks TaxAgency objects

---

#### `GET /api/integrations/quickbooks/tax-agency/:taxId`

Returns a single tax agency by ID.

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `taxId` | `integer` | QuickBooks tax agency ID |

**Response `200 OK`** — QuickBooks TaxAgency object

**Error `404 Not Found`** — Tax agency does not exist

---

### Integrations — Monday.com

All integration endpoints (except OAuth callbacks) require authentication (`requireAuth`). The authenticated user's `org_id` is resolved from the Clerk JWT via a database lookup.

**Database Table:** `monday_tokens`

---

#### `GET /api/integrations/monday/`

**Response `200 OK`**

```
This is the Monday API.
```

---

#### `GET /api/integrations/monday/install`

Initiates Monday.com OAuth 2.0 flow.

**Auth:** Required

**OAuth Scopes:** Configured in Monday.com app settings (not passed in the authorize URL)

**Response:** `302 Redirect` → Monday.com OAuth authorize URL

---

#### `GET /api/integrations/monday/oauth-callback`

OAuth callback handler. Validates the `state` parameter against an in-memory store (which also carries the `org_id`), exchanges the code for tokens, and stores them keyed by `org_id`. After storing the token, triggers a **fire-and-forget auto-detection** of the default Monday board for labor KPIs (sets `laborSource` and `mondayBoardId` on the organisation).

**Auth:** None (OAuth callback — `org_id` is retrieved from the OAuth state map)

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `code` | `string` | Authorization code from Monday.com |
| `state` | `string` | State parameter for CSRF protection (also encodes `org_id`) |

**Response:** `302 Redirect` → `FRONTEND_REDIRECT_URI?connected=monday`

---

#### `GET /api/integrations/monday/success`

**Auth:** Required

**Response:** `302 Redirect` → `FRONTEND_REDIRECT_URI?connected=monday`

---

#### `GET /api/integrations/monday/status`

**Auth:** Required

**Response `200 OK`**

```json
{
  "connected": true,
  "laborConfigured": true
}
```

---

### Integrations — ClickUp

All integration endpoints (except OAuth callbacks) require authentication (`requireAuth`). The authenticated user's `org_id` is resolved from the Clerk JWT via a database lookup.

**Database Table:** `clickup_tokens`

---

#### `GET /api/integrations/clickup/`

**Response `200 OK`**

```
This is the ClickUp API.
```

---

#### `GET /api/integrations/clickup/install`

Initiates ClickUp OAuth 2.0 flow.

**Auth:** Required

**Response:** `302 Redirect` → ClickUp OAuth authorize URL

---

#### `GET /api/integrations/clickup/oauth-callback`

OAuth callback handler. Validates the `state` parameter against an in-memory store (which also carries the `org_id`), exchanges the code for an access token, and stores it keyed by `org_id`. ClickUp tokens are long-lived and do not include a refresh token or expiry. After storing the token, triggers a **fire-and-forget auto-detection** of the default ClickUp workspace for labor KPIs (sets `laborSource` and `clickupWorkspaceId` on the organisation).

**Auth:** None (OAuth callback — `org_id` is retrieved from the OAuth state map)

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `code` | `string` | Authorization code from ClickUp |
| `state` | `string` | State parameter for CSRF protection (also encodes `org_id`) |

**Response:** `302 Redirect` → `FRONTEND_REDIRECT_URI?connected=clickup`

---

#### `GET /api/integrations/clickup/success`

**Auth:** Required

**Response:** `302 Redirect` → `FRONTEND_REDIRECT_URI?connected=clickup`

---

#### `GET /api/integrations/clickup/status`

**Auth:** Required

**Response `200 OK`**

```json
{
  "connected": true,
  "laborConfigured": true
}
```

---

### Integrations — Labor Config

Endpoints for viewing and managing the labor KPI source configuration. After connecting Monday.com or ClickUp via OAuth, the system auto-detects a default board/workspace for labor KPIs. These endpoints allow viewing the current config, listing available options, and manually overriding the auto-detected defaults.

All endpoints require authentication (`requireAuth`). The authenticated user's `org_id` is resolved from the Clerk JWT via a database lookup.

---

#### `GET /api/integrations/labor-config/status`

Returns the current labor KPI configuration for the authenticated user's organisation.

**Auth:** Required

**Response `200 OK`**

```json
{
  "laborSource": "monday",
  "mondayBoardId": "123456789",
  "clickupWorkspaceId": null,
  "monday_connected": true,
  "clickup_connected": false
}
```

---

#### `GET /api/integrations/labor-config/monday/boards`

Lists all Monday.com boards accessible to the connected account, with a flag indicating whether each board has a time tracking column.

**Auth:** Required

**Response `200 OK`**

```json
{
  "boards": [
    { "id": "123456789", "name": "Sprint Board", "hasTimeTracking": true },
    { "id": "987654321", "name": "Roadmap", "hasTimeTracking": false }
  ]
}
```

**Error `400 Bad Request`** — Monday.com is not connected for this organisation

---

#### `GET /api/integrations/labor-config/clickup/workspaces`

Lists all ClickUp workspaces accessible to the connected account.

**Auth:** Required

**Response `200 OK`**

```json
{
  "workspaces": [
    { "id": "abc123", "name": "My Workspace" }
  ]
}
```

**Error `400 Bad Request`** — ClickUp is not connected for this organisation

---

#### `PUT /api/integrations/labor-config`

Manually update the labor KPI source configuration. Overrides the auto-detected defaults.

**Auth:** Required

**Request Body:**

| Field | Type | Description |
|---|---|---|
| `laborSource` | `string` | `"monday"` or `"clickup"` (required) |
| `mondayBoardId` | `string` | Board ID (required when `laborSource` is `"monday"`) |
| `clickupWorkspaceId` | `string` | Workspace ID (required when `laborSource` is `"clickup"`) |

**Response `200 OK`**

```json
{
  "message": "Labor configuration updated",
  "laborSource": "monday",
  "mondayBoardId": "123456789",
  "clickupWorkspaceId": null
}
```

**Error `400 Bad Request`** — Invalid `laborSource` or missing required ID field

---

## Data Models

### User

| Field | Type | Description |
|---|---|---|
| `user_id` | `BigInt` (PK, auto-increment) | Unique identifier |
| `clerk_id` | `String` (unique) | Clerk authentication ID |
| `first_name` | `String` | First name |
| `last_name` | `String` | Last name |
| `email` | `String` | Email address |
| `phone` | `String?` | Phone number |
| `gender` | `String?` | Gender |
| `status` | `String?` | Account status |
| `role_id` | `BigInt?` (FK → Role) | Assigned role |
| `org_id` | `String?` (FK → Organisation, UUID) | Associated organisation |
| `job_title` | `String?` | Job title |
| `last_login` | `DateTime?` | Last login timestamp |

**Relations:** `Role`, `Organisation`, `File[]`

---

### Organisation

| Field | Type | Description |
|---|---|---|
| `org_id` | `String` (PK, UUID) | Unique identifier |
| `org_name` | `String` | Company name |
| `industry` | `String?` | Industry sector |
| `founded` | `DateTime?` | Date founded |
| `key_contacts` | `BigInt?` | Primary contact user ID |
| `company_location` | `String?` | Headquarters |
| `organization_chart` | `String?` | Org chart URL |
| `gpt_types` | `String?` | AI model preferences |
| `storage_bucket` | `String` (UUID) | Auto-generated Supabase storage bucket ID (a dedicated bucket is created per org) |
| `hubspot_connected` | `Boolean` | HubSpot integration connected |
| `quickbooks_connected` | `Boolean` | QuickBooks integration connected |
| `monday_connected` | `Boolean` | Monday.com integration connected |
| `clickup_connected` | `Boolean` | ClickUp integration connected |
| `laborSource` | `String?` | Active labor KPI source: `"monday"` or `"clickup"` (auto-detected on OAuth, overridable via labor-config endpoint) |
| `mondayBoardId` | `String?` | Monday.com board ID used for labor KPI fetching |
| `clickupWorkspaceId` | `String?` | ClickUp workspace ID used for labor KPI fetching |
| `is_platform` | `Boolean` | Marks the platform org (Maural Solutions) — used for admin auto-assignment |

**Relations:** `User[]`, `File[]`, `FinanceKpi[]`, `LeadsKpi[]`, `LaborKpi[]`, `VTO?`, `HubspotToken`, `QuickbooksToken`, `MondayToken`, `ClickUpToken`, `document_embeddings[]`

---

### File

| Field | Type | Description |
|---|---|---|
| `file_id` | `String` (PK, UUID) | Unique identifier |
| `file_name` | `String` | Original file name |
| `file_size` | `BigInt?` | File size in bytes |
| `file_source` | `String?` | Supabase storage path |
| `ctg_id` | `BigInt?` (FK → Category) | Category |
| `org_id` | `String?` (FK → Organisation, UUID) | Owning organisation |
| `user_id` | `BigInt?` (FK → User) | Uploader |
| `created_at` | `DateTime` | Upload timestamp |
| `updated_at` | `DateTime` | Last modified timestamp |

**Relations:** `Category`, `Organisation`, `User`

---

### Comment

| Field | Type | Description |
|---|---|---|
| `comment_id` | `BigInt` (PK, auto-increment) | Unique identifier |
| `file_id` | `String` (FK → File, UUID) | Associated document |
| `comment` | `String` | Comment text |
| `created_at` | `DateTime` | Creation timestamp |
| `user_id` | `BigInt?` (FK → User) | Author |

**Relations:** `File`, `User`

---

### Activity_Log

| Field | Type | Description |
|---|---|---|
| `activity_id` | `BigInt` (PK, auto-increment) | Unique identifier |
| `file_id` | `String?` (FK → File, UUID) | Associated document |
| `activity_type` | `BigInt?` (FK → ActivityType) | Type of activity |
| `activity_datetime` | `DateTime?` | When the activity occurred |
| `user_id` | `BigInt?` (FK → User) | User who performed action |

**Relations:** `ActivityType`, `File`, `User`

---

### ActivityType

| Field | Type | Description |
|---|---|---|
| `activity_type_id` | `BigInt` (PK, auto-increment) | Unique identifier |
| `activity_name` | `String?` | Activity label (e.g., "Viewed", "Downloaded") |

---

### Role

| Field | Type | Description |
|---|---|---|
| `role_id` | `BigInt` (PK, auto-increment) | Unique identifier |
| `role_name` | `String?` | Role label |

**Predefined Roles:** Super Admin, Admin, Org Executive, Org Staff

**Relations:** `User[]`, `RolePermission[]`

---

### Permission

| Field | Type | Description |
|---|---|---|
| `permission_id` | `BigInt` (PK, auto-increment) | Unique identifier |
| `permission_name` | `String?` | Permission label |

**Relations:** `RolePermission[]`

---

### RolePermission

| Field | Type | Description |
|---|---|---|
| `role_id` | `BigInt` (PK, FK → Role) | Role |
| `permission_id` | `BigInt` (PK, FK → Permission) | Permission |

**Composite Primary Key:** (`role_id`, `permission_id`)

---

### Category

| Field | Type | Description |
|---|---|---|
| `ctg_id` | `BigInt` (PK, auto-increment) | Unique identifier |
| `ctg_name` | `String?` | Category label |

**Relations:** `File[]`

---

### VTO (Vision/Traction Organizer)

| Field | Type | Description |
|---|---|---|
| `vto_id` | `String` (PK, UUID) | Unique identifier |
| `title` | `String` | VTO document title |
| `year` | `String` | Planning year |
| `created_at` | `DateTime` | Creation timestamp |
| `updated_at` | `DateTime` | Last modified timestamp |
| `org_id` | `String` (FK → Organisation, UUID, unique) | Owning organisation (1:1) |
| `core_values` | `Json` | Array of core values |
| `mission` | `String?` | Organisation mission statement |
| `vision` | `String?` | Organisation vision statement |
| `ten_year_targets` | `Json` | Array of 10-year target strings |
| `target_market` | `String?` | Target market description |
| `proven_process` | `String?` | Proven process description |
| `differentiators` | `String?` | Key differentiators |
| `guarantee` | `String?` | Organisation guarantee |
| `future_date` | `String?` | 3-year picture target date |
| `revenue` | `String?` | 3-year revenue target |
| `profit` | `String?` | 3-year profit target |
| `measurables` | `String?` | 3-year measurables |
| `look_like` | `String?` | "What it looks like" description |

**Relations:** `Organisation` (one-to-one via unique `org_id`)

> The VTO data is also injected into the AI chatbot's context so it can answer questions about the organisation's vision, strategy, and goals.

---

### Integration Token Tables

#### HubspotToken

| Field | Type |
|---|---|
| `org_id` | `String` (PK, UUID, FK → Organisation) |
| `access_token` | `String` |
| `refresh_token` | `String` |
| `expires_at` | `DateTime` |
| `created_at` | `DateTime` |
| `updated_at` | `DateTime` |

#### QuickbooksToken

| Field | Type |
|---|---|
| `org_id` | `String` (PK, UUID, FK → Organisation) |
| `access_token` | `String` |
| `refresh_token` | `String` |
| `token_type` | `String` |
| `realmId` | `BigInt` |
| `expires_in` | `Int` |
| `x_refresh_token_expires_in` | `Int` |

#### MondayToken

| Field | Type |
|---|---|
| `id` | `Int` (PK, auto-increment) |
| `org_id` | `String` (unique, UUID, FK → Organisation) |
| `access_token` | `String` |
| `refresh_token` | `String?` |
| `token_type` | `String?` |
| `realm_id` | `String?` |
| `expires_in` | `Int?` |
| `refresh_token_expires_in` | `Int?` |
| `created_at` | `DateTime` |
| `updated_at` | `DateTime` |

#### ClickUpToken

| Field | Type |
|---|---|
| `org_id` | `String` (PK, UUID, FK → Organisation) |
| `access_token` | `String` |
| `refresh_token` | `String?` |
| `token_type` | `String?` |
| `team_id` | `String?` |
| `expires_at` | `DateTime?` |
| `created_at` | `DateTime?` |
| `updated_at` | `DateTime?` |

> **Note:** ClickUp tokens are long-lived. `team_id` is cached after first API call to `/team`. `refresh_token`, `token_type`, and `expires_at` are nullable because ClickUp's OAuth response does not include these fields.

---

### document_embeddings (Supabase / pgvector)

| Field | Type | Description |
|---|---|---|
| `id` | `BigInt` (PK) | Unique identifier |
| `content` | `Text` | Chunk of document text |
| `metadata` | `JSON` | File ID, file name, org_id, ctg_id, chunk index |
| `org_id` | `String?` (FK → Organisation, UUID) | Organisation scope for tenant isolation |
| `embedding` | `vector(1536)` | Embedding vector (generated by Ollama `nomic-embed-text`) |

The `org_id` column has a B-tree index and `ON DELETE CASCADE` FK to the Organisation table. The `match_documents` RPC uses `WHERE org_id = ANY(filter_org_ids)` for database-level tenant isolation during vector search.
