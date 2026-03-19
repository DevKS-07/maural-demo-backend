const prisma = require("../lib/prisma");
const { getSupabase } = require("../lib/supabase");

async function main() {
  // Check if a platform org already exists
  const existing = await prisma.organisation.findFirst({
    where: { is_platform: true },
  });

  if (existing) {
    console.log(
      `[seed] Platform org already exists: "${existing.org_name}" (${existing.org_id})`,
    );
    return;
  }

  // Create the platform organisation
  const platformOrg = await prisma.organisation.create({
    data: {
      org_name: "Maural Solutions",
      is_platform: true,
    },
  });

  console.log(
    `[seed] Created platform org: "${platformOrg.org_name}" (${platformOrg.org_id})`,
  );

  // Create the Supabase storage bucket
  const { error } = await getSupabase().storage.createBucket(
    platformOrg.storage_bucket,
    { public: false },
  );

  if (error) {
    console.error(
      `[seed] Failed to create storage bucket "${platformOrg.storage_bucket}":`,
      error.message,
    );
  } else {
    console.log(
      `[seed] Created storage bucket: ${platformOrg.storage_bucket}`,
    );
  }
}

main()
  .catch((e) => {
    console.error("[seed] Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
