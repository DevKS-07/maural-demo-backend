# Maural KMS — Backend API

REST API for the Maural Knowledge Management System — a multi-tenant platform that provides document management, AI-powered chat (RAG pipeline), KPI dashboards, strategic planning (VTO), user and organisation management, and OAuth integrations with HubSpot, QuickBooks, Monday.com, and ClickUp.

Maural Solutions LLC operates the platform as a consulting firm serving multiple organisations simultaneously. Each organisation's data is logically isolated — users, documents, KPIs, and AI search results are scoped per tenant.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Folder Structure](#folder-structure)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Authentication & Authorization](#authentication--authorization)
- [System Setup & User Onboarding](#system-setup--user-onboarding)
- [AI Chatbot](#ai-chatbot)
- [KPI Dashboards](#kpi-dashboards)
- [API Endpoints](#api-endpoints)
- [Entity Relationships](#entity-relationships)
- [Scripts](#scripts)
- [Notes](#notes)

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Node.js (Express 5) | API server |
| Database | PostgreSQL via Supabase | Primary data store |
| ORM | Prisma | Schema management, queries, migrations |
| Auth | Clerk (JWT) | Authentication, user lifecycle webhooks |
| LLM | OpenAI — `gpt-4o-mini` | Intent routing, agent responses, guardrails |
| Embeddings | OpenAI — `text-embedding-3-small` | 1536-dimensional document vectors |
| LLM SDK | LangChain (`@langchain/openai`) | ChatOpenAI and OpenAIEmbeddings wrappers |
| Vector Search | Supabase pgvector | Cosine similarity search on document embeddings |
| File Storage | Supabase Storage | Per-organisation storage buckets |
| Streaming | SSE (Server-Sent Events) | Real-time token delivery for chat |
| Integrations | HubSpot, QuickBooks, Monday.com, ClickUp | OAuth 2.0 data connections for KPI pipelines |

### Global Middleware

| Middleware | Description |
|---|---|
| Helmet | Security-related HTTP headers |
| CORS | Restricts origins to `ALLOWED_ORIGINS` env var |
| Compression | gzip response compression |
| Morgan | Request logging (JSON in production, `dev` format locally) |
| cookie-parser | Parses cookies from incoming requests |

---

## Quick Start

> **Prerequisites:** Node.js, PostgreSQL via Supabase, OpenAI API key

```bash
# 1. Clone the repository
git clone <repo-url>
cd maural-kms-api

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Fill in all required values — see Environment Variables section
# At minimum: DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY,
#             CLERK_SECRET_KEY, OPENAI_API_KEY

# 4. Run database migrations
npx prisma migrate dev

# 5. Start the development server
npm run dev
```

Server runs at `http://localhost:5000/api/v1`

---

## Folder Structure

```
maural-kms-api/
├── controllers/
│   ├── auth.controller.js           — Clerk webhook handler + /auth/me
│   ├── chat.controller.js           — Streaming + JSON chat endpoints
│   ├── ingest.controller.js         — Document ingestion pipeline
│   ├── user.controller.js           — User CRUD
│   ├── invitation.controller.js     — Clerk invitation management
│   ├── org.controller.js            — Organisation CRUD + storage bucket lifecycle
│   ├── docs.controller.js           — Document upload, download, comments
│   ├── vto.controller.js            — VTO (Vision/Traction Organizer) CRUD
│   ├── engine.controller.js         — KPI summary + scorecard aggregation
│   ├── hubspot.controller.js        — HubSpot OAuth + data endpoints
│   ├── quickbooks.controller.js     — QuickBooks OAuth + data endpoints
│   ├── monday.controller.js         — Monday.com OAuth + status
│   ├── clickup.controller.js        — ClickUp OAuth + status
│   └── laborConfig.controller.js    — Labor KPI source configuration
├── middleware/
│   └── auth.middleware.js           — Clerk JWT validation, RBAC, org-level access control
├── routes/
│   ├── auth.routes.js
│   ├── user.routes.js
│   ├── org.routes.js
│   ├── docs.routes.js
│   ├── chat.routes.js
│   ├── vto.routes.js
│   ├── summary.routes.js
│   ├── hubspot.routes.js
│   ├── quickbooks.routes.js
│   ├── monday.routes.js
│   ├── clickup.routes.js
│   ├── laborConfig.routes.js
│   ├── integrations.routes.js
│   └── home.routes.js
├── services/
│   ├── ragService.js                — Document retrieval + prompt construction
│   ├── businessDataService.js       — KPI + VTO data fetching for chat context
│   ├── intentRouter.js              — Multi-intent detection (OpenAI)
│   ├── promptTemplates.js           — Per-intent system prompts
│   ├── guardrail.js                 — Answer accuracy verification
│   ├── finance.service.js           — QuickBooks financial KPI computation
│   ├── leads.service.js             — HubSpot leads KPI computation
│   ├── labour.service.js            — Labor KPI computation
│   ├── monday.service.js            — Monday.com API integration
│   ├── clickup.service.js           — ClickUp API integration
│   └── laborConfig.service.js       — Labor source auto-detection + configuration
├── lib/
│   └── prisma.js                    — Prisma singleton
├── scripts/
│   └── ingest-local.js              — Local ingestion script (reads from uploads/)
├── prisma/
│   └── schema.prisma                — Database schema
├── __tests__/                       — Test suite
├── config/                          — Configuration files
├── deploy/                          — Deployment configs
├── uploads/                         — Temp Multer directory (gitignored)
├── .env.example
├── app.js                           — Express app setup + middleware
├── server.js                        — Server entry point
├── routes.js                        — Route registration
└── package.json
```

---

## Environment Variables

Copy `.env.example` to `.env`. Never commit your `.env` file.

### General

| Variable | Description | Required |
|---|---|---|
| `NODE_ENV` | `development` or `production` | Yes |
| `HOST` | Server host | Yes |
| `PORT` | Server port — default `5000` | Yes |
| `apiVersion` | API version prefix — default `v1` | Yes |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | Yes |
| `FRONTEND_URL` | Base URL of the frontend app | Yes |
| `FRONTEND_REDIRECT_URI` | Frontend URL for OAuth redirect after connection | Yes |
| `DISABLE_AUTH` | Set `true` to bypass auth locally — never use in production | No |

### Supabase / Database

| Variable | Description | Required |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous/public key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (used by ingestion pipeline) | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `DIRECT_URL` | Direct connection URL for migrations | Yes |

### Clerk (Auth)

| Variable | Description | Required |
|---|---|---|
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Yes |
| `CLERK_SECRET_KEY` | Clerk secret key | Yes |
| `CLERK_WEBHOOK_SECRET` | Webhook secret — required for user lifecycle sync | Yes |

### OpenAI (AI)

| Variable | Description | Required |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI API key — obtain at `platform.openai.com` | Yes |
| `OPENAI_CHAT_MODEL` | Chat model — default `gpt-4o-mini` | No |
| `OPENAI_EMBED_MODEL` | Embeddings model — default `text-embedding-3-small` | No |

### HubSpot Integration

| Variable | Description | Required |
|---|---|---|
| `HUBSPOT_APP_ID` | HubSpot app ID | Yes |
| `HUBSPOT_CLIENT_ID` | OAuth client ID | Yes |
| `HUBSPOT_CLIENT_SECRET` | OAuth client secret | Yes |
| `HUBSPOT_REDIRECT_URI` | OAuth callback URL | Yes |

### QuickBooks Integration

| Variable | Description | Required |
|---|---|---|
| `QUICKBOOKS_APP_ID` | QuickBooks app ID | Yes |
| `QUICKBOOKS_CLIENT_ID` | OAuth client ID | Yes |
| `QUICKBOOKS_CLIENT_SECRET` | OAuth client secret | Yes |
| `QUICKBOOKS_REDIRECT_URI` | OAuth callback URL | Yes |
| `QUICKBOOKS_ENVIRONMENT` | `sandbox` or `production` | Yes |
| `QUICKBOOKS_BASE_URL` | API base URL | Yes |

### Monday.com Integration

| Variable | Description | Required |
|---|---|---|
| `MONDAY_CLIENT_ID` | OAuth client ID | Yes |
| `MONDAY_CLIENT_SECRET` | OAuth client secret | Yes |
| `MONDAY_REDIRECT_URI` | OAuth callback URL | Yes |
| `MONDAY_SIGNING_SECRET` | Webhook signing secret for verifying Monday.com events | No |

### ClickUp Integration

| Variable | Description | Required |
|---|---|---|
| `CLICKUP_CLIENT_ID` | OAuth client ID | Yes |
| `CLICKUP_CLIENT_SECRET` | OAuth client secret | Yes |
| `CLICKUP_REDIRECT_URI` | OAuth callback URL | Yes |
| `CLICKUP_WEBHOOK_SECRET` | Webhook secret for verifying ClickUp events | No |

---

## Database

```bash
# Run migrations
npx prisma migrate dev

# Open Prisma Studio (optional)
npx prisma studio
```

### pgvector Setup

The pgvector extension and `document_embeddings` table must be created manually in Supabase before using the AI chatbot. Run the following in the Supabase SQL Editor:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create embeddings table with org_id for tenant isolation
-- 1536 dimensions = OpenAI text-embedding-3-small output size
CREATE TABLE IF NOT EXISTS document_embeddings (
  id        bigserial PRIMARY KEY,
  content   text,
  metadata  jsonb,
  org_id    uuid REFERENCES "Organisation"(org_id) ON DELETE CASCADE,
  embedding vector(1536)
);

-- Index on org_id for fast tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_document_embeddings_org_id
  ON document_embeddings (org_id);

-- Tenant-scoped similarity search function
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_count     int DEFAULT 15,
  filter_org_ids  uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id         bigint,
  content    text,
  metadata   jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
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

-- Grant access to service role
GRANT ALL ON TABLE document_embeddings TO service_role;
GRANT ALL ON SEQUENCE document_embeddings_id_seq TO service_role;
ALTER TABLE document_embeddings DISABLE ROW LEVEL SECURITY;
```

---

## Authentication & Authorization

### Clerk JWT

All protected endpoints require a valid Clerk JWT in the `Authorization` header:

```
Authorization: Bearer <clerk_jwt_token>
```

The `requireAuth` middleware validates the token using the Clerk SDK. Auth can be disabled in development with `DISABLE_AUTH=true`.

### Role-Based Access Control (RBAC)

The `requireRole(minRole)` middleware enforces a four-tier role hierarchy:

| Role | Level | Scope | Description |
|---|---|---|---|
| `super_admin` | 4 | Platform-wide | Full system access, manages all organisations and admins |
| `admin` | 3 | Platform-wide | Manages organisations and users |
| `org_executive` | 2 | Own org only | Organisation-level management and reporting |
| `org_staff` | 1 | Own org only | Standard member, accesses assigned organisation's resources |

A user must have a role level **>= the minimum required level** to access the endpoint.

### Organisation-Level Access Control (Tenant Isolation)

The `requireOrgAccess(orgIdSource)` middleware prevents users from accessing other organisations' data:

- **`super_admin` / `admin`**: Cross-org access — can access any organisation's data
- **`org_executive` / `org_staff`**: Own org only — locked to their assigned organisation

For param-based routes (e.g., `/api/summary/financial/:orgId`), the middleware validates the `orgId` matches the user's org. For body-based routes (e.g., `/api/chat`), it force-overrides `req.body.orgIds` with the user's own org ID.

### Rate Limits

| Scope | Window | Max Requests |
|---|---|---|
| Global (`/api/*`) | 15 min | 100 |
| Chat (`/api/chat/*`) | 15 min | 20 |

---

## System Setup & User Onboarding

Users are created exclusively through Clerk invitations — there is no public sign-up.

### Bootstrap (First-Time Setup)

1. **Enable invitation-only sign-up** in the Clerk Dashboard (Configure > Restrictions)
2. **Create the first Super Admin** manually in the Clerk Dashboard:
   - Create a user and set `publicMetadata: { "role": "super_admin" }`
   - The `user.created` webhook automatically creates the DB record with the Super Admin role
3. **Create organisations** via `POST /api/org/`
   - A dedicated Supabase storage bucket is auto-created per organisation

### Onboarding Users

4. **Super Admin invites Admins** via `POST /api/user/invite`
5. **Admins invite Org Executives and Staff** via `POST /api/user/invite`

| Inviter Role | Can Invite | Org Restriction |
|---|---|---|
| Super Admin | `admin`, `org_executive`, `org_staff` | Any org |
| Admin | `org_executive`, `org_staff` | Any org |
| Org Executive | `org_executive`, `org_staff` | Own org only (auto-filled) |
| Org Staff | Cannot invite | — |

When an invitee signs up through Clerk, the webhook auto-assigns their `org_id` and `role` from the invitation metadata.

### Invitation Management

- **List invitations**: `GET /api/user/invitations?status=pending`
- **Revoke invitation**: `DELETE /api/user/invite/:invitationId`

---

## AI Chatbot

AI inference is powered by the **OpenAI API** (`gpt-4o-mini` for chat, `text-embedding-3-small` for embeddings).

### Multi-Agent RAG Pipeline

Each chat request passes through a 5-step pipeline:

```
User Message
     |
     |----------------------------+----------------------------+
     v                           v                            v
[Intent Router]          [Document Retrieval]       [Business Data Service]
gpt-4o-mini, temp=0       pgvector top-15 chunks     DB queries (no LLM call)
-> ["summarize","predict"] -> relevant document text  -> KPI snapshots + VTO data
     |                            |                            |
     +----------+-----------------+----------------------------+
                v
     [Parallel Specialized Agents]
      One gpt-4o-mini agent per detected intent
      +----------+----------+----------+----------+----------+
      summarize  analyze    predict    explain    qa
      +----------+----------+----------+----------+----------+
                v
     [Response Combiner]  <- only if more than 1 intent
      gpt-4o-mini: merges sections into one coherent answer
                v
     [Guardrail Agent]
      gpt-4o-mini, temp=0, JSON output
      - Checks every claim against source documents and business data
      - Labels unlabeled general knowledge
      - Revises hallucinated claims
      - Returns: { validatedAnswer, confidence, issues[] }
                v
     Stream answer -> SSE chunks -> sources -> guardrail metadata -> [DONE]
```

### Intent Types

| Intent | Trigger | Agent Behaviour |
|---|---|---|
| `summarize` | "summarize", "overview", "condense" | Bullet points, executive summary |
| `analyze` | "analyze", "trends", "compare" | Step-by-step reasoning, quantified observations |
| `predict` | "predict", "forecast", "expect" | Confidence labels (High / Medium / Low) |
| `explain` | "explain", "what is", "how does" | Plain language, analogies |
| `qa` | Default — direct factual question | Direct answer grounded in documents |

### Document Ingestion

Before the chatbot can answer questions, documents must be ingested:

```bash
# Via API
POST /api/chat/ingest

# Or locally (place files in uploads/ first)
node scripts/ingest-local.js
```

**Pipeline:** Upload -> Text extraction -> Sanitize -> Chunk (1000 chars, 150-char overlap) -> Embed with `text-embedding-3-small` (OpenAI, 1536 dims) -> Store in `document_embeddings` with `org_id`

**Supported file types:**

| Extension | Parser |
|---|---|
| `.pdf` | `pdf-parse` v1 |
| `.xlsx`, `.xls` | SheetJS (`xlsx`) — each sheet converted to CSV |
| `.docx` | `mammoth` — raw text extraction |
| `.txt`, `.md`, `.csv`, `.json` | Raw UTF-8 buffer |

### Retrieval & Tenant Isolation

- **Top-K:** 15 most similar chunks via cosine similarity (`match_documents` RPC)
- **Tenant scoping:** The `filter_org_ids` parameter restricts search to the user's organisation. Admins can pass `NULL` for cross-org search
- **Document coverage guarantee:** After top-K, the system fetches at least 1 chunk from any file with no chunks in the results, ensuring all org documents are represented
- **Document index:** A list of all file names is prepended to the context on every request

### Business Data Context

In addition to document embeddings, the chatbot receives **live business data** on every request:

| Source | Database Table | Data |
|---|---|---|
| Financial KPIs | `FinanceKpi` | Revenue, profit, EBITDA, cash position, burn rate, runway |
| Leads KPIs | `LeadsKpi` | Sales funnel, conversion rate, pipeline coverage, retention |
| Labor KPIs | `LaborKpi` | Headcount, utilization, labor cost/hour, revenue per FTE |
| VTO | `VTO` | Core values, mission, vision, 10-year targets, marketing strategy |

Business data is injected into the system prompt alongside document chunks. It is **only injected when `orgIds` is scoped** to specific organisations — omitted in admin cross-org mode.

### Conversation Memory

Short-term, client-side — the frontend sends conversation history with each request, trimmed to the last **10 turns**. No server-side session storage.

### Guardrail

| Condition | Action |
|---|---|
| Claim not in documents, not labeled | Revised — claim removed or labeled `(General knowledge)` |
| Prediction without confidence label | Revised — confidence label added |
| All claims grounded | Original answer returned unchanged |
| Confidence score < 60 | Transparency note prepended |
| Guardrail LLM fails | Original answer returned (never blocks) |

---

## KPI Dashboards

KPI data is sourced from connected integrations and stored as periodic snapshots in the database.

| KPI Domain | Source Integration | Key Metrics |
|---|---|---|
| **Financial** | QuickBooks | Revenue, net income, EBITDA, gross margin, cash position, burn rate, runway, DSO, working capital |
| **Leads** | HubSpot | Leads, deals won, conversion rate, pipeline coverage, recurring revenue %, client concentration |
| **Labor** | Monday.com or ClickUp | Direct labor hours, headcount, billable utilization, labor cost/hour, revenue per FTE |

### Data Pipeline

1. Organisation authorizes OAuth -> Token stored
2. Labor source auto-configured (board/workspace detected on OAuth connect)
3. System fetches data from external API on demand
4. Data transformed into KPI snapshots -> Stored in `FinanceKpi` / `LeadsKpi` / `LaborKpi`
5. Rendered on organisation dashboard

### Caching

KPI snapshots use a DB-first strategy with a 6-hour cache TTL. Stale or missing data triggers a background API refresh. Each record is uniquely constrained on `[org_id, periodStart, periodEnd]` — refreshing overwrites rather than duplicates.

### Labor Source Configuration

After connecting Monday.com or ClickUp, the system auto-detects the default board/workspace. Manual override is available via the labor config API:

- `GET /api/integrations/labor-config/status` — Current config
- `GET /api/integrations/labor-config/monday/boards` — Available Monday boards
- `GET /api/integrations/labor-config/clickup/workspaces` — Available ClickUp workspaces
- `PUT /api/integrations/labor-config` — Override labor source

---

## API Endpoints

Base URL: `http://localhost:5000/api/v1`

All endpoints require a Clerk JWT Bearer token unless marked **Public**.

### Health & Home

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/health` | Server health, uptime, memory | Public |
| `GET` | `/` | Welcome message | Public |

### Webhooks

| Method | Path | Description | Auth |
|---|---|---|---|
| `POST` | `/webhooks/clerk` | Clerk user lifecycle events (`user.created`, `user.updated`, `user.deleted`) — Svix verified | Public |

### Auth

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/auth/me` | Current user profile with role and permissions | Required |
| `GET` | `/auth/org` | Current user's organisation details | Required |

### Users

| Method | Path | Description | Auth |
|---|---|---|---|
| `POST` | `/user/invite` | Send a Clerk invitation | Required + `org_executive` |
| `GET` | `/user/invitations` | List all invitations | Required + `admin` |
| `DELETE` | `/user/invite/:invitationId` | Revoke a pending invitation | Required + `admin` |
| `GET` | `/user/all` | List all users | Required |
| `GET` | `/user/:userId` | Get user by ID | Required |
| `GET` | `/user/:userId/activity` | User activity log | Required |
| `GET` | `/user/:userId/files` | Files uploaded by user | Required |
| `GET` | `/user/:userId/comments` | Comments made by user | Required |
| `GET` | `/user/:userId/permissions` | Permissions for user's role | Required |
| `PUT` | `/user/:userId` | Update a user | Required |
| `DELETE` | `/user/:userId` | Delete a user | Required |

### Organisations

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/org/all` | List all organisations | Required |
| `GET` | `/org/:orgId` | Get organisation by ID | Required |
| `GET` | `/org/:orgId/users` | Users in an organisation | Required |
| `GET` | `/org/:orgId/files` | Files in an organisation | Required |
| `POST` | `/org/` | Create an organisation (auto-creates storage bucket) | Required |
| `PUT` | `/org/:orgId` | Update an organisation | Required |
| `DELETE` | `/org/:orgId` | Delete an organisation (cleans up storage bucket) | Required |

### Documents

File uploads use `multipart/form-data` with a 50 MB size limit.

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/docs/all` | List all document metadata | Required |
| `GET` | `/docs/category/:ctgId` | Documents by category | Required |
| `GET` | `/docs/:id` | Download/stream a document | Required |
| `POST` | `/docs/` | Upload a document | Required |
| `PUT` | `/docs/:id` | Update document metadata | Required |
| `DELETE` | `/docs/:id` | Delete document and its embeddings | Required |
| `GET` | `/docs/:id/comments` | List comments on a document | Required |
| `POST` | `/docs/:id/comments` | Add a comment | Required |
| `DELETE` | `/docs/:id/comments/:commentId` | Delete a comment | Required |
| `GET` | `/docs/:id/activity` | Activity log for a document | Required |

### Chat / AI

| Method | Path | Description | Auth |
|---|---|---|---|
| `POST` | `/chat/` | Send a message, get a JSON response | Required |
| `POST` | `/chat/stream` | Send a message, get an SSE stream | Required |
| `POST` | `/chat/ingest` | Trigger document ingestion pipeline | Required |

### VTO (Vision/Traction Organizer)

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/vto/:orgId` | Get organisation's VTO | Required |
| `POST` | `/vto/:orgId` | Create a VTO | Required + `org_executive` |
| `PUT` | `/vto/:orgId` | Update a VTO | Required + `org_executive` |
| `DELETE` | `/vto/:orgId` | Delete a VTO | Required + `org_executive` |

### KPI Summary

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/summary/financial/:orgId` | Financial KPIs (from QuickBooks) | Required |
| `GET` | `/summary/leads/:orgId` | Leads KPIs (from HubSpot) | Required |
| `GET` | `/summary/labor/:orgId` | Labor KPIs (from Monday.com/ClickUp) | Required |
| `GET` | `/summary/summary/:orgId` | Master dashboard — all KPIs in parallel | Required |
| `GET` | `/summary/scorecard` | Cross-org scorecard (all organisations) | Required + `admin` |

### Integrations — HubSpot

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/integrations/hubspot/install` | Start OAuth flow | Required |
| `GET` | `/integrations/hubspot/oauth-callback` | OAuth callback handler | Public |
| `GET` | `/integrations/hubspot/status` | Check connection status | Required |
| `GET` | `/integrations/hubspot/contacts` | List contacts (limit 50) | Required |
| `GET` | `/integrations/hubspot/companies` | List companies (limit 50) | Required |
| `GET` | `/integrations/hubspot/carts` | List carts (limit 50) | Required |

### Integrations — QuickBooks

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/integrations/quickbooks/install` | Start OAuth flow | Required |
| `GET` | `/integrations/quickbooks/oauth-callback` | OAuth callback handler | Public |
| `GET` | `/integrations/quickbooks/status` | Check connection status | Required |
| `GET` | `/integrations/quickbooks/company-info` | Get company info | Required |
| `GET` | `/integrations/quickbooks/accounts` | List accounts | Required |
| `GET` | `/integrations/quickbooks/accounts/:accountId` | Get account by ID | Required |
| `GET` | `/integrations/quickbooks/bills` | List bills | Required |
| `GET` | `/integrations/quickbooks/bills/:billId` | Get bill by ID | Required |
| `GET` | `/integrations/quickbooks/invoices` | List invoices | Required |
| `GET` | `/integrations/quickbooks/invoices/:invoiceId` | Get invoice by ID | Required |
| `GET` | `/integrations/quickbooks/invoices/:invoiceId/pdf` | Download invoice as PDF | Required |
| `GET` | `/integrations/quickbooks/customers` | List customers | Required |
| `GET` | `/integrations/quickbooks/customers/:customerId` | Get customer by ID | Required |
| `GET` | `/integrations/quickbooks/tax-agency` | List tax agencies | Required |
| `GET` | `/integrations/quickbooks/tax-agency/:taxId` | Get tax agency by ID | Required |

### Integrations — Monday.com

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/integrations/monday/install` | Start OAuth flow | Required |
| `GET` | `/integrations/monday/oauth-callback` | OAuth callback handler | Public |
| `GET` | `/integrations/monday/status` | Check connection status + labor config | Required |

### Integrations — ClickUp

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/integrations/clickup/install` | Start OAuth flow | Required |
| `GET` | `/integrations/clickup/oauth-callback` | OAuth callback handler | Public |
| `GET` | `/integrations/clickup/status` | Check connection status + labor config | Required |

### Integrations — Labor Config

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/integrations/labor-config/status` | Current labor KPI configuration | Required |
| `GET` | `/integrations/labor-config/monday/boards` | List available Monday.com boards | Required |
| `GET` | `/integrations/labor-config/clickup/workspaces` | List available ClickUp workspaces | Required |
| `PUT` | `/integrations/labor-config` | Update labor KPI source configuration | Required |

---

## Entity Relationships

### Core Data Model

```
                       +-----------------------------+
                       |     MAURAL SOLUTIONS LLC     |
                       |  (Platform Operator)         |
                       +-------------+---------------+
                                     | operates
                       +-------------v---------------+
                       |      KMS PLATFORM            |
                       |  (Multi-Tenant Application)  |
                       +-------------+---------------+
                                     |
          +--------------------------+---------------------------+
          |                          |                           |
+---------v---------+    +-----------v----------+   +-----------v-----------+
|   Organisation A   |    |   Organisation B      |   |   Organisation C      |
|   (Tenant)         |    |   (Tenant)            |   |   (Tenant)            |
+---------+---------+    +-----------+----------+   +-----------+-----------+
          |                          |                           |
          +--------------------------+---------------------------+
                                     |
          Each Organisation (Tenant) contains:
          Users, Files, Embeddings, KPIs (Financial/Leads/Labor), VTO, OAuth Tokens
```

### Key Relationships

| Entity | Relates To | Type | Meaning |
|---|---|---|---|
| Organisation | User | One-to-Many | An org has multiple employees |
| Organisation | File | One-to-Many | An org owns multiple documents |
| Organisation | FinanceKpi / LeadsKpi / LaborKpi | One-to-Many | KPI snapshots across time periods |
| Organisation | document_embeddings | One-to-Many | Tenant-isolated AI search (CASCADE delete) |
| Organisation | VTO | One-to-One | One strategic plan per org |
| Organisation | OAuth Tokens | One-to-One per service | Saved credentials per integration |
| User | Organisation | Many-to-One (optional) | Belongs to one org (null for Maural staff) |
| User | Role | Many-to-One | Assigned one role |
| User | File | One-to-Many | Can upload multiple documents |
| Role | Permission | Many-to-Many (via RolePermission) | Granular permission assignments |
| File | Category | Many-to-One | Classified under one category |
| File | document_embeddings | One-to-Many (implicit) | Content split into embedded chunks |

### Tenant Isolation

The `org_id` foreign key is the most important relationship in the data model. It appears on Users, Files, KPIs, and document_embeddings. Every API query filters by `org_id` to ensure organisation-level data isolation. This is enforced at multiple layers:

- **Application**: API controllers and middleware filter by `org_id`
- **Database**: Foreign keys with `ON DELETE CASCADE`, B-tree indexes on `org_id`
- **Storage**: Each organisation has its own Supabase Storage bucket
- **AI Search**: The `match_documents` RPC uses `WHERE org_id = ANY(filter_org_ids)`

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile to JavaScript |
| `npm start` | Start production server |
| `npm test` | Run test suite |
| `npm run lint` | Lint source files |
| `npx prisma migrate dev` | Run database migrations |
| `npx prisma studio` | Open Prisma Studio |
| `node scripts/ingest-local.js` | Ingest documents locally from `uploads/` |

---

## Notes

- `DISABLE_AUTH=true` is for local development only — never enable in production
- QuickBooks defaults to `sandbox` environment — update `QUICKBOOKS_ENVIRONMENT` and `QUICKBOOKS_BASE_URL` when deploying
- AI inference uses OpenAI API (`gpt-4o-mini` for chat, `text-embedding-3-small` for embeddings) — `OPENAI_API_KEY` is required in production
- The `document_embeddings` table must use `vector(1536)` to match `text-embedding-3-small` output — do not use 768 dimensions
- `pdf-parse@1` is required specifically — version 2.x has a breaking API change
- BigInt fields (IDs) are serialized as strings in all API responses
- Users are created exclusively through Clerk invitations — no public sign-up endpoint
- Each organisation gets a dedicated Supabase storage bucket (auto-created on org creation)
- ClickUp tokens are long-lived and do not include a refresh token or expiry
- The scorecard endpoint uses a DB-first strategy with 6-hour cache TTL for KPI data
- Error responses follow a consistent `{ "message": "..." }` format; production 500 errors return generic messages

### Detailed Reference Documentation

For more detail, see:
- [AI_CHATBOT_README.md](AI_CHATBOT_README.md) — Full AI chatbot technical documentation
- [API_REFERENCE.md](API_REFERENCE.md) — Complete API reference with request/response examples
- [OPERATIONS_GUIDE.md](OPERATIONS_GUIDE.md) — Role architecture, bootstrap, management API reference, and technical troubleshooting
- [USER_GUIDE.md](USER_GUIDE.md) — Step-by-step application UI navigation guide
