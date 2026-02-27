const express = require("express");
const router = express.Router();
const { chat, streamChat } = require("../controllers/chat.controller");
const { ingest } = require("../controllers/ingest.controller");

router.post("/stream", streamChat);
router.post("/", chat);
router.post("/ingest", ingest);

module.exports = router;
