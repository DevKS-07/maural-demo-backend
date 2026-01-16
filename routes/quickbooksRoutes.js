const express = require("express");
const router = express.Router();

const quickbooksController = require("../controllers/quickbooks.controller");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// External API Routes
router.get("/", (req, res) => {
  res.send("This is the QuickBooks API.");
});

router.get("/install", quickbooksController.installQuickbooks);

router.get("/oauth-callback", quickbooksController.getQuickbooksCallback);

router.get("/success", quickbooksController.connectionSuccessHandler);

router.get("/status", quickbooksController.getQuickbooksStatus);

module.exports = router;
