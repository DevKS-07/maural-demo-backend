const express = require("express");

// Controller functions for document routes

// Home route for testing
exports.docs_Testing = (req, res) => {
  res.send("Docs API is working");
};

// Get all documents
exports.getAllDocuments = (req, res) => {
  // TODO: Implement logic to fetch all documents
  res.status(200).json({ message: "Get all documents" });
};

// Get a single document by ID
exports.getDocumentById = (req, res) => {
  const { id } = req.params;
  // TODO: Implement logic to fetch a document by ID
  res.status(200).json({ message: `Get document with ID: ${id}` });
};

// Get a single document by Type (i.e. Financial, Legal, etc.)
exports.getDocumentByType = (req, res) => {
  const { type } = req.params;
  // TODO: Implement logic to fetch a document by ID
  res.status(200).json({ message: `Get document with Type: ${type}` });
};

// Create a new document
exports.createDocument = (req, res) => {
  // TODO: Implement logic to create a new document
  res.status(201).json({ message: "Document created" });
};

exports.uploadDocuments = (req, res) => {
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
};

// Update a document by ID
exports.updateDocument = (req, res) => {
  const { id } = req.params;
  // TODO: Implement logic to update a document by ID
  res.status(200).json({ message: `Document with ID: ${id} updated` });
};

// Update a document by Type
exports.updateDocument = (req, res) => {
  const { type } = req.params;
  // TODO: Implement logic to update a document by ID
  res.status(200).json({ message: `Document with Type: ${type} updated` });
};

// Delete a document by ID
exports.deleteDocument = (req, res) => {
  const { id } = req.params;
  // TODO: Implement logic to delete a document by ID
  res.status(200).json({ message: `Document with ID: ${id} deleted` });
};
