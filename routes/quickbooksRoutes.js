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

router.get("/accounts", quickbooksController.getAccounts); // Get All accounts in a company
router.get("/accounts/:accountId", quickbooksController.getAccountById); // Get a specific account (Try these id's for testing: 33, 30, 90)

router.get("/company-info", quickbooksController.getCompanyInfo); // get the CompanyInfo object

router.get("/bills", quickbooksController.getBills); // Get All Bills in a company
router.get("/bills/:billId", quickbooksController.getBillById); // Get a specific bill (Try these id's for testing: 98, 97, 20, 19)

/**
 **Online Accounting API endpoint format
 * Basic format: <OPERATION> <baseURL>/v3/company/<id>/<entity>?<minorversion>
 *
 **Payment API endpoint format
 * Basic format: <OPERATION> <base URL>/quickbooks/v4/customers/<id>/<entity>
 */

/**
 * TODO: -------- Add Routes to Fetch Data -------- *
 *
 ** Ref: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/most-commonly-used/account
 *
 ** Following are the most common data object types fetched from quickbooks
 *
 **Transactional Data
 * Bill: All, ById
 * Invoice
 * Payment
 * JournalEntry
 *
 **Reference data
 * Account: All, ById
 * Customer
 * Vendor
 * CompanyInfo
 * Employee
 *
 ** Financial reports (high value)
 * BalanceSheet
 * ProfitAndLoss
 * CashFlow
 * TaxAgency
 *
 ** Other
 * Estimate
 * Item
 * Preferences
 */

module.exports = router;
