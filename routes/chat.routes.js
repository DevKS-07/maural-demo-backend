const express = require("express");
const router = express.Router();
const { chat, streamChat } = require("../controllers/chat.controller");
const { ingest } = require("../controllers/ingest.controller");
const { requireOrgAccess } = require("../middleware/auth.middleware");

router.get("/", (req, res) => {
  res.send("Welcome to the ChatBot!");
});

router.post("/", requireOrgAccess("body"), chat);
router.post("/stream", requireOrgAccess("body"), streamChat);
router.post("/ingest", ingest);

module.exports = router;
