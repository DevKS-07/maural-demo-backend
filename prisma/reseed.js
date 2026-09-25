/**
 * Demo reseed — restores the demo tenant's DATA to its seeded state, then
 * reports on anything it deliberately leaves alone.
 *
 * Run with:
 *   locally:             node -r dotenv/config prisma/reseed.js
 *   Railway (a shell on the API service, which already holds every variable):
 *                        node prisma/reseed.js
 *
 * What it restores: everything prisma/seed.js writes — both orgs (including
 * the labor source and integration flags), roles, categories, the four
 * personas and their org chart, both KPI periods, and the VTO. It is seed.js
 * re-run; every write there is an upsert, so this converges however often it
 * runs.
 *
 * What it does NOT do:
 *
 * - It deletes nothing. Rows the seed does not own — an extra organisation,
 *   user, KPI period, VTO or integration token — are reported, not removed.
 *   With the demo gate in place nothing should be able to create them, so one
 *   appearing means a write got past the gate: worth investigating, not
 *   silently cleaning up.
 *
 * - It never touches documents. Visitor uploads are listed, not deleted. A
 *   seeded document that is missing or has lost its chunks is listed, not
 *   restored. Restoring one needs the generated files in uploads/, which are
 *   gitignored, excluded from the Docker image (.dockerignore: uploads/*), and
 *   built by demo-content/build-documents.ps1 through Word on Windows. So
 *   document restoration can only ever run locally: rebuild the files, then
 *   upload them through POST /api/docs per demo-content/upload-manifest.json.
 */

const fs = require("fs");
const path = require("path");
const prisma = require("../lib/prisma");
const { main: seed } = require("./seed");
const {
  PLATFORM_ORG_ID,
  DEMO_ORG_ID,
  USERS,
  FINANCE_KPIS,
  LEADS_KPIS,
  LABOR_KPIS,
} = require("./demo-data");

const MANIFEST_PATH = path.join(
  __dirname,
  "..",
  "demo-content",
  "upload-manifest.json",
);

const SEEDED_ORG_IDS = [PLATFORM_ORG_ID, DEMO_ORG_ID];

const warnings = [];
const warn = (msg) => warnings.push(msg);

/** Rows the seed does not own. Reported only — see the header. */
async function checkDataDrift() {
  const extraOrgs = await prisma.organisation.findMany({
    where: { org_id: { notIn: SEEDED_ORG_IDS } },
    select: { org_id: true, org_name: true },
  });
  for (const o of extraOrgs) {
    warn(`Organisation not in the seed: "${o.org_name}" (${o.org_id})`);
  }

  const extraUsers = await prisma.user.findMany({
    where: { clerk_id: { notIn: USERS.map((u) => u.clerk_id) } },
    select: { user_id: true, clerk_id: true },
  });
  for (const u of extraUsers) {
    warn(`User not in the seed: clerk_id "${u.clerk_id}" (user_id ${u.user_id})`);
  }

  const kpiTables = [
    ["financeKpi", FINANCE_KPIS],
    ["leadsKpi", LEADS_KPIS],
    ["laborKpi", LABOR_KPIS],
  ];
  for (const [model, seeded] of kpiTables) {
    const seededStarts = new Set(seeded.map((r) => r.periodStart.getTime()));
    const rows = await prisma[model].findMany({
      select: { org_id: true, periodStart: true, periodEnd: true },
    });
    for (const r of rows) {
      if (r.org_id !== DEMO_ORG_ID || !seededStarts.has(r.periodStart.getTime())) {
        warn(
          `${model} row not in the seed: org ${r.org_id}, ` +
            `${r.periodStart.toISOString()} → ${r.periodEnd.toISOString()}`,
        );
      }
    }
  }

  const extraVtos = await prisma.vTO.count({
    where: { org_id: { not: DEMO_ORG_ID } },
  });
  if (extraVtos) warn(`${extraVtos} VTO row(s) for an org other than Thornbury`);

  const tokenTables = ["quickbooksToken", "hubspotToken", "mondayToken", "clickUpToken"];
  for (const model of tokenTables) {
    const n = await prisma[model].count();
    if (n) warn(`${n} ${model} row(s) — the demo should hold no integration tokens`);
  }
}

/**
 * Report on documents without changing them. A seeded document is a Thornbury
 * file whose name is in the upload manifest; only the oldest copy of each name
 * counts, so a visitor upload that reuses a seeded name is still reported as
 * a visitor upload.
 */
async function reportDocuments() {
  let manifestNames;
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    manifestNames = manifest.documents.map((d) => d.file);
  } catch (e) {
    warn(`Could not read ${MANIFEST_PATH} (${e.message}) — document report skipped`);
    return;
  }

  const files = await prisma.$queryRaw`
    SELECT f.file_id, f.file_name, f.org_id, f.uploaded_at,
           count(e.id)::int AS chunks
    FROM "File" f
    LEFT JOIN document_embeddings e ON e.metadata->>'file_id' = f.file_id::text
    GROUP BY f.file_id
    ORDER BY f.uploaded_at`;

  // Uploads store file_name URL-encoded ("FY2026%20Strategic%20Plan…"), so
  // compare decoded names — a raw comparison matches none of the manifest.
  const decode = (name) => {
    try {
      return decodeURIComponent(name);
    } catch {
      return name;
    }
  };

  const seeded = new Map(); // decoded file_name -> oldest matching row
  const other = [];
  for (const f of files) {
    const name = decode(f.file_name);
    f.file_name = name;
    const isSeedCandidate = f.org_id === DEMO_ORG_ID && manifestNames.includes(name);
    if (isSeedCandidate && !seeded.has(name)) seeded.set(name, f);
    else other.push(f);
  }

  console.log(`[reseed] Documents: ${seeded.size} of ${manifestNames.length} seeded present`);
  for (const name of manifestNames) {
    const f = seeded.get(name);
    if (!f) warn(`Seeded document missing: "${name}"`);
    else if (f.chunks === 0) warn(`Seeded document has 0 chunks (not searchable): "${name}"`);
  }

  if (other.length) {
    console.log(`[reseed] ${other.length} document(s) not part of the seed (visitor uploads) — left in place:`);
    for (const f of other) {
      console.log(
        `  - "${f.file_name}" · ${f.chunks} chunks · uploaded ${new Date(f.uploaded_at).toISOString()}`,
      );
    }
  }
}

async function main() {
  console.log("[reseed] Restoring seeded data (prisma/seed.js)…");
  await seed();

  console.log("[reseed] Checking for data the seed does not own…");
  await checkDataDrift();
  await reportDocuments();

  if (warnings.length) {
    console.log(`\n[reseed] ATTENTION — ${warnings.length} item(s) this script does not fix:`);
    for (const w of warnings) console.log(`  ! ${w}`);
    console.log(
      "\n[reseed] Documents are never modified here. Restoring a seeded document is" +
        "\n[reseed] local-only: run demo-content/build-documents.ps1 (Windows + Word)," +
        "\n[reseed] then upload through POST /api/docs per demo-content/upload-manifest.json.",
    );
  } else {
    console.log("[reseed] Clean — data matches the seed and all seeded documents are searchable.");
  }
}

main()
  .catch((e) => {
    console.error("[reseed] Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
