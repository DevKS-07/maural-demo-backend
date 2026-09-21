# Architecture diagrams

Salvaged from `docs-assets/presentation/`, which is gitignored and therefore was never
tracked. These are the standalone SVGs from the team's final presentation. They are kept here
so the Phase 7 README can embed them without depending on an untracked folder.

All ten are self-contained SVGs (no external fonts, images or scripts) and render directly in
GitHub Markdown via `![...](docs/diagrams/<name>.svg)`.

## Technical diagrams — the ones worth embedding

| File | What it shows |
| --- | --- |
| `architecture.svg` | System architecture: the middleware layer (Clerk JWT auth, org isolation, role-based access, CORS) and how requests flow through it. |
| `oauth-flow.svg` | The OAuth2 authorization flow end to end, from "Connect" click through state-token generation to callback. |
| `rbac-hierarchy.svg` | The four-level role hierarchy (Super Admin → Admin → Org Executive → Org Staff), enforced per request in middleware. |
| `kpi-flow.svg` | Data flow from the four integrations through extraction into the dashboard KPIs. |
| `integration-cards.svg` | Per-provider breakdown of what each integration pulls and which KPIs it feeds. |
| `third-party-security.svg` | Why each external service was chosen, framed around security and compliance. |
| `compliance-overview.svg` | PIPEDA and US regulatory coverage, and why both jurisdictions applied. |

## Presentation slides — lower priority

| File | What it shows |
| --- | --- |
| `problem-statement.svg` | The business problem: data siloed across QuickBooks, monday.com and others. |
| `challenges.svg` | Engineering problems solved, led by the cross-domain auth failure. |
| `stats-panel.svg` | Effort metrics — integration count, KPIs extracted, and similar figures. |

## Caution for the Phase 7 README

**Several of these diagrams document the production system, not the demo.** `architecture.svg`
shows Clerk JWT auth, `oauth-flow.svg` shows a real OAuth2 round trip, and `kpi-flow.svg` and
`integration-cards.svg` show live integration pulls. The deployed demo replaces all of that —
auth becomes a shared passphrase plus a persona switcher, OAuth becomes a frontend-only mock,
and KPIs come from seeded rows.

That is fine, and arguably the point: the diagrams show what was built, and the demo is a
portfolio shim over it. But label them as the production architecture when embedding, or a
reviewer who reads the diagram and then clicks the demo will think the diagram is inaccurate.

Not copied from `docs-assets/presentation/`: `speaker-script.md`, `speaker-script.html` and
`langchain-vs-langgraph.html`. Presentation prose rather than diagrams — still available in the
untracked folder if wanted later.
