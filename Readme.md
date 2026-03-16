# Maural KMS — Backend API

REST API for the Maural Knowledge Management System. Handles document management, AI-powered chat (RAG pipeline), user and client management, and OAuth integrations with HubSpot, QuickBooks, Monday.com, and ClickUp.

---

## Table of contents

- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Folder structure](#folder-structure)
- [Environment variables](#environment-variables)
- [Database](#database)
- [AI chatbot setup](#ai-chatbot-setup)
- [API endpoints](#api-endpoints)
- [Scripts](#scripts)
- [Notes](#notes)

---

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express 5 |
| Database | PostgreSQL via Supabase |
| ORM | Prisma |
| Auth | Clerk (JWT) |
| LLM | Ollama — `qwen3.5:9b` (local) |
| Embeddings | Ollama — `nomic-embed-text` (local) |
| Vector search | Supabase pgvector |
| Integrations | HubSpot, QuickBooks, Monday.com, ClickUp |

---

## Quick start

> **Prerequisites:** Node.js, PostgreSQL via Supabase, [Ollama](https://ollama.com) installed and running

```bash
# 1. Clone the repository
git clone <repo-url>
cd backend

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Fill in all required values — see Environment Variables section

# 4. Run database migrations
npx prisma migrate dev

# 5. Start the development server
npm run dev
```

Server runs at `http://localhost:5000/api/v1`

---

## Folder structure

```
backend/
├── controllers/
│   ├── chat.controller.js        — Streaming + JSON chat endpoints
│   ├── ingest.controller.js      — Document ingestion pipeline
│   ├── user.controller.js        — User CRUD
│   ├── client.controller.js      — Client CRUD
│   └── docs.controller.js        — Document upload, download, comments
├── middleware/
│   ├── auth.middleware.js         — Clerk JWT validation
│   └── role.middleware.js         — RBAC role enforcement
├── routes/
│   ├── chatRoutes.js
│   ├── userRoutes.js
│   ├── clientRoutes.js
│   ├── docsRoutes.js
│   └── integrations/
│       ├── hubspotRoutes.js
│       ├── quickbooksRoutes.js
│       ├── mondayRoutes.js
│       └── clickupRoutes.js
├── services/
│   ├── ragService.js             — Document retrieval + prompt construction
│   ├── intentRouter.js           — Multi-intent detection
│   ├── promptTemplates.js        — Per-intent system prompts
│   └── guardrail.js              — Answer accuracy verification
├── lib/
│   └── prisma.js                 — Prisma singleton
├── scripts/
│   └── ingest-local.js           — Local ingestion script (reads from uploads/)
├── uploads/                      — Temp Multer directory (gitignored)
├── .env.example
└── package.json
```

---

## Environment variables

Copy `.env.example` to `.env`. Never commit your `.env` file.

### General

| Variable | Description | Required |
|---|---|---|
| `NODE_ENV` | `development` or `production` | Yes |
| `HOST` | Server host | Yes |
| `PORT` | Server port — default `5000` | Yes |
| `apiVersion` | API version prefix — default `v1` | Yes |
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
| `CLERK_WEBHOOK_SECRET` | Webhook secret — only needed when testing login/signup flows | No |

### Ollama (AI — local)

| Variable | Description | Required |
|---|---|---|
| `OLLAMA_BASE_URL` | Ollama server URL — default `http://localhost:11434` | Yes |
| `OLLAMA_CHAT_MODEL` | Chat model — default `qwen3.5:9b` | Yes |
| `OLLAMA_EMBED_MODEL` | Embeddings model — default `nomic-embed-text` | Yes |

### HubSpot integration

| Variable | Description | Required |
|---|---|---|
| `HUBSPOT_APP_ID` | HubSpot app ID | Yes |
| `HUBSPOT_CLIENT_ID` | OAuth client ID | Yes |
| `HUBSPOT_CLIENT_SECRET` | OAuth client secret | Yes |
| `HUBSPOT_REDIRECT_URI` | OAuth callback — default `http://localhost:5000/api/integrations/hubspot/oauth-callback` | Yes |

### QuickBooks integration

| Variable | Description | Required |
|---|---|---|
| `QUICKBOOKS_APP_ID` | QuickBooks app ID | Yes |
| `QUICKBOOKS_CLIENT_ID` | OAuth client ID | Yes |
| `QUICKBOOKS_CLIENT_SECRET` | OAuth client secret | Yes |
| `QUICKBOOKS_REDIRECT_URI` | OAuth callback — default `http://localhost:5000/api/integrations/quickbooks/oauth-callback` | Yes |
| `QUICKBOOKS_ENVIRONMENT` | `sandbox` or `production` | Yes |
| `QUICKBOOKS_BASE_URL` | API base URL — default `https://sandbox-quickbooks.api.intuit.com` | Yes |

### Monday.com integration

| Variable | Description | Required |
|---|---|---|
| `MONDAY_CLIENT_ID` | OAuth client ID | Yes |
| `MONDAY_CLIENT_SECRET` | OAuth client secret | Yes |
| `MONDAY_REDIRECT_URI` | OAuth callback — default `http://localhost:5000/api/integrations/monday/oauth-callback` | Yes |
| `MONDAY_SIGNING_SECRET` | Webhook signing secret for verifying Monday.com events | No |

### ClickUp integration

| Variable | Description | Required |
|---|---|---|
| `CLICKUP_CLIENT_ID` | OAuth client ID | Yes |
| `CLICKUP_CLIENT_SECRET` | OAuth client secret | Yes |
| `CLICKUP_REDIRECT_URI` | OAuth callback — default `http://localhost:5000/api/integrations/clickup/oauth-callback` | Yes |
| `CLICKUP_WEBHOOK_SECRET` | Webhook secret for verifying ClickUp events | No |

---

## Database

```bash
# Run migrations
npx prisma migrate dev

# Open Prisma Studio (optional)
npx prisma studio
```

The pgvector extension and `document_embeddings` table must be created manually in Supabase before running the AI chatbot. See [AI chatbot setup](#ai-chatbot-setup) below.

---

## AI chatbot setup

All AI inference runs **100% locally** via Ollama — no data is sent to any third-party AI service.

### 1. Install and start Ollama

Download from [https://ollama.com](https://ollama.com), then pull the required models:

```bash
ollama pull qwen3.5:9b
ollama pull nomic-embed-text
```

Verify Ollama is running:

```bash
curl http://localhost:11434/api/tags
```

### 2. Set up pgvector in Supabase

Run the following in your Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS document_embeddings (
  id        bigserial PRIMARY KEY,
  content   text,
  metadata  jsonb,
  embedding vector(768)
);

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),
  match_count     int DEFAULT 15,
  filter          jsonb DEFAULT '{}'
)
RETURNS TABLE (
  id         bigint,
  content    text,
  metadata   jsonb,
  similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_embeddings.id,
    document_embeddings.content,
    document_embeddings.metadata,
    1 - (document_embeddings.embedding <=> query_embedding) AS similarity
  FROM document_embeddings
  ORDER BY document_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

GRANT ALL ON TABLE document_embeddings TO service_role;
GRANT ALL ON SEQUENCE document_embeddings_id_seq TO service_role;
ALTER TABLE document_embeddings DISABLE ROW LEVEL SECURITY;
```

### 3. Ingest documents

After uploading documents via the API, trigger ingestion:

```bash
# Via API
POST /api/chat/ingest

# Or locally (place files in uploads/ first)
node scripts/ingest-local.js
```

**Supported file types:** `.pdf`, `.xlsx`, `.xls`, `.docx`, `.txt`, `.md`, `.csv`, `.json`

**Chunking:** 1000 characters per chunk, 150-character overlap

---

## API endpoints

Base URL: `http://localhost:5000/api/v1`

All endpoints require a Clerk JWT Bearer token unless marked **Public**.

### Rate limits

| Scope | Window | Max requests |
|---|---|---|
| Global (`/api/*`) | 15 min | 100 |
| Chat (`/api/chat/*`) | 15 min | 20 |

### Health

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/health` | Server health, uptime, memory | Public |

### Webhooks

| Method | Path | Description | Auth |
|---|---|---|---|
| `POST` | `/webhooks/clerk` | Clerk user lifecycle events (Svix verified) | Public |

### Auth

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/auth/me` | Get current user profile with role and permissions | Required |

### Users

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/user/all` | List all users | Required |
| `GET` | `/user/:userId` | Get user by ID | Required |
| `GET` | `/user/:userId/activity` | Get user activity log | Required |
| `GET` | `/user/:userId/files` | Get files uploaded by user | Required |
| `GET` | `/user/:userId/comments` | Get comments made by user | Required |
| `GET` | `/user/:userId/permissions` | Get permissions for user's role | Required |
| `POST` | `/user/` | Create a new user | Required |
| `PUT` | `/user/:userId` | Update a user | Required |
| `DELETE` | `/user/:userId` | Delete a user | Required |

### Clients

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/client/all` | List all clients | Required |
| `GET` | `/client/:clientId` | Get client by ID | Required |
| `GET` | `/client/:clientId/users` | Get all users for a client | Required |
| `GET` | `/client/:clientId/files` | Get all files for a client | Required |
| `POST` | `/client/` | Create a new client | Required |
| `PUT` | `/client/:clientId` | Update a client | Required |
| `DELETE` | `/client/:clientId` | Delete a client | Required |

### Documents

File uploads use `multipart/form-data` with a 50 MB size limit.

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/docs/all` | List all document metadata | Required |
| `GET` | `/docs/category/:ctgId` | List documents by category | Required |
| `GET` | `/docs/:id` | Download/stream a document file | Required |
| `POST` | `/docs/` | Upload a new document | Required |
| `PUT` | `/docs/:id` | Update document metadata | Required |
| `DELETE` | `/docs/:id` | Delete document and its embeddings | Required |
| `GET` | `/docs/:id/comments` | List comments on a document | Required |
| `POST` | `/docs/:id/comments` | Add a comment to a document | Required |
| `DELETE` | `/docs/:id/comments/:commentId` | Delete a comment | Required |
| `GET` | `/docs/:id/activity` | Get activity log for a document | Required |

### Chat / AI

| Method | Path | Description | Auth |
|---|---|---|---|
| `POST` | `/chat/` | Send a message, get a JSON response | Required |
| `POST` | `/chat/stream` | Send a message, get an SSE stream | Required |
| `POST` | `/chat/ingest` | Trigger document ingestion pipeline | Required |

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
| `GET` | `/integrations/monday/status` | Check connection status | Required |

### Integrations — ClickUp

> **Note:** Partially implemented — token storage is pending.

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/integrations/clickup/install` | Start OAuth flow | Required |
| `GET` | `/integrations/clickup/oauth-callback` | OAuth callback handler | Public |
| `GET` | `/integrations/clickup/status` | Check connection status | Required |

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
- `CLERK_WEBHOOK_SECRET` is only required when testing login/signup webhook logic
- The ClickUp integration is partially implemented — token storage is currently commented out in the codebase
- All AI inference runs locally via Ollama — no document content or user queries are sent to any external AI service
- `pdf-parse@1` is required specifically — version 2.x has a breaking API change incompatible with the current integration
- BigInt fields (IDs) are serialized as strings in all API responses
