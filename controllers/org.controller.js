const prisma = require("../lib/prisma");
const { getSupabase } = require("../lib/supabase");

///////////////////////////////  HOME ROUTE (Test Route) ///////////////////////////////

/**
 * A simple route to test if the Organisation API is working
 * @route GET /org/
 * @returns {string} - A success message - "Organisation API is working"
 * */
exports.orgTesting = (req, res) => {
  res.status(200).send("Organisation API is working");
};

///////////////////////////////  GET ROUTES ///////////////////////////////

/**
 * ### FOR SUPER ADMIN / ADMIN ONLY ###
 * Get all organisations
 * @route GET /org/all
 * @returns {array} - An array of organisation objects
 * */
exports.getAllOrgs = async (req, res) => {
  try {
    const orgs = await prisma.organisation.findMany();
    res.status(200).json(orgs);
  } catch (error) {
    console.error("Failed to retrieve organisations:", error.message);
    res.status(500).json({ message: "Failed to retrieve organisations" });
  }
};

/**
 * Get a single organisation by ID
 * @route GET /org/:orgId
 * @param {string} req.params.orgId - The UUID of the organisation to retrieve
 * @returns {object} - The organisation object if found, otherwise an error message
 * */
exports.getOrgById = async (req, res) => {
  const { orgId } = req.params;
  try {
    const org = await prisma.organisation.findUnique({
      where: { org_id: orgId },
    });
    if (!org) {
      return res
        .status(404)
        .json({ message: `Organisation with ID ${orgId} not found` });
    }
    res.status(200).json(org);
  } catch (error) {
    console.error("Failed to retrieve organisation:", error.message);
    res.status(500).json({ message: "Failed to retrieve organisation" });
  }
};

/**
 * Get all users (employees) belonging to an organisation
 * @route GET /org/:orgId/users
 * @param {string} req.params.orgId - The UUID of the organisation
 * @returns {array} - An array of user objects belonging to the organisation
 * */
exports.getOrgUsers = async (req, res) => {
  const { orgId } = req.params;
  try {
    const users = await prisma.user.findMany({
      where: { org_id: orgId },
    });
    res.status(200).json(users);
  } catch (error) {
    console.error("Failed to retrieve organisation users:", error.message);
    res.status(500).json({ message: "Failed to retrieve organisation users" });
  }
};

/**
 * Get all files (documents) belonging to an organisation
 * @route GET /org/:orgId/files
 * @param {string} req.params.orgId - The UUID of the organisation
 * @returns {array} - An array of file objects belonging to the organisation
 * */
exports.getOrgFiles = async (req, res) => {
  const { orgId } = req.params;
  try {
    const files = await prisma.file.findMany({
      where: { org_id: orgId },
    });
    res.status(200).json(files);
  } catch (error) {
    console.error("Failed to retrieve organisation files:", error.message);
    res.status(500).json({ message: "Failed to retrieve organisation files" });
  }
};

///////////////////////////////  POST ROUTES ///////////////////////////////

/**
 * ### FOR SUPER ADMIN / ADMIN ONLY ###
 * Create / register a new organisation
 * @route POST /org/
 * @param {string} req.body.org_name - The name of the organisation (required)
 * @param {string} req.body.industry - The industry the organisation operates in
 * @param {string} req.body.founded - The founding date of the organisation (ISO date string)
 * @param {number} req.body.key_contacts - User ID of the key contact person
 * @param {string} req.body.company_location - Physical location of the organisation
 * @param {string} req.body.organization_chart - URL or description of the org chart
 * @param {string} req.body.gpt_types - GPT configuration types for the organisation
 * @returns {object} - The newly created organisation object
 * */
exports.createOrg = async (req, res) => {
  const {
    org_name,
    industry,
    founded,
    key_contacts,
    company_location,
    organization_chart,
    gpt_types,
  } = req.body;

  if (!org_name) {
    return res.status(400).json({ message: "org_name is required" });
  }

  try {
    const newOrg = await prisma.organisation.create({
      data: {
        org_name,
        industry,
        founded: founded ? new Date(founded) : undefined,
        key_contacts: key_contacts ? BigInt(key_contacts) : undefined,
        company_location,
        organization_chart,
        gpt_types,
      },
    });

    // Create a dedicated Supabase storage bucket for this organisation
    const { error: bucketError } = await getSupabase().storage.createBucket(
      newOrg.storage_bucket,
      { public: false },
    );

    if (bucketError) {
      console.error(
        `[org] Failed to create storage bucket "${newOrg.storage_bucket}":`,
        bucketError.message,
      );
      // Don't roll back — the org record is the source of truth.
      // A missing bucket will cause clear upload failures that can be diagnosed.
    } else {
      console.log(`[org] Created storage bucket: ${newOrg.storage_bucket}`);
    }

    res.status(201).json(newOrg);
  } catch (error) {
    console.error("Failed to create organisation:", error.message);
    res.status(500).json({ message: "Failed to create organisation" });
  }
};

///////////////////////////////  PUT ROUTES ///////////////////////////////

/**
 * ### FOR SUPER ADMIN / ADMIN / ORG EXECUTIVE ###
 * Update an organisation's profile by ID
 * @route PUT /org/:orgId
 * @param {string} req.params.orgId - The UUID of the organisation to update
 * @param {string} req.body.org_name - Updated organisation name
 * @param {string} req.body.industry - Updated industry
 * @param {string} req.body.founded - Updated founding date (ISO date string)
 * @param {number} req.body.key_contacts - Updated key contact user ID
 * @param {string} req.body.company_location - Updated company location
 * @param {string} req.body.organization_chart - Updated org chart
 * @param {string} req.body.gpt_types - Updated GPT types
 * @returns {object} - The updated organisation object
 * */
exports.updateOrg = async (req, res) => {
  const { orgId } = req.params;
  const {
    org_name,
    industry,
    founded,
    key_contacts,
    company_location,
    organization_chart,
    gpt_types,
  } = req.body;

  try {
    const updatedOrg = await prisma.organisation.update({
      where: { org_id: orgId },
      data: {
        org_name,
        industry,
        founded: founded ? new Date(founded) : undefined,
        key_contacts: key_contacts ? BigInt(key_contacts) : undefined,
        company_location,
        organization_chart,
        gpt_types,
      },
    });
    res.status(200).json(updatedOrg);
  } catch (_error) {
    res
      .status(500)
      .json({ message: `Failed to update organisation with ID ${orgId}` });
  }
};

///////////////////////////////  DELETE ROUTES ///////////////////////////////

/**
 * ### FOR SUPER ADMIN ONLY ###
 * Delete an organisation by ID
 * @route DELETE /org/:orgId
 * @param {string} req.params.orgId - The UUID of the organisation to delete
 * @returns {object} - A success message
 * */
exports.deleteOrg = async (req, res) => {
  const { orgId } = req.params;
  try {
    // Look up the org's storage bucket before deleting the record
    const org = await prisma.organisation.findUnique({
      where: { org_id: orgId },
      select: { storage_bucket: true },
    });

    await prisma.organisation.delete({
      where: { org_id: orgId },
    });

    // Best-effort cleanup of the Supabase storage bucket
    if (org?.storage_bucket) {
      try {
        const supabase = getSupabase();
        // Empty the bucket first (required before deletion)
        const { data: files } = await supabase.storage
          .from(org.storage_bucket)
          .list("uploads");
        if (files && files.length > 0) {
          await supabase.storage
            .from(org.storage_bucket)
            .remove(files.map((f) => `uploads/${f.name}`));
        }
        await supabase.storage.deleteBucket(org.storage_bucket);
        console.log(`[org] Deleted storage bucket: ${org.storage_bucket}`);
      } catch (bucketErr) {
        console.error(
          `[org] Failed to clean up storage bucket "${org.storage_bucket}":`,
          bucketErr.message,
        );
      }
    }

    res.status(200).json({ message: `Organisation with ID ${orgId} deleted` });
  } catch (_error) {
    res
      .status(500)
      .json({ message: `Failed to delete organisation with ID ${orgId}` });
  }
};
