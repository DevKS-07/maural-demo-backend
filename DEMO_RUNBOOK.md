# Maural KMS → Public Demo: Runbook

**Purpose of this file:** a resumable plan. Tick items as they're completed. If you are an AI
agent picking this up in a new session, read "Context" and "Decisions" first — they contain
findings that took a full codebase review to establish and are not obvious from the code.

**Status:** Phase 0 done. **Frontend Phase 1 done** apart from one manual GitHub-settings
check: `main` and `demo` are both at `0553ea3` on `maural-demo-frontend`, and the local clone
is checked out on `demo`.

**API Phase 1 is done** apart from the same manual GitHub-settings checks the frontend is
waiting on. The rewrite happened — `uploads/` is stripped from all history **and a real
credential leak found in `Readme.md` history has been redacted** (see "Added during API
Phase 1"; this file previously predicted the scan would come back clean, and it did not).
`main` and `demo` are both pushed to `maural-demo-backend` and sit at the same commit, the
local clone is checked out on `demo`, and `dev` is kept local at that commit and never pushed.
(No SHA recorded on purpose — edits to this file move it. Read it with `git ls-remote origin`.)

**Remaining Phase 1 work is all on github.com by hand** (no `gh` on this machine): archive the
two old team repos, and confirm private + collaborators on both new repos.

**Phase 2 is complete (2026-09-22).** Pausing decision: free tier + a DB-touching keep-alive
job, built in Phase 6. Demo project ref is **`jnmhzhjvizkrbvgdhyms`**, schema is pushed,
`document_embeddings` is `vector(1536)` with no vector index, and a rolled-back 1536-dim
insert + cosine search passes. **RLS is on for every table, `document_embeddings` included**
— the original SQL's `DISABLE ROW LEVEL SECURITY` was reversed; the anon key is verified
locked out and `SUPABASE_SERVICE_ROLE_KEY` is now mandatory for ingestion. **The runbook's pgvector SQL could not be used as written** —
`db push` itself creates `document_embeddings`, badly; see "Added during Phase 2" for what was
actually run.

**Phase 3 is COMPLETE (2026-09-23), on `demo`** — including the block that was deferred out of
it, which ran during Phase 4 and passed (see below). The `schema.prisma` fix is committed and the
**`[TRAP]` on `prisma db push` is resolved — plain `db push` is safe again.** `prisma/seed.js` is
idempotent (proven by repeated runs converging on identical row counts) and the demo tenant is
**fully seeded**: both orgs, four roles, five categories, four persona users with the org chart
wired, two periods of all three KPI tables with every field populated, and the VTO. Two Phase 4
items were pulled forward and are done — the `req.auth` stub and `.env.development.local`.

**The six demo documents are authored and built** — sources tracked in `demo-content/documents/`,
binaries generated into the gitignored `uploads/` by `demo-content/build-documents.ps1`. All six
were extraction-tested with the libraries ingestion actually uses; the corpus is ≈47 chunks.

**Deferred out of Phase 3 by the user (2026-09-23), then completed during Phase 4 the same day
once the capped OpenAI key arrived.** Document upload, ingestion and retrieval verification all
passed — see the ticked items in the Phase 3 deferred block for the numbers.
`demo-content/upload-manifest.json` did make it turnkey. It was deliberately run **before** the
demo-password middleware was added, so no `Authorization` header was needed; anything re-run
after that point does need one.

**The capped OpenAI key is in place (2026-09-23)** and present in **both** `.env` and
`.env.development.local`, verified identical. **Phase 3's deferred block is complete** — all six
documents uploaded, ingested and verified (47 chunks, no file at zero), and both retrieval
checks pass.

**The WebViewer licence key still works — tested 2026-09-23, Decision 6 resolved: keep the
viewer.** The seeded documents unblocked that test and it passed, against this file's
expectation that the October 2025 key would be dead. No `@pdftron/webviewer` removal, and **no
`filter-repo` pass on the frontend repo**. See Phase 5 and Decision 6.

**Phase 4 is COMPLETE (2026-09-23), on `demo`** — every item done and verified locally against
the demo database, except the rate limits, which the user deliberately deferred (see that item).
**Committed and pushed**: `feat(demo): enforce RBAC and gate the demo API`, `origin/demo` on
`maural-demo-backend`. `origin/main` is untouched, still the team project as left (Decision 7).
**The demo-password middleware is now mounted**, so every request except `/api/health` needs
`Authorization: Bearer thornbury-demo-2026`.

**Next backend phase is 6 (deploy).** Phase 5 is the frontend session's.

**Phase 6 code half IN PROGRESS (2026-09-24), on `demo`.** Step 1 done: the three items Phase 5
left for the backend are resolved (VTO + labor-config writes blocked; period-aware KPI lookup;
scorecard fixed). **Owed by the frontend session before the deployed demo is seen on/after
1 Oct 2026:** pin the demo clock to 22 Sep 2026, and make the VTO editor save per-visitor.
Step 2 done: rate limits set to 1000 global / 100 chat per 15 min. Step 3 done: the four
integration `/disconnect` routes are blocked, and `prisma/reseed.js` restores data (never
documents). Step 4 done: `jobs/keepalive.js` written and tested locally. **The code half of
Phase 6 is complete.** Left for the user in the dashboards: deploy the API and frontend, then
add the keep-alive cron service (steps on the Phase 6 item). See "Added during Phase 6".

**Phase 5 is COMPLETE apart from the joint verification pass (2026-09-24), on `demo` in
`maural-demo-frontend`** — four commits, all pushed to `origin/demo`:
`14d9806` (Clerk → passphrase gate, welcome page with persona picker, demo banner, mock
integrations, finance gate, profile), `8c1016b` (actions the demo can't perform shown disabled;
static invitation sample), `54c1b27` (locked sidebar items that show live backend 403s),
`f73c63a` (welcome-page copy aligned with what the demo allows). `origin/main` untouched.
**The persona switcher is not a topbar dropdown** — decided mid-phase: it is a welcome page
(`/welcome`, which replaced `/login`) plus a demo banner inside the app. Decisions and findings
are in "Added during Phase 5". **Two items need the backend session:** VTO writes are not on the
block list, and the dashboard fallback returns the same seeded quarter for every date range.

> **⚠️ FOR THE FRONTEND SESSION — the `[CONFLICT]` is decided: RBAC is enforced.**
>
> `DISABLE_AUTH` no longer makes `requireRole` and `requireOrgAccess` pass-through. The four
> personas now get **real 403s** from the backend. **No contract string changed** — headers,
> persona values, default persona and `DEMO_ACCESS_KEY` are all exactly as the frozen "Shared
> contract" section has them. What changed is behaviour, and it affects Phase 5 work:
>
> - **`org_staff` gets 403 on** `GET /api/summary/scorecard`, all three `/api/user/invite*`
>   routes, and `POST|PUT|DELETE /api/vto/:orgId`. **`org_executive` gets 403 on**
>   `GET /api/summary/scorecard` only. `admin` / `super_admin` are denied nothing.
> - **Both org personas are confined to Thornbury** on the `:orgId` routes; requesting another
>   org's id returns 403. Admin personas keep cross-org access.
> - **A persona switch can 403 an in-flight request.** `DashboardPage.tsx` swaps views by role,
>   so a visitor on the admin dashboard who switches to `org_staff` may get a 403 back from a
>   scorecard fetch that started before the swap. Handle it as an expected state, not an error
>   toast — this is the one new failure mode the change introduces.
> - **The denial is real but currently invisible.** Role-based view routing means `org_staff`
>   never navigates to the scorecard page. If the RBAC demo should be *seen*, Phase 5 needs a
>   deliberate affordance (a disabled nav item, or a "your role can't see this" panel).
>   Worth doing — it is the most concrete proof the persona switcher is not cosmetic.
> - **Known cosmetic issue:** the three invitation routes return 500 for *authorised* personas
>   too, because they proxy to Clerk with a dummy key. Hide that screen rather than showing its
>   error state. See "Added during Phase 4".
>
> **WebViewer: the licence key WORKS — tested by the user 2026-09-23. Keep the viewer.**
> Don't drop `@pdftron/webviewer`, don't touch `web-viewer.tsx`, and **don't do the
> `filter-repo` strip of `public/lib/webviewer/`** — Decision 6 is resolved in favour of
> keeping it. The demo-limitations note tied to dropping the viewer is moot.
> Still do the **authentication** item — and note it is now live, not pending:
> `GET /api/docs/:id` **already sits** behind the demo-password middleware, and an
> `<iframe src>` cannot send an `Authorization` header. Fetch through the axios instance and
> render `URL.createObjectURL(blob)`. Verified: that route returns 200 with the Bearer header
> and 401 without it.
>
> **Documents are seeded (2026-09-23):** six uploaded, ingested and verified in the demo tenant
> — two PDFs, three DOCX and one XLSX, 47 chunks, every file confirmed non-zero.
> `FY2026 Strategic Plan - Recurring Revenue Transition.pdf` (273 KB) is the natural one to open.
> Chat retrieval is verified working against both documents and seeded KPI/VTO data.
> **One frontend detail from that run:** citation chips come back with the `title`
> **URL-encoded** (`Q2%202026%20Quarterly%20Business%20Review.docx`). Run it through
> `decodeURIComponent` or the chips will read badly. Each chip also carries a `type` of
> `Knowledge Base`, `KPI Data` or `VTO`, which is a ready-made grouping if you want one.
>
> **The backend is ready for you (2026-09-23) — Phase 4 is complete and verified.** The
> password gate is live: every request except `/api/health` now needs
> `Authorization: Bearer <passphrase>`, and `X-Demo-Role` is in CORS `allowedHeaders`, so the
> preflight passes (confirmed: `204` with
> `Access-Control-Allow-Headers: Content-Type,Authorization,X-Demo-Role`).
> **The dashboard now returns real numbers** rather than three error cards — seeded KPI rows
> are served with `fromCache: true` on each section when the live integration call fails, which
> in the demo is always. Sections carry 29 / 18 / 11 populated fields.
> **Eight route/method combinations return 403 with `{ demo: true }`** and a "disabled in the
> demo" message: `POST /api/org`, `PUT|DELETE /api/org/:orgId`, `PUT|DELETE /api/user/:userId`,
> `PUT|DELETE /api/docs/:id`, `POST /api/chat/ingest`. Treat `demo: true` as "show a friendly
> notice", not an error — ideally disable the control rather than letting it fail. **Reads are
> untouched**, and so is `POST /api/docs`: `GET /api/docs/:id` and `GET /api/org/:orgId` both
> return 200, so the WebViewer and upload paths are clear. Note this means **document rename
> and org rename will 403** if those controls are reachable in the UI.
>
> **The demo passphrase is `thornbury-demo-2026`** (chosen 2026-09-23). This is the value a
> visitor types into the gate; it is deliberately not a secret — Phase 7 publishes it in the
> README alongside the demo link. It lives in `DEMO_ACCESS_KEY` in both `.env` and
> `.env.development.local`, and the frontend still needs **no env var for it** — `getToken()` returns
> whatever the visitor typed. Recorded here only so both sessions can test against the same
> string. *(Stale sentence corrected in Phase 5: the password middleware **is** mounted —
> every request except `/api/health` needs the `Authorization` header. See Phase 4.)*

**Two recovery artifacts exist outside the repo — their disposal is the user's call; agents
should not raise or act on it (2026-09-22).** They can be deleted — the push is
verified, and both contain the client documents and the unredacted password:
`../maural-kms-api-prerewrite-mirror.git` (full pre-rewrite mirror, all 12 original refs) and
`../maural-api-uploads-backup-20260921` (the 5 tracked client documents). **Keep the uploads
backup only if those source documents are wanted for reference** — Phase 3 authors its own
fictional demo documents and does not need them.

---

## Context

Two repos, a team senior-project:

| Repo | Path | Original remote (frozen — never pushed to again) | New remote (demo, private until Phase 7) |
| --- | --- | --- | --- |
| API | `maural-kms-api` | `github.com/DevKS-07/maural-kms-api.git` (branch `dev`) | `github.com/DevKS-07/maural-demo-backend.git` |
| Web | `../maural-kms` | `github.com/DevKS-07/maural-kms-frontend.git` (branch `proper`) | `github.com/DevKS-07/maural-demo-frontend.git` |

The new repos already exist (created by hand, empty). The local folder names did **not**
change. `maural-kms-api` is still the API folder and still the name of the *frozen team repo*,
so never build a remote URL from the folder name.

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
   *Implemented in Phase 5 as a **welcome page**, not the topbar dropdown originally planned — a
   small "Viewing as" control next to the notifications bell read as an app setting, and gave a
   visitor no idea what the personas were. `/welcome` explains the product, shows the four
   personas as selectable cards, and takes the passphrase; a demo banner in the app links back to
   it. See "Added during Phase 5".*
6. **WebViewer: KEEP IT — [RESOLVED 2026-09-23, the licence key still works].** *Tested by the
   user; the October 2025 Apryse demo key is still active, against this file's expectation that
   it would be dead. `web-viewer.tsx` is left alone, `public/lib/webviewer/` stays, and no
   history rewrite is needed in the frontend repo. The one live consequence is deployment size —
   172 MB across 677 files lands in the Vercel build output (Phase 6).* The original decision,
   for the record: keep it if the license key still works; if not, drop it and fall back to a
   plain browser PDF view with a visible note that this is a demo. A simple viewer that works
   reads better in a portfolio than a broken premium one.
7. **`main` = the real project, `demo` = demo modifications.** Deploy from `demo`.
8. **The team repos are left completely untouched** — frozen as the snapshot of where the team
   finished, with all collaborators keeping access. Local clones are disconnected from them and
   pushed to new blank repos instead. History is filtered *locally* before that first push so
   the client documents don't get republished; the old remotes never see a rewrite.
9. **Hosting: Railway for the API, Vercel for the frontend.** Railway because the API needs a
   long-running container — SSE on `/api/chat/stream`, multi-agent requests that outlast typical
   serverless timeouts, native deps (cairo/pango/tesseract) and a persistent `pg` Pool. Avoid
   free tiers that sleep: a portfolio link that takes ~50s to wake reads as broken. Vercel for
   the frontend, deployed **from GitHub, not the Docker image** — so `nginx.conf`,
   `entrypoint.sh` and the frontend `Dockerfile` are not in the deployment path.
10. **The backend Dockerfile stays — do not switch to Nixpacks.** `railway.toml` selects
    `builder = "dockerfile"` and that build is known-good. It already solves things a Nixpacks
    build would have to re-solve: the `--max-old-space-size=2048` install heap (commit
    `fed0e6c`, an OOM that was already paid for once), the cairo/pango/jpeg/giflib runtime libs
    for `@napi-rs/canvas`, explicit `prisma generate` ordering, a non-root user and a
    healthcheck. The frontend's nginx setup was genuinely unused on the Vercel path; this one is
    live. Leave `railway.toml` and the `Dockerfile` alone.

---

## Shared contract — backend ↔ frontend

Fixed strings both repos must agree on. **Do not invent alternatives.** A mismatch here fails
as a CORS or auth error, not as a naming error, so it is expensive to debug.

| Thing | Value |
| --- | --- |
| Auth scheme | `Authorization: Bearer <demo password the visitor types>` |
| Backend env var holding the password | `DEMO_ACCESS_KEY` |
| Frontend storage of the typed password | `localStorage["demo_key"]` |
| Persona header | `X-Demo-Role` |
| Persona values | `super_admin` · `admin` · `org_executive` · `org_staff` |
| Default persona when header absent | `org_executive` |
| Seeded clerk ids | `demo_super_admin` · `demo_admin` · `demo_org_executive` · `demo_org_staff` |
| Paths exempt from the password gate | `/api/health` |

Three rules that follow from it:

- **Both headers go in two places on the frontend** — the axios interceptor in
  `AuthContext.tsx` and the raw `fetch` in `floating-chatbot.tsx`.
- **`X-Demo-Role` must be listed in CORS `allowedHeaders`** (`app.js:43`) or every
  cross-origin request fails preflight.
- **The frontend needs no env var for the password.** The visitor types it; `getToken()`
  returns it. Only the backend knows the expected value.

**Behaviour both sides rely on (recorded in Phase 5 — the table above is unchanged).** These
aren't strings, but the frontend is built on them, so changing one on the backend breaks it:

| Backend behaviour | What the frontend does with it |
| --- | --- |
| Missing or wrong passphrase → **401** | The gate shows "That passphrase isn't right". `AuthContext` **clears the stored key on a 401 from `/auth/me`** — a 403 there would strand a returning visitor on a blank page |
| Blocked write → **403 `{ demo: true, message }`** | Shows `message` as a friendly toast (safety net; the controls are disabled anyway) |
| Role/tenant denial → **403 `{ message }`** (no `demo` flag) | The locked-sidebar panels quote `message` verbatim |

**Frontend-only storage** (not part of the contract, recorded so nobody reuses the names):
`localStorage["demo_role"]` — active persona; `localStorage["demo_connections"]` — per-visitor
mock integration state (JSON).

### Working in parallel

Phases split cleanly by repo: **0** is frontend-only, **1** touches both but the two migrations
are independent of each other, **2–4** are backend-only, **5** is frontend-only, **6** is
backend-then-frontend, **7** is both. Backend 2–4 and frontend 5 are the natural parallel pair —
frontend code can be written against this contract and verified once Phase 4 lands.

**Suggested order.** Phase 0 → frontend Phase 1 → API Phase 1 → Phases 2–4 → (split) Phase 5.
Grouping Phase 0 and the frontend migration into one block avoids bouncing between repos.
Nothing in Phases 0–1 depends on the WebViewer decision any more — that test needs a running
stack and lives in Phase 5.

Two cautions: do the **Phase 1 git migrations one at a time** (irreversible operations deserve
undivided attention), and **once two sessions are running in parallel, only the backend session
edits this file** — concurrent writes lose each other's ticks. Before the split there's only one
session, so it owns the file.

---

## Findings that drive the plan

These were expensive to establish. Don't re-derive them.

- **`DISABLE_AUTH` already exists** (`config/env.js:40`) and flips `requireAuth`, `requireRole`
  and `requireOrgAccess` to pass-through. But it is gated `!isProduction && ...`, so
  `NODE_ENV=production` silently re-enables auth. **The only hard constraint is
  `NODE_ENV !== "production"`** — `development`, `demo` and anything else all behave
  identically, because every branch in the codebase tests `isProduction` and nothing tests for
  `development` or `demo` specifically (verified 2026-09-23; see "Added during Phase 4").
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
  ``.env.${NODE_ENV}.local``, and `NODE_ENV` defaults to `development`, so a bare
  `npm run dev` looks for **`.env.development.local`**. If that file is absent `config/env.js`
  hard-exits on missing required vars — and the `.env` load in `app.js` comes too late to
  rescue it. **That file is the one the local demo uses** (see the naming decision in "Added
  during Phase 4"); it must exist before any local verification step.
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
- **`prisma db push` reads `.env`, not `.env.development.local`.** `prisma.config.js` starts with
  `import "dotenv/config"`, which loads plain `.env` from the repo root, and then resolves
  `env("DIRECT_URL")`. The repo still has `.env`, `.env.development.local`,
  `.env.production.local`, `.env.staging.local` and `.env.test.local` on disk, all holding
  **old** credentials. So the file that decides where the schema lands is `.env` — print the
  host out of `DIRECT_URL` and eyeball it before running `db push`, rather than trusting that
  the right file was edited. (dotenv does not override an already-set shell variable, so a
  stale exported `DIRECT_URL` wins over the file.)
- **Supabase free-tier projects pause after about a week of inactivity** — that is almost
  certainly what happened to the original project, which is now inactive. A portfolio demo is
  idle by nature: nobody clicks it for ten days, the database pauses, and the next visitor gets
  a broken app. Decide at project-creation time how to handle it: a paid plan, or a scheduled
  keep-alive query. The keep-alive is cheap since Railway is already running (see Phase 6).

### Added during frontend Phase 0–1 (2026-09-21)

- **The old runbook's API remote URL pointed back at the team repo.** It said
  `gh repo create maural-kms-api` + `git remote add origin .../DevKS-07/maural-kms-api.git`.
  That is the frozen team repo on the same account, so the "new" push would have landed there.
  Fixed: the new repos are `maural-demo-backend` / `maural-demo-frontend` (see Context).
- **The frontend history has nothing to strip.** Every commit was scanned outside
  `public/lib/webviewer`: no `uploads/`, no pdf/docx/xlsx/pptx/csv, no `.env`, no key-shaped
  strings. **No `filter-repo` pass is needed for the frontend in Phase 1.** The only possible
  rewrite is the Phase 5 webviewer strip. `git-filter-repo` is an API-only dependency for now.
- **Frontend `main` and `proper` have diverged. `proper` is correct.** Local `main`
  (`acf821f`) has 8 commits `proper` lacks; `origin/main` (`bb01ec7`) has 9. Two of them are
  non-merge teammate commits (s-tus: `abdfca8`, `abc57de`) that remove `AuthenticatedLayout`'s
  Clerk checks and its "Unable to reach the server" screen. `proper` has the *later* version
  with both restored, and Phases 5/6 rely on that screen and the redirect logic. Promoting
  `proper` therefore drops those two commits from the new repo's history. Accepted: the team
  repo keeps them. `proper` also has 3 commits `main` lacks (Docker packaging, README, lockfile).
- **Validate a lockfile with `npm ci` before committing it, not `npm install`.** `npm install`
  silently rewrites the lockfile to match `package.json` and hides drift. `npm ci` fails
  loudly on a mismatch and never writes the lockfile. That is also exactly what Vercel runs.
- **`gh` CLI is not installed** on this machine. The repos were created in the web UI instead.

### Added during API Phase 1 (2026-09-21)

- **[RESOLVED 2026-09-22 — no action needed]** *The old Supabase project
  `anwurvszektveevdiacu` no longer exists, so there is nothing to rotate. The frozen team repo
  stays private, with access granted explicitly to team members only, so its unredacted history
  is not treated as an exposure. Kept below as the record of what was found.*
  **The API history contained live credentials — the runbook was wrong that
  it would be clean.** An old `Readme.md` (blob `133ab87`, in commits `543b5fe` and `cfae7f3`,
  both ancestors of `dev`) had a fully populated env block, not a template:
  the Supabase project ref `anwurvszektveevdiacu`, the real anon JWT, and
  **the database password `Ecosphere8_...` in plaintext** inside `DATABASE_URL`. No branch tip
  had it — it was removed later — so it was purely historical, exactly the class of thing the
  `uploads/` strip exists to catch. All three are now redacted from local history via
  `--replace-text`, in the same pass as the `uploads/` strip.
  **Redacting local history does not un-leak the credential**: the frozen team repo still holds
  it unredacted, and everyone with access to that repo can read it. **If that Supabase project
  still exists, rotate the database password.** Phase 2's fresh project means the demo never
  uses this credential either way, so this is cleanup of an old exposure, not a demo blocker.
- **A second blob (`ebed8e96`) had the same credentials but was unreachable** from any commit —
  a dangling object. `git push` only sends reachable objects, so it was never a publication
  risk, and the rewrite dropped it. Worth knowing so it isn't mistaken for a second leak.
- **The runbook's secret-scan command was insufficient.** `git log -p --all | grep` does not
  show diffs for merge commits, so content introduced by a merge is invisible to it — it missed
  the leak above. The per-blob scan now in Phase 1 walks every blob in the object database with
  its path attached, and is what actually found it. Use that form.
- **`git filter-repo` leaves `.git/filter-repo/fast-export.original` behind** — ~25 MB
  containing the stripped client documents *and* the unredacted password, surviving the rewrite
  and the gc. Not pushable (it isn't a git object), but it sits on disk looking clean.
  Delete it and `fast-export.filtered` after verifying. Doing so took `.git` from 53 MB to
  3.9 MB — and note it was **20 MB before** the rewrite, so the mid-rewrite growth is these
  streams, not a failed strip.
- **`filter-repo --dry-run` is the safe rehearsal** and was worth the extra step. It writes
  `fast-export.original` and `.filtered` without touching the repo, so the filtering can be
  proven before committing: `uploads/` filechange refs went 9 → 0, the password 1 → 0, the
  project ref 2 → 0, and commit count stayed 181 → 181. It also confirmed `--path
  --invert-paths` and `--replace-text` combine in one pass.
- **Stream size is a misleading check.** The filtered stream was only ~48 KB smaller than the
  original even though `uploads/` is 10 MB unpacked, because filter-repo must pass every blob
  through the stream for `--replace-text` to inspect it. The stripped blobs simply end up
  referenced by no commit and are dropped at gc. Verify by path and commit counts, not bytes.
- **All 12 API branches were ancestors of `dev`**, so deleting them was lossless — check with
  `merge-base --is-ancestor` per branch, not just by comparing `rev-list` counts.
  **`main` and `dev` were both kept** at the same commit; only the other 10 were deleted. Only
  `main` and `demo` will be pushed — `dev` stays local rather than adding a redundant third
  branch to a portfolio repo.
- **No commit touched only `uploads/`,** so no commit became empty and none was pruned. That
  makes **181 in / 181 out the single sharpest verification number** for this rewrite. The
  stronger check is comparing `%an|%ae|%ad|%s` for all 181 commits against the pre-rewrite
  mirror — they came back identical.
- **The rewrite deletes the `uploads/` directory from the working tree**, since all five
  remaining files were tracked. `.gitignore` already had a `!/uploads/.gitkeep` negation for a
  placeholder that was never actually tracked, and **`scripts/ingest-local.js:33` reads
  `../uploads` at runtime** — which Phase 3 local seeding depends on, since `scripts/` is
  excluded by `.dockerignore` and must run locally. `uploads/.gitkeep` is now tracked
  (commit `8398a65`) so the directory exists on a fresh clone.
- **`pip install git-filter-repo` worked and put it on PATH** as a real `git filter-repo`
  subcommand (v2.47.0, Python 3.14). The anticipated fallback of downloading the standalone
  script was not needed; `python -m git_filter_repo` is the backup if PATH ever breaks.
- **The runbook's recorded `dev` tip goes stale fast.** It said `65f5d7b`; the actual tip was
  `3c7740c`, because the runbook's own doc commits had moved it. Re-read the tip rather than
  trusting a recorded SHA.
- **[DECIDED 2026-09-22] Seeding work goes on `demo`.** *Everything demo-related lives on
  `demo` — seed extensions included — and `main` stays the team project as left. This also
  covers the durable `schema.prisma` fix for `document_embeddings` (see "Added during
  Phase 2"). The question as originally recorded:*
  **Which branch does the seeding work go on?** The working copy is
  left checked out on `demo`, and Phase 4 is explicitly titled "`demo` branch" — but **Phase 3
  never says where its changes live**, and it does involve committed code: it extends
  `prisma/seed.js`, which is a tracked file on `main`. So the boundary is genuinely ambiguous,
  and the risk is drifting into it rather than choosing.
  The two defensible readings:
  - **Everything demo-related on `demo`** (seed extensions included). Keeps `main` as the
    untouched team project, which is what Decision 7 says `main` is for. Cost: `main`'s
    `prisma/seed.js` stays as the team left it, so the demo tenant only exists on `demo`.
  - **Seeding on `main`, shims on `demo`.** Treats a richer seed script as a legitimate
    improvement to the real project and keeps `demo` purely the shim layer (auth stub, CORS
    header, demo-password middleware, rate limits). Cost: `main` gains commits the team never
    wrote, blurring "the real project".
  Either works; **pick one at the start of Phase 3 and record it here**, because splitting the
  difference later means cherry-picking seed commits between branches. Note that Phase 3's
  other outputs — the Supabase project, the seeded rows, the uploaded documents — are database
  and infrastructure state, not commits, so they're unaffected by this choice.

### Added during Phase 2 (2026-09-22)

- **`document_embeddings` is a Prisma model** (`prisma/schema.prisma:182`), so `db push`
  creates the table itself — the runbook assumed the pgvector SQL would. What Prisma builds is
  wrong in two ways: the column is untyped `vector` (not `vector(1536)`), and
  `@@index([embedding])` becomes a **B-tree** index on the vector column (Prisma can't express
  IVFFlat, so an introspected IVFFlat index came back as a plain `@@index`). A 1536-dim vector
  is ~6 KB against B-tree's 2.7 KB row limit, so **every embedding insert fails**. Proven on the
  demo DB with a rolled-back probe: `index row size 6160 exceeds btree version 4 maximum 2704
  for index "document_embeddings_embedding_idx"`. Phase 3 ingestion would have died on its
  first chunk.
- **Consequences for the runbook's SQL:** `db push` fails outright with no `vector` type, so the
  extension must come **first**; the SQL's `CREATE TABLE IF NOT EXISTS` then silently no-ops;
  and its `idx_document_embeddings_org_id` would duplicate Prisma's `document_embeddings_org_id_idx`.
  The fix is DB-only (no code change, so no branch question) — see Phase 2 for the exact sequence.
  Retained Prisma differences, all harmless: `content` and `embedding` are `NOT NULL`, `metadata`
  defaults to `'{}'`, and the FK also has `ON UPDATE CASCADE`.
- **Why this never broke in the original project, despite routine `db push` use — tested,
  not inferred.** The old table was hand-built from SQL (`vector(1536)` + an IVFFlat index)
  *before* the model existed; the model arrived in `cafa5a7` (2026-02-23) as `prisma db pull`
  output — the 12 generated "row level security" comments give it away — and introspection
  loses both the dimension and the index type. Recreating the old IVFFlat index on the empty
  demo table and running `prisma migrate diff --from-config-datasource --to-schema
  prisma/schema.prisma --script` (a dry run of `db push`) showed Prisma **matches indexes by
  column and ignores the access method**: its only proposed change was
  `ALTER INDEX "idx_document_embeddings_embedding" RENAME TO "document_embeddings_embedding_idx"`.
  So on the old DB the first push after `cafa5a7` at most renamed the IVFFlat index (still
  IVFFlat; nothing references it by name) and every later push was a no-op on that table.
  The column type is **never** diffed — with `vector(1536)` in the DB and
  `Unsupported("vector")` in the schema, Prisma proposes nothing for the column. The flaw only
  fires when *no* index exists on `embedding` — i.e. building from empty, which had never
  happened until today. (Temporary index dropped afterwards; table back to pkey + org_id.)
- **[TRAP — RESOLVED 2026-09-22, schema fix committed in Phase 3. `db push` is safe again.]**
  *The fix below is now on `demo`: `Unsupported("vector(1536)")` and no `@@index([embedding])`.
  `migrate diff --from-config-datasource --exit-code` against the real file returned exit 0 and
  `-- This is an empty migration.`, confirming the commit changed nothing in the database. The
  record of the trap is kept below because the same failure returns if `@@index([embedding])` is
  ever reintroduced — e.g. by a future `prisma db pull`, which is how it got there originally.*
  **Was: don't `npx prisma db push` against the demo DB.** Every claim here was tested
  (2026-09-22), not inferred:
  - **A push re-adds the B-tree index**, because the demo deliberately has no vector index and so
    nothing for Prisma to match. Dry run against the fixed table outputs only
    `CREATE INDEX "document_embeddings_embedding_idx" ON "document_embeddings"("embedding");`
    — it does **not** touch the column type.
  - **Empty table:** the push succeeds, then every ingestion insert fails (probe error above).
  - **Rows present:** the push itself fails — building that index over one real row gave
    `index row size 6160 exceeds btree version 4 maximum 2704` (tested inside a rolled-back
    transaction).
  - **If a schema change is needed before the fix lands:** don't push. Generate the script,
    delete the `CREATE INDEX "document_embeddings_embedding_idx"` line, and apply the rest:

    ```bash
    npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > change.sql
    # edit change.sql: remove the document_embeddings_embedding_idx line
    npx prisma db execute --file change.sql     # same datasource as db push: DIRECT_URL from .env
    ```

    If the diff's *only* output is that `CREATE INDEX`, there is nothing to apply — skip it.
- **The durable fix — [DONE 2026-09-22, committed on `demo`].** In `schema.prisma`, change the
  column to `Unsupported("vector(1536)")` and delete `@@index([embedding])`. Tested against a
  patched copy of the schema:
  - **vs the live demo DB:** `migrate diff --exit-code` returns 0 with `-- This is an empty
    migration.` — committing the fix changes nothing in the database.
  - **from an empty DB** (`--from-empty`): `"embedding" vector(1536) NOT NULL` and only
    `document_embeddings_org_id_idx` — no B-tree on the vector. So after the fix, a fresh build
    is just `CREATE EXTENSION` + `db push`; Phase 2 step 3's `DROP INDEX` / `ALTER COLUMN` are no
    longer needed (the extension must still come first — the schema doesn't declare it).
  - Once it's committed, plain `db push` is safe again and this trap can be marked resolved.
- **RLS is ON for all 17 tables, `document_embeddings` included — decided 2026-09-22: no table
  has RLS off.** New Supabase projects enable RLS on every table (all came up `rls = true`, zero
  policies). The original runbook SQL then *disabled* it on `document_embeddings`; that was
  applied and then **reversed**, because it bought nothing and opened a hole:
  - **Nothing in the app needs it off.** Every path already bypasses RLS: Prisma and
    `ragService`'s raw `pg` pool connect as `postgres` (table owner, `rolbypassrls`), and
    `lib/supabase.js` uses the service-role key (`rolbypassrls`).
  - **Off, it exposed the table to the anon key.** Supabase grants `anon` SELECT/INSERT/DELETE
    on every `public` table; RLS-with-no-policies is what neutralizes that. With RLS off, anyone
    holding the anon key could read, **inject chunks the chatbot would cite as fact**, or wipe
    the knowledge base via `/rest/v1/document_embeddings` — bypassing `DEMO_ACCESS_KEY` and the
    rate limits entirely. The anon key isn't in the frontend (it has no Supabase dependency at
    all), but Supabase designs that key to be publishable, relying on RLS.
  - **Verified after re-enabling:** `postgres` insert + cosine search OK (rolled back);
    `supabase-js` service-role insert and delete OK; `supabase-js` **anon** insert rejected
    (`42501: new row violates row-level security policy`), and with a real row present an anon
    select saw 0 rows and an anon delete removed 0. Table left at 0 rows.
  - **Why the original likely disabled it:** `lib/supabase.js:15` falls back to
    `SUPABASE_ANON_KEY` when `SUPABASE_SERVICE_ROLE_KEY` is unset — with RLS on, that fallback
    now fails ingestion (with `42501`) instead of silently writing through the public key.
    That's the desired behaviour, but it makes the service-role key **mandatory** (see Phase 6).
  - **Don't add policies** to "fix" a `42501` — the answer is always the service-role key.
- **The extension lives in `public`**, not Supabase's recommended `extensions` schema, because
  the runbook's plain `CREATE EXTENSION` uses the first schema on the search path
  (`"$user", public, extensions`). Works; the Supabase dashboard's advisor may flag it as a lint.
- **The env-file trap was live, not hypothetical.** When Phase 2 started, plain `.env` still
  pointed at the old project `anwurvszektveevdiacu` (`aws-1-us-east-2` pooler), and the new
  values had been put in `.env.local` — which **nothing** loads (`server.js` reads
  `.env.<NODE_ENV>.local`, `prisma.config.js` / `app.js:1` / `scripts/ingest-local.js` read
  `.env`). Resolved by the user: the new values are now in `.env`, and every other `.env*` file
  except `.env.example` was moved off the repo root.
- **`app.js:1` loads plain `.env` too — but too late to rescue a missing env file.**
  *(Corrected during Phase 3 prep; this previously claimed `.env` was a general fallback.)*
  `server.js` requires `config/env` on line 6, **before** `app.js` on line 7, and `config/env`
  both hard-exits on missing required vars and snapshots every value into its exports at that
  moment. So: with no `.env.<NODE_ENV>.local`, the server **exits** — the `.env` load in
  `app.js` never gets a chance. With one present but missing a variable, the `.env` value
  only reaches code that reads `process.env` directly (e.g. `ragService.js:42`'s
  `process.env.DATABASE_URL` fallback), not the many modules that import from `config/env`.
  Partial, inconsistent fallback — keep `.env.development.local` complete rather than relying on it.
- **`node_modules` was not installed**, which would have made `npx prisma` fetch the latest
  Prisma instead of the lockfile's and broken `prisma.config.js`'s `dotenv/config` import.
  `npm ci` fixed it (prisma 7.5.0, @prisma/client 7.4.2, dotenv 17.3.1 — all match the lock).
  Its Windows `EPERM` cleanup warning left an empty `node_modules/are-we-there-yet` that
  `npm ls` reports as extraneous; harmless. 59 audit warnings — **don't `npm audit fix`**, it
  rewrites the lockfile.
- **Prisma 7's `db push` did not run `prisma generate`.** Run `npx prisma generate` before
  anything in Phase 3 that uses the client (`prisma/seed.js`).
- **`docs/diagrams/` was moved out of the repo by the user** into the gitignored
  `docs-assets/` — no longer wanted tracked. Untracked on `demo` in `4ef39cf`; the files remain
  in history (commit `8398a65`) and are still tracked on `main`. Phase 1's
  "Salvage the architecture diagrams" item and Phase 7's "use the salvaged diagrams" now refer
  to `docs-assets/`, not `docs/diagrams/`.

### Added during Phase 3 (2026-09-22)

- **[CONFLICT — RESOLVED 2026-09-23. Decision: enforce. The personas are real.]**
  *Under `DISABLE_AUTH`, `requireAuth` stays pass-through (nothing validates a Clerk session)
  but `requireRole` and `requireOrgAccess` now evaluate normally against the stubbed identity —
  the runbook's proposed fix below, adopted as written. Implemented in
  `middleware/auth.middleware.js` by deleting the two `if (AUTH_DISABLED) return passThrough;`
  lines and adding a `hasIdentity(req)` guard for the unreachable case where neither Clerk nor
  the stub is mounted. **Verified live against the demo DB** — see "Added during Phase 4" for
  the per-persona results. **No contract string changed**, so the frozen "Shared contract"
  section is untouched.*
  *Three points that settled it:*
  - ***The codebase already did this.*** `docs.controller.js:169` gates its inline org check on
    `typeof req.auth === "function"`, **not** on `DISABLE_AUTH` — so document upload has been
    enforcing org scoping against the demo stub all along, and Phase 3 depended on it. The
    middleware was the inconsistent part, not the proposal.
  - ***It is a no-op in production.*** `config/env.js:40` is `!isProduction && ...`, so
    `AUTH_DISABLED` is already `false` in production and the deleted branch was already dead
    code there. The change cannot affect the real project.
  - ***The pass-through guarded a condition that can no longer occur.*** It existed because
    Clerk-with-no-session yields `{userId: null}`, which would 403 everything. `app.js:53`
    mounts the stub or Clerk but never neither, and the stub always yields a valid persona.
  **Original finding, kept as the record of what was decided:**
  **`DISABLE_AUTH=true` defeats the RBAC demo.** Two things
  this file already says are in direct tension, and nothing reconciles them:
  - Findings: `DISABLE_AUTH` flips `requireAuth`, `requireRole` **and** `requireOrgAccess` to
    pass-through. Confirmed in `middleware/auth.middleware.js` — `requireRole` and
    `requireOrgAccess` both begin `if (AUTH_DISABLED) return passThrough;`.
  - Phase 4's verify step: "Confirm `org_staff` gets 403 on `/api/summary/scorecard` — that
    denial is the RBAC demo working, not a bug."
  With `DISABLE_AUTH=true` that 403 **cannot happen**: `requireRole` never runs, so `org_staff`
  gets a 200. Decision 5 calls the four-role switcher the feature that "turns removed auth into a
  demo feature", and its most visible demonstration is exactly this denial — so this is not a
  cosmetic gap.
  **Proposed fix, for Phase 4 to decide (deliberately not applied during Phase 3):** under
  `DISABLE_AUTH`, keep `requireAuth` as pass-through but let `requireRole` and `requireOrgAccess`
  evaluate normally against the stubbed identity. That is safe *because* of the stub — `demoAuth`
  guarantees `req.auth()` always returns a known role and a seeded `clerk_id`, which is the thing
  the original pass-through was protecting against. `requireOrgAccess` additionally needs the
  persona users seeded with `org_id`, which Phase 3 does. The `demoAuth` stub as written is
  compatible with either choice, so nothing is foreclosed.
- **The document build pipeline, and two traps in it.** Sources are HTML in
  `demo-content/documents/` (Markdown was ruled out — no converter is installed and none of
  `marked`/`markdown-it`/`showdown` is in `node_modules`). `build-documents.ps1` drives Word COM
  for PDF/DOCX; `build-xlsx.js` writes the workbook with the already-present `xlsx` package.
  **Nothing was added to `package.json` and the lockfile is untouched.**
  - **Word COM rejects the `[ref]` argument form.** `$doc.SaveAs([ref]$path, [ref]$fmt)` — the
    VBScript idiom that most examples use — fails under PowerShell 5.1 with *"Cannot convert the
    ... value of type psobject to type Object"*. Pass arguments directly:
    `$doc.SaveAs([string]$path, [int]$fmt)`.
  - **Set spreadsheet number formats per row, not per column range.** Ingestion extracts a
    workbook as *formatted* text via `sheet_to_csv`, so a percentage cell carrying an integer
    money format is extracted as `37` rather than `37.1`. The stored value is correct and the
    error is invisible in Excel — it only appears in what the chatbot reads.
- **The generated documents are excluded from the repo, deliberately.** `.gitignore` has
  `/uploads/*` with only `.gitkeep` negated, and all six outputs were confirmed ignored. The
  tracked HTML sources plus the two build scripts reproduce them exactly, so nothing is lost and
  the repo does not carry ~600 KB of binaries that would also have to be re-reviewed on every
  change.
- **No document-conversion tooling on this machine, but Office COM is available.** No `pandoc`,
  `soffice`/`libreoffice` or `wkhtmltopdf` on PATH, and the only relevant npm dependencies are
  readers (`pdf-parse`, `pdfjs-dist`) — except `xlsx`, which does write. Phase 5's WebViewer test
  needs a real PDF, so authoring everything as `.md`/`.txt` is not sufficient.
  **`Word.Application` and `Excel.Application` are both available via COM**, so genuine
  `.docx`/`.xlsx`/`.pdf` can be produced through PowerShell with **zero new npm dependencies and
  no lockfile change** — which also avoids `npm install` rewriting the lockfile.

- **`OPENAI_EMBED_MODEL` is pinned by the column type, and a wrong value fails silently.** The
  demo column is `vector(1536)`. `text-embedding-3-small` (the `.env` value and the
  `config/env.js:57` default) and `ada-002` are 1536; **`text-embedding-3-large` is 3072** and
  would be rejected by every insert — which, during ingestion, is only logged (see the Phase 3
  upload item). Treat this as a fifth silent-failure mode alongside the four already listed.
  Verified: all three embedding call sites use `OpenAIEmbeddings` —
  `controllers/ingest.controller.js:191`, `services/ragService.js:72`,
  `scripts/ingest-local.js:225`. There is **no live Ollama path**; `config/ollama.js` is a
  vestigial header helper that nothing instantiates.
- **Two comments in live code still say the system is 768-dimensional** —
  `services/ragService.js:156` and `lib/prismaVector.js:5`. They are leftovers from the project's
  original Ollama era and are **wrong about the current system**. Don't read them as current, and
  don't "fix" the column to match them.
- **The project ran locally on Ollama before OpenAI, and old 768-dim SQL is still findable.**
  `AI_MODEL_SWITCHING_GUIDE.md` records the original design — `qwen3.5:9b` chat and
  `nomic-embed-text` embeddings at **768 dims**, chosen so no document content left the server —
  and the migration to OpenAI when the team's EC2 credits ran out. A surviving SQL script from
  that era (found in the old Supabase project, 2026-09-22) recreates `document_embeddings` at
  `vector(768)`, **with no `org_id` column**, and opens with `DROP TABLE IF EXISTS
  document_embeddings`. **Never run it against the demo DB**: wrong dimension, and it would drop
  a table that now carries an FK to `Organisation` and destroy the tenant isolation
  `ragService` depends on. It is useful only as provenance — it is the direct evidence for the
  hand-built IVFFlat index (`lists = 100`) that the Phase 2 finding deduced, and the origin of
  the `DISABLE ROW LEVEL SECURITY` line that the original runbook SQL carried and that Phase 2
  reversed.
- **`match_documents` is genuinely unused — confirmed, not assumed.** The demo DB has no such
  function and needs none. There is **no `.rpc(` call anywhere in the repo**; every
  `match_documents` reference is in a `.md` file or a stale comment, including
  `services/ragService.js:9`, whose header still lists it under "Requires the following to exist
  in Supabase". `AI_CHATBOT_README.md:146` states it outright: the RPC is retained for backwards
  compatibility, and live retrieval uses direct SQL on a dedicated `pg` Pool so
  `SET ivfflat.probes` persists on the same connection.

### Added during Phase 4 (2026-09-23)

**The RBAC enforcement change, verified live** against the demo DB (with `NODE_ENV=demo`, which
was the local value at the time — it is `development` now, and the behaviour is identical), all four
personas, before the demo-password middleware existed (so no `Authorization` header was needed
yet). This is the evidence behind the `[CONFLICT]` resolution:

| Route | super_admin | admin | org_executive | org_staff |
| --- | --- | --- | --- | --- |
| `GET /summary/scorecard` (`requireRole("admin")`) | 200 | 200 | **403** | **403** |
| `GET /summary/summary/:orgId` — own org | — | 200 | 200 | 200 |
| `GET /summary/summary/:orgId` — other org | — | 200 (bypass) | **403** | **403** |
| `GET /user/invitations` (`requireRole("org_executive")`) | — | 500¹ | 500¹ | **403** |
| `DELETE /vto/:orgId` (`requireRole("org_executive")`) | — | — | — | **403** |

With **no** `X-Demo-Role` header the scorecard returns 403 as `org_executive`, confirming the
contract's default persona is applied before the role check rather than falling through. The
403s land **before** the handler, so the `DELETE` probe mutated nothing.
¹ *Not a regression — see the first finding below.*

- **The three invitation routes 500 in demo mode, for every authorised persona.** `admin` and
  `org_executive` clear `requireRole` and then fail in the handler with
  `[invitation] Failed to list invitations: Unauthorized` — that is **Clerk's Backend API**
  rejecting the dummy `CLERK_SECRET_KEY`. `invitation.controller.js` proxies to Clerk to
  create, list and revoke invitations, and there is no Clerk organisation behind the demo, so
  this cannot be made to work without real Clerk credentials. Affects
  `POST /api/user/invite`, `GET /api/user/invitations`, `DELETE /api/user/invite/:invitationId`.
  **Not a security problem — it fails closed**, and `POST /api/user/invite` is therefore
  self-blocking without being on the destructive-routes list. **It is a cosmetic problem** if
  the frontend surfaces invitations on a manage-users page: an `org_executive` persona would
  see an error state. Left unfixed — outside Phase 4's stated scope and it fails safely.
  Add the routes to a frontend-side hide list in Phase 5 if that screen is reachable.
- **The SQL injection was in *two* queries, not one. Fixing only the flagged lines would have
  left the hole open.** The original finding named `ragService.js:214-215` (the vector search).
  But `orgFilter` was interpolated into the **keyword/full-text query** at the old line 255 as
  well, and that query additionally interpolated the user-derived `tsWords`. Both now bind
  every caller-supplied value; `vectorQuery(sql)` gained a `params` argument.
  **Proven closed, not assumed.** With an `admin` persona — which bypasses
  `requireOrgAccess("body")`, so the raw body value reaches the query — and the payload
  `00000000-0000-4000-a000-000000000001') OR 1=1--` (a *valid* uuid plus an injection tail,
  which against the old interpolation produced `... = ANY(ARRAY['<uuid>']) OR 1=1--` and would
  have returned every row of every tenant), Postgres now reports:
  `invalid input syntax for type uuid: "00000000-0000-4000-a000-000000000001') OR 1=1--"`
  — the whole string treated as **one data value**. Both the vector and keyword searches logged
  it, which is the direct evidence that the second query had the identical flaw. 0 rows
  returned. A legitimate two-uuid admin query still returns chunks, so the array binding works.
  *Two false starts worth recording, because both produced a misleading "pass":*
  (1) a payload whose uuid was invalid (`x') OR 1=1--`) errors on the **old** code too, so it
  proves nothing — the payload must be a well-formed uuid; (2) a trivial message like `"test"`
  never reaches retrieval at all, because the intent router short-circuits it — the probe needs
  a real question or the query under test is never executed.
- **`getFullDashboardSummary`'s DB fallback could not key on the resolved period — "nearly
  drop-in" was optimistic.** `resolvePeriod()` (`engine.controller.js:298`) defaults to the
  **current calendar month** (1st → last day), while Phase 3 seeded KPI rows per **quarter**
  (`2026-07-01` → `2026-09-30`). A fallback doing `findUnique` on the
  `org_id_periodStart_periodEnd` composite therefore matches **nothing**, returns no row, and
  leaves the error cards exactly as they were — a silent no-op that looks identical to having
  built no fallback at all. The implemented version tries the exact period first and then falls
  back to the most recent row for the org (`orderBy: { periodStart: "desc" }`).
  Sections that fall back are marked `fromCache: true`; a section with no live result *and* no
  persisted row still returns its original error, so a genuine failure stays visible rather
  than being disguised as empty data.
- **[DECIDED 2026-09-23] The local env file is `.env.development.local`, not `.env.demo.local`.
  There is no `.env.demo.local` any more.** The local demo runs under the default
  `NODE_ENV=development`, so **`npm run dev` works with nothing set** — which is the whole
  point of the change.
  *The reasoning, and the thing that makes it safe:* **no `.env` file ever reaches the
  deployment.** `.dockerignore:14` is `.env*` and Railway supplies its variables directly, so
  the local filename and the deployed `NODE_ENV` are **completely decoupled** — the local file
  is a local concern only. That also means the earlier framing of "one file for dev, one for
  deployment" was never available: both would have been local files.
  *Why nothing breaks:* **no code branches on `development` vs `demo`.** Every environment
  check in the codebase tests `isProduction` (`NODE_ENV === "production"`) — `app.js:96`,
  `lib/prisma.js:15,18`, `config/env.js:40`. Verified by grepping every `NODE_ENV` /
  `isProduction` use outside `node_modules`. So the only hard constraint anywhere is
  **never `production`**, which would force-disable `DISABLE_AUTH`.
  *Verified after the rename:* 34/34 keys parity-checked against `.env`, all eight secrets
  identical, still gitignored, and a bare `node server.js` boots, loads 34 vars from
  `.env.development.local` and 0 from `.env`, with RBAC still enforcing.
  **Two consequences worth keeping in view:**
  - The **two-copies constraint is unchanged** — `.env` is still mandatory and separate,
    because `prisma.config.js`, `app.js:1` and `scripts/ingest-local.js` read plain `.env`
    regardless of `NODE_ENV`. Renaming the sibling file did not reduce the duplication.
  - `/api/health` is public and echoes the environment (`app.js:35`). Locally it now reports
    `"development"`. **On Railway, `NODE_ENV=demo` is still the better value** for exactly that
    reason, and it costs nothing — the deployed app has no env file to match it to.
- **[TRAP] `GUARDRAIL_CONFIDENCE_THRESHOLD` is a *skip* threshold, not a minimum-to-answer —
  and the `.env` comment describing it is wrong.** `.env` says "Minimum confidence score (0–100)
  the guardrail requires before returning an AI answer". It does no such thing: **no answer is
  ever blocked by it.** `chat.controller.js:126` uses it to decide whether to **skip the
  guardrail LLM call** when the pre-confidence heuristic
  (`40 + min(groundedChunks×10, 60) − (intents−1)×15`, line 128) is already at or above it. The
  only confidence-driven behaviour change is at `guardrail.js:114`: below **60**, a transparency
  note is prepended.
  **The direction is counterintuitive and matters for the cost item:** *raising* the threshold
  makes the guardrail run **more** often — more spend, more latency — while *lowering* it skips
  more. Anyone tuning this for cost will move it the wrong way. Observed directly: the
  document question scored pre-confidence 100 (6+ grounded chunks, one intent), skipped the
  guardrail and answered in **8.4s**; the KPI question fell below the threshold of 90, ran the
  extra call, and took **57s**.
  *Also stale: `chat.controller.js:124` says "default 80"; `config/env.js` actually defaults it
  to **90**.*
- **Chat latency is a demo-experience risk, not just a cost one.** 8.4s when the guardrail is
  skipped, **57s when it runs** — on a local machine with a warm connection. A visitor watching
  a spinner for a minute reads the demo as broken. Relevant to Phase 6's Railway deploy (proxy
  timeouts) and worth a visible streaming/progress affordance in Phase 5 — `/api/chat/stream`
  exists and is what the frontend chatbot already uses, so the SSE path likely masks this; the
  57s figure is from the non-streaming `/api/chat` endpoint used for this verification.
  **[CORRECTED in Phase 5] The SSE path does not mask it.** `streamChat`
  (`chat.controller.js:233-240`) awaits the whole `orchestrate()` pipeline, guardrail included,
  *before* the first event, then replays the finished answer through `streamFromBuffer`. The
  visitor sees nothing for the full 8–57s. Accepted by the user as a demo limitation — see
  "Added during Phase 5".
- **[DECIDED 2026-09-23] Swapping embeddings to local Ollama (`nomic-embed-text`) was considered
  and rejected. Keep OpenAI.** Raised as a way to avoid the capped-key blocker. Four reasons,
  all checked against the code rather than assumed:
  - **`OLLAMA_EMBED_MODEL` is read by nothing.** `config/env.js` exports only
    `OPENAI_EMBED_MODEL` (line 57) and has no `OLLAMA_*` key at all — so `config/ollama.js`
    destructures `OLLAMA_API_KEY` from a module that never exports it and
    `getOllamaHeaders()` always returns `{}`. Setting the variable would be a silent no-op.
  - **No code path, and building one rewrites the lockfile.** All three embedding sites
    construct `OpenAIEmbeddings`; `@langchain/ollama` is **not** in `node_modules`. Adding it
    means `npm install` — the lockfile rewrite Phases 2 and 3 both avoided.
  - **It is a one-way DB change.** `nomic-embed-text` is 768-dim against the demo's
    `vector(1536)`, so it needs `ALTER COLUMN ... TYPE vector(768)` plus a re-do of the Phase 3
    `schema.prisma` durable fix. Embeddings from different models are not comparable, so
    switching back later means wiping `document_embeddings` and re-embedding. (The table is at
    0 rows today, so this was the cheapest possible moment to decide — and it was decided.)
    **Still do not use the old 768-dim SQL script** — it `DROP TABLE`s and has no `org_id`.
  - **The decisive one: Railway has no Ollama.** Embedding is not only an ingestion cost —
    `ragService.js:72` embeds the **query on every chat message**. Local ingestion would work;
    the deployed demo would have nothing to call at runtime. Fixing that means a second Railway
    service hosting the model, or a paid remote Ollama proxy (which is what the dead
    `OLLAMA_API_KEY` helper implies the team once used).
  **And it would save almost nothing.** The corpus is ~47 chunks — a fraction of a cent. The
  cost risk is the **chat** model (four `ChatOpenAI` sites, 3–6 calls per message on a public
  endpoint), which is what the rate limits and the hard spend cap address.
  *New fact worth recording: **Ollama v0.17.7 IS installed on this machine** (the earlier
  finding established only that no live code path exists, not that the binary was absent).*
- **`getFullDashboardSummary` error cards reproduced, exactly as the original finding predicts.**
  `GET /summary/summary/:orgId` returns 200 with
  `{"financial":{"error":"No QuickBooks token found for organisation: …"}}` and the same shape
  for the other two sections. Confirms the DB-fallback item is required, and that the failure is
  per-section inside a 200 rather than a non-200 — so the fallback has to inspect each section,
  not catch a rejected request.

### Added during Phase 5 (2026-09-23 → 24)

**Decisions — all made by the user during the phase:**

- **[DECIDED] The persona switcher is a welcome page plus a demo banner, not a topbar
  dropdown.** The dropdown was built first and rejected: too small to notice, no explanation of
  what a persona is, and it read as part of the product rather than the demo. `/welcome`
  (`WelcomePage.tsx`, replacing `LoginPage.tsx`; `/login` now redirects there) explains the
  product, shows the four personas as selectable cards, and takes the passphrase. Inside the app,
  an amber **demo banner** (`demo-banner.tsx`) says "Demo mode · Viewing as …" and links back to
  `/welcome#personas`. The banner also ticks Phase 7's "demo banner" item.
- **[DECIDED] The passphrase stays.** A temporary frontend fallback key used while the dashboard
  was tested was removed once the backend gate went live (see the trap below).
- **[DECIDED] Persona cards show the seeded people** (Dana Thornbury, Marcus Oyelaran, Priya
  Raghunathan, Avery Nakamura) — copied from `prisma/demo-data.js`, because nothing can be fetched
  before the passphrase is entered.
- **[DECIDED] Actions the demo can't perform are disabled, not hidden** — shown with a "Disabled
  in the demo — works in the full app" tooltip (`src/lib/demoLimits.tsx`). Covers org create /
  rename, user edit / deactivate / delete, document delete, invite and revoke. The `/api-test`
  developer page is no longer routed. A safety net in `AuthContext` turns any missed
  `403 { demo: true }` into a friendly toast.
- **[DECIDED] Invitations show a static sample** (five, relative dates, real seeded org ids) and
  the invitation API is never called — it 500s for every persona without Clerk.
- **[DECIDED] The RBAC denial is made visible with locked sidebar items**, but **only for
  refusals the backend enforces** — never for menus the frontend merely hides. Each opens
  `/restricted/:feature`, which makes the real read-only request and quotes the server's 403.
  Org Executive: *Client scorecard*, *Other organisations*. Org Staff: those two plus
  *Invitations*. Admin / Super Admin: none (the backend denies them nothing). Verified against the
  running backend — all five persona/route pairs returned 403, admin control returned 200.
- **[DECIDED] Citation chips and the chat wait are accepted as demo limitations** — not built.
- **[DECIDED] Activity and Reports stay in the menus as-is** (placeholder data / "Coming soon" —
  unfinished team work). The welcome page's "What's different in this demo" note explains them.
- **[DECIDED] Welcome-page copy promises only what works.** A three-line "What's different in this
  demo" note sits above the passphrase box. Credit line: "Dev K Sarthi — Technical Lead". Product
  and persona copy is marked `DRAFT COPY` for the user to edit.

**Findings — things this file didn't anticipate:**

- **`localStorage` isn't reactive.** The plan's `isSignedIn = !!localStorage.getItem(...)` is read
  once, so storing the key wouldn't trigger the profile fetch. `src/lib/demoAuth.tsx` wraps the
  key and persona in a small store read through `useSyncExternalStore`, with a `storage` listener
  so other tabs follow.
- **A rejected stored key caused a redirect loop** between `/` and the login page (`/auth/me` 401
  → redirect to login → login sees a key → back to `/`). Fixed by clearing the key on a 401 from
  `/auth/me`. That is why the contract section now records "401, not 403".
- **[TRAP] A frontend fallback key breaks once the backend gate exists.** A temporary
  `getDemoKey() → "demo"` fallback (used to test before the gate existed) produced a stream of
  401s and a blank page: the fallback also made the frontend believe it was signed in, so the
  passphrase field was hidden and there was no way to recover. **To test without the gate, turn it
  off on the backend — never fake a key on the frontend.**
- **Headers are set in three places, not two.** The contract's two (axios interceptor, chatbot
  `fetch`) plus the passphrase check on `/welcome`, which uses plain axios so a stale stored key
  can't leak into it. All three read `DEMO_ROLE_HEADER` and `getDemoRole()` from `demoAuth.tsx`.
- **A persona switch does a full reload to `/`, not `refreshProfile`.** Pages fetch once on mount,
  so a soft switch leaves the previous persona's data on screen. The reload also means nothing
  from the old persona is in flight (the Phase 4 "in-flight 403" concern) and nobody is stranded
  on a route the new persona can't see. A switch in another tab triggers the same reload.
- **Citation chips existed and were removed.** Added in `9d6901c` (Priya Pandey, 22 Feb), dropped
  by the chatbot rewrite in `bebb3ac` (s-tus, 17 Mar, "quick fix"). `src/services/chatService.ts`
  still parses the `sources` event but nothing imports it; the chatbot's own stream handler reads
  only `chunk` and `guardrail`. The backend still sends `sources`, so restoring chips means
  reviving the rendering from `9d6901c`. The chatbot also ignores the `error` event, and its
  failure text tells visitors to check that "Ollama" is running (`floating-chatbot.tsx:1389`).
- **User edit and status toggle never reached a handler.** The frontend sends
  `PATCH /user/:id` and `PATCH /user/:id/status`; the backend has only `PUT` and `DELETE` on
  `/user/:userId`, so both 404 regardless of the demo gate. Disabled with the rest.
- **WebViewer authentication needed no change.** `DocumentViewerPage.tsx:33` already fetches the
  file through the shared `api` instance as a blob, so it carries both headers.
- **Small gaps in the original integration code, fixed while rewiring:** the cards' "Enabled"
  switch had an empty handler (now opens consent / disconnect), and the icon paths were relative
  and broke on nested routes. The consent route must stay in the same route group as
  `/integrations`, or the layout remounts and the success toast can be lost.
- **New hand-sync points with the backend seed**, alongside `useRoles.ts` and `CATEGORY_ID_MAP`:
  `src/lib/demoPersonas.ts` (names, titles, orgs) and `src/lib/demoSeed.ts` (the two org ids).
- **The banner's "Viewing as" name comes from `/auth/me`**, not the stored persona, so it doubles
  as proof that `X-Demo-Role` reaches the backend.

**Open — for the backend session:** *All three resolved in Phase 6 (2026-09-24) — see "Added
during Phase 6". VTO and labor-config writes are blocked (the VTO editor moves to per-visitor
browser saves); the backend now serves the seeded quarter overlapping the requested range, with
the frontend's clock pin handed to the frontend session; the scorecard excludes the platform org
and — a bigger fix than recorded here — now shows Thornbury's real numbers, which were also null.*

- **VTO writes are not blocked.** `POST|PUT|DELETE /api/vto/:orgId` is allowed for
  `org_executive`, so any visitor using Dana can overwrite or delete the seeded VTO — which feeds
  the chatbot — for everyone after them. The frontend deliberately leaves the VTO editor working.
  `PUT /integrations/labor-config` (switches the active labor source) persists the same way.
- **Every date range shows the same numbers.** The dashboard fallback returns the most recent
  seeded row whatever range is requested, so the date picker shows Q3 2026 for every choice. From
  **1 October 2026** the frontend's "current quarter" is Q4, and the executive landing header will
  label Q3 data as Q4. Options: seed periods that move with the date (fits Phase 6's reseed), or
  pin the frontend's default range to the seeded quarter.
- **The admin scorecard includes the platform org** (Maural Solutions) with `null` scores, which
  will look like a broken row next to Thornbury.

**Frontend loose ends — known, not being fixed now:**

- `@clerk/clerk-react` is still a dependency (removing it rewrites the lockfile);
  `VITE_CLERK_PUBLISHABLE_KEY` in `env.ts` and the `--clerk-color-*` CSS variables are unused.
- The QuickBooks logo on the finance connect prompt is hotlinked from `cdn-assets-us.frontify.com`
  (`FinanceModule.tsx`); `public/assets/integrations/quickbooks.svg` is a local replacement.
- Only finance is gated on a mock connection; leads and labor show regardless. Admin-facing views
  show the org's seeded `*_connected` flags, not the visitor's mock state.
- Org Staff can reach `/summary` by typing the URL (frontend-only restriction; the backend allows
  own-org reads). Pre-existing.
- Components now unreachable but kept, so re-enabling a control is just removing its
  `DemoDisabled` wrapper: `InviteUserModal`, `EditUserModal`, `DeleteUserAlert`,
  `CreateOrganisationModal`; `ApiTestPage` is unrouted.
- A browser that blocks storage can't pass the gate — the passphrase can't be stored.

### Added during Phase 6 (2026-09-24)

**Scope of the backend session:** the code half of Phase 6 only, on `demo`. Nothing is deployed
from this session; Railway and Vercel are dashboard work the user does afterwards. The frontend
has its own session, which does **not** edit this file.

**Decisions — made by the user:**

- **[DECIDED] VTO writes are blocked; the frontend editor saves to the visitor's browser only.**
  `POST|PUT|DELETE /api/vto/:orgId` are on the demo-gate block list and return
  `403 { demo: true }`. The reason that settled it: the VTO is free text that every later visitor
  sees and that `businessDataService` quotes in the chat prompt, so an open write is a
  defacement surface on a link meant for recruiters — worse than a degraded chatbot. The editor
  stays, saving per-visitor in `localStorage` like the mock OAuth (Decision 3); the chatbot never
  sees those edits. Until that frontend pass lands, a save shows the existing `demo: true`
  safety-net toast, so nothing breaks in the meantime.
- **[DECIDED] `PUT /api/integrations/labor-config` is blocked too.** It was guarded only by
  `requireAuth` — a pass-through in demo mode — so any persona, Marcus included, could change
  the org's labor source. Nothing visible depends on it (labor numbers always come from the
  seeded rows), so there was no reason to leave it open.
- **[DECIDED] Document upload (`POST /api/docs`) stays open.** Raised because it is the same
  class of risk as the VTO — an uploaded file is embedded, becomes citable by the chatbot and
  appears in everyone's document list — and kept deliberately: it is there to show the upload
  feature. The reseed path is what cleans it up.
- **[DECIDED] The demo's clock is frozen at 22 Sep 2026; KPI periods do not move with the
  date.** Rolling seeded periods forward was rejected: the six documents, the VTO and the seed's
  own revenue table ("Period to date, 22 Sep") are all written around Q3 2026, and moving the
  numbers would desynchronise them — the inconsistency Phase 3 warned about. The fix is split:
  backend (done, below) and a frontend pin of "now" to 22 Sep 2026 in `currentQuarter()` and the
  two landing-page quarter headers, **handed to the frontend session** — not done here. **It must
  land before anyone sees the deployed demo on or after 1 October 2026**, when the frontend's
  "current quarter" becomes Q4.
- **[DECIDED] Rate limits: 1000 global / 100 chat per 15 min, per IP.** The user wanted room for
  visitors to experiment, so neither goes back to the TODOs' 100 / 20. Reasoning: the global
  limit guards cheap DB reads, and a low value would 429 real visitors (a persona switch is a full
  reload, and one office IP can be several people). A person's chat rate is capped by the
  8–57s response time to well under 100 per window, so the chat limit only ever binds a
  script. **Consequence to keep in view:** a looping script can still spend at roughly 100
  messages × 3–6 `gpt-4o-mini` calls per IP per 15 min (rough estimate, not measured: about
  $0.50–1 per window). The OpenAI spend cap stops the bill, but **hitting it kills the chatbot for
  every visitor until it resets** — so the cap is the real backstop, and it is worth checking
  usage now and then after Phase 7 goes public. The limiter is per IP, so it slows casual
  loops, not IP-rotating abuse. Note a chat request counts against **both** limiters.
- **[DECIDED] The four integration `/disconnect` routes are blocked.**
  `DELETE /api/integrations/{hubspot,quickbooks,monday,clickup}/disconnect` were `requireAuth`-only
  (pass-through), so any persona could call them. **Monday's was a live way to break the demo,
  found while scoping the reseed:** disconnecting it clears the org's `laborSource`, after which
  `labour.service.js:54` *returns* a "not configured" object of nulls instead of throwing — and
  the dashboard fallback only runs on a *failed* live call, so the labor section would go blank
  for every visitor. (Established by reading the code, not by triggering it on the shared DB; the
  equivalent state was produced directly in the reseed test below.) The frontend never calls
  these routes — its connect flow is browser-only (Decision 3). All four verified `403 { demo: true }`.
- **[DECIDED] The reseed restores data only; it never touches documents.** `prisma/reseed.js`
  re-runs `seed.js` and then **reports**, without deleting, (a) rows the seed does not own —
  extra orgs, users, KPI periods, VTOs, integration tokens — and (b) documents: whether all six
  seeded ones are present and searchable, and any visitor uploads. Nothing is pruned: with the
  gate in place nothing should create stray rows, so one appearing is a gate bug to investigate.
  **Visitor uploads therefore accumulate** and stay citable by the chatbot until removed by hand
  (document delete is blocked in the API, so via the Supabase dashboard — the `File` row, its
  `document_embeddings` rows by `metadata->>'file_id'`, and the object in bucket `…0004`).
- **`File.file_name` is stored URL-encoded** (`FY2026%20Strategic%20Plan%20…`) — the same
  encoding as the citation-chip finding in Phase 3. The reseed's first run matched **0 of 6**
  seeded documents against the manifest's plain names and reported all six as visitor uploads.
  Harmless because it only reports; fixed by comparing decoded names. **Anyone who later builds
  upload pruning must decode first and must refuse to delete unless all six seeded documents
  are matched** — a pruner with the raw comparison would have deleted the whole knowledge base,
  which can only be rebuilt locally.
- **[DECIDED] Keep-alive: a Railway cron service running `jobs/keepalive.js`, not a GitHub
  Action.** The user questioned whether it's needed for a demo kept up only a few weeks —
  strictly optional, since a paused project can be restored from the dashboard in minutes, and
  the alternative is opening the demo by hand every 4–5 days. Chosen because "a few weeks" still
  spans two or three ~7-day pause windows, and the moment the link matters most (a reviewer
  clicking days after an application) is exactly when nobody else has touched it. The GitHub
  Action option was rejected: scheduled workflows are disabled after 60 days of repo inactivity,
  a silent failure of exactly the kind the job exists to prevent. Why these details:
  - **`jobs/`, not `scripts/`** — `.dockerignore` excludes `scripts`, so a script there would not
    exist in the image. `jobs/` is excluded by neither `.dockerignore` nor `.gitignore`.
  - **Plain `pg`, not `lib/prisma`** — anything that imports `config/env` exits unless all of the
    API's required variables are set, which would mean copying ~20 variables into the cron
    service. The script needs only `DIRECT_URL` (falls back to `DATABASE_URL`). `pg` and
    `dotenv` are production dependencies, so they survive the Dockerfile's `npm prune`.
  - **A real table read** (`count(*)` on `"Organisation"`), not `select 1`, and it fails if the
    table is empty — so a wiped demo shows up as a failed cron run, not a silent "ok".
  - **Separate from the reseed.** The keep-alive fails silently if it breaks, so it is kept
    trivially simple; the reseed modifies data and should never run as a side effect of it.
- **`seed.js` now exports `main()` and runs only when invoked directly**
  (`require.main === module`), so `reseed.js` reuses it instead of duplicating it. `node -r
  dotenv/config prisma/seed.js` and `prisma db seed` behave exactly as before (re-verified).

**Findings — things this file didn't anticipate:**

- **The admin scorecard was broken for Thornbury too, not only the platform org.** Measured
  before any change: `GET /summary/scorecard` for the Q3 range returned **all-null scores for
  both orgs**. `fetchOrgScorecardData` did its own exact-period `findUnique` and never used the
  Phase 4 fallback, so it missed every seeded row. The runbook's pointer to
  `buildEmptyScorecard()` (`engine.controller.js:630`) was a red herring: `fetchOrgScorecardData`
  swallows its own failures, so the `rejected` branch that calls it cannot run; the nulls came
  from `buildOrgScore` receiving nothing.
- **Exact-period matching could never hit a seeded row, so Q2 was unreachable.** Seeded rows end
  at `2026-09-30T23:59:59Z`; the date picker sends `2026-09-30`, which parses to midnight.
  Every range therefore fell through to "most recent row" — including a request for Q2, which is
  seeded but was never shown. The shared lookup (`findPersistedKpi`) now tries exact → **most
  recent row overlapping the range** → most recent row overall. Overlap matching also absorbs
  the frontend's `toISOString()` off-by-one for visitors east of UTC (a Q3 range starting
  `2026-06-30` still resolves to Q3).
- **Once the scorecard received real data, two of its formulas turned out to be wrong** — they had
  never been exercised against real numbers:
  - `ebitdaPct` divided EBITDA by `netIncome` (profit), reporting Thornbury's 5.2% margin as
    **269%**. Now EBITDA / total revenue — matches the seeded `ebitdaMargin` exactly (5.2 / 9.7).
  - `pipelineCoverageRatio` divided `pipelineCoverage` by revenue again, rounding to **0**. The
    schema defines `pipelineCoverage` as the ratio ("proposed work / revenue goal") and the
    dashboard and chatbot both display it as `1.72x`; it is now passed through. **Left as-is:**
    `totalPipelineValue` still carries that ratio under a dollar-sounding name — the frontend
    never reads it. And `leads.service.js:470` (live HubSpot path, dead in the demo) writes a
    dollar pipeline value into `pipelineCoverage`, contradicting the schema; not touched.
- **The platform org is excluded by `is_platform`, not by "has no data".** Filtering on
  `is_platform: false` is correct outside the demo too — it is a *client* scorecard — whereas
  dropping orgs with no KPI rows would hide a newly onboarded client in production.
- **VTO writes as `org_staff` now get the demo 403, not the role 403.** The demo gate runs before
  `requireRole`, so the Phase 4 table's `DELETE /vto/:orgId → 403` for `org_staff` now carries
  `demo: true`. Harmless: none of the locked-sidebar probes use a VTO route.

**Verified locally against the demo DB (2026-09-24):** scorecard Q3 → Thornbury only, EBITDA
5.2%, coverage 1.72x, utilization 66.4; Q2 → 9.7%, 1.94x, 71.2; `org_executive` still 403.
Dashboard Q3 → Q3 rows, Q2 → Q2 rows (`dso` 61 vs 68), Q4 → Q3 rows carrying their own
`periodStart`/`periodEnd`. VTO `POST|PUT|DELETE` as `org_executive`, `org_staff` and `admin` →
all nine `403 { demo: true }`, VTO `updatedAt` unchanged afterwards; `PUT /integrations/labor-config`
→ `403 { demo: true }`, status still `monday`; `POST /api/docs` still reaches its controller.

---

## Phase 0 — Prep

One item. The WebViewer license test used to live here but **moved to Phase 5** — testing it
requires opening a document, which needs a running backend, a live database and a seeded file.
None of those exist until Phases 2–4 are done. The old Supabase project is inactive and the
old hosted backend is down, so the test is simply not runnable yet.

- [x] **Commit the frontend lockfile.** *Done: `0553ea3` on `proper`, local only. Checked
      first with `npm ci` (lockfile in sync, 1035 packages) and `npm run build` (passes).* `../maural-kms/.gitignore` ignores
      `package-lock.json`. Not a build blocker on the chosen Vercel-from-GitHub path — Vercel
      uses `npm ci` when a lockfile exists and `npm install` when it doesn't, so the build
      succeeds either way. Do it for **reproducibility**: every dependency sits on a `^` range,
      so without a lockfile a rebuild months from now resolves fresh minors and can break an
      unattended demo. (It *would* be a hard blocker if the frontend Dockerfile were ever used —
      `npm ci` fails outright without one.)
      ```bash
      # in ../maural-kms — delete the 'package-lock.json' line from .gitignore, then:
      git add -f package-lock.json
      git commit -m "chore: track lockfile for reproducible builds"
      ```

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
- [x] **[BLOCKER] Confirm what's in the API history.** Eight files were committed under
      `uploads/` — three more than are on disk: `Analysis.pdf`, `CR Decision map - Process.pptx.pdf`,
      `JGA-A-Strategic-Plan-for-Growth-and-Operational-Excellence.pdf`, `Project Status Report.docx`,
      `Project data.xlsx`, `Relational AI.docx`, `Who- A method for Hiring.pdf`, `sample3.docx`.
      Client and third-party material — must not reach a public repo.
      *Confirmed: exactly those eight, 8.7 MB packed of a 13 MB repo. Now stripped.*
      ```bash
      git log --all --diff-filter=A --name-only --format="" -- "uploads/*" | sort -u
      ```
- [x] **Scan both histories for secrets.** *Frontend: done, clean. **API: done — NOT clean.***
      The prediction that only `.env.example` was ever committed was wrong for the API: an old
      `Readme.md` (blob `133ab87`, commits `543b5fe` and `cfae7f3`, both ancestors of `dev`)
      carried the real Supabase project ref, the real anon JWT, **and the database password in
      plaintext**. All three are now redacted from history. Full detail and the follow-up action
      in "Added during API Phase 1". Everything else in API history is placeholders.
      **The command below is not sufficient — it misses content introduced by merge commits.**
      Use the per-blob scan instead:
      ```bash
      # INSUFFICIENT (skips merge-commit diffs) — kept only to show what was originally planned:
      #   git log -p --all | grep -nE "sk-[A-Za-z0-9_-]{20,}|service_role|eyJhbGciOiJIUzI1NiI"

      # Exhaustive: scan every blob in the object database, path attached.
      git rev-list --all | while read c; do git ls-tree -r "$c"; done \
        | awk '{sha=$3; $1="";$2="";$3=""; sub(/^ +/,""); print sha"\t"$0}' | sort -u > pairs.txt
      while IFS=$'\t' read -r sha path; do
        git cat-file -p "$sha" 2>/dev/null | grep -noniE \
          "sk-proj-[A-Za-z0-9_-]{20,}|sk_(live|test)_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----" \
          | sed "s|^|$path\t|"
      done < pairs.txt
      ```
- [x] **History strategy decided: filter and keep.** Development history carries portfolio
      value, and the team repo retains the unfiltered original. The client documents are
      stripped locally before the first push and never reach a public repo.
- [x] **Install git-filter-repo:** `pip install git-filter-repo`. *Done — v2.47.0. The pip
      install put it on PATH as a working `git filter-repo` subcommand, so the
      download-the-standalone-script fallback was not needed. `python -m git_filter_repo` also
      works if PATH ever breaks. API only; the frontend needs no filter pass (see Findings).*
- [x] **Disconnect from the team remote.** Do this first, so no later command can push there.
      *Done in both repos (user ran it by hand). API `git remote -v` is empty. Frontend
      `origin` has since been re-pointed at `maural-demo-frontend`.*
      ```bash
      git remote remove origin
      git remote -v          # expect empty
      ```
- [x] **Promote the working branch to `main`.** *Frontend: done with
      `git branch -M proper main`, a single rename that overwrites the old `main` (`acf821f`).
      Only `main` remains. **API: done.** The dev tip was `3c7740c`, not `65f5d7b` as this file
      previously said — two runbook doc commits had landed since. All 12 API branches were
      verified ancestors of `dev` (`rev-list --all` = `rev-list dev` = 181), so the deletions
      were lossless. Kept **both `main` and `dev`** at the same commit and deleted the other 10;
      only `main` and `demo` get pushed.*
      ```bash
      # API, from dev — verify ancestry FIRST, then promote:
      for b in $(git for-each-ref --format='%(refname:short)' refs/heads/); do
        git merge-base --is-ancestor "$b" dev && echo "safe: $b" || echo "AHEAD: $b"
      done
      git checkout dev && git branch -f main dev && git checkout main
      git for-each-ref --format='%(refname:short)' refs/heads/ \
        | grep -vxE 'main|dev' | xargs -r -n1 git branch -D
      ```
- [x] **Strip `uploads/` from history.** *Done — combined with the credential redaction in a
      single pass, because a second rewrite would mean a second force-push window.* `--force`
      is required because this is an existing working copy rather than a fresh clone.
      **Dry-run first** — it writes both streams without touching the repo, so the filtering can
      be proven before committing to it.
      ```bash
      # replacements.txt (outside the repo), one literal rule per line:
      #   <full anon JWT>==>[REDACTED_SUPABASE_ANON_KEY]
      #   Ecosphere8_...==>[REDACTED_DB_PASSWORD]
      #   anwurvszektveevdiacu==>[REDACTED_PROJECT_REF]
      git filter-repo --path uploads --invert-paths --replace-text ../replacements.txt --force --dry-run
      # compare .git/filter-repo/fast-export.original vs .filtered, then rerun without --dry-run
      ```
- [x] **Verify the strip.** *Done, all green:* the confirm command prints nothing; no `uploads`
      path anywhere in history; **181 commits in, 181 out** with author, email, date and subject
      byte-identical to the pre-rewrite mirror; `DEMO_RUNBOOK.md` still tracked; the HEAD tree
      differs from the original by exactly the 5 `uploads/` files and nothing else; and a
      re-scan of all 673 remaining blobs finds none of the three credential strings.
      **Then delete `.git/filter-repo/fast-export.original`** — it survives the rewrite and
      still contains the stripped documents and the unredacted password (see Findings).

> **On `public/lib/webviewer` (172 MB, 677 files):** whether it gets stripped depends on the
> WebViewer license test, which can't run until Phase 5. Migrate with it intact for now. If the
> viewer is later dropped, do a second `filter-repo` pass then — cheap, because the new repo is
> private, has only you as a collaborator, and nobody else has cloned it, so a force-push is
> safe. Don't block the migration on a decision you can't make yet.

- [x] **Create the new blank private repos.** Start private; flip to public in Phase 7.
      *Done by hand on github.com: `maural-demo-backend` and `maural-demo-frontend`. `gh` is
      not installed and isn't needed. The originally planned names were unusable: `maural-kms-api`
      is the frozen team repo on the same account.*
- [x] **Point at the new remotes and push.**
      - Frontend: **done.** `main` pushed to `maural-demo-frontend` (~119 MB packed; largest
        blob is 8.9 MB, under GitHub's 100 MB per-file limit).
      - API: **done.** `origin` is `https://github.com/DevKS-07/maural-demo-backend.git`, added
        only after the strip and the secret scan were both verified clean, and asserted against
        the three forbidden repo names before the push ran. `main` pushed, then `demo` cut from
        it and pushed. Repo is ~3.9 MB after the strip, down from 20 MB.
      ```bash
      # API — read the URL back before pushing. It must be maural-demo-backend, NOT
      # maural-kms-api (frozen team repo) and NOT either frontend repo.
      git remote add origin https://github.com/DevKS-07/maural-demo-backend.git
      git remote -v
      GIT_TERMINAL_PROMPT=0 git ls-remote origin     # expect no output on a blank repo
      git push -u origin main
      ```
- [x] **Cut a `demo` branch in each repo.** `main` stays the real project; every demo change
      lands on `demo`. Deployment tracks `demo`. *Frontend: done, `demo` pushed and tracking
      `origin/demo`. **API: done** — `demo` cut from `main`, pushed, tracking `origin/demo`, and
      the working copy is checked out on it ready for Phase 4.*
      ```bash
      git checkout -b demo && git push -u origin demo
      ```
- [ ] **Confirm the wiring.** `git remote -v` shows only the new repo in both working copies,
      and Settings → Collaborators on both new repos lists only you. *Frontend: `git remote -v`
      verified. `git ls-remote` shows only `main` + `demo` at `0553ea3`, and no local-only
      commits. **API: git side verified** — `git remote -v` asserted as `maural-demo-backend`,
      and `git ls-remote` shows only `main` + `demo`, both at the same commit, with zero
      unpushed commits on either. (Local `dev` sits at that commit but is never pushed.)*
      **Still open on both repos: the private + Collaborators check on github.com, by hand.**
- [x] **Salvage the architecture diagrams.** *(API repo.)* **Done in commit `8398a65`.** All ten
      standalone SVGs copied from the gitignored `docs-assets/presentation/` into a tracked
      `docs/diagrams/`, with a `README.md` index splitting them into seven technical diagrams
      (architecture, oauth-flow, rbac-hierarchy, kpi-flow, integration-cards,
      third-party-security, compliance-overview) and three presentation slides
      (problem-statement, challenges, stats-panel). All are self-contained — no external fonts,
      images or scripts — so they render in GitHub Markdown directly.
      **Two cautions recorded in that index for Phase 7:** several diagrams document the
      *production* auth and integration paths that the demo replaces with shims, so label them
      as production architecture when embedding; and the sibling `docs-assets/docs/` folder
      (*not* `presentation/`) contains real client identifiers — do not commit it wholesale.

---

## Phase 2 — Demo Supabase project

- [x] **Create the project**, collect `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`,
      `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. *Done by the user: ref
      `jnmhzhjvizkrbvgdhyms`, `aws-0-us-east-2` pooler, Postgres 17.6. All five values are in
      `.env`; both anon and service-role JWTs decode to the new ref with the right roles.
      `DATABASE_URL` = transaction pooler :6543 `?pgbouncer=true`; `DIRECT_URL` = session
      pooler :5432.*
- [x] **Decide how to survive free-tier pausing.** Free projects pause after roughly a week
      idle — which is the normal state of a portfolio demo, and almost certainly what killed
      the original project. Either budget for a paid plan or commit to a keep-alive (Phase 6).
      Deciding now avoids discovering it when someone reports the demo is down.
      → *Decision (2026-09-22):* **Free tier + a scheduled keep-alive job, built in Phase 6.**
      No paid plan. The job must run a **real database query** — `/api/health` (`app.js:24`)
      returns only uptime and memory and never touches the DB, so neither it nor Railway's
      healthcheck keeps the project awake. Details are on the Phase 6 keep-alive item.
- [x] **[BLOCKER] Point both database URLs at the new project.** `prisma.config.js` resolves
      from `DIRECT_URL`, loaded out of plain **`.env`** via `dotenv/config` — not
      `.env.development.local`, and not the other four stale `.env.*.local` files still on disk. Print
      the host from `DIRECT_URL` and confirm it's the new project *before* pushing; a stale
      exported shell variable also beats the file.
      *Done. The trap was live — `.env` still pointed at the old project when Phase 2 started
      (see Findings). After the user fixed it: `DIRECT_URL`/`DATABASE_URL` resolve to
      `postgres.jnmhzhjvizkrbvgdhyms@aws-0-us-east-2`, no `DIRECT_URL`/`DATABASE_URL`/`NODE_ENV`
      at Process, User or Machine scope, and the only `.env*` files left are `.env` and
      `.env.example`. Every DB write went through a script that aborts unless the `DIRECT_URL`
      user ends in `.jnmhzhjvizkrbvgdhyms`.*
- [x] **Push the schema:** `npx prisma db push` (not `migrate dev` — no migrations exist).
      *Done — 17 tables in `public`; Prisma reported `aws-0-us-east-2.pooler.supabase.com:5432`.
      Needs `npm ci` first if `node_modules` is missing, and the `vector` extension first (below).*
- [x] **pgvector setup — NOT the SQL this file originally had.** The two intended omissions
      stand: no `match_documents` (ragService uses raw SQL on its own pool) and **no IVFFlat
      index** (on a demo-sized corpus a sequential scan is exact and fast, and it sidesteps the
      recall problem `SET ivfflat.probes = 100` works around). But `document_embeddings` is a
      Prisma model, so `db push` creates the table — with an untyped `vector` column and a
      B-tree index that rejects every real embedding (see "Added during Phase 2"). The original
      `CREATE TABLE IF NOT EXISTS` would silently no-op. **What was actually run, in order:**
      ```sql
      -- 1. BEFORE db push — Prisma's schema references the vector type
      CREATE EXTENSION IF NOT EXISTS vector;          -- landed in public, v0.8.2
      ```
      ```bash
      # 2.
      npx prisma db push
      ```
      ```sql
      -- 3. AFTER db push, one transaction. Not needed once the schema.prisma fix lands
      --    (see the [TRAP] finding). Until then, don't db push again — use migrate diff +
      --    db execute as described there.
      BEGIN;
      DROP INDEX IF EXISTS document_embeddings_embedding_idx;            -- Prisma's B-tree on the vector
      ALTER TABLE document_embeddings ALTER COLUMN embedding TYPE vector(1536);
      GRANT ALL ON TABLE document_embeddings TO service_role;
      GRANT ALL ON SEQUENCE document_embeddings_id_seq TO service_role;
      ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;         -- already on by default; kept explicit
      COMMIT;
      -- No org_id index here: Prisma already made document_embeddings_org_id_idx.
      -- NO `DISABLE ROW LEVEL SECURITY` — the original SQL had it; it was applied, then
      -- reversed (see "Added during Phase 2"). No table in this project has RLS off.
      ```
- [x] **Verify** the `vector` extension is installed and `document_embeddings` exists with a
      1536-dimension column before spending money on embeddings.
      *Done, all green: `vector` 0.8.2 installed; `embedding` is `vector(1536)`; indexes are
      exactly `document_embeddings_pkey` + `document_embeddings_org_id_idx`; FK to
      `"Organisation"(org_id)` ON DELETE CASCADE; **RLS on** (all 17 tables, zero policies);
      `service_role` has table and sequence privileges; no `match_documents` function.
      **Functional proof:** a random 1536-dim row inserted and came back from a `<=>` cosine
      search with similarity 1, inside a transaction that was rolled back — table left at 0 rows.
      The same probe **failed before** the fix with the B-tree row-size error, so it's the check
      to repeat after any future `db push`. **RLS proof:** service-role insert/delete via
      `supabase-js` works; the anon key is rejected on insert and sees/deletes 0 rows.*

---

## Phase 3 — Seed the demo tenant (`demo` branch)

Seeded data is now the only source of KPI truth. This is what a reviewer actually reads.
**All Phase 3 commits land on `demo`** (decided 2026-09-22 — see Findings).

> **Ordering dependency.** The document-upload step below calls `POST /api/docs`, which needs
> **two Phase 4 items done first**:
>
> 1. **The `req.auth` stub.** `createDocument` (`docs.controller.js:169`) runs its own inline
>    org check; with Clerk mounted but no session it resolves no user and returns 403, so
>    uploads fail before anything is ingested.
> 2. **`.env.development.local`.** Uploading means running the server locally, and `server.js` exits
>    without an `.env.<NODE_ENV>.local` — the `.env` load in `app.js` comes too late (see
>    "Added during Phase 2"). A bare `npm run dev` picks that file up, since `NODE_ENV`
>    defaults to `development`.
>
> Everything else in Phase 3 is independent and can be done first.

**Prerequisites — do these first, in order** (all established during Phase 2):

- [x] **Commit the `schema.prisma` fix as the first Phase 3 commit.** In `document_embeddings`
      (`prisma/schema.prisma:182`): `Unsupported("vector")` → `Unsupported("vector(1536)")`,
      and delete `@@index([embedding])`. Already verified against a patched copy — see the
      "durable fix" finding. Confirm on the real file that the live DB needs nothing:
      ```bash
      npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --exit-code
      # expect exit 0 and "-- This is an empty migration."
      ```
      Then mark the `[TRAP]` finding resolved — plain `db push` is safe again after this.
      *Done. `DIRECT_URL` confirmed as `postgres.jnmhzhjvizkrbvgdhyms@aws-0-us-east-2` with no
      shell override first; the diff returned exit 0 and `-- This is an empty migration.`
      `[TRAP]` marked resolved. A comment now sits where `@@index([embedding])` was, explaining
      why there is no index there, since `prisma db pull` is what introduced it originally.*
- [x] **`npx prisma generate`.** Prisma 7's `db push` did not generate the client, and
      `seed.js` needs it. *Done — client v7.5.0, matching the lockfile. The CLI advertises
      8.0.0-rc; **don't take it**, it would rewrite the lockfile.*
- [x] **[BLOCKER] Put a real OpenAI key with a hard spend cap in `.env`** — the dedicated
      demo key from Phase 6, created now instead. Ingestion embeds every chunk and retrieval
      verification runs the chat pipeline, so Phase 3 spends money first. `.env` previously
      held the placeholder `sk-proj-xxx…`, which is **non-empty, so it passes
      `config/openai.js`'s startup check** and only fails at OpenAI with a 401 — during
      ingestion that failure is only logged (see the upload item).
      *Done 2026-09-23 (user supplied the capped key). **The two-copies constraint was violated
      in transit and caught by a parity check** — the key had been put in `.env.development.local`
      only, leaving `.env` on the placeholder. That split is worse than it looks: the running
      server reads `.env.development.local` (real key, works), while `prisma.config.js`, `app.js:1`
      and **`scripts/ingest-local.js` read plain `.env`** — so a local ingest run would have
      401'd silently. Now identical in both files, verified by comparing the lines directly.
      **Check parity, don't assume it.***
- [x] **Run the seed as `node -r dotenv/config prisma/seed.js`** — not bare `node
      prisma/seed.js`. `seed.js` loads no env file itself, and its `lib/prisma` →
      `config/env` import hard-exits on missing vars. `-r dotenv/config` loads `.env` (the
      demo values) first. (`npx prisma db seed` probably works too, via `prisma.config.js`'s
      own dotenv load, but that path is unverified — use the explicit form.)

**Seeding and content:**

- [x] **Write a one-page brief for the fictional company** — name, industry, size, revenue
      shape, the problems it has. Everything downstream should agree with it; inconsistencies
      are what a sharp reviewer notices.
      *Done and approved 2026-09-23: `demo-content/COMPANY_BRIEF.md`. **Thornbury Energy Group** —
      commercial building energy retrofit and commissioning, founder-led, 68 staff, $24.8M FY2025,
      running EOS. Deliberately **behind plan**: a demo where every number is green gives the
      chatbot nothing to explain. Each of its five problems maps to a dashboard KPI, so the
      chatbot can tie a number to a narrative. The seeded half of the brief lives in
      `prisma/demo-data.js`.*
- [x] **Seed the platform org and the demo org.** `prisma/seed.js` already creates the platform
      org and its storage bucket — extend it rather than writing a second script.
      **Restructure it to be idempotent first:** it currently `return`s early as soon as a
      platform org exists, so anything appended after that check silently never runs on a
      second invocation — and the Phase 6 reseed path depends on re-running it. Use upserts
      keyed on stable values (clerk ids, org names, fixed ids) instead of the early exit.
      ***Both orgs are seeded.*** *The early return is gone and every write is an upsert on a
      fixed id, proven by running the seed repeatedly to identical row counts.
      **Maural Solutions** (platform, `…0001` / bucket `…0002`) and **Thornbury Energy Group**
      (demo tenant, `…0003` / bucket `…0004`) are both created by `seedOrg` in `main()`, with
      pinned uuids rather than generated ones so a reseed converges instead of creating a second
      org and the bucket names never drift. `storage_bucket` is written on create but never on
      update — changing it would orphan every file already uploaded to the old bucket. The four
      persona users, both KPI periods and the VTO all hang off the Thornbury org.*
- [x] **[BLOCKER] Seed the four `Role` rows with fixed ids** — nothing creates them, and on the
      fresh DB the table is empty. The labels must match `config/roles.js` exactly, and the
      ids must match the frontend's hard-coded list in `../maural-kms/src/hooks/useRoles.ts`:
      `1 = "Super Admin"`, `2 = "Admin"`, `3 = "Org Executive"`, `4 = "Org Staff"`.
      `auth.controller.js` looks roles up by `role_name`, so a label typo fails silently.
      **`Permission` / `RolePermission` need no rows** — the frontend's `hasPermission` is
      defined but never called. **[CONFIRMED + DECIDED 2026-09-23: leave both tables empty.]**
      Verified across both repos: `hasPermission` (`AuthContext.tsx:138`) has **zero call sites**;
      the only backend references are `include` clauses at `auth.controller.js:176` and
      `user.controller.js:126`, plus `user.controller.js:136` which returns the mapped list from a
      permissions endpoint. With no rows those return `[]` and a 200 — **empty is safe, not merely
      unused**: the optional chain short-circuits and Prisma's `include` always yields an array,
      so there is no crash path, and `useRoles.ts` already hard-codes `RolePermission: []` itself.
      Access control runs entirely off `publicMetadata.role` (backend `requireRole`) and
      `Role.role_name` (frontend guards, e.g. `IntegrationsPage.tsx:5`). Old SQL for these tables
      exists but was deliberately not used — seeding data nothing consumes would add reseed
      surface and imply permissions matter here, when the team gated on role names instead.
      *Done, and both id maps were **re-verified against the frontend source** rather than taken
      on trust: `useRoles.ts:6-9` and `CATEGORY_ID_MAP` match this file exactly. `seed.js` also
      now cross-checks its four labels against `config/roles.js` and throws on drift, so the
      silent-lookup-failure mode is converted into a loud one.*
- [x] **[BLOCKER] Seed the five `Category` rows with fixed ids** — `File.ctg_id` is a foreign
      key to `Category`, and the uploader sends ids straight from `CATEGORY_ID_MAP` in
      `../maural-kms/src/components/DocumentsToolbar.tsx`: `1 = Sales`, `2 = Marketing`,
      `3 = Finance`, `4 = Legal`, `5 = Technical`. ("Uncategorized" is a null `ctg_id`, no
      row.) On an empty table, any upload with a category fails on the FK.
- [x] **After inserting explicit ids, advance the sequences**, or the next auto-generated id
      collides with a seeded one. *Done inside `seed.js` (an `advanceSequence` helper), not as a
      one-off by hand — so the reseed path carries it too. Verified: both sequences read
      `last_value = 4` / `5` with `is_called = true`, so the next generated ids are 5 and 6.
      Re-running with the same max is harmless. Note the `User` table needs no equivalent —
      persona users key on `clerk_id` and let `user_id` auto-generate.*
      ```sql
      SELECT setval(pg_get_serial_sequence('"Role"', 'role_id'),     (SELECT max(role_id) FROM "Role"));
      SELECT setval(pg_get_serial_sequence('"Category"', 'ctg_id'), (SELECT max(ctg_id)  FROM "Category"));
      ```
- [x] **[BLOCKER] Seed four persona users**, one per role, with stable clerk ids:
      `demo_super_admin`, `demo_admin`, `demo_org_executive`, `demo_org_staff`. The Phase 5
      switcher resolves to these, so the ids must match what the backend stub expects.
      Put `super_admin` and `admin` in the **platform** org and `org_executive` / `org_staff`
      in the **demo** org — that mirrors how `auth.controller.js:62` provisions admins, and
      admins bypass the org check anyway (`docs.controller.js:172`).
      *Done. Avery Nakamura (Super Admin) and Priya Raghunathan (Admin) in Maural Solutions;
      Dana Thornbury (Org Executive, the founder) and Marcus Oyelaran (Org Staff) in Thornbury.
      Org chart wired in a second pass, since `reports_to` references the autogenerated
      `user_id`. Dana is the executive persona deliberately — the founder-dependency story only
      lands if the default persona is the founder reading their own numbers.*
- [x] **Align both role systems per user** — `publicMetadata.role` key *and* DB `Role.role_name`
      label. See Findings. *Done, and now enforced from both ends: `prisma/seed.js` throws if its
      labels drift from `config/roles.js`, and `middleware/demoAuth.middleware.js` throws at
      startup if a persona has no mapped clerk id.*
- [x] **Author five or six demo documents** — strategy deck, financial summary, meeting notes,
      hiring plan, quarterly review. This is the chat's entire knowledge base.
      **Formats ingestion can read** (`ingest.controller.js:129-159`): `pdf`, `docx`,
      `xlsx`/`xls`, `txt`/`md`/`csv`/`json`, and images via OCR. **Not `pptx`** — export the
      strategy deck as PDF. Prefer text-based PDFs/DOCX over scanned ones; OCR is slower and
      noisier.
      *Done — six, covering PDF, DOCX and XLSX, and every `Category` id plus the null case.
      **Sources are tracked HTML in `demo-content/documents/`; the binaries are built into
      `uploads/` and are gitignored**, so the repo stays small and the documents are reproducible.
      Build with `demo-content/build-documents.ps1`. `demo-content/upload-manifest.json` maps each
      file to its `ctg_id` and carries the two retrieval checks, so the deferred upload step is
      turnkey.*
      **Verified without spending anything:** all six were extracted with the exact libraries
      ingestion uses (`pdf-parse`, `mammoth`, `xlsx`) — all six return well over the 50-character
      threshold, so **no OCR path is triggered**, and a spot-check confirmed the specific figures
      each document is supposed to carry survived conversion. **Total corpus ≈ 47 chunks**, so the
      embedding spend for a full ingestion is a fraction of a cent.
      | Document | Format | Category |
      | --- | --- | --- |
      | FY2026 Strategic Plan — Recurring Revenue Transition | PDF | Sales (1) |
      | Q2 2026 Quarterly Business Review | DOCX | Finance (3) |
      | FY2026 Financial Summary & KPI Detail | XLSX | Finance (3) |
      | MBCx Delivery Standard v3 | PDF | Technical (5) |
      | Client Master Services Agreement — Template | DOCX | Legal (4) |
      | Leadership Team Meeting Notes — 8 Sep 2026 | DOCX | *null* |
> **[DEFERRED 2026-09-23 — user decision] Upload, ingestion and retrieval verification move out
> of Phase 3.** The three unticked items below (upload + chunk-count check, and end-to-end
> retrieval) are deferred to a later phase. Rationale given: most of this path works in the
> production app, so it is expected to work here too.
>
> **Two things to carry forward, because they are the reasons this is the riskiest thing to
> defer, not the safest:**
> 1. **"It works in production" has already been falsified twice on this project.** The
>    production database never built `document_embeddings` from empty — that is the entire Phase 2
>    B-tree finding — and RLS is now ON where production had it off, which creates a `42501`
>    ingestion failure mode production never had. The demo path is genuinely not the production
>    path here.
> 2. **Every failure in this specific step is silent.** `createDocument` fires
>    `ingestSingleFile` without awaiting it, so a 201 is returned regardless. The `LEFT JOIN`
>    chunk-count query is not optional polish — it is the only check that distinguishes success
>    from failure.
>
> **Scheduling constraint: this block must complete before Phase 5's WebViewer test**, which
> needs a seeded document to open. It is not deferrable to Phase 6 without also moving that test.
>
> The documents themselves are still authored in Phase 3, so the deferred work is only "upload
> and verify", not "write the content".

- [x] **Upload through `POST /api/docs`**, not by hand — it auto-ingests via `ingestSingleFile`,
      doing File row + storage + extract + chunk + embed in one step.
      **A 201 does not mean it ingested.** `createDocument` fires `ingestSingleFile` without
      awaiting it (`docs.controller.js:258`), so the response returns before embedding runs,
      and failures — bad OpenAI key, `42501` from a missing service-role key, unreadable
      file — appear only in the server log as `[ingest] ✗ "<file name>": …` (success is
      `[ingest] ✓ "<file name>" — N chunks ingested.`). Watch the log, then confirm every
      uploaded file has chunks — the `LEFT JOIN` makes a failed file show up as `0` rather
      than silently vanish (chunks carry `metadata.file_id`, `ingest.controller.js:227-233`):
      ```sql
      SELECT f.file_name, count(e.id) AS chunks
      FROM "File" f
      LEFT JOIN document_embeddings e ON e.metadata->>'file_id' = f.file_id::text
      GROUP BY f.file_name ORDER BY chunks;
      ```
      *Done 2026-09-23, run **before** the demo-password middleware was added, so no
      `Authorization` header was needed. All six uploaded as `org_executive` (Dana, `user_id` 3)
      to the Thornbury org per `demo-content/upload-manifest.json`; all six returned 201 **and**
      all six logged `[ingest] ✓`. The LEFT JOIN check is the one that counts:*

      | chunks | ctg | file |
      | --- | --- | --- |
      | 10 | 1 | FY2026 Strategic Plan - Recurring Revenue Transition.pdf |
      | 10 | 4 | Client Master Services Agreement - Template.docx |
      | 8 | 5 | MBCx Delivery Standard v3.pdf |
      | 7 | 3 | Q2 2026 Quarterly Business Review.docx |
      | 7 | *null* | Leadership Team Meeting Notes - 8 Sep 2026.docx |
      | 5 | 3 | FY2026 Financial Summary and KPI Detail.xlsx |
      | **47** | | **TOTAL across 6 files — zero files with 0 chunks** |

      *Three independent cross-checks alongside it, so a join bug could not mask a failure:
      `document_embeddings` holds exactly 47 rows; **0 orphaned chunks** (no chunk whose
      `metadata.file_id` has no `File`); **1 distinct `org_id`**, confirming tenant isolation;
      and `vector_dims` is **1536** on every row. 47 matches the manifest's estimate exactly.*
- [x] **Seed the KPI tables completely** — full rows in `finance_kpis`, `leads_kpis`,
      `labor_kpis` for the current period. Seed *every* field, not just the five the live
      persist path writes.
      *Done — every field populated, across **two** periods rather than one: Q3 2026
      (period-to-date, the current period) and Q2 2026 (prior closed quarter) so the dashboard
      shows a comparison and the decline is visible. Upserted on the `(org_id, periodStart,
      periodEnd)` composite. **Arithmetic verified against the seeded rows, not just asserted:**
      gross profit = income − COGS, all four margin percentages, working capital, runway,
      recurring + one-time = total income, revenue segments summing to total income, conversion
      rate, and revenue per billable FTE — all reconcile on both periods.*
      **[TRAP — cost a debugging cycle] `asOfDate` exists only on `FinanceKpi`.** `LeadsKpi` and
      `LaborKpi` do not have it, so a shared period constant spread into all three fails with
      `Unknown argument 'asOfDate'`. Keep the period bounds shared and `asOfDate` finance-only.
- [x] **Seed the VTO** — `businessDataService` injects it into the chat prompt; cheap depth.
      *Done — full EOS VTO for FY2026: four core values, mission, vision, four ten-year targets,
      target market, proven process ("Baseline → Retrofit → Verify → Monitor"), differentiators,
      guarantee, and a three-year picture dated Dec 31 2028 whose measurables are the same KPIs
      the dashboard shows.*
- [x] **Verify retrieval end to end.** Ask something only a seeded document can answer, and
      something only a seeded KPI can answer. Check citation chips list both.
      *Done 2026-09-23 — both `retrieval_checks` from the manifest, via `POST /api/chat` as
      `org_executive`. **Both passed.***
      - *Multi-hop, documents-only ("Why did Thornbury miss its Q3 utilization target?"):
        returned the intended synthesis — Q2's audit-backfill rule, triggered twice in Q3 and
        executed zero times because audit scoping needed founder sign-off while the founder was
        on the Cascadia rebid. **Neither document contains that answer alone**, so this is real
        multi-hop retrieval, not a lucky single-chunk hit. Cited both expected documents.
        8.4s, guardrail confidence 100.*
      - *KPI-only ("current DSO vs target?"): **68.0 days against the 45-day target**, drawn
        from the seeded KPI rows and the VTO — matching the expected shape. 57s, confidence 85.*
      - *Citation chips carry a `type` discriminator — `Knowledge Base` / `KPI Data` / `VTO` —
        so both halves are visibly cited, which is what this check was for. Note the chip
        `title` is the **URL-encoded** file name (`Q2%202026%20...docx`); the frontend should
        `decodeURIComponent` it or the chips read badly.*

---

## Phase 4 — Backend demo changes (`demo` branch)

Originally scoped as "six small, localized edits. No structural changes." It ended up as eleven
items and one new file (`middleware/demoGate.middleware.js`) — the `[CONFLICT]` resolution and
the `.env` rename were added during the phase, and two items were pulled forward into Phase 3.
Still no structural changes: every edit is localized, and the only new module is the demo gate.

- [x] **[BLOCKER] Resolve the `[CONFLICT]` — enforce RBAC under `DISABLE_AUTH`.**
      *Decided and implemented 2026-09-23: `requireAuth` stays pass-through; `requireRole` and
      `requireOrgAccess` now evaluate against the demo stub. `middleware/auth.middleware.js` —
      the two `if (AUTH_DISABLED) return passThrough;` lines deleted, a `hasIdentity(req)` guard
      added, and the comments that claimed the checks were bypassed corrected. Verified live
      across all four personas — results table in "Added during Phase 4". No contract string
      changed. The frontend consequences are in the Status block at the top of this file.*

- [x] **[BLOCKER] Stub `req.auth` instead of removing auth.** Replace `clerkMiddleware()` when
      `DISABLE_AUTH` is on. Fixes all twelve call sites at once.
      *Done early, because Phase 3's upload step depends on it — `middleware/demoAuth.middleware.js`,
      mounted at `app.js` as `app.use(DISABLE_AUTH ? demoAuth : clerkMiddleware())`. Verified all
      four personas resolve to their seeded clerk ids, and that both an unrecognised
      `X-Demo-Role` and a missing one fall back to `org_executive` per the shared contract. It
      throws at startup if the persona list ever drifts from `config/roles.js`. **See the
      `[CONFLICT]` finding** — this stub does not by itself restore the `org_staff` 403, because
      `requireRole` is still pass-through under `DISABLE_AUTH`.*
      ```js
      req.auth = () => ({
        userId: DEMO_USERS[req.get("X-Demo-Role") || "org_executive"],
        sessionClaims: { publicMetadata: { role: req.get("X-Demo-Role") || "org_executive" } }
      });
      ```
- [x] **[BLOCKER] Add `X-Demo-Role` to CORS `allowedHeaders`** in `app.js:43`. Without it the
      preflight fails and every cross-origin request dies with a generic CORS error.
- [x] **Set `NODE_ENV` to anything that is not `production`.** Keep a dummy `CLERK_SECRET_KEY`
      set to satisfy the required-vars check in `config/env.js`.
      *Done/decided 2026-09-23. **Locally: `development`**, which is the default, so
      `npm run dev` works with nothing set and reads `.env.development.local`. **On Railway:
      still a free choice** — set it there explicitly and never to `production`, or
      `DISABLE_AUTH` is force-disabled (`config/env.js:40`) and every request 401s with no
      Clerk session behind it. `demo` reads better in the public `/api/health` response
      (`app.js:35`) than `development` does; either works. The two are decoupled because no
      `.env` file reaches the image (`.dockerignore:14` is `.env*`).*
- [x] **Create `.env.development.local` for local runs — needed before Phase 3's upload step.**
      *Created early as `.env.demo.local`, then **renamed to `.env.development.local` on
      2026-09-23 (user decision — see the naming decision in "Added during Phase 4")**. Copied
      from `.env`, **all 34 keys parity-checked**, `PORT=5000` and `DISABLE_AUTH=true` correct,
      and confirmed gitignored by `.gitignore:5` (`.env*`, with only `.env.example` negated).
      **Boot verified with a bare `node server.js` and no `NODE_ENV` set** — dotenv injects 34
      vars from `.env.development.local` and **0 from `.env`**, so the `.env` fallback is
      confirmed inert; `DISABLE_AUTH` engages and the RBAC checks still enforce (`admin` 200 /
      `org_staff` 403 on the scorecard).*
      `server.js` loads `.env.<NODE_ENV>.local` and `NODE_ENV` defaults to `development`, so
      this exact filename is what a bare `npm run dev` picks up; without it the app exits on
      missing required vars (the `.env` load in `app.js` is too late to help).
      **Copy `.env`, not `.env.example`** — since Phase 2, `.env` holds the complete demo values
      (all five Supabase values, and the capped OpenAI key from Phase 3), while `.env.example`
      is placeholders. Keep `PORT=5000` to match the frontend's base URL. The `NODE_ENV` *line*
      inside the file is **inert** — the shell variable picks the file, and dotenv does not
      override an already-set variable — so it is kept consistent only so it cannot mislead a
      reader. **Two copies of the same secrets: if a value changes, change both** — this
      constraint survived the rename, and it has already been violated once (see the OpenAI key
      item in Phase 3). Verify parity rather than assuming it.
- [x] **[BLOCKER] Add the demo-password middleware.** Check `Authorization: Bearer <key>`
      against `DEMO_ACCESS_KEY` before the routes; exempt `/api/health` so Railway's probe
      works. The frontend already sends this once the shim's `getToken` returns the key. See
      "Shared contract" for exact strings.
- [x] **[BLOCKER] Parameterize the vector query** at `services/ragService.js:214-215` —
      bind as `$1::uuid[]`.
- [x] **Block the destructive routes:** `DELETE /api/org/:orgId`, `PUT|DELETE /api/user/:userId`,
      `DELETE /api/docs/:id`, `POST /api/chat/ingest`. All anonymous without auth; ingest
      re-embeds every file in the database on demand.
      *Done in `middleware/demoGate.middleware.js`, and **extended beyond this list with the
      user's approval (2026-09-23)** — the four above left three more mutating routes reachable:*
      - *`POST /api/org` — new organisations appear on the admin scorecard, so an anonymous
        create visibly pollutes the demo for the next visitor.*
      - *`PUT /api/org/:orgId` — renames the demo tenant; `storage_bucket` drift would orphan
        every uploaded file.*
      - *`PUT /api/docs/:id` — renames or recategorises the seeded documents.*
      ***Eight route/method combinations are now blocked**, returning 403 with
      `{ demo: true }` and a "disabled in the demo" message. Verified all eight, plus the
      negative cases: `GET /api/docs/:id` → 200 (the WebViewer path), `GET /api/org/:orgId` →
      200, and **`POST /api/docs` → 400 "No file provided"**, proving the upload route reaches
      its controller rather than the gate — the pattern requires an id segment, so the
      collection-level POST is untouched. Row counts confirmed unchanged after probing
      (2 orgs / 4 users / 6 files / 47 chunks), since every block lands before its handler.*
- [x] **[DONE in Phase 6, 2026-09-24 — user decision: 1000 global / 100 chat per 15 min.]**
      *The global limit stays at 1000 (cheap reads, bursty page loads, shared office/campus IPs);
      chat goes 200 → 100, not to the TODOs' 20, so experimenting visitors never hit it. Both TODO
      comments replaced with the reasoning. Verified from the running server's headers:
      `RateLimit-Policy: 100;w=900` on `/api/chat/*`, `1000;w=900` elsewhere. See "Added during
      Phase 6".* Original item, kept for the record:
      **[DEFERRED 2026-09-23 — user decision: leave out for now]** ~~Lower the rate limits~~ in
      `app.js:75,85` (actually `app.js:81,91`) — currently **1000 global / 200 chat per 15 min**, both still carrying their
      "lower this back" TODOs. Chat is three to six model calls per message.
      **Consequence to carry forward, since this is the demo's one real money lever:** the chat
      endpoint is public and unauthenticated apart from the shared password, so with these
      limits **the OpenAI hard spend cap is the only backstop left**. That makes the cap
      non-optional rather than belt-and-braces — confirm it in Phase 6 before going public.
      Revisit before Phase 7 flips the repos public; until then the demo is private and the
      exposure is limited to whoever has the link and the passphrase.
- [x] **[BLOCKER] Add a DB fallback to `getFullDashboardSummary`.** When a section rejects, read
      the persisted KPI row for that period. Nearly drop-in — the Prisma models use the same
      field names the services return.
- [x] **Verify locally** against the demo database: `/api/auth/me`,
      `/api/summary/summary/:orgId`, `/api/chat/stream` with each of the four `X-Demo-Role`
      values. Confirm `org_staff` gets 403 on `/api/summary/scorecard` — that denial is the RBAC
      demo working, not a bug.
      *Done 2026-09-23, end-to-end with every Phase 4 change in place:*
      - ***Password gate:*** no header → 401, wrong key → 401, correct key → 200,
        `/api/health` → 200 unauthenticated (exempt, per the contract).
      - ***CORS preflight*** with `Access-Control-Request-Headers: authorization,x-demo-role`
        → `204` and `Access-Control-Allow-Headers: Content-Type,Authorization,X-Demo-Role`.
      - ***RBAC:*** all four personas 200 on `/auth/me`; scorecard 200/200/**403**/**403** for
        super_admin/admin/org_executive/org_staff.
      - ***Destructive routes:*** all five blocked with 403. **`GET /api/docs/:id` still 200**
        (the WebViewer path is not over-blocked), and `DELETE /api/user/invite/:id` correctly
        passes through since it is not on the list.
      - ***Dashboard fallback:*** three error cards replaced by **29 / 18 / 11 populated
        fields** from the seeded rows, `fromCache: true`. Spot-checked `dso=68`,
        `billableUtilization=66.4`, `conversionRate=20.6` — all matching the seed.
      - ***Chat:*** still retrieves after parameterisation (4 document sources, answer contains
        the seeded DSO), and a legitimate two-uuid admin query returns 4 chunks, proving the
        `ANY($n::uuid[])` array binding works.

---

## Phase 5 — Frontend demo changes (`demo` branch)

**All code is on `demo` in `maural-demo-frontend`, pushed:** `14d9806`, `8c1016b`, `54c1b27`,
`f73c63a`. Decisions and findings are in "Added during Phase 5".

- [x] **[BLOCKER] Write the `demoAuth` shim module** exporting Clerk's shapes: `ClerkProvider`
      as pass-through, `useAuth` → `{getToken, isSignedIn, isLoaded}`, `useUser` →
      `{user:{imageUrl}, isLoaded}`, plus `SignIn`, `SignOutButton`, `UserProfile`.
      *`src/lib/demoAuth.tsx`. `SignIn` and `UserProfile` ended up with no shim equivalent — the
      welcome page and profile page replaced them outright. Key and persona live in a small
      reactive store (`localStorage` alone isn't reactive — see Findings).*
- [x] **`getToken()` returns the demo password.** This is the whole gate.
- [x] **Swap the seven Clerk imports** (list in Findings). Keep imports explicit rather than
      aliasing the package in Vite — a reviewer reading `main.tsx` shouldn't think real Clerk is
      wired up. *Done; no Clerk code in the built bundle. Local names say `useDemoAuth` /
      `DemoAuthProvider`. The package itself is still in `package.json` (loose end).*
- [x] **Turn `LoginPage` into the passphrase gate.** Set
      `isSignedIn = !!localStorage.getItem("demo_key")` and `AuthenticatedLayout`'s existing
      redirect-to-login logic works unchanged.
      *Superseded: `LoginPage.tsx` was deleted; the gate is part of `/welcome` (`/login`
      redirects). It checks the typed key against `/auth/me` before storing it; wrong key → "That
      passphrase isn't right".*
- [x] **[BLOCKER] Build the persona switcher** — a "Viewing as" control in the topbar that sets
      the active persona, sends `X-Demo-Role` on every request, and calls `refreshProfile` so
      `/auth/me` returns the matching seeded user. Add the header in **both** send paths (axios
      interceptor and the chatbot's raw `fetch`), or the chatbot will answer as a different
      persona than the rest of the app.
      *Built as specified, then **replaced by user decision**: persona cards on `/welcome` plus a
      demo banner in the app. Both headers are sent in both paths. A switch does a full reload to
      `/` rather than `refreshProfile`.*
- [x] **Add the mock consent route** `/demo/connect/:provider` — provider name, the scopes it
      would request, Authorize / Cancel. No credential fields. Label it plainly as simulated and
      use a neutral treatment rather than reproducing Intuit's actual login page.
      *`DemoConnectPage.tsx`: Maural and provider icons, plain-language read-only scopes, a
      "Simulated for this demo" box. Org Executive only, like `/integrations`.*
- [x] **Rewire `integration-card.tsx`.** `handleConnect` currently calls install then redirects —
      point it at the consent route. Drive `enabled` from local demo state rather than
      `user.Organisation.*_connected`. Existing connecting states, confirm dialog and toasts all
      carry over. *State in `src/lib/demoConnections.ts` (`localStorage["demo_connections"]`),
      all providers start disconnected.*
- [x] **Apply the same treatment to all four providers** — one parameterized component, so the
      Integrations page looks finished rather than one-of-four.
- [x] **Gate the financial section on the connection flag** so the connect step means something
      visually. *Gated in the executive's own analytics and landing page; the admin view shows
      seeded figures. **Depends on Phase 4's dashboard fallback** — without it the connect prompt
      would reappear after connecting.*
- [x] **Replace `ProfilePage`** with a static card from the seeded user, and **`nav-user`'s sign
      out** with one that clears the demo key. *Also removed `nav-user`'s "Security" link (pointed
      at a Clerk-only page) and replaced its hard-coded "CN" avatar fallback with real initials.*

**Added during the phase:**

- [x] **Welcome page** (`/welcome`) — product intro, persona cards, passphrase; replaces the
      login page. Credit line and draft copy included. *(`14d9806`, copy revised `f73c63a`.)*
- [x] **Demo banner** in the app — "Viewing as …" from `/auth/me`, "Switch persona" link.
- [x] **Disable actions the backend blocks or that can't work** — tooltip "Disabled in the demo";
      static invitation sample; `/api-test` unrouted; safety-net toast for `403 { demo: true }`.
      *(`8c1016b`.)*
- [x] **Make the RBAC denial visible** — locked sidebar items opening a live permission check,
      backend-enforced refusals only. Verified against the running backend. *(`54c1b27`.)*
- [x] **Align the welcome copy with what the demo allows** — no promises of disabled or
      unfinished features; "What's different in this demo" note. *(`f73c63a`.)*
- [x] **[BLOCKER] Test the WebViewer license.** *Do this after Phases 2–4 and after the demo
      shim above works* — it needs a running backend, the new Supabase project, a seeded
      document and a way into the app. The key in `../maural-kms/.env` is
      `demo:1760471071849:...`, stamped October 2025; Apryse demo keys are short-lived, so
      expect it to be dead. Open a document and watch the console.
      → *Test outcome:* **THE KEY STILL WORKS — verified by the user, 2026-09-23.** The
      expectation recorded above was wrong; the October 2025 demo key is still active.
      **WebViewer stays.** This resolves Decision 6 in favour of keeping the premium viewer.
- [x] **Apply the viewer decision.** If the key works, leave `web-viewer.tsx` alone. If not:
      drop `@pdftron/webviewer` and `public/lib/webviewer/` and render documents in a plain PDF
      view instead.
      *Key works → **leave `web-viewer.tsx` alone**. No frontend change, and the
      "demo-limitations note" item below is moot.*
- [x] ~~**If the viewer was dropped, strip it from history too.**~~ **NOT NEEDED** — the licence
      test passed, so `public/lib/webviewer/` stays and there is no second `filter-repo` pass.
      The frontend therefore needs **no history rewrite at all** (Phase 0–1 findings already
      established it had nothing else to strip).
      **But this makes a Phase 6 item live rather than hypothetical:** 172 MB across 677 files
      now definitely lands in the Vercel build output. Check the deployment size there, and see
      the Deferred section on fetching the viewer at build time if it becomes a problem.
- [x] **Whichever viewer survives, check it can authenticate.** `GET /api/docs/:id` is behind
      the demo-password middleware, and an `<iframe src="...">` cannot send an `Authorization`
      header. Fetch the file through the existing axios instance (which already attaches the
      header via the shim's `getToken`), then render `URL.createObjectURL(blob)` as the source.
      That keeps it working with no backend exemption. Verify the same for WebViewer's own
      document-fetch path if it stays.
      *No change needed — confirmed by reading the code: `DocumentViewerPage.tsx:33` already
      fetches through the shared `api` instance with `responseType: "blob"` and hands WebViewer
      the blob, never a URL. Confirm at runtime in the joint pass.*
- [x] ~~**If the viewer was dropped, add the demo-limitations note**~~ — **moot**, the viewer
      survived. (The general "this is a demo, data is synthetic" banner in Phase 7 still stands;
      that one is unrelated to the viewer.)
- [ ] **Joint verification pass** — frontend against the running backend, in a browser. The only
      open Phase 5 item. Check:
      - wrong passphrase is rejected; `thornbury-demo-2026` gets in;
      - each of the four personas: banner name matches the chosen card, `/` loads, and the
        chatbot answers as the same persona as the rest of the app;
      - locked sidebar items show a 403 for Dana and Marcus; Priya and Avery have none;
      - as Dana: connect QuickBooks, then the Finance tab shows figures (not the prompt again);
        the VTO tab saves; org details can't be saved;
        *(Amended in Phase 6: VTO writes are now blocked on the backend. "Saves" means saves
        **to this browser only** — the edit survives a reload, and a second browser still shows
        the seeded VTO. Depends on the frontend's per-visitor VTO pass.)*
      - the date picker: Q2 2026 (Apr–Jun) shows different numbers from Q3; the landing headers
        say Q3 2026 whatever today's date is *(added in Phase 6; depends on the frontend clock pin)*;
      - as Priya: the admin scorecard lists Thornbury only, with real numbers (EBITDA 5.2%,
        coverage 1.72x) *(added in Phase 6)*;
      - disabled controls show their tooltip, by mouse and by keyboard;
      - a document opens in WebViewer (`FY2026 Strategic Plan … .pdf`);
      - `/welcome` at phone width.

---

## Phase 6 — Deploy

- [ ] **[BLOCKER] Dedicated OpenAI key with a hard spend cap.** Not your main key. A public
      unauthenticated chat endpoint running a multi-agent pipeline is the one thing here that
      can actually cost money. *Created in Phase 3 (ingestion needs it first) — here, just
      confirm the cap is set and put the same key in Railway.*
- [ ] **Deploy the API from `demo`.** Env (set in the **Railway dashboard** — no `.env` file
      reaches the image, `.dockerignore:14`): `NODE_ENV=demo` (any value except `production`;
      `demo` is preferred because `/api/health` shows it publicly), `DISABLE_AUTH=true`,
      `DEMO_ACCESS_KEY`, five Supabase values, capped OpenAI key, dummy `CLERK_SECRET_KEY`, and
      `FRONTEND_URL` / `FRONTEND_REDIRECT_URI` / `ALLOWED_ORIGINS`. No `QUICKBOOKS_*` vars
      needed. **`SUPABASE_SERVICE_ROLE_KEY` is mandatory, not optional:** `lib/supabase.js`
      silently falls back to the anon key without it, and with RLS on (Phase 2) ingestion and
      document deletes then fail with `42501 ... violates row-level security policy`. If that
      error ever appears, check this variable — do not add RLS policies.
- [ ] **Confirm no `.env` reaches the image** — `.dockerignore` already excludes `.env*`; verify
      it still does after the history rewrite.
- [ ] **Check `/api/health` and CORS.** A CORS miss surfaces as AuthContext's "Unable to reach
      the server" screen, which looks like a backend outage.
- [ ] **Deploy the frontend to Vercel from GitHub.** Set `VITE_*` values as Vercel **build-time**
      env vars; Vite inlines them. `VITE_API_BASE_URL` must include the `/api` suffix (the local
      value is `http://localhost:5000/api`) — omitting it 404s every call.
      `public/config.js` ships with unsubstituted `${...}` placeholders on this path, which is
      fine: `src/env.ts` ignores any value starting with `${` and falls back to
      `import.meta.env`. Leave `config.js` in place — `index.html` loads it unconditionally, so
      deleting it means editing `index.html` too, for no benefit.
- [ ] **Allowlist the right origin.** Vercel mints a unique preview URL per deployment, and
      those won't be in `ALLOWED_ORIGINS` — previews will fail CORS while production works.
      Either test only on the production domain or add a pattern for previews.
- [ ] **[NOW UNCONDITIONAL] Check the deployment size.** WebViewer **did** survive the licence
      test (2026-09-23), so `public/lib/webviewer` — 172 MB across 677 files — lands in the
      Vercel build output for certain. Verify it deploys within limits before assuming it does.
- [ ] **Walk the whole journey as a visitor:** passphrase → each of the four personas →
      dashboard → documents → open a file → connect flow → two chatbot questions → citations and
      guardrail badge.
      *Amended in Phase 5: start at `/welcome` (the passphrase is entered there, with a persona
      card), and **there are no citation chips** in the demo chatbot — they were removed from the
      frontend in `bebb3ac` and the user accepted that as a demo limitation. Expect the guardrail
      badge only, and a silent 8–57s wait before an answer appears. Add the locked sidebar items
      (as Dana or Marcus) to the walk.*
- [x] **Set up a reseed path.** Even with writes blocked the demo drifts. A one-command reseed
      is enough; a scheduled job is nicer.
      *Done 2026-09-24 (code): `prisma/reseed.js`. **Data only — documents are never modified**
      (user decision; see "Added during Phase 6").*
      ```bash
      node -r dotenv/config prisma/reseed.js   # locally (reads .env — check DIRECT_URL's host first)
      node prisma/reseed.js                    # Railway: a shell on the API service, which holds every variable
      ```
      *Restores both orgs (incl. labor source and integration flags), roles, categories,
      personas + org chart, both KPI periods and the VTO; exits 1 if the seed fails. Then prints
      an ATTENTION list of anything it doesn't fix: stray rows, missing or chunkless seeded
      documents, visitor uploads. **Document restoration is local-only and not automated:**
      the files come from `uploads/`, which is gitignored, excluded from the image
      (`.dockerignore`: `uploads/*`) and built by `demo-content/build-documents.ps1` through Word
      on Windows — rebuild, then upload per `demo-content/upload-manifest.json` with the
      `Authorization` header. **Verified against the demo DB:** clean run reports 6 of 6 seeded
      documents searchable; after deliberately clearing Thornbury's `laborSource`/`mondayBoardId`
      and changing the VTO title, one reseed restored both exactly.
      **Not scheduled** — runs by hand for now. If it's scheduled later, make it a separate
      Railway cron service from the keep-alive (the keep-alive must stay trivially simple, since
      it fails silently).*
- [ ] **[BLOCKER] Set up the Supabase keep-alive** — *CODE DONE 2026-09-24: `jobs/keepalive.js`.
      Still open: wiring it on Railway after the API deploy exists, then the 8-day check.*
      *Railway wiring (dashboard): add a **second service** from the same repo and `demo`
      branch — it builds the same Dockerfile, and `railway.toml` holds only `[build]`, so nothing
      there needs changing. In that service's settings: **Start Command**
      `node jobs/keepalive.js`; **Cron Schedule** `0 9 * * 1,3,5` (09:00 UTC Mon/Wed/Fri — the
      longest gap is 3 days); **Variables**: only `DIRECT_URL`, as a reference to the API
      service's value (`${{<api-service-name>.DIRECT_URL}}`). No other variable is needed —
      the script doesn't load `config/env`. Check its first run: the log should read
      `[keepalive] ok — 2 organisation(s)`, and a failed run shows as failed in Railway.*
      *Verified locally (2026-09-24): ok with `.env`; ok with **only** `DIRECT_URL` set and no
      `.env` in reach (the Railway situation); exit 1 with a clear message on a missing variable
      and on a wrong password.*
      Chosen in Phase 2 over a paid plan. A
      scheduled query every 2–3 days stops the free tier pausing on an idle demo; that interval
      leaves room for a missed run inside the ~7-day window. **The job must actually query the
      database.** `/api/health` does not (`app.js:24` returns uptime/memory only), so pinging it
      — or relying on Railway's healthcheck — keeps the *API* warm but lets Supabase pause.
      Options: a Railway cron service running a cheap read (e.g. `select count(*) from
      "Organisation"`) with the `DIRECT_URL` Railway already holds, which keeps DB credentials
      out of GitHub; or a GitHub Action calling a DB-backed API endpoint with `DEMO_ACCESS_KEY`
      as a secret. Prefer a real table read over a bare `select 1`. **Verify it works** by
      checking the Supabase dashboard after 8+ days: the project should still be active.

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
- [x] **Put a demo banner in the app** — synthetic data, simulated integrations. Sets
      expectations and explains the mock OAuth without anyone asking.
      *Done in Phase 5 (`14d9806`): the amber demo banner above the topbar ("Demo mode · Fictional
      data · simulated integrations · Viewing as …"), plus the welcome page's "What's different in
      this demo" note.*
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
  a large deploy. **The viewer survived the licence test (2026-09-23), so this is now certain
  rather than conditional**: it ships. Consider fetching at build time if Vercel's deployment
  size becomes a problem.
