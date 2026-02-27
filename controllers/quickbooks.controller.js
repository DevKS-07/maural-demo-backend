const axios = require("axios");
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });
const { createClient } = require("@supabase/supabase-js");

const OAuthClient = require("intuit-oauth");
const crypto = require("crypto");
const uuid = require("uuid");

const CLIENT_ID = process.env.QUICKBOOKS_CLIENT_ID;
const CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET;
const REDIRECT_URI = process.env.QUICKBOOKS_REDIRECT_URI;
const ENVIRONMENT = process.env.QUICKBOOKS_ENVIRONMENT || "sandbox";
const baseURL = process.env.QUICKBOOKS_BASE_URL;

let oauthClient = null;

// ################## OAuth Flow Handlers ##################

/**
 * Install QuickBooks - Initiates the OAuth 2.0 flow
 */
const installQuickbooks = async (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    return res
      .status(400)
      .send(
        "QuickBooks integration is not properly configured. Please contact the administrator.",
      );
  }

  try {
    oauthClient = new OAuthClient({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      environment: ENVIRONMENT,
      redirectUri: REDIRECT_URI,
      logging: false, // by default the value is `false`
    });

    // Change the scopes required for the application as needed
    const scopes = [
      OAuthClient.scopes.Accounting,
      // OAuthClient.scopes.Payment,
      // OAuthClient.scopes.Address,
      // OAuthClient.scopes.Email,
      // OAuthClient.scopes.OpenId,
      // OAuthClient.scopes.Profile,
      // OAuthClient.scopes.Phone,
      // OAuthClient.scopes.TimeTracking,
    ];

    // Generate a random state secret
    const authState = crypto.randomBytes(32).toString("hex");

    req.session.oauthState = authState; // Store the state secret on server-side for validating it in the callback.

    const authUri = oauthClient.authorizeUri({
      scope: scopes,
      state: authState, // You can enter any string value for the state.
      // The server should return the exact state : value pair sent in the original request.
      // Include an anti-forgery token for the state and confirm it in the response.
      // This prevents cross-site request forgery.
      response_type: "code",
    });

    oauthClient.state = res.redirect(authUri);
  } catch (error) {
    console.error("Error generating QuickBooks authorization URL: ", error);
    res
      .status(500)
      .send("Error initiating QuickBooks installation. Please try again.");
  }
};

/**
 * Handle OAuth callback from QuickBooks
 */
const callbackHandler = async (req, res) => {
  const { code, state, realmId } = req.query;
  const callbackUrl = req.url;

  console.log("\n=== OAuth Callback Received ===");
  console.log("Query params:", req.query);
  console.log("===============================\n");

  if (!code || !state) {
    return res.status(400).send("Missing required query parameters.");
  }

  const expectedState = req.session.oauthState;

  // Validating state secret to prevent CSRF attacks
  if (!expectedState || state !== expectedState) {
    return res.status(400).send("Invalid authentication request.");
  }

  // Invalidate state secret once auth is successful (to prevent replay)
  delete req.session.oauthState;

  try {
    const authResponse = await oauthClient.createToken(callbackUrl);
    const {
      access_token,
      refresh_token,
      expires_in,
      x_refresh_token_expires_in,
      token_type,
    } = authResponse.json;

    // console.log(authResponse.json);
    // console.log(`
    //   token_type: ${token_type}\n
    //   access_token: ${access_token}\n
    //   refresh_token: ${refresh_token}\n
    //   expires_in: ${expires_in}\n
    //   x_refresh_token_expires_in: ${x_refresh_token_expires_in}\n
    //   `);

    // ! TODO: Later change this to use user_id from Clerk Auth
    const user_id = realmId;
    req.session.user_id = user_id;
    console.log(`User ID: ${user_id}`);

    // Storing these tokens in DB
    await prisma.quickbooksToken.upsert({
      where: { user_id: user_id },
      create: {
        user_id: user_id,
        access_token,
        refresh_token,
        token_type,
        realmId,
        expires_in,
        x_refresh_token_expires_in,
      },
      update: {
        access_token,
        refresh_token,
        token_type,
        x_refresh_token_expires_in,
      },
    });

    res.redirect("/api/integrations/quickbooks/success");
  } catch (error) {
    console.error("Error fetching access tokens: ", error);
    res.status(500).send("Error connecting QuickBooks. Please try again.");
  }
};

/**
 * Handle logic after successful connection to QuickBooks
 */
const connectionSuccessHandler = async (req, res) => {
  const user_id = req.session.user_id;
  console.log(`User (realmId): ${user_id}`);

  try {
    const token = prisma.quickbooksToken.findUnique({
      where: { user_id: user_id },
    });
    console.log(`Token: ${token}`);

    console.log(`QuickBooks Integration Successful!`);

    // TODO: Redirect to frontend /quickbooks  route
    // res.redirect("http://localhost:3000/quickbooks"); // Redirecting to frontend QuickBooks Dashboard page
    res.redirect("/api/integrations/quickbooks/status"); // Redirecting to frontend QuickBooks Dashboard page

    // res.redirect("/api/integrations/quickbooks/status");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error connecting QuickBooks!");
  }
};

/**
 * Check if the user is connected to Quickbooks or not.
 * @param {*} req
 * @param {*} res sends {connected: true} if the user is connected, otherwise {connected: false}.
 */
const connectionStatus = async (req, res) => {
  try {
    const user_id = req.session.user_id;

    if (!user_id) {
      return res.status(200).json({ connected: false });
    }

    const token = await prisma.quickbooksToken.findUnique({
      where: { user_id },
    });

    return res.status(200).json({
      connected: Boolean(token),
    });
  } catch (error) {
    console.error("Quickbooks status error:", error);
    return res.status(500).json({
      connected: false,
      error: "Failed to check Quickbooks connection status",
    });
  }
};

/**
 * Refresh the access-token
 */
const refreshAccessToken = (req, res) => {
  oauthClient
    .refresh()
    .then(function (authResponse) {
      console.log(
        `\n The Refresh Token is  ${JSON.stringify(authResponse.json)}`,
      );
      oauth2_token_json = JSON.stringify(authResponse.json, null, 2);
      // TODO: update access_token in db.
      res.send(oauth2_token_json);
    })
    .catch(function (e) {
      console.error(e);
    });
};

// ################## Data Handlers ##################
/**
 * Retrieves the details of all accounts in a Company.
 */
const getAccounts = async (req, res) => {
  const user_id = req.session.user_id;
  const tokenRecord = await getTokenRecord(user_id);
  const { access_token, realmId } = tokenRecord;

  try {
    if (!realmId) {
      return res.status(401).send("No realmId found!");
    }

    if (!access_token) {
      return res.status(401).send("No access token found for the user");
    }

    // ! TODO: Set "maxresults 100" in the query later on.
    const query = encodeURIComponent("select * from Account");
    const reqUrl = `${baseURL}/v3/company/${realmId}/query?query=${query}&minorversion=75`;

    const response = await axios.get(reqUrl, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/json",
      },
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send("Error fetching Account");
  }
};

/**
 * Retrieves the details of a specific account in a Company using its ID.
 */
const getAccountById = async (req, res) => {
  const { accountId } = req.params;
  const user_id = req.session.user_id;
  const tokenRecord = await getTokenRecord(user_id);
  const { access_token, realmId } = tokenRecord;

  try {
    if (!accountId) {
      return res.status(400).send("Account ID is required");
    }

    if (!realmId) {
      return res.status(401).send("No realmId found!");
    }

    if (!access_token) {
      return res.status(401).send("No access token found for the user");
    }

    const reqUrl = `${baseURL}/v3/company/${realmId}/account/${accountId}?minorversion=75`;

    const response = await axios.get(reqUrl, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/json",
      },
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);

    if (error.response?.status === 404) {
      return res.status(404).send("Account not found in QuickBooks");
    }

    res.status(500).send("Error fetching Account");
  }
};

/**
 * Retrieves the details of the CompanyInfo object.
 */
const getCompanyInfo = async (req, res) => {
  const user_id = req.session.user_id;
  const tokenRecord = await getTokenRecord(user_id);
  const { access_token, realmId } = tokenRecord;

  try {
    if (!realmId) {
      return res.status(401).send("No realmId found!");
    }

    if (!access_token) {
      return res.status(401).send("No access token found for the user");
    }

    const reqUrl = `${baseURL}/v3/company/${realmId}/companyinfo/${realmId}`;

    const response = await axios.get(reqUrl, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/json",
      },
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send("Error fetching Company Info");
  }
};

/**
 * Retrieves all Bills in a Company (paged).
 */
const getBills = async (req, res) => {
  const user_id = req.session.user_id;
  const tokenRecord = await getTokenRecord(user_id);
  const { access_token, realmId } = tokenRecord;

  try {
    if (!realmId) {
      return res.status(401).send("No realmId found!");
    }

    if (!access_token) {
      return res.status(401).send("No access token found for the user");
    }

    let startPosition = 1;
    const maxResults = 1000;
    let allBills = [];
    let hasMore = true;

    while (hasMore) {
      const query = encodeURIComponent(
        `select * from Bill STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`,
      );

      const reqUrl = `${baseURL}/v3/company/${realmId}/query?query=${query}&minorversion=75`;

      const response = await axios.get(reqUrl, {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/json",
        },
      });

      const bills = response.data?.QueryResponse?.Bill || [];
      allBills.push(...bills);

      if (bills.length < maxResults) {
        hasMore = false;
      } else {
        startPosition += maxResults;
        await new Promise((r) => setTimeout(r, 300)); // throttle
      }
    }

    res.status(200).json(allBills);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send("Error fetching Bills");
  }
};

/**
 * Retrieves the details of a specific Bill in a Company using its ID.
 */
const getBillById = async (req, res) => {
  const { billId } = req.params;
  const user_id = req.session.user_id;
  const tokenRecord = await getTokenRecord(user_id);
  const { access_token, realmId } = tokenRecord;

  try {
    if (!billId) {
      return res.status(400).send("Bill ID is required");
    }

    if (!realmId) {
      return res.status(401).send("No realmId found!");
    }

    if (!access_token) {
      return res.status(401).send("No access token found for the user");
    }

    const reqUrl = `${baseURL}/v3/company/${realmId}/bill/${billId}?minorversion=75`;

    const response = await axios.get(reqUrl, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/json",
      },
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);

    if (error.response?.status === 404) {
      return res.status(404).send("Bill not found in QuickBooks");
    }

    res.status(500).send("Error fetching Bill");
  }
};

/**
 * Retrieves all Invoices in a Company (paged).
 */
const getInvoices = async (req, res) => {
  const user_id = req.session.user_id;
  const tokenRecord = await getTokenRecord(user_id);
  const { access_token, realmId } = tokenRecord;

  try {
    if (!realmId) {
      return res.status(401).send("No realmId found!");
    }

    if (!access_token) {
      return res.status(401).send("No access token found for the user");
    }

    let startPosition = 1;
    const maxResults = 1000;
    let allInvoices = [];
    let hasMore = true;

    while (hasMore) {
      const query = encodeURIComponent(
        `select * from Invoice STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`,
      );

      const reqUrl = `${baseURL}/v3/company/${realmId}/query?query=${query}&minorversion=75`;

      const response = await axios.get(reqUrl, {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/json",
        },
      });

      const invoices = response.data?.QueryResponse?.Invoice || [];
      allInvoices.push(...invoices);

      if (invoices.length < maxResults) {
        hasMore = false;
      } else {
        startPosition += maxResults;
        await new Promise((r) => setTimeout(r, 300)); // throttle
      }
    }

    res.status(200).json(allInvoices);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send("Error fetching Invoices");
  }
};

/**
 * Retrieves the details of a specific Invoice using its ID.
 */
const getInvoiceById = async (req, res) => {
  const { invoiceId } = req.params;
  const user_id = req.session.user_id;
  const tokenRecord = await getTokenRecord(user_id);
  const { access_token, realmId } = tokenRecord;

  try {
    if (!invoiceId) {
      return res.status(400).send("Invoice ID is required");
    }

    if (!realmId) {
      return res.status(401).send("No realmId found!");
    }

    if (!access_token) {
      return res.status(401).send("No access token found for the user");
    }

    const reqUrl = `${baseURL}/v3/company/${realmId}/invoice/${invoiceId}?minorversion=75`;

    const response = await axios.get(reqUrl, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/json",
      },
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);

    if (error.response?.status === 404) {
      return res.status(404).send("Invoice not found in QuickBooks");
    }

    res.status(500).send("Error fetching Invoice");
  }
};

/**
 * This returns the specified object in the response body
 * as an Adobe Portable Document Format (PDF) file. The resulting
 * PDF file is formatted according to custom form styles in
 * the company settings.
 */

const getInvoicePdf = async (req, res) => {
  const { invoiceId } = req.params;
  const user_id = req.session.user_id;
  const tokenRecord = await getTokenRecord(user_id);
  const { access_token, realmId } = tokenRecord;

  console.log("~~~~~ getInvoicePdf Ran ~~~~~~");

  try {
    if (!invoiceId) {
      return res.status(400).send("Invoice ID is required");
    }

    if (!realmId) {
      return res.status(401).send("No realmId found!");
    }

    if (!access_token) {
      return res.status(401).send("No access token found for the user");
    }

    const reqUrl = `${baseURL}/v3/company/${realmId}/invoice/${invoiceId}/pdf?minorversion=75`;

    const response = await axios.get(reqUrl, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/pdf",
      },
      responseType: "arraybuffer",
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=invoice-${invoiceId}.pdf`,
    });

    res.status(200).send(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);

    if (error.response?.status === 404) {
      return res.status(404).send("Invoice not found in QuickBooks");
    }

    res.status(500).send("Error fetching Invoice");
  }
};

/**
 * Retrieves all TaxAgency Objects in a Company (paged).
 */
const getTaxAgency = async (req, res) => {
  const user_id = req.session.user_id;
  const tokenRecord = await getTokenRecord(user_id);
  const { access_token, realmId } = tokenRecord;

  try {
    if (!realmId) {
      return res.status(401).send("No realmId found!");
    }

    if (!access_token) {
      return res.status(401).send("No access token found for the user");
    }

    let startPosition = 1;
    const maxResults = 1000;
    let allTaxObjects = [];
    let hasMore = true;

    while (hasMore) {
      const query = encodeURIComponent(
        `select * from TaxAgency STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`,
      );

      const reqUrl = `${baseURL}/v3/company/${realmId}/query?query=${query}&minorversion=75`;

      const response = await axios.get(reqUrl, {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/json",
        },
      });

      const taxObjects = response.data?.QueryResponse?.TaxAgency || [];
      allTaxObjects.push(...taxObjects);

      if (taxObjects.length < maxResults) {
        hasMore = false;
      } else {
        startPosition += maxResults;
        await new Promise((r) => setTimeout(r, 300)); // throttle
      }
    }

    res.status(200).json(allTaxObjects);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send("Error fetching TaxAgency");
  }
};

/**
 * Retrieves the details of a specific Invoice using its ID.
 */
const getTaxAgencyById = async (req, res) => {
  const { taxId } = req.params;
  const user_id = req.session.user_id;
  const tokenRecord = await getTokenRecord(user_id);
  const { access_token, realmId } = tokenRecord;

  try {
    if (!taxId) {
      return res.status(400).send("TaxAgency ID is required");
    }

    if (!realmId) {
      return res.status(401).send("No realmId found!");
    }

    if (!access_token) {
      return res.status(401).send("No access token found for the user");
    }

    const reqUrl = `${baseURL}/v3/company/${realmId}/taxagency/${taxId}?minorversion=75`;

    const response = await axios.get(reqUrl, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/json",
      },
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);

    if (error.response?.status === 404) {
      return res.status(404).send("TaxAgency not found in QuickBooks");
    }

    res.status(500).send("Error fetching TaxAgency");
  }
};

/**
 * Retrieves all Customers in a Company (paged).
 */
const getCustomers = async (req, res) => {
  const user_id = req.session.user_id;
  const tokenRecord = await getTokenRecord(user_id);
  const { access_token, realmId } = tokenRecord;

  try {
    if (!realmId) {
      return res.status(401).send("No realmId found!");
    }

    if (!access_token) {
      return res.status(401).send("No access token found for the user");
    }

    let startPosition = 1;
    const maxResults = 1000;
    let allCustomers = [];
    let hasMore = true;

    while (hasMore) {
      const query = encodeURIComponent(
        `select * from Customer STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`,
      );

      const reqUrl = `${baseURL}/v3/company/${realmId}/query?query=${query}&minorversion=75`;

      const response = await axios.get(reqUrl, {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/json",
        },
      });

      const customers = response.data?.QueryResponse?.Customer || [];
      allCustomers.push(...customers);

      if (customers.length < maxResults) {
        hasMore = false;
      } else {
        startPosition += maxResults;
        await new Promise((r) => setTimeout(r, 300)); // throttle
      }
    }

    res.status(200).json(allCustomers);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send("Error fetching Customers");
  }
};

/**
 * Retrieves the details of a specific Customer in a Company using its ID.
 */
const getCustomerById = async (req, res) => {
  const { customerId } = req.params;
  const user_id = req.session.user_id;
  const tokenRecord = await getTokenRecord(user_id);
  const { access_token, realmId } = tokenRecord;

  try {
    if (!customerId) {
      return res.status(400).send("Customer ID is required");
    }

    if (!realmId) {
      return res.status(401).send("No realmId found!");
    }

    if (!access_token) {
      return res.status(401).send("No access token found for the user");
    }

    const reqUrl = `${baseURL}/v3/company/${realmId}/customer/${customerId}?minorversion=75`;

    const response = await axios.get(reqUrl, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/json",
      },
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);

    if (error.response?.status === 404) {
      return res.status(404).send("Customer not found in QuickBooks");
    }

    res.status(500).send("Error fetching Customer");
  }
};

module.exports = {
  installQuickbooks,
  callbackHandler,
  connectionSuccessHandler,
  connectionStatus,
  refreshAccessToken,
  getAccounts,
  getAccountById,
  getCompanyInfo,
  getBills,
  getBillById,
  getInvoices,
  getInvoiceById,
  getInvoicePdf,
  getTaxAgency,
  getTaxAgencyById,
  getCustomers,
  getCustomerById,
};

// ##################### Utility Functions #####################

/**
 * Get the token data for a specific user
 * @param {*} user_id user ID
 * @returns The token record from the database
 */
const getTokenRecord = async (user_id) => {
  return await prisma.quickbooksToken.findUnique({
    where: { user_id: user_id },
  });
};
