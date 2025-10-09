const express = require("express");
const multer = require("multer");
const docsController = require("../controllers/docsController");

const router = express.Router();

const upload = multer({ dest: "uploads/" }); // Multer setup for file uploads

// Home route for testing
router.get("/", docsController.docs_Testing);
router.get("/all", docsController.getAllDocuments);

router.get("/id/:id", docsController.getDocumentById);
router.get("/type/:type", docsController.getDocumentByType);

// router.post("/upload", upload.array("files", 20), docsController.uploadDocuments);
router.post("/create", docsController.createDocument);

router.post("/upload", docsController.uploadDocuments);

module.exports = router;
