const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth.middleware");

const quickbooksController = require("../controllers/quickbooks.controller");

// External API Routes
router.get("/", (req, res) => {
  res.send("This is the QuickBooks API.");
});

router.get("/install", requireAuth, quickbooksController.installQuickbooks);

router.get("/oauth-callback", quickbooksController.callbackHandler);

router.get("/success", requireAuth, quickbooksController.connectionSuccessHandler);

router.get("/status", requireAuth, quickbooksController.connectionStatus);

/** 
router.get("/accounts", quickbooksController.getAccounts); // Get All accounts in a company

router.get("/accounts/:accountId", quickbooksController.getAccountById); // Get a specific account (Try these id's for testing: 33, 30, 90)

router.get("/company-info", quickbooksController.getCompanyInfo); // get the CompanyInfo object

router.get("/bills", quickbooksController.getBills); // Get All Bills in a company

router.get("/bills/:billId", quickbooksController.getBillById); // Get a specific bill (Try these id's for testing: 98, 97, 20, 19)

router.get("/invoices", quickbooksController.getInvoices); // Get All invoices in a company

router.get("/invoices/:invoiceId", quickbooksController.getInvoiceById); // Get a specific invoice (Try these id's for testing: 178, 180, 177, 174)

router.get("/invoices/:invoiceId/pdf", quickbooksController.getInvoicePdf); // Get a specific invoice as a pdf (Try these id's for testing: 178, 180, 177, 174)

router.get("/tax-agency", quickbooksController.getTaxAgency); // Get all TaxAgency Objects in a Company (paged).

router.get("/tax-agency/:taxId", quickbooksController.getTaxAgencyById); // Get a specefic TaxAgency Object (try 1, 2)

router.get("/customers", quickbooksController.getCustomers); // Get All customers in a company

router.get("/customers/:customerId", quickbooksController.getCustomerById); // Get a specific customer object by id (Try 61, 1, 58, 59)

*/

/**
 **Online Accounting API endpoint format
 * Basic format: <OPERATION> <baseURL>/v3/company/<id>/<entity>?<minorversion>
 */

/**
 ** ------------ TO BE IMPLEMENTED ------------ *
 *
 * ---- Transactional_Data ----
 * Payment
 * JournalEntry
 *
 * ---- Reference data ----
 * Vendor
 * Employee
 *
 * ---- Financial reports (high value) ----
 * BalanceSheet
 * ProfitAndLoss
 * CashFlow
 *
 */

module.exports = router;
