const express = require("express");
const multer = require("multer");
const docsController = require("../controllers/docs.controller");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max per file
});

// Home route for testing
router.get("/", docsController.docs_Testing);

// **************************  GET ROUTES **************************

/**
 * TODO: Add middleware to restrict access to docs based on user role:
 * - Super Admin / Admin: can view and upload all documents for all clients
 * - Client Executive / Client Staff: can only view and upload their own client's documents
 */

router.get("/all", docsController.getAllDocuments); // Get all documents

router.get("/category/:ctgId", docsController.getDocumentsByCategory); // Get documents by category

router.get("/:id", docsController.getDocumentById); // Get a single document by ID (streams file)

router.get("/:id/comments", docsController.getDocumentComments); // Get all comments on a document

router.get("/:id/activity", docsController.getDocumentActivity); // Get activity log for a document

// **************************  POST ROUTES **************************

router.post("/", upload.single("file"), docsController.createDocument); // Upload and create a document

router.post("/:id/comments", docsController.addDocumentComment); // Add a comment to a document

// **************************  PUT ROUTES **************************

router.put("/:id", docsController.updateDocument); // Update document metadata by ID

// ************************** DELETE ROUTES **************************

router.delete("/:id", docsController.deleteDocument); // Delete a document by ID

router.delete("/:id/comments/:commentId", docsController.deleteDocumentComment); // Delete a comment from a document

module.exports = router;
