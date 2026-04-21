# Maural KMS — Technical Operations Guide

Reference guide for system operators and platform administrators — covers role architecture, first-time bootstrap, ongoing management API reference, and technical troubleshooting. For application UI navigation, see [USER_GUIDE.md](USER_GUIDE.md).

---

## Table of Contents

1. [Role Architecture](#1-role-architecture)
2. [First-Time System Bootstrap](#2-first-time-system-bootstrap)
3. [Ongoing User & Organisation Management](#3-ongoing-user--organisation-management)
4. [Technical Troubleshooting](#4-technical-troubleshooting)
5. [Sponsor Deployment Guide](#5-sponsor-deployment-guide)

---

## 1. Role Architecture

The system uses a four-tier role hierarchy stored in Clerk `publicMetadata` and mirrored in the database.

| Clerk Role | DB Role Name | Level | Scope |
| --- | --- | :---: | --- |
| `super_admin` | Super Admin | 4 | Platform-wide — full system access |
| `admin` | Admin | 3 | Platform-wide — manages orgs and users |
| `org_executive` | Org Executive | 2 | Own org only — management and reporting |
| `org_staff` | Org Staff | 1 | Own org only — documents and AI chatbot |

`requireRole(minRole)` middleware enforces the hierarchy: a user must have a role level **≥ the minimum required** to access the endpoint. `requireOrgAccess` additionally prevents `org_executive` and `org_staff` from accessing other organisations' data.

`super_admin` and `admin` users are automatically assigned to the internal **platform organisation** (`is_platform: true`, "Maural Solutions") when no explicit `org_id` is provided at creation time.

---

## 2. First-Time System Bootstrap

Completed once when the system is first deployed. Perform these steps in order.

### Prerequisites

Ensure the following environment variables are set before proceeding:

| Variable | Description |
| --- | --- |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_WEBHOOK_SECRET` | Svix signing secret for the Clerk webhook |
| `DATABASE_URL` | PostgreSQL connection string |
| `DIRECT_URL` | Direct connection URL for migrations |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (used by ingestion pipeline) |
| `OPENAI_API_KEY` | OpenAI API key (chat + embeddings) |

### Step 1 — Configure Clerk

1. Go to `dashboard.clerk.com` → open your production project.
2. Navigate to **Configure → Restrictions** → set sign-up mode to **Invitation Only**. This prevents anyone without an invitation from creating an account.
3. Navigate to **Configure → Webhooks** → add an endpoint pointing to:

   ```text
   POST https://<your-api-domain>/api/webhooks/clerk
   ```

4. Enable the following events on that webhook: `user.created`, `user.updated`, `user.deleted`.
5. Copy the **Signing Secret** (starts with `whsec_`) — this is your `CLERK_WEBHOOK_SECRET` env var.

### Step 2 — Run Migrations and Seed

```bash
# Apply all Prisma schema migrations
npx prisma migrate deploy

# Seed the platform organisation ("Maural Solutions", is_platform = true)
npx prisma db seed
```

On Railway, run these as one-off commands via **Service → Settings → Deploy → Run Command**.

The four roles (`Super Admin`, `Admin`, `Org Executive`, `Org Staff`) must exist in the `Role` table before any users are created. Verify with:

```sql
SELECT role_name FROM "Role";
```

### Step 3 — Set Up pgvector (Supabase SQL Editor — one time only)

Required for the AI chatbot to store and search document embeddings. Run once in **Supabase Dashboard → SQL Editor**:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS document_embeddings (
  id        bigserial PRIMARY KEY,
  content   text,
  metadata  jsonb,
  org_id    uuid REFERENCES "Organisation"(org_id) ON DELETE CASCADE,
  embedding vector(1536)
);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_org_id
  ON document_embeddings (org_id);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_embedding
  ON document_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_count     int DEFAULT 15,
  filter_org_ids  uuid[] DEFAULT NULL
)
RETURNS TABLE (id bigint, content text, metadata jsonb, similarity float)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_embeddings.id,
    document_embeddings.content,
    document_embeddings.metadata,
    1 - (document_embeddings.embedding <=> query_embedding) AS similarity
  FROM document_embeddings
  WHERE (filter_org_ids IS NULL OR document_embeddings.org_id = ANY(filter_org_ids))
  ORDER BY document_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

GRANT ALL ON TABLE document_embeddings TO service_role;
GRANT ALL ON SEQUENCE document_embeddings_id_seq TO service_role;
ALTER TABLE document_embeddings DISABLE ROW LEVEL SECURITY;
```

> The table must use `vector(1536)` — this matches the output dimensions of `text-embedding-3-small`. Do not change this value.

### Step 4 — Create the First Super Admin

The first Super Admin must be created manually in the Clerk Dashboard because no admins exist yet to send invitations.

1. Go to **Clerk Dashboard → Users → Create User**.
2. Enter the Super Admin's email, first name, and last name.
3. Before saving, set the **Public Metadata** field to:

   ```json
   { "role": "super_admin" }
   ```

4. Click **Create**.

**What happens automatically:**

- Clerk fires a `user.created` webhook event
- The webhook handler reads `publicMetadata.role` → maps `"super_admin"` to the DB "Super Admin" role
- Because no `org_id` was set, the webhook auto-assigns the Super Admin to the platform org (`is_platform: true`)
- A `User` record is created in the database with the correct `role_id` and `org_id`

The Super Admin can now sign in and proceed with the steps below.

### Step 5 — Create the First Organisation

**Endpoint:** `POST /api/org/`

```json
{
  "org_name": "Acme Corp",
  "industry": "Technology",
  "company_location": "Toronto, ON"
}
```

Returns the created `Organisation` object with a UUID `org_id`. A dedicated Supabase storage bucket is automatically created for the organisation — no manual bucket setup is needed. Repeat for each client organisation to be onboarded.

### Step 6 — Invite the First Admin

**Endpoint:** `POST /api/user/invite`

```json
{
  "email_address": "admin@acmecorp.com",
  "role": "admin",
  "org_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

Clerk sends an invitation email. When the invitee signs up, the `user.created` webhook fires and auto-assigns the `admin` role and the specified `org_id`. If `org_id` is omitted, they are assigned to the platform org.

---

## 3. Ongoing User & Organisation Management

### Invitation Permission Matrix

| Inviter Role | Can Invite | Org Restriction |
| --- | --- | --- |
| `super_admin` | `admin`, `org_executive`, `org_staff` | Any org |
| `admin` | `org_executive`, `org_staff` | Any org |
| `org_executive` | `org_executive`, `org_staff` | Own org only (auto-enforced) |
| `org_staff` | Nobody | — |

### Invitation API

| Endpoint | Description |
| --- | --- |
| `POST /api/user/invite` | Send an invitation (`email_address`, `role`, `org_id`) |
| `GET /api/user/invitations` | List invitations — filter with `?status=pending\|accepted\|revoked` |
| `DELETE /api/user/invite/:invitationId` | Revoke a pending invitation |

### Organisation API

| Endpoint | Description |
| --- | --- |
| `POST /api/org/` | Create an organisation (auto-creates Supabase storage bucket) |
| `PUT /api/org/:orgId` | Update organisation details |
| `DELETE /api/org/:orgId` | Delete an organisation (removes storage bucket) |

### User API

| Endpoint | Description |
| --- | --- |
| `PUT /api/user/:userId` | Update profile — `org_id`, `job_title`, `phone`, `role`, etc. |
| `DELETE /api/user/:userId` | Delete a user |

### Bootstrap Workflow Summary

```text
┌─────────────────────────────────────────────────────────────┐
│                    BOOTSTRAP PHASE                          │
├─────────────────────────────────────────────────────────────┤
│  1. Configure Clerk (invitation-only + webhook)             │
│                     ↓                                       │
│  2. npx prisma migrate deploy && npx prisma db seed         │
│                     ↓                                       │
│  3. Run pgvector SQL in Supabase                            │
│                     ↓                                       │
│  4. Create Super Admin manually in Clerk Dashboard          │
│     (set publicMetadata.role = "super_admin")               │
│     → Webhook auto-creates DB record + assigns platform org │
├─────────────────────────────────────────────────────────────┤
│                   ONBOARDING PHASE                          │
├─────────────────────────────────────────────────────────────┤
│  5. POST /api/org/  — create client organisations           │
│                     ↓                                       │
│  6. POST /api/user/invite (role: "admin")  — invite Admins  │
│                     ↓                                       │
│  7. Admins invite Org Executives & Staff via the app UI     │
├─────────────────────────────────────────────────────────────┤
│                   ONGOING OPERATIONS                        │
├─────────────────────────────────────────────────────────────┤
│  • Manage invitations: GET/DELETE /api/user/invite          │
│  • Update user profiles: PUT /api/user/:userId              │
│  • Manage organisations: PUT/DELETE /api/org/:orgId         │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Technical Troubleshooting

### Webhook not receiving events

- Confirm `CLERK_WEBHOOK_SECRET` matches the Svix signing secret in the Clerk Dashboard.
- In Clerk Dashboard → Webhooks, verify the endpoint URL is correct and `user.created`, `user.updated`, `user.deleted` events are enabled.
- Check API logs for `[Clerk Webhook]` entries. A `400 Invalid webhook signature` means the secret is wrong or the body was modified in transit — ensure `/api/webhooks/clerk` uses `express.raw()` middleware, not `express.json()`.

### User created in Clerk but no database record appears

- Confirm the webhook is configured and receiving events (see above).
- Check that the four roles exist in the `Role` table — if the role lookup fails, the webhook logs an error but may still create the user without a `role_id`.
- Verify `publicMetadata.role` is one of: `super_admin`, `admin`, `org_executive`, `org_staff`. Any other value is ignored and the user defaults to `org_staff`.

### `super_admin` / `admin` user created but no org assigned

- Confirm `npx prisma db seed` has been run — the webhook auto-assigns these roles to the `is_platform: true` org. If no platform org exists, the assignment is silently skipped.
- Assign the org manually if needed:

  ```text
  PUT /api/user/:userId  →  { "org_id": "<platform-org-id>" }
  ```

### Auth returns 401 on all requests

- Confirm `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are set correctly.
- Verify the JWT in the `Authorization: Bearer <token>` header is not expired.
- In development, `DISABLE_AUTH=true` bypasses all checks — ensure this is not set in production.

### Database connection errors at startup

- Confirm `DATABASE_URL` and `DIRECT_URL` are set and point to the correct Supabase project.
- Verify `npx prisma migrate deploy` has been run — a missing table causes Prisma to throw `P2021` (table does not exist).
- Check Supabase Dashboard → Database → Connection Pooling to confirm the connection limit has not been reached.

### AI chatbot returns no results / embeddings not found

- Confirm the `document_embeddings` table and `match_documents` function exist (Step 3 above).
- Confirm `OPENAI_API_KEY` is set — embeddings are generated at upload time using `text-embedding-3-small`.
- If documents were uploaded before the table was created, re-upload them or re-run ingestion via `POST /api/chat/ingest`.

### KPI data not appearing in analytics

- Confirm the relevant integration OAuth token is stored in the DB (`HubspotToken`, `QuickbooksToken`, `MondayToken`, or `ClickUpToken` table).
- KPI data is cached for up to 6 hours — check API logs for `[finance]`, `[leads]`, or `[labor]` entries to see if a refresh is in progress.
- For QuickBooks: confirm `QUICKBOOKS_ENVIRONMENT` is set to `production` and `QUICKBOOKS_BASE_URL` points to the production endpoint.

---

## 5. Sponsor Deployment Guide

Complete instructions for getting the application running from scratch using the provided Docker images. No access to the source code is required.

### What You Will Receive

| File | Contents |
| --- | --- |
| `maural-kms-backend-1.0.tar` | Backend API server image (~150 MB) |
| `maural-kms-frontend.tar` | Frontend web app image (~25 MB) |
| `.env.example` | Template with all required environment variable names |

### Sponsor Prerequisites

- **Docker Desktop** installed and running — [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
- **A Supabase account and project** — [supabase.com](https://supabase.com) (free tier is sufficient)
- **An OpenAI API key** — [platform.openai.com](https://platform.openai.com)
- **A Clerk account** — [clerk.com](https://clerk.com) (free tier is sufficient)
- Minimum 2 GB free disk space

---

### Part A — Backend

#### Step 1 — Load the Backend Image

```powershell
# Windows
docker load -i maural-kms-backend-1.0.tar

# Mac / Linux
docker load < maural-kms-backend-1.0.tar
```

Verify it loaded:

```powershell
docker images
# You should see: maural-kms-backend   1.0   listed
```

#### Step 2 — Create Your .env File

Copy `.env.example` to `.env` and fill in all values:

```bash
# Database — Supabase project → Settings → Database
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

# Supabase — project → Settings → API
SUPABASE_URL=https://[ref].supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Clerk — Clerk Dashboard → API Keys
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...        # obtained in Step 6 below

# OpenAI — platform.openai.com → API Keys
OPENAI_API_KEY=sk-...
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBED_MODEL=text-embedding-3-small

# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
ALLOWED_ORIGINS=https://your-frontend-domain.com
FRONTEND_URL=https://your-frontend-domain.com
FRONTEND_REDIRECT_URI=https://your-frontend-domain.com/integrations

# Integrations — leave blank for now, fill in when connecting each service
HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=
HUBSPOT_REDIRECT_URI=https://your-api-domain.com/api/integrations/hubspot/oauth-callback
QUICKBOOKS_CLIENT_ID=
QUICKBOOKS_CLIENT_SECRET=
QUICKBOOKS_REDIRECT_URI=https://your-api-domain.com/api/integrations/quickbooks/oauth-callback
QUICKBOOKS_ENVIRONMENT=production
QUICKBOOKS_BASE_URL=https://quickbooks.api.intuit.com
MONDAY_CLIENT_ID=
MONDAY_CLIENT_SECRET=
MONDAY_REDIRECT_URI=https://your-api-domain.com/api/integrations/monday/oauth-callback
CLICKUP_CLIENT_ID=
CLICKUP_CLIENT_SECRET=
CLICKUP_REDIRECT_URI=https://your-api-domain.com/api/integrations/clickup/oauth-callback
```

#### Step 3 — Run Database Migrations

The backend image includes all migration files. Run this once to create the database schema:

```bash
docker run --rm --env-file .env maural-kms-backend:1.0 npx prisma migrate deploy
```

Then seed the platform organisation:

```bash
docker run --rm --env-file .env maural-kms-backend:1.0 npx prisma db seed
```

#### Step 4 — Set Up pgvector in Supabase

Go to **Supabase Dashboard → SQL Editor** and run the following once. This is required for the AI chatbot to work:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS document_embeddings (
  id        bigserial PRIMARY KEY,
  content   text,
  metadata  jsonb,
  org_id    uuid REFERENCES "Organisation"(org_id) ON DELETE CASCADE,
  embedding vector(1536)
);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_org_id
  ON document_embeddings (org_id);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_embedding
  ON document_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_count     int DEFAULT 15,
  filter_org_ids  uuid[] DEFAULT NULL
)
RETURNS TABLE (id bigint, content text, metadata jsonb, similarity float)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_embeddings.id,
    document_embeddings.content,
    document_embeddings.metadata,
    1 - (document_embeddings.embedding <=> query_embedding) AS similarity
  FROM document_embeddings
  WHERE (filter_org_ids IS NULL OR document_embeddings.org_id = ANY(filter_org_ids))
  ORDER BY document_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

GRANT ALL ON TABLE document_embeddings TO service_role;
GRANT ALL ON SEQUENCE document_embeddings_id_seq TO service_role;
ALTER TABLE document_embeddings DISABLE ROW LEVEL SECURITY;
```

#### Step 5 — Start the Backend Container

```bash
docker run -d \
  --name maural-kms-backend \
  --restart unless-stopped \
  --env-file .env \
  -p 3000:3000 \
  maural-kms-backend:1.0
```

Verify it is running:

```bash
curl http://localhost:3000/api/health
# Expected: { "status": "ok", ... }
```

#### Step 6 — Configure the Clerk Webhook

The webhook keeps your database in sync whenever users are created, updated, or deleted.

1. Go to **Clerk Dashboard → Configure → Webhooks → Add Endpoint**
2. Set the URL to: `https://your-api-domain.com/api/webhooks/clerk`
3. Enable events: `user.created`, `user.updated`, `user.deleted`
4. Copy the **Signing Secret** (starts with `whsec_`) and set it as `CLERK_WEBHOOK_SECRET` in your `.env`
5. Restart the backend container with the updated secret:

```bash
docker stop maural-kms-backend && docker rm maural-kms-backend
# Re-run the docker run command from Step 5
```

#### Step 7 — Create the First Super Admin

> **Before creating users:** Go to **Clerk Dashboard → Configure → Restrictions** and set sign-up mode to **Invitation Only**. This prevents anyone without an invitation from creating an account.

1. Go to **Clerk Dashboard → Users → Create User**
2. Enter the Super Admin's email, first name, and last name
3. Set **Public Metadata** to: `{ "role": "super_admin" }`
4. Click **Create** — the webhook automatically creates the matching database record with the Super Admin role

---

### Part B — Frontend

#### Step 8 — Load the Frontend Image

```powershell
# Windows
docker load -i maural-kms-frontend.tar

# Mac / Linux
docker load < maural-kms-frontend.tar
```

Verify it loaded:

```powershell
docker images
# You should see: maural-kms   latest   listed
```

#### Step 9 — Set Up Your Clerk Account for the Frontend

1. In the same Clerk application from Step 6, go to **API Keys**
2. Copy the **Publishable Key** — it starts with `pk_live_` (production) or `pk_test_` (staging). This is the same value as `CLERK_PUBLISHABLE_KEY` in your backend `.env`
3. Go to **Domains** and add the domain or IP address where you will host the frontend (e.g. `https://kms.yourcompany.com`)

#### Step 10 — Start the Frontend Container

```bash
docker run -d \
  --name maural-kms-frontend \
  --restart unless-stopped \
  -p 8080:80 \
  -e VITE_API_BASE_URL=https://your-api-domain.com/api \
  -e VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxx \
  -e VITE_WEBVIEWER_LICENSE_KEY="your-webviewer-license-key" \
  maural-kms:latest

# VITE_WEBVIEWER_LICENSE_KEY — PDF viewer license from Apryse (apryse.com).
# Leave empty or omit for the free-tier watermarked viewer.
```

Open `http://localhost:8080` to verify the app loads.

---

### End-to-End Verification

Run through this checklist after both containers are running:

- `curl http://localhost:3000/api/health` returns `{ "status": "ok" }`
- `http://localhost:8080` loads the login page
- The Super Admin can sign in successfully
- The Super Admin dashboard loads without errors
- Creating an organisation via the UI works

---

### Cloud Deployment Options

For production hosting, push the loaded images to your own registry and deploy from there. The environment variables set via `-e` or `--env-file` are instead entered in the platform's dashboard.

| Platform | How to deploy |
| --- | --- |
| Railway | New project → Deploy from Docker image → paste image URL → set env vars in Variables tab |
| AWS (App Runner / ECS) | Push image to ECR → create service pointing to ECR image → set env vars in task config |
| Google Cloud Run | Push image to Artifact Registry → deploy to Cloud Run → set env vars in service config |
| Azure Container Apps | Push image to Azure Container Registry → create Container App → set env vars in Environment Variables |

To push to your own registry:

```bash
docker tag maural-kms-backend:1.0  your-registry/maural-kms-backend:1.0
docker tag maural-kms:latest        your-registry/maural-kms-frontend:latest
docker push your-registry/maural-kms-backend:1.0
docker push your-registry/maural-kms-frontend:latest
```

---

### Troubleshooting

#### Backend container exits immediately

```bash
docker logs maural-kms-backend
```

Look for `[env] Missing required environment variables` — confirm all required values in `.env` are filled in.

#### Login fails after the app loads

→ Clerk publishable key is wrong, or the frontend domain is not whitelisted in your Clerk dashboard (Step 9, point 3).

#### App loads but data does not appear / API calls fail

→ `VITE_API_BASE_URL` is incorrect or the backend is not reachable. Check `ALLOWED_ORIGINS` in the backend `.env` includes the frontend domain.

#### Migrations fail

→ Confirm `DATABASE_URL` and `DIRECT_URL` point to a valid, reachable Supabase project. Free-tier Supabase projects pause after inactivity — check the Supabase dashboard to confirm the project is active.

#### AI chatbot returns no results

→ pgvector setup was not run (Step 4), or `OPENAI_API_KEY` is not set correctly.

#### Port already in use

→ Change the left side of `-p`: e.g. `-p 4000:3000` for the backend, or `-p 3000:80` for the frontend.

#### Need to update an environment variable

```bash
docker stop maural-kms-backend && docker rm maural-kms-backend
# Edit .env, then re-run the docker run command from Step 5
```

---

*For application UI navigation, see [USER_GUIDE.md](USER_GUIDE.md). For deployment configuration and infrastructure handover, see [PRODUCTION_HANDOVER_CHECKLIST.html](PRODUCTION_HANDOVER_CHECKLIST.html).*
