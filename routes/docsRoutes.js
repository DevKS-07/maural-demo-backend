const express = require("express");
const multer = require("multer");
const docsController = require("../controllers/docs.controller");

const router = express.Router();

const upload = multer({ dest: "uploads/" }); // Multer setup for file uploads

// Home route for testing

router.get("/", docsController.docs_Testing);

///////////////////////////////  GET ROUTES ///////////////////////////////

/**
 * TODO: Add a middleware to restrict access to docs for users depending on their roles
 * For Example
 * - Admins can view and upload all documents for all clients
 * - Clients can only view and upload their own documents and not others
 * */

router.get("/", docsController.getAllDocuments); // Get all documents
router.get("/type", docsController.getDocumentByType); // Get documents by Type
router.get("/:id", docsController.getDocumentById); // Get document by ID

///////////////////////////////  POST ROUTES ///////////////////////////////

router.post("/", docsController.createDocument); // Upload/Create a document
// router.post("/upload", upload.array("files", 20), docsController.uploadDocuments);

///////////////////////////////  PUT ROUTES ///////////////////////////////

router.put("/:id", docsController.updateDocument); // Update a document by ID

/////////////////////////////// DELETE ROUTES ///////////////////////////////

router.delete("/:id", docsController.deleteDocument); // Delete a document by ID

module.exports = router;
