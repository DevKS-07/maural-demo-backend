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

**Phase 3 is in progress (2026-09-22), on `demo`.** The `schema.prisma` fix is committed and the
**`[TRAP]` on `prisma db push` is resolved — plain `db push` is safe again.** Work is proceeding
in the order: prerequisites → `seed.js` restructure → company brief → seeded rows → KPIs/VTO →
the two Phase 4 items → documents → upload + verification. **Blocked at the money line:** the
capped OpenAI key is not in place yet (the user will add it later), so nothing that embeds —
document upload, ingestion, retrieval verification — has been attempted. Everything before that
point is safe to run.

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
6. **WebViewer:** keep it if the license key still works. If it doesn't, drop it from the
   frontend and fall back to a plain browser PDF view — with a visible note that this is a demo
   and some features differ from production. A simple viewer that works reads better in a
   portfolio than a broken premium one. **The test itself lives in Phase 5**, not earlier: it
   needs a running backend, a live database and a seeded document, and the old Supabase project
   and hosted backend are both down.
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
- **`prisma db push` reads `.env`, not `.env.demo.local`.** `prisma.config.js` starts with
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
  Partial, inconsistent fallback — keep `.env.demo.local` complete rather than relying on it.
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

- **[CONFLICT — needs a Phase 4 decision] `DISABLE_AUTH=true` defeats the RBAC demo.** Two things
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
      `.env.demo.local`, and not the other four stale `.env.*.local` files still on disk. Print
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
> 2. **`.env.demo.local`.** Uploading means running the server locally, and `server.js` exits
>    without an `.env.<NODE_ENV>.local` — the `.env` load in `app.js` comes too late (see
>    "Added during Phase 2"). Run it with `NODE_ENV=demo` so it picks up that file.
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
- [ ] **[BLOCKER] Put a real OpenAI key with a hard spend cap in `.env`** — the dedicated
      demo key from Phase 6, created now instead. Ingestion embeds every chunk and retrieval
      verification runs the chat pipeline, so Phase 3 spends money first. `.env` currently
      holds the placeholder `sk-proj-xxx…`, which is **non-empty, so it passes
      `config/openai.js`'s startup check** and only fails at OpenAI with a 401 — during
      ingestion that failure is only logged (see the upload item).
- [x] **Run the seed as `node -r dotenv/config prisma/seed.js`** — not bare `node
      prisma/seed.js`. `seed.js` loads no env file itself, and its `lib/prisma` →
      `config/env` import hard-exits on missing vars. `-r dotenv/config` loads `.env` (the
      demo values) first. (`npx prisma db seed` probably works too, via `prisma.config.js`'s
      own dotenv load, but that path is unverified — use the explicit form.)

**Seeding and content:**

- [ ] **Write a one-page brief for the fictional company** — name, industry, size, revenue
      shape, the problems it has. Everything downstream should agree with it; inconsistencies
      are what a sharp reviewer notices.
- [ ] **Seed the platform org and the demo org.** `prisma/seed.js` already creates the platform
      org and its storage bucket — extend it rather than writing a second script.
      **Restructure it to be idempotent first:** it currently `return`s early as soon as a
      platform org exists, so anything appended after that check silently never runs on a
      second invocation — and the Phase 6 reseed path depends on re-running it. Use upserts
      keyed on stable values (clerk ids, org names, fixed ids) instead of the early exit.
      *Restructure **done** — the early return is gone and every write is an upsert on a fixed
      id; proven by running it twice to identical state. The **platform org is seeded** with a
      pinned `org_id` and `storage_bucket` (`00000000-0000-4000-a000-00000000000{1,2}`) rather
      than generated uuids, so a reseed converges instead of creating a second org and the
      bucket name never drifts. **The demo org is still to do** — it is named after the company
      brief, so it waits on that. `seed.js` has a marked extension point for it.*
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
- [ ] **[BLOCKER] Seed four persona users**, one per role, with stable clerk ids:
      `demo_super_admin`, `demo_admin`, `demo_org_executive`, `demo_org_staff`. The Phase 5
      switcher resolves to these, so the ids must match what the backend stub expects.
      Put `super_admin` and `admin` in the **platform** org and `org_executive` / `org_staff`
      in the **demo** org — that mirrors how `auth.controller.js:62` provisions admins, and
      admins bypass the org check anyway (`docs.controller.js:172`).
- [ ] **Align both role systems per user** — `publicMetadata.role` key *and* DB `Role.role_name`
      label. See Findings.
- [ ] **Author five or six demo documents** — strategy deck, financial summary, meeting notes,
      hiring plan, quarterly review. This is the chat's entire knowledge base.
      **Formats ingestion can read** (`ingest.controller.js:129-159`): `pdf`, `docx`,
      `xlsx`/`xls`, `txt`/`md`/`csv`/`json`, and images via OCR. **Not `pptx`** — export the
      strategy deck as PDF. Prefer text-based PDFs/DOCX over scanned ones; OCR is slower and
      noisier.
- [ ] **Upload through `POST /api/docs`**, not by hand — it auto-ingests via `ingestSingleFile`,
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
- [ ] **Seed the KPI tables completely** — full rows in `finance_kpis`, `leads_kpis`,
      `labor_kpis` for the current period. Seed *every* field, not just the five the live
      persist path writes.
- [ ] **Seed the VTO** — `businessDataService` injects it into the chat prompt; cheap depth.
- [ ] **Verify retrieval end to end.** Ask something only a seeded document can answer, and
      something only a seeded KPI can answer. Check citation chips list both.

---

## Phase 4 — Backend demo changes (`demo` branch)

Six small, localized edits. No structural changes.

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
- [ ] **[BLOCKER] Add `X-Demo-Role` to CORS `allowedHeaders`** in `app.js:43`. Without it the
      preflight fails and every cross-origin request dies with a generic CORS error.
- [ ] **Set `NODE_ENV=demo`** (not `production`). Keep a dummy `CLERK_SECRET_KEY` set to satisfy
      the required-vars check in `config/env.js`.
- [x] **Create `.env.demo.local` for local runs — needed before Phase 3's upload step.**
      *Done early, for the same reason. Copied from `.env` (all 33 keys present, parity checked)
      with only `NODE_ENV` changed to `demo`; `PORT=5000` and `DISABLE_AUTH=true` were already
      correct. Confirmed gitignored by `.gitignore:5` (`.env*`, with only `.env.example`
      negated). Boot verified with `NODE_ENV=demo node server.js`. **The `.env` fallback is
      confirmed inert**: the startup log shows dotenv injecting 32 vars from `.env.demo.local` and
      then **0 from `.env`**, since everything was already set. **The placeholder OpenAI key is in
      both files — when the capped key arrives it must be changed in `.env` AND
      `.env.demo.local`.**
      `server.js` loads `.env.<NODE_ENV>.local`, so `NODE_ENV=demo` needs that exact filename or
      the app exits on missing required vars (the `.env` load in `app.js` is too late to help).
      **Copy `.env`, not `.env.example`** — since Phase 2, `.env` holds the complete demo values
      (all five Supabase values, and the capped OpenAI key from Phase 3), while `.env.example`
      is placeholders. Keep `PORT=5000` to match the frontend's base URL. The `NODE_ENV` *line*
      inside the file does nothing — the shell variable picks the file — so start the server
      with `NODE_ENV=demo` set (PowerShell: `$env:NODE_ENV="demo"; node server.js`). Two
      copies of the same secrets: if a value changes, change both.
- [ ] **[BLOCKER] Add the demo-password middleware.** Check `Authorization: Bearer <key>`
      against `DEMO_ACCESS_KEY` before the routes; exempt `/api/health` so Railway's probe
      works. The frontend already sends this once the shim's `getToken` returns the key. See
      "Shared contract" for exact strings.
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
- [ ] **[BLOCKER] Test the WebViewer license.** *Do this after Phases 2–4 and after the demo
      shim above works* — it needs a running backend, the new Supabase project, a seeded
      document and a way into the app. The key in `../maural-kms/.env` is
      `demo:1760471071849:...`, stamped October 2025; Apryse demo keys are short-lived, so
      expect it to be dead. Open a document and watch the console.
      → *Test outcome:* `________`
- [ ] **Apply the viewer decision.** If the key works, leave `web-viewer.tsx` alone. If not:
      drop `@pdftron/webviewer` and `public/lib/webviewer/` and render documents in a plain PDF
      view instead.
- [ ] **If the viewer was dropped, strip it from history too.** 172 MB across 677 files. The
      repo is private with only you on it, so a rewrite plus force-push is safe.
      ```bash
      # in ../maural-kms
      git filter-repo --path public/lib/webviewer --invert-paths --force
      git push --force origin main demo
      ```
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
      can actually cost money. *Created in Phase 3 (ingestion needs it first) — here, just
      confirm the cap is set and put the same key in Railway.*
- [ ] **Deploy the API from `demo`.** Env: `NODE_ENV=demo`, `DISABLE_AUTH=true`,
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
- [ ] **Check the deployment size** if WebViewer survived the Phase 5 licence test —
      `public/lib/webviewer` is 172 MB and lands in the build output.
- [ ] **Walk the whole journey as a visitor:** passphrase → each of the four personas →
      dashboard → documents → open a file → connect flow → two chatbot questions → citations and
      guardrail badge.
- [ ] **Set up a reseed path.** Even with writes blocked the demo drifts. A one-command reseed
      is enough; a scheduled job is nicer.
- [ ] **[BLOCKER] Set up the Supabase keep-alive** — chosen in Phase 2 over a paid plan. A
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
  a large deploy. Consider fetching at build time if the viewer survives the Phase 5 test.
