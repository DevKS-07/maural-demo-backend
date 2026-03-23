// laborConfig.controller.js
// HTTP layer for labor KPI source configuration.
// Allows viewing current config, listing available boards/workspaces,
// and manually overriding the auto-detected defaults.

const prisma = require("../lib/prisma");
const { listBoards } = require("../services/monday.service");
const { listWorkspaces } = require("../services/clickup.service");

const TIME_TRACKING_TYPES = ["time_tracking", "duration"];

// Resolves org_id from the Clerk JWT on the request
const getOrgId = async (req) => {
  const { userId: clerkId } = req.auth();
  if (!clerkId) return null;
  const user = await prisma.user.findUnique({
    where: { clerk_id: clerkId },
    select: { org_id: true },
  });
  return user?.org_id ?? null;
};

/**
 * GET /api/integrations/labor-config/status
 * Returns the current labor KPI configuration for the user's org.
 */
const getConfigStatus = async (req, res) => {
  const org_id = await getOrgId(req);
  if (!org_id) return res.status(401).json({ error: "Not authenticated" });

  try {
    const org = await prisma.organisation.findUnique({
      where: { org_id },
      select: {
        laborSource: true,
        mondayBoardId: true,
        clickupWorkspaceId: true,
        monday_connected: true,
        clickup_connected: true,
      },
    });

    if (!org) return res.status(404).json({ error: "Organisation not found" });

    return res.status(200).json({
      laborSource: org.laborSource ?? null,
      mondayBoardId: org.mondayBoardId ?? null,
      clickupWorkspaceId: org.clickupWorkspaceId ?? null,
      monday_connected: org.monday_connected,
      clickup_connected: org.clickup_connected,
    });
  } catch (error) {
    console.error("[LaborConfig] getConfigStatus error:", error.message);
    return res.status(500).json({ error: "Failed to fetch labor config" });
  }
};

/**
 * GET /api/integrations/labor-config/monday/boards
 * Lists all Monday boards with a flag indicating time tracking support.
 */
const listMondayBoards = async (req, res) => {
  const org_id = await getOrgId(req);
  if (!org_id) return res.status(401).json({ error: "Not authenticated" });

  try {
    const token = await prisma.mondayToken.findUnique({ where: { org_id } });
    if (!token)
      return res
        .status(400)
        .json({ error: "Monday.com is not connected for this organisation" });

    const boards = await listBoards(org_id);

    const result = boards.map((b) => ({
      id: b.id,
      name: b.name,
      hasTimeTracking: b.columns.some((c) =>
        TIME_TRACKING_TYPES.includes(c.type)
      ),
    }));

    return res.status(200).json({ boards: result });
  } catch (error) {
    console.error("[LaborConfig] listMondayBoards error:", error.message);
    return res.status(500).json({ error: "Failed to list Monday boards" });
  }
};

/**
 * GET /api/integrations/labor-config/clickup/workspaces
 * Lists all ClickUp workspaces for the connected account.
 */
const listClickUpWorkspaces = async (req, res) => {
  const org_id = await getOrgId(req);
  if (!org_id) return res.status(401).json({ error: "Not authenticated" });

  try {
    const token = await prisma.clickUpToken.findUnique({ where: { org_id } });
    if (!token)
      return res
        .status(400)
        .json({ error: "ClickUp is not connected for this organisation" });

    const workspaces = await listWorkspaces(org_id);

    return res.status(200).json({ workspaces });
  } catch (error) {
    console.error(
      "[LaborConfig] listClickUpWorkspaces error:",
      error.message
    );
    return res
      .status(500)
      .json({ error: "Failed to list ClickUp workspaces" });
  }
};

/**
 * PUT /api/integrations/labor-config
 * Manually update the labor KPI source configuration.
 * Body: { laborSource: "monday"|"clickup", mondayBoardId?, clickupWorkspaceId? }
 */
const updateConfig = async (req, res) => {
  const org_id = await getOrgId(req);
  if (!org_id) return res.status(401).json({ error: "Not authenticated" });

  const { laborSource, mondayBoardId, clickupWorkspaceId } = req.body;

  if (!laborSource || !["monday", "clickup"].includes(laborSource)) {
    return res
      .status(400)
      .json({ error: 'laborSource must be "monday" or "clickup"' });
  }

  if (laborSource === "monday" && !mondayBoardId) {
    return res
      .status(400)
      .json({ error: "mondayBoardId is required when laborSource is monday" });
  }

  if (laborSource === "clickup" && !clickupWorkspaceId) {
    return res.status(400).json({
      error:
        "clickupWorkspaceId is required when laborSource is clickup",
    });
  }

  try {
    const data = { laborSource };
    if (laborSource === "monday") data.mondayBoardId = String(mondayBoardId);
    if (laborSource === "clickup")
      data.clickupWorkspaceId = String(clickupWorkspaceId);

    await prisma.organisation.update({
      where: { org_id },
      data,
    });

    return res.status(200).json({
      message: "Labor configuration updated",
      laborSource,
      mondayBoardId: data.mondayBoardId ?? null,
      clickupWorkspaceId: data.clickupWorkspaceId ?? null,
    });
  } catch (error) {
    console.error("[LaborConfig] updateConfig error:", error.message);
    return res.status(500).json({ error: "Failed to update labor config" });
  }
};

module.exports = {
  getConfigStatus,
  listMondayBoards,
  listClickUpWorkspaces,
  updateConfig,
};
