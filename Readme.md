# Maural KMS — Backend API

> Short description of what this API does. <!-- TODO:  -->

---

## Table of contents

- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Folder structure](#folder-structure)
- [Environment variables](#environment-variables)
- [Database](#database)
- [API endpoints](#api-endpoints)
- [Scripts](#scripts)
- [Notes](#notes)

---

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express |
| Language | <!-- TODO: JavaScript or TypeScript? --> |
| Database | PostgreSQL via Supabase |
| Auth | Clerk |
| Integrations | HubSpot, QuickBooks, Monday.com, ClickUp |

---

## Quick start

> Prerequisites: Node.js `<!-- TODO: version -->`, PostgreSQL `<!-- TODO: version -->`

```bash
# 1. Clone the repository
git clone <repo-url>
cd backend

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Fill in the required values — see Environment Variables section

# 4. Start the development server
npm run dev
```

Server runs at `http://localhost:5000/api/v1`

---

## Folder structure

```
<!-- TODO: paste your folder tree here -->
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
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `DIRECT_URL` | Direct connection URL for migrations | Yes |

### Clerk (Auth)

| Variable | Description | Required |
|---|---|---|
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Yes |
| `CLERK_SECRET_KEY` | Clerk secret key | Yes |
| `CLERK_WEBHOOK_SECRET` | Webhook secret — only needed when testing login/signup flows | No |

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
<!-- TODO: add migration command -->

# Seed database (if applicable)
<!-- TODO: add seed command -->
```

> Schema overview or link to schema file: <!-- TODO: e.g. see `prisma/schema.prisma` -->

---

## API endpoints

Base URL: `http://localhost:5000/api/v1`

### Auth

| Method | Path | Description | Auth required |
|---|---|---|---|
| <!-- TODO --> | | | |

### Users

| Method | Path | Description | Auth required |
|---|---|---|---|
| <!-- TODO --> | | | |

### Integrations

| Method | Path | Description | Auth required |
|---|---|---|---|
| `GET` | `/integrations/hubspot/oauth-callback` | HubSpot OAuth callback | No |
| `GET` | `/integrations/quickbooks/oauth-callback` | QuickBooks OAuth callback | No |
| `GET` | `/integrations/monday/oauth-callback` | Monday.com OAuth callback | No |
| `GET` | `/integrations/clickup/oauth-callback` | ClickUp OAuth callback | No |

<!-- TODO: add more resource sections as needed -->

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile to JavaScript |
| `npm start` | Start production server |
| `npm test` | Run test suite |
| `npm run lint` | Lint source files |
<!-- TODO: add any additional scripts -->

---

## Notes

- `DISABLE_AUTH=true` is for local development only — never enable in production
- QuickBooks defaults to `sandbox` environment — update `QUICKBOOKS_ENVIRONMENT` and `QUICKBOOKS_BASE_URL` when deploying
- `CLERK_WEBHOOK_SECRET` is only required when testing login/signup webhook logic
<!-- TODO: add any other gotchas or environment-specific notes -->
