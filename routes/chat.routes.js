const express = require("express");
const router = express.Router();
const { chat, streamChat } = require("../controllers/chat.controller");
const { ingest } = require("../controllers/ingest.controller");

router.get("/", (req, res) => {
  res.send("Welcome to the ChatBot!");
});

router.post("/", chat);
router.post("/stream", streamChat);
router.post("/ingest", ingest);

module.exports = router;
