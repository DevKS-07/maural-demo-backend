const prisma = require("../lib/prisma");

///////////////////////////////  GET ROUTES ///////////////////////////////

/**
 * Get the VTO for an organisation
 * @route GET /vto/:orgId
 * @param {string} req.params.orgId - The UUID of the organisation
 * @returns {object} - The VTO object if found, otherwise an error message
 */
exports.getVTOByOrgId = async (req, res) => {
  const { orgId } = req.params;
  try {
    const vto = await prisma.vTO.findUnique({
      where: { org_id: orgId },
    });
    if (!vto) {
      return res
        .status(404)
        .json({ message: `No VTO found for organisation ${orgId}` });
    }
    res.status(200).json(vto);
  } catch (error) {
    console.error("Failed to retrieve VTO:", error.message);
    res.status(500).json({ message: "Failed to retrieve VTO" });
  }
};

///////////////////////////////  POST ROUTES ///////////////////////////////

/**
 * Create a VTO for an organisation (one-to-one)
 * @route POST /vto/:orgId
 * @param {string} req.params.orgId - The UUID of the organisation
 * @returns {object} - The newly created VTO object
 */
exports.createVTO = async (req, res) => {
  const { orgId } = req.params;
  const {
    title,
    year,
    core_values,
    mission,
    vision,
    ten_year_targets,
    target_market,
    proven_process,
    differentiators,
    guarantee,
    future_date,
    revenue,
    profit,
    measurables,
    look_like,
  } = req.body;

  if (!title || !year) {
    return res
      .status(400)
      .json({ message: "title and year are required" });
  }

  try {
    const existing = await prisma.vTO.findUnique({
      where: { org_id: orgId },
    });
    if (existing) {
      return res
        .status(409)
        .json({ message: `A VTO already exists for organisation ${orgId}` });
    }

    const newVTO = await prisma.vTO.create({
      data: {
        org_id: orgId,
        title,
        year,
        core_values,
        mission,
        vision,
        ten_year_targets,
        target_market,
        proven_process,
        differentiators,
        guarantee,
        future_date,
        revenue,
        profit,
        measurables,
        look_like,
      },
    });
    res.status(201).json(newVTO);
  } catch (error) {
    console.error("Failed to create VTO:", error.message);
    res.status(500).json({ message: "Failed to create VTO" });
  }
};

///////////////////////////////  PUT ROUTES ///////////////////////////////

/**
 * Update the VTO for an organisation
 * @route PUT /vto/:orgId
 * @param {string} req.params.orgId - The UUID of the organisation
 * @returns {object} - The updated VTO object
 */
exports.updateVTO = async (req, res) => {
  const { orgId } = req.params;
  const {
    title,
    year,
    core_values,
    mission,
    vision,
    ten_year_targets,
    target_market,
    proven_process,
    differentiators,
    guarantee,
    future_date,
    revenue,
    profit,
    measurables,
    look_like,
  } = req.body;

  try {
    const updatedVTO = await prisma.vTO.update({
      where: { org_id: orgId },
      data: {
        title,
        year,
        core_values,
        mission,
        vision,
        ten_year_targets,
        target_market,
        proven_process,
        differentiators,
        guarantee,
        future_date,
        revenue,
        profit,
        measurables,
        look_like,
      },
    });
    res.status(200).json(updatedVTO);
  } catch (error) {
    console.error("Failed to update VTO:", error.message);
    res.status(500).json({ message: `Failed to update VTO for organisation ${orgId}` });
  }
};

///////////////////////////////  DELETE ROUTES ///////////////////////////////

/**
 * Delete the VTO for an organisation
 * @route DELETE /vto/:orgId
 * @param {string} req.params.orgId - The UUID of the organisation
 * @returns {object} - A success message
 */
exports.deleteVTO = async (req, res) => {
  const { orgId } = req.params;
  try {
    await prisma.vTO.delete({
      where: { org_id: orgId },
    });
    res.status(200).json({ message: `VTO for organisation ${orgId} deleted` });
  } catch (error) {
    console.error("Failed to delete VTO:", error.message);
    res.status(500).json({ message: `Failed to delete VTO for organisation ${orgId}` });
  }
};
