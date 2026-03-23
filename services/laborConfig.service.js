// laborConfig.service.js
// Auto-detection orchestration for labor KPI source configuration.
// Called fire-and-forget from OAuth callbacks — errors are logged, not thrown.

const prisma = require("../lib/prisma");
const { detectDefaultBoard } = require("./monday.service");
const { detectDefaultWorkspace } = require("./clickup.service");

/**
 * Auto-configure labor source after Monday OAuth.
 * Finds the first board with a time tracking column and sets it as the default.
 */
const autoConfigureMonday = async (orgId) => {
  try {
    const result = await detectDefaultBoard(orgId);
    if (!result) {
      console.warn(
        `[LaborConfig] No board with time tracking found for org ${orgId}`
      );
      return;
    }
    await prisma.organisation.update({
      where: { org_id: orgId },
      data: {
        laborSource: "monday",
        mondayBoardId: result.boardId,
      },
    });
    console.log(
      `[LaborConfig] Auto-configured Monday board "${result.boardName}" for org ${orgId}`
    );
  } catch (err) {
    console.error(
      `[LaborConfig] Monday auto-config failed for org ${orgId}:`,
      err.message
    );
  }
};

/**
 * Auto-configure labor source after ClickUp OAuth.
 * Picks the first workspace (most accounts have only one).
 */
const autoConfigureClickUp = async (orgId) => {
  try {
    const result = await detectDefaultWorkspace(orgId);
    if (!result) {
      console.warn(
        `[LaborConfig] No ClickUp workspace found for org ${orgId}`
      );
      return;
    }
    await prisma.organisation.update({
      where: { org_id: orgId },
      data: {
        laborSource: "clickup",
        clickupWorkspaceId: result.workspaceId,
      },
    });
    console.log(
      `[LaborConfig] Auto-configured ClickUp workspace "${result.workspaceName}" for org ${orgId}`
    );
  } catch (err) {
    console.error(
      `[LaborConfig] ClickUp auto-config failed for org ${orgId}:`,
      err.message
    );
  }
};

module.exports = { autoConfigureMonday, autoConfigureClickUp };
