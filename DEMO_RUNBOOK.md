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
`main` and `demo` are both pushed to `maural-demo-backend` at `5cd2a07`, the local clone is
checked out on `demo`, and `dev` is kept local at the same commit and never pushed.

**Remaining Phase 1 work is all on github.com by hand** (no `gh` on this machine): archive the
two old team repos, and confirm private + collaborators on both new repos. **Phase 2 has not
been started.** Next session: Phases 2–4 are backend-only, so this repo continues straight
into Phase 2.

**Two recovery artifacts exist outside the repo** and can now be deleted — the push is
verified, and both contain the client documents and the unredacted password:
`../maural-kms-api-prerewrite-mirror.git` (full pre-rewrite mirror, all 12 original refs) and
`../maural-api-uploads-backup-20260921` (the 5 tracked client documents). **Keep the uploads
backup only if those source documents are wanted for reference** — Phase 3 authors its own
fictional demo documents and does not need them.

**Two recovery artifacts exist outside the repo** and should be deleted once the push is
verified — both contain the client documents and the unredacted password:
`../maural-kms-api-prerewrite-mirror.git` (full pre-rewrite mirror, all 12 original refs) and
`../maural-api-uploads-backup-20260921` (the 5 tracked client documents).

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

- **[ACTION REQUIRED] The API history contained live credentials — the runbook was wrong that
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
      and `git ls-remote` shows only `main` + `demo` at `5cd2a07` with zero unpushed commits on
      either. (Local `dev` sits at the same commit but is deliberately never pushed.)*
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
      can actually cost money.
- [ ] **Deploy the API from `demo`.** Env: `NODE_ENV=demo`, `DISABLE_AUTH=true`,
      `DEMO_ACCESS_KEY`, five Supabase values, capped OpenAI key, dummy `CLERK_SECRET_KEY`, and
      `FRONTEND_URL` / `FRONTEND_REDIRECT_URI` / `ALLOWED_ORIGINS`. No `QUICKBOOKS_*` vars
      needed.
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
