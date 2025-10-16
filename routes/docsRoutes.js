const express = require("express");
const multer = require("multer");
const docsController = require("../controllers/docsController");

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

router.get("/all", docsController.getAllDocuments);
router.get("/id/:id", docsController.getDocumentById);
router.get("/type/:type", docsController.getDocumentByType);

///////////////////////////////  POST ROUTES ///////////////////////////////

router.post("/upload", docsController.uploadDocuments);
router.post("/create", docsController.createDocument);
// router.post("/upload", upload.array("files", 20), docsController.uploadDocuments);

///////////////////////////////  PUT ROUTES ///////////////////////////////
router.put("/update/:id", docsController.updateDocument);

/////////////////////////////// DELETE ROUTES ///////////////////////////////
router.delete("/delete/:id", docsController.deleteDocument);

module.exports = router;
