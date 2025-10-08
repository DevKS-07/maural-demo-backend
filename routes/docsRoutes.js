const express = require("express");
const multer = require("multer");

const router = express.Router();

const upload = multer({ dest: "uploads/" }); // Multer setup for file uploads

// Home route for testing
router.get("/", (req, res) => {
  res.send("Docs API is working");
});

// POST /docs/upload - Upload multiple documents
// router.post("/upload", upload.array("files", 20), (req, res) => {
router.post("/upload", (req, res) => {
  console.log("File upload endpoint hit"); // Debugging line

  // TODO: Process the uploaded files here
  // USE: multer to handle file uploads
  console.log(req.body);

  // Error handling for bad request
  //   if (!req.body) {
  //     return res.status(400).json({ error: "Body Empty." });
  //   }

  // Error handling for no file uploaded
  //   if (!req.file) {
  //     return res.status(400).send("No file uploaded");
  //   }

  //   const uploadedFiles = req.body.formdata.files.map((file) => ({
  //     filename: file.filename,
  //     path: file.path,
  //   }));
  //   console.log("Uploaded files:", req.body.formdata); // Log the uploaded files info

  res.status(200).json({
    message: "Files uploaded successfully.",
    // files: uploadedFiles,
  });
});

module.exports = router;
