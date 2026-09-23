/**
 * Demo seed — idempotent.
 *
 * Run with:
 *   node -r dotenv/config prisma/seed.js
 *
 * NOT bare `node prisma/seed.js`: this file loads no env itself, and its
 * `lib/prisma` -> `config/env` import hard-exits on missing required vars.
 * `-r dotenv/config` loads plain `.env` first.
 *
 * Every write here is an upsert keyed on a stable value (fixed uuid, fixed
 * integer id, clerk id, or the org+period composite), so the script can be
 * re-run any number of times and converge on the same state. Do not
 * reintroduce an early `return` when a row already exists — the Phase 6
 * reseed path depends on re-running this, and anything after such a check
 * would silently never run.
 *
 * The data itself lives in ./demo-data.js, which tracks
 * demo-content/COMPANY_BRIEF.md.
 */

const prisma = require("../lib/prisma");
const { getSupabase } = require("../lib/supabase");
const { CLERK_ROLE_TO_DB_ROLE } = require("../config/roles");
const {
  DEMO_ORG_ID,
  PLATFORM_ORG,
  DEMO_ORG,
  USERS,
  FINANCE_KPIS,
  LEADS_KPIS,
  LABOR_KPIS,
  VTO,
} = require("./demo-data");

/**
 * Role ids are hard-coded in the FRONTEND (`src/hooks/useRoles.ts`) and the
 * labels are looked up by name in `auth.controller.js`. Both must match
 * exactly: a wrong id breaks the role dropdown, a wrong label fails silently.
 */
const ROLES = [
  { role_id: 1n, role_name: "Super Admin" },
  { role_id: 2n, role_name: "Admin" },
  { role_id: 3n, role_name: "Org Executive" },
  { role_id: 4n, role_name: "Org Staff" },
];

/**
 * Category ids are hard-coded in the FRONTEND (`CATEGORY_ID_MAP` in
 * `src/components/DocumentsToolbar.tsx`) and sent straight through on upload,
 * where `File.ctg_id` is a foreign key. A missing row fails the upload on the
 * FK. ("Uncategorized" is a null `ctg_id` — it is not a row.)
 */
const CATEGORIES = [
  { ctg_id: 1n, ctg_name: "Sales" },
  { ctg_id: 2n, ctg_name: "Marketing" },
  { ctg_id: 3n, ctg_name: "Finance" },
  { ctg_id: 4n, ctg_name: "Legal" },
  { ctg_id: 5n, ctg_name: "Technical" },
];

/**
 * Fails loudly if `config/roles.js` and the seeded labels ever drift apart.
 * Without this the mismatch surfaces as an empty role lookup at login rather
 * than as an error here.
 */
function assertRoleLabelsMatchConfig() {
  const fromConfig = new Set(Object.values(CLERK_ROLE_TO_DB_ROLE));
  const seeded = new Set(ROLES.map((r) => r.role_name));

  const missing = [...fromConfig].filter((l) => !seeded.has(l));
  const extra = [...seeded].filter((l) => !fromConfig.has(l));

  if (missing.length || extra.length) {
    throw new Error(
      `Role labels drifted from config/roles.js.` +
        (missing.length ? ` Missing from seed: ${missing.join(", ")}.` : "") +
        (extra.length ? ` Not in config: ${extra.join(", ")}.` : ""),
    );
  }
}

/**
 * Explicit ids do not advance the table's sequence, so the next
 * auto-generated id would collide with a seeded one. Re-running setval with
 * the same max is harmless.
 */
async function advanceSequence(table, column) {
  const [{ setval }] = await prisma.$queryRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"${table}"', '${column}'),
            (SELECT max("${column}") FROM "${table}")) AS setval`,
  );
  console.log(`[seed] Sequence "${table}"."${column}" advanced to ${setval}`);
}

async function seedOrg(org) {
  const { org_id, storage_bucket, ...rest } = org;
  const result = await prisma.organisation.upsert({
    where: { org_id },
    create: { org_id, storage_bucket, ...rest },
    // storage_bucket is deliberately left out of the update — changing it
    // would orphan every file already uploaded to the old bucket.
    update: rest,
  });
  console.log(`[seed] Org: "${result.org_name}" (${result.org_id})`);
  return result;
}

/**
 * Creating a bucket that already exists is the expected case on a reseed, so
 * that specific failure is treated as success. Anything else is reported but
 * not fatal — the rows are the important part, and a bucket can be created by
 * hand in the Supabase dashboard.
 */
async function ensureStorageBucket(bucketName) {
  const { error } = await getSupabase().storage.createBucket(bucketName, {
    public: false,
  });

  if (!error) {
    console.log(`[seed] Created storage bucket: ${bucketName}`);
    return;
  }

  const alreadyExists =
    String(error.statusCode) === "409" ||
    /already exists/i.test(error.message || "");

  if (alreadyExists) {
    console.log(`[seed] Storage bucket already present: ${bucketName}`);
  } else {
    console.error(
      `[seed] Failed to create storage bucket "${bucketName}": ${error.message}`,
    );
  }
}

async function seedRoles() {
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { role_id: role.role_id },
      create: role,
      update: { role_name: role.role_name },
    });
  }
  console.log(`[seed] Roles: ${ROLES.length} upserted`);
  await advanceSequence("Role", "role_id");
}

async function seedCategories() {
  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { ctg_id: category.ctg_id },
      create: category,
      update: { ctg_name: category.ctg_name },
    });
  }
  console.log(`[seed] Categories: ${CATEGORIES.length} upserted`);
  await advanceSequence("Category", "ctg_id");
}

/**
 * Two passes: `reports_to` references `user_id`, which autogenerates, so the
 * org chart can only be wired once every row exists. No sequence fix is
 * needed here — `user_id` is never supplied explicitly.
 */
async function seedUsers() {
  for (const user of USERS) {
    const { reports_to_clerk_id, ...fields } = user;
    await prisma.user.upsert({
      where: { clerk_id: user.clerk_id },
      create: fields,
      update: fields,
    });
  }

  const rows = await prisma.user.findMany({
    where: { clerk_id: { in: USERS.map((u) => u.clerk_id) } },
    select: { user_id: true, clerk_id: true },
  });
  const byClerkId = new Map(rows.map((u) => [u.clerk_id, u.user_id]));

  for (const user of USERS) {
    if (!user.reports_to_clerk_id) continue;
    await prisma.user.update({
      where: { clerk_id: user.clerk_id },
      data: { reports_to: byClerkId.get(user.reports_to_clerk_id) },
    });
  }

  console.log(`[seed] Users: ${USERS.length} upserted, org chart wired`);
}

/**
 * All three KPI tables are unique on (org_id, periodStart, periodEnd), so the
 * period composite is the natural idempotency key.
 */
async function seedKpis() {
  const tables = [
    ["financeKpi", FINANCE_KPIS, "finance"],
    ["leadsKpi", LEADS_KPIS, "leads"],
    ["laborKpi", LABOR_KPIS, "labor"],
  ];

  for (const [model, rows, label] of tables) {
    for (const row of rows) {
      await prisma[model].upsert({
        where: {
          org_id_periodStart_periodEnd: {
            org_id: DEMO_ORG_ID,
            periodStart: row.periodStart,
            periodEnd: row.periodEnd,
          },
        },
        create: { org_id: DEMO_ORG_ID, ...row },
        update: row,
      });
    }
    console.log(`[seed] KPIs (${label}): ${rows.length} periods upserted`);
  }
}

async function seedVto() {
  await prisma.vTO.upsert({
    where: { org_id: DEMO_ORG_ID },
    create: { org_id: DEMO_ORG_ID, ...VTO },
    update: VTO,
  });
  console.log(`[seed] VTO: "${VTO.title}"`);
}

async function main() {
  assertRoleLabelsMatchConfig();

  const platformOrg = await seedOrg(PLATFORM_ORG);
  await ensureStorageBucket(platformOrg.storage_bucket);

  const demoOrg = await seedOrg(DEMO_ORG);
  await ensureStorageBucket(demoOrg.storage_bucket);

  await seedRoles();
  await seedCategories();
  await seedUsers();
  await seedKpis();
  await seedVto();

  console.log("[seed] Done.");
}

main()
  .catch((e) => {
    console.error("[seed] Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
