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

router.get("/oauth-callback", quickbooksController.callbackHandler);

router.get("/success", quickbooksController.connectionSuccessHandler);

router.get("/status", quickbooksController.connectionStatus);

/**
 * TODO: -------- Add Routes to Fetch Data -------- *
 *
 ** Ref: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/most-commonly-used/account
 *
 ** Following are the most common data object types fetched from quickbooks
 *
 * Account
 * Bill
 * CompanyInfo
 * Customer
 * Employee
 * Estimate
 * Invoice
 * Item
 * Payment
 * Preferences
 * ProfitAndLoss
 * TaxAgency
 * Vendor
 */

module.exports = router;
