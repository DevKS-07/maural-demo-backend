# Maural KMS → Public Demo: Runbook

**Purpose of this file:** a resumable plan. Tick items as they're completed. If you are an AI
agent picking this up in a new session, read "Context" and "Decisions" first — they contain
findings that took a full codebase review to establish and are not obvious from the code.

**Status:** Phase 0 not started. Nothing has been changed yet.

---

## Context

Two repos, a team senior-project:

| Repo | Path | Original remote (frozen — never pushed to again) |
| --- | --- | --- |
| API | `maural-kms-api` | `github.com/DevKS-07/maural-kms-api.git` (branch `dev`) |
| Web | `../maural-kms` | `github.com/DevKS-07/maural-kms-frontend.git` (branch `proper`) |

**The system.** Multi-tenant B2B knowledge management platform. Node 22 / Express 5, Prisma →
Postgres on Supabase, Clerk auth, OpenAI RAG over pgvector, OAuth integrations with HubSpot,
QuickBooks, Monday.com, ClickUp. Frontend is React 19 + Vite + shadcn/Tailwind.

**The goal.** Deploy a public, no-login demo for a portfolio, on new repos owned solely by the
user. Not a production hardening exercise — the project is not being actively developed further.

---

## Decisions already made

1. **Fresh Supabase project** for the demo. Real client data must not be reachable.
2. **Pre-seeded KPI data, no live integrations.** The QuickBooks sandbox was considered and
   dropped — it only behaves well with a real tenant.
3. **Mock OAuth flow, frontend-only.** Keep the feel of connecting (consent screen → connected
   state) with no credentials and no backend calls. Per-visitor local state so nobody can leave
   it disconnected for the next person.
4. **Shared demo password**, not fully open — the chat endpoint costs real money per message.
5. **Four-role persona switcher** instead of login. Turns removed auth into a demo feature.
6. **WebViewer:** keep it if the license key still works. If it doesn't, drop it from the
   frontend and fall back to a plain browser PDF view — with a visible note that this is a demo
   and some features differ from production. A simple viewer that works reads better in a
   portfolio than a broken premium one.
7. **`main` = the real project, `demo` = demo modifications.** Deploy from `demo`.
8. **The team repos are left completely untouched** — frozen as the snapshot of where the team
   finished, with all collaborators keeping access. Local clones are disconnected from them and
   pushed to new blank repos instead. History is filtered *locally* before that first push so
   the client documents don't get republished; the old remotes never see a rewrite.

---

## Findings that drive the plan

These were expensive to establish. Don't re-derive them.

- **`DISABLE_AUTH` already exists** (`config/env.js:40`) and flips `requireAuth`, `requireRole`
  and `requireOrgAccess` to pass-through. But it is gated `!isProduction && ...`, so
  `NODE_ENV=production` silently re-enables auth. Use `NODE_ENV=demo`.
- **It does not cover everything.** Twelve call sites resolve identity by calling `req.auth()`
  directly, bypassing the middleware: `auth.controller.js:168,205`, `clickup.controller.js:26`,
  `docs.controller.js:169`, `hubspot.controller.js:30`, `invitation.controller.js:43,164,205`,
  `laborConfig.controller.js:14`, `monday.controller.js:27`, `quickbooks.controller.js:31`.
  With `clerkMiddleware()` mounted they get `{userId: null}` and fail *quietly* — 401/403/404
  rather than an error. **Stubbing `req.auth` fixes all twelve at once**; editing controllers
  one by one is the wrong approach.
- **Two independent role systems.** Backend `requireRole` reads
  `sessionClaims.publicMetadata.role` (`org_executive`); frontend page guards read
  `user.Role.role_name` (`"Org Executive"`). `IntegrationsPage.tsx:5` gates on the latter, so a
  seeded user needs both aligned or the Integrations page bounces to `/unauthorized`.
- **`getToken()` is the demo-password seam.** Both API paths — the axios interceptor at
  `../maural-kms/src/context/AuthContext.tsx:64-69` and the chatbot's raw SSE fetch at
  `../maural-kms/src/components/floating-chatbot.tsx:1322` — take their credential from
  `getToken()`. Return the demo key there and every request carries
  `Authorization: Bearer <key>` with **zero API call-site changes**.
- **Clerk is only in 7 files:** `main.tsx`, `context/AuthContext.tsx`,
  `layouts/Authenticatedlayout.tsx`, `components/floating-chatbot.tsx`,
  `components/nav-user.tsx`, `pages/LoginPage.tsx`, `pages/ProfilePage.tsx`. Everything else
  goes through the app's own `AuthContext`.
- **`/api/summary/summary/:orgId` ignores seeded data.** `getFullDashboardSummary` always calls
  the live services; with no integration tokens all three throw and the dashboard renders three
  error cards. `useSummary.ts:24` is what the dashboard calls. Needs a DB fallback.
  `/api/summary/scorecard` *is* DB-first but flattens to ten summary numbers, so swapping the
  frontend to it would lose most of the dashboard.
- **No migrations directory.** `npx prisma migrate dev` (what the README says) will not work.
  Use `npx prisma db push`. `prisma.config.js` resolves its datasource from **`DIRECT_URL`**,
  not `DATABASE_URL`.
- **SQL injection at `services/ragService.js:214-215`.** `orgIds` from `req.body` is
  interpolated raw into SQL on the `DIRECT_URL` pool. The only thing sanitizing it today is
  `requireOrgAccess("body")` overwriting it — which `DISABLE_AUTH` turns off. Goes from
  admin-reachable to anonymous-reachable.
- **Dead endpoints.** `prisma.comment` and `prisma.activity_Log` don't exist in the active
  schema (they're in `prisma/oldSchema`). Six routes always 500. Not worth fixing for the demo,
  but don't be confused by them.
- **`scripts/` is excluded by `.dockerignore`**, so `ingest-local.js` doesn't exist in the
  container. Seed locally.
- **`X-Demo-Role` must be added to CORS `allowedHeaders`.** `app.js:43` lists only
  `["Content-Type", "Authorization"]`. A custom header triggers a preflight that the server
  will reject unless the header is listed. Symptom is a generic CORS failure that looks like
  the API is down, not like a header problem.
- **Local env files are named `.env.<NODE_ENV>.local`.** `server.js:1-3` loads
  ``.env.${NODE_ENV}.local``, so running locally with `NODE_ENV=demo` looks for
  `.env.demo.local` — which doesn't exist. `config/env.js` then hard-exits on missing required
  vars. Create `.env.demo.local` before any local verification step.
- **Local port mismatch.** `config/env.js:30` defaults `PORT` to 3000, but the frontend's
  `.env` points at `http://localhost:5000/api`. Set `PORT=5000` locally or the frontend can't
  reach the API.
- **Two places send request headers**, mirroring the `getToken` finding: the axios interceptor
  in `AuthContext.tsx` and the chatbot's raw `fetch` in `floating-chatbot.tsx`. Anything added
  to requests — the demo key, `X-Demo-Role` — has to go in both or chat silently behaves as a
  different persona than the rest of the app.
- **The demo password needs no frontend env var.** The visitor types it, it goes to
  `localStorage`, `getToken()` returns it, the backend validates it. Don't add a `VITE_` var
  for it — adding any new `VITE_` variable means editing three files in lockstep
  (`src/env.ts`, `public/config.js`, and the envsubst list in `entrypoint.sh`), and missing one
  yields an unsubstituted `${...}` string at runtime.

---

## Phase 0 — Clear the blockers

Two things will stop a clean deploy dead.

- [ ] **[BLOCKER] Commit the frontend lockfile.** `../maural-kms/.gitignore` ignores
      `package-lock.json`, but its Dockerfile runs `npm ci`, which fails without one. It only
      builds today because the file exists locally.
      ```bash
      # in ../maural-kms — delete the 'package-lock.json' line from .gitignore, then:
      git add -f package-lock.json
      git commit -m "chore: track lockfile so npm ci works in Docker"
      ```
- [ ] **[BLOCKER] Test the WebViewer license.** The key in `../maural-kms/.env` is
      `demo:1760471071849:...` — stamped October 2025. Run the app, open a document, watch the
      console. Apryse demo keys are short-lived.
- [x] **Viewer policy decided.** If the key works → keep WebViewer unchanged. If it doesn't →
      remove the WebViewer dependency, render documents in a plain PDF view, and add a demo
      note that some features differ from production. Record which branch you're on here after
      the test above. → *Test outcome:* `________`

---

## Phase 1 — New repos, clean history

**The old remotes are never touched.** They stay exactly as they are — a frozen snapshot of
where the team ended, with all collaborators keeping their access. The work below happens in
local clones and pushes only to new, blank repos. `git filter-repo` rewrites local objects and
never contacts a remote, so nothing here can reach the team repos.

**Why filter at all, when we're not rewriting the team repo:** `git push` sends every reachable
object. The eight files under `uploads/` live in history blobs, so pushing the existing history
to a blank remote republishes them — recoverable via `git log --all` even though they're not in
the working tree. On a repo destined to be public, that's the thing to avoid.

**The team repo is the backup.** It holds full original history, untouched, so a separate mirror
is optional insurance rather than a requirement.

- [ ] **Archive the old repos on GitHub** (Settings → Archive repository). Read-only for
      everyone including you; collaborators keep access; visibly labelled as frozen. Enforces
      "team snapshot" better than just not pushing. *Optional but recommended.*
- [ ] **[BLOCKER] Confirm what's in the API history.** Eight files were committed under
      `uploads/` — three more than are on disk: `Analysis.pdf`, `CR Decision map - Process.pptx.pdf`,
      `JGA-A-Strategic-Plan-for-Growth-and-Operational-Excellence.pdf`, `Project Status Report.docx`,
      `Project data.xlsx`, `Relational AI.docx`, `Who- A method for Hiring.pdf`, `sample3.docx`.
      Client and third-party material — must not reach a public repo.
      ```bash
      git log --all --diff-filter=A --name-only --format="" -- "uploads/*" | sort -u
      ```
- [ ] **Scan both histories for secrets.** Only `.env.example` was ever committed in either
      repo, so this should come back clean — verify before going public.
      ```bash
      git log -p --all | grep -nE "sk-[A-Za-z0-9_-]{20,}|service_role|eyJhbGciOiJIUzI1NiI" | head
      ```
- [x] **History strategy decided: filter and keep.** Development history carries portfolio
      value, and the team repo retains the unfiltered original. The client documents are
      stripped locally before the first push and never reach a public repo.
- [ ] **Install git-filter-repo:** `pip install git-filter-repo`
- [ ] **Disconnect from the team remote.** Do this first, so no later command can push there.
      ```bash
      git remote remove origin
      git remote -v          # expect empty
      ```
- [ ] **Promote the working branch to `main`.** API development is on `dev` (tip `65f5d7b`);
      the frontend is on `proper`. Those are the real tips — make each the new `main` and drop
      the rest so filter-repo doesn't carry a dozen stale branches.
      ```bash
      # API, from dev:
      git checkout dev
      git branch -f main dev && git checkout main
      git branch | grep -v "^\*" | xargs -r git branch -D
      ```
- [ ] **Strip `uploads/` from history.** `--force` is required because this is an existing
      working copy rather than a fresh clone. If that makes you nervous, clone to a scratch
      directory from the team repo and do it there instead.
      ```bash
      git filter-repo --path uploads --invert-paths --force
      ```
- [ ] **Verify the strip.** The confirm command above should now print nothing. If it prints
      filenames, stop — do not push.
- [ ] **Create the new blank private repos.** Start private; flip to public in Phase 7.
      ```bash
      gh repo create maural-kms-api --private
      gh repo create maural-kms-web --private
      ```
- [ ] **Point at the new remotes and push.**
      ```bash
      git remote add origin https://github.com/DevKS-07/maural-kms-api.git
      git push -u origin main
      ```
- [ ] **Cut a `demo` branch in each repo.** `main` stays the real project; every demo change
      lands on `demo`. Deployment tracks `demo`.
      ```bash
      git checkout -b demo && git push -u origin demo
      ```
- [ ] **Confirm the wiring.** `git remote -v` shows only the new repo in both working copies,
      and Settings → Collaborators on both new repos lists only you.
- [ ] **Salvage the architecture diagrams.** `docs-assets/presentation/` has `architecture.svg`,
      `oauth-flow.svg`, `rbac-hierarchy.svg`, `kpi-flow.svg` and more, but the whole folder is
      gitignored. Copy the good ones into a tracked `docs/` for the Phase 7 README.

---

## Phase 2 — Demo Supabase project

- [ ] **Create the project**, collect `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`,
      `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] **[BLOCKER] Point both database URLs at the new project.** `prisma.config.js` resolves
      from `DIRECT_URL`. Miss that and you push the schema into the old database.
- [ ] **Push the schema:** `npx prisma db push` (not `migrate dev` — no migrations exist).
- [ ] **Run the pgvector SQL with two edits:** skip `match_documents` (ragService dropped the
      RPC for raw SQL on its own pool) and create **no IVFFlat index** — on a demo-sized corpus
      a sequential scan is exact and fast, and it sidesteps the recall problem that
      `SET ivfflat.probes = 100` exists to work around.
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

      GRANT ALL ON TABLE document_embeddings TO service_role;
      GRANT ALL ON SEQUENCE document_embeddings_id_seq TO service_role;
      ALTER TABLE document_embeddings DISABLE ROW LEVEL SECURITY;
      ```
- [ ] **Verify** the `vector` extension is installed and `document_embeddings` exists with a
      1536-dimension column before spending money on embeddings.

---

## Phase 3 — Seed the demo tenant

Seeded data is now the only source of KPI truth. This is what a reviewer actually reads.

> **Ordering dependency.** The document-upload step below calls `POST /api/docs`, and
> `createDocument` (`docs.controller.js:169`) runs its own inline org check. With Clerk mounted
> but no session it resolves no user and returns 403, so uploads fail before anything is
> ingested. **Do the first item of Phase 4 (the `req.auth` stub) before this phase's upload
> step.** Everything else in Phase 3 is independent and can be done first.

- [ ] **Write a one-page brief for the fictional company** — name, industry, size, revenue
      shape, the problems it has. Everything downstream should agree with it; inconsistencies
      are what a sharp reviewer notices.
- [ ] **Seed the platform org and the demo org.** `prisma/seed.js` already creates the platform
      org and its storage bucket — extend it rather than writing a second script.
- [ ] **[BLOCKER] Seed four persona users**, one per role, with stable clerk ids:
      `demo_super_admin`, `demo_admin`, `demo_org_executive`, `demo_org_staff`. The Phase 5
      switcher resolves to these, so the ids must match what the backend stub expects.
- [ ] **Align both role systems per user** — `publicMetadata.role` key *and* DB `Role.role_name`
      label. See Findings.
- [ ] **Author five or six demo documents** — strategy deck, financial summary, meeting notes,
      hiring plan, quarterly review. This is the chat's entire knowledge base.
- [ ] **Upload through `POST /api/docs`**, not by hand — it auto-ingests via `ingestSingleFile`,
      doing File row + storage + extract + chunk + embed in one step.
- [ ] **Seed the KPI tables completely** — full rows in `finance_kpis`, `leads_kpis`,
      `labor_kpis` for the current period. Seed *every* field, not just the five the live
      persist path writes.
- [ ] **Seed the VTO** — `businessDataService` injects it into the chat prompt; cheap depth.
- [ ] **Verify retrieval end to end.** Ask something only a seeded document can answer, and
      something only a seeded KPI can answer. Check citation chips list both.

---

## Phase 4 — Backend demo changes (`demo` branch)

Six small, localized edits. No structural changes.

- [ ] **[BLOCKER] Stub `req.auth` instead of removing auth.** Replace `clerkMiddleware()` when
      `DISABLE_AUTH` is on. Fixes all twelve call sites at once.
      ```js
      req.auth = () => ({
        userId: DEMO_USERS[req.get("X-Demo-Role") || "org_executive"],
        sessionClaims: { publicMetadata: { role: req.get("X-Demo-Role") || "org_executive" } }
      });
      ```
- [ ] **[BLOCKER] Add `X-Demo-Role` to CORS `allowedHeaders`** in `app.js:43`. Without it the
      preflight fails and every cross-origin request dies with a generic CORS error.
- [ ] **Set `NODE_ENV=demo`** (not `production`). Keep a dummy `CLERK_SECRET_KEY` set to satisfy
      the required-vars check in `config/env.js`.
- [ ] **Create `.env.demo.local` for local runs.** `server.js` loads `.env.<NODE_ENV>.local`, so
      `NODE_ENV=demo` needs that exact filename or the app exits on missing required vars. Copy
      `.env.example` as the starting point and set `PORT=5000` to match the frontend's base URL.
- [ ] **[BLOCKER] Add the demo-password middleware.** Check `Authorization: Bearer <demo key>`
      before the routes; exempt `/api/health` so Railway's probe works. The frontend already
      sends this once the shim's `getToken` returns the key.
- [ ] **[BLOCKER] Parameterize the vector query** at `services/ragService.js:214-215` —
      bind as `$1::uuid[]`.
- [ ] **Block the destructive routes:** `DELETE /api/org/:orgId`, `PUT|DELETE /api/user/:userId`,
      `DELETE /api/docs/:id`, `POST /api/chat/ingest`. All anonymous without auth; ingest
      re-embeds every file in the database on demand.
- [ ] **Lower the rate limits** in `app.js:75,85` — currently 1000 global / 200 chat per 15 min,
      both carrying "lower this back" TODOs. Chat is three to six model calls per message.
- [ ] **[BLOCKER] Add a DB fallback to `getFullDashboardSummary`.** When a section rejects, read
      the persisted KPI row for that period. Nearly drop-in — the Prisma models use the same
      field names the services return.
- [ ] **Verify locally** against the demo database: `/api/auth/me`,
      `/api/summary/summary/:orgId`, `/api/chat/stream` with each of the four `X-Demo-Role`
      values. Confirm `org_staff` gets 403 on `/api/summary/scorecard` — that denial is the RBAC
      demo working, not a bug.

---

## Phase 5 — Frontend demo changes (`demo` branch)

- [ ] **[BLOCKER] Write the `demoAuth` shim module** exporting Clerk's shapes: `ClerkProvider`
      as pass-through, `useAuth` → `{getToken, isSignedIn, isLoaded}`, `useUser` →
      `{user:{imageUrl}, isLoaded}`, plus `SignIn`, `SignOutButton`, `UserProfile`.
- [ ] **`getToken()` returns the demo password.** This is the whole gate.
- [ ] **Swap the seven Clerk imports** (list in Findings). Keep imports explicit rather than
      aliasing the package in Vite — a reviewer reading `main.tsx` shouldn't think real Clerk is
      wired up.
- [ ] **Turn `LoginPage` into the passphrase gate.** Set
      `isSignedIn = !!localStorage.getItem("demo_key")` and `AuthenticatedLayout`'s existing
      redirect-to-login logic works unchanged.
- [ ] **[BLOCKER] Build the persona switcher** — a "Viewing as" control in the topbar that sets
      the active persona, sends `X-Demo-Role` on every request, and calls `refreshProfile` so
      `/auth/me` returns the matching seeded user. Add the header in **both** send paths (axios
      interceptor and the chatbot's raw `fetch`), or the chatbot will answer as a different
      persona than the rest of the app.
- [ ] **Add the mock consent route** `/demo/connect/:provider` — provider name, the scopes it
      would request, Authorize / Cancel. No credential fields. Label it plainly as simulated and
      use a neutral treatment rather than reproducing Intuit's actual login page.
- [ ] **Rewire `integration-card.tsx`.** `handleConnect` currently calls install then redirects —
      point it at the consent route. Drive `enabled` from local demo state rather than
      `user.Organisation.*_connected`. Existing connecting states, confirm dialog and toasts all
      carry over.
- [ ] **Apply the same treatment to all four providers** — one parameterized component, so the
      Integrations page looks finished rather than one-of-four.
- [ ] **Gate the financial section on the connection flag** so the connect step means something
      visually.
- [ ] **Replace `ProfilePage`** with a static card from the seeded user, and **`nav-user`'s sign
      out** with one that clears the demo key.
- [ ] **Apply the Phase 0 viewer decision.** If the key works, leave `web-viewer.tsx` alone. If
      not: drop `@pdftron/webviewer` and `public/lib/webviewer/` (172 MB of vendored assets —
      removing it also shrinks the deploy substantially), and render documents in a plain PDF
      view instead.
- [ ] **Whichever viewer survives, check it can authenticate.** `GET /api/docs/:id` is behind
      the demo-password middleware, and an `<iframe src="...">` cannot send an `Authorization`
      header. Fetch the file through the existing axios instance (which already attaches the
      header via the shim's `getToken`), then render `URL.createObjectURL(blob)` as the source.
      That keeps it working with no backend exemption. Verify the same for WebViewer's own
      document-fetch path if it stays.
- [ ] **If the viewer was dropped, add the demo-limitations note** — a short line on the
      documents page saying this is a demo and the production build uses a full document viewer.

---

## Phase 6 — Deploy

- [ ] **[BLOCKER] Dedicated OpenAI key with a hard spend cap.** Not your main key. A public
      unauthenticated chat endpoint running a multi-agent pipeline is the one thing here that
      can actually cost money.
- [ ] **Deploy the API from `demo`.** Env: `NODE_ENV=demo`, `DISABLE_AUTH=true`, five Supabase
      values, capped OpenAI key, demo password, dummy `CLERK_SECRET_KEY`, and `FRONTEND_URL` /
      `FRONTEND_REDIRECT_URI` / `ALLOWED_ORIGINS`. No `QUICKBOOKS_*` vars needed.
- [ ] **Confirm no `.env` reaches the image** — `.dockerignore` already excludes `.env*`; verify
      it still does after the history rewrite.
- [ ] **Check `/api/health` and CORS.** A CORS miss surfaces as AuthContext's "Unable to reach
      the server" screen, which looks like a backend outage.
- [ ] **Deploy the frontend.** Set `VITE_API_BASE_URL` to the deployed API **including the
      `/api` suffix** (the local value is `http://localhost:5000/api`) — omitting it 404s every
      call. If using the nginx image, `entrypoint.sh` rewrites `public/config.js` with envsubst
      at container start, so runtime env vars must be present there, not just at build time.
- [ ] **Walk the whole journey as a visitor:** passphrase → each of the four personas →
      dashboard → documents → open a file → connect flow → two chatbot questions → citations and
      guardrail badge.
- [ ] **Set up a reseed path.** Even with writes blocked the demo drifts. A one-command reseed
      is enough; a scheduled job is nicer.

---

## Phase 7 — Portfolio polish

- [ ] **Write a real README for each repo** — what it does, architecture, stack, the interesting
      decisions, live demo link and password. Use the salvaged diagrams.
- [ ] **Lead with the parts worth reading:** the multi-agent chat orchestration, hybrid
      vector + full-text retrieval, the pgbouncer / `ivfflat.probes` fix, the DB-first KPI cache
      with its TTL. These show engineering judgement rather than framework assembly.
- [ ] **Credit the team and state your role.** Six contributors. API: 178 of 204 commits are
      yours. Web: a teammate has 42 commits to your 27. A short contributors note with a plain
      description of what you owned reads better than an implicit solo claim — and costs nothing.
- [ ] **Put a demo banner in the app** — synthetic data, simulated integrations. Sets
      expectations and explains the mock OAuth without anyone asking.
- [ ] **Decide this file's fate.** `DEMO_RUNBOOK.md` sits in the API repo root and describes the
      demo shims frankly. Either gitignore it (stays local, still readable by agents) or commit
      it as an artifact of process. Just don't publish it unexamined.
- [ ] **Re-read the diff, then go public.** Confirm `uploads/` is gone from history, then flip
      both repos to public.

---

## Deferred — known issues not being fixed

Recorded so they aren't rediscovered as surprises. None block the demo.

- No org scoping on `/api/docs/*`, `/api/org/*`, `/api/user/*` — irrelevant once there's one
  demo tenant and no real auth, but it's why the demo must block destructive routes.
- Six endpoints reference dropped Prisma models (`comment`, `activity_Log`) and always 500.
- OAuth state lives in an in-memory `Map` (`quickbooks.controller.js:27`) — moot now.
- `controllers/__hubspot.controller.js` and `__quickbooks.controller.js` are ~1,140 lines of
  dead code.
- `../maural-kms/public/lib/webviewer` is 172 MB across 677 committed files — heavy clones and
  a large image. Consider fetching at build time if the viewer survives Phase 0.
