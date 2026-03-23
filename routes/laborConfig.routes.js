const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth.middleware");
const ctrl = require("../controllers/laborConfig.controller");

router.get("/status", requireAuth, ctrl.getConfigStatus);
router.get("/monday/boards", requireAuth, ctrl.listMondayBoards);
router.get("/clickup/workspaces", requireAuth, ctrl.listClickUpWorkspaces);
router.put("/", requireAuth, ctrl.updateConfig);

module.exports = router;
