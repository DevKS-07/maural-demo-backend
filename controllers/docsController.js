const express = require("express");
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const e = require("express");
const prisma = new PrismaClient();
// Controller functions for document routes

///////////////////////////////  HOME ROUTE (Test Route) ///////////////////////////////

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

/**
 * Test route to check if the Docs API is working
 * @route GET /docs/
 * @return {string} A success message
 * */
exports.docs_Testing = (req, res) => {
  res.status(200).send("Docs API is working");
};

///////////////////////////////  GET ROUTES ///////////////////////////////

/**
 * Get all documents
 * @route GET /docs/all
 * @return {array} An array of document objects
 * */
exports.getAllDocuments = async (req, res) => {
  // TODO: Implement logic to fetch all documents
 // const { data: documents, error } = await supabase.storage.from('file_storage').list();
  const documents = await prisma.file.findMany();
  res.status(200).json(documents);
};

/** Get a single document by ID
 * @route GET /docs/id/:id
 * @param {string} req.params.id The ID of the document to retrieve
 * @return {object} The document object if found, otherwise an error message
 * */
exports.getDocumentById = async (req, res) => {
  const { id } = req.params;

  const file_meta = await prisma.file.findUnique({
    where: {
      file_id: id,
    },
  });

  const file = await supabase.storage.from('file_storage').info(file_meta.file_source.split('/')[1]);
  res.status(200).json({ "metadata": file_meta, "file": file  });
};

/** Get documents by Type
 * @route GET /docs/type/:type
 * @param {string} req.params.type The Type of the document to retrieve
 * @return {object} The document object if found, otherwise an error message
 * */
exports.getDocumentByType = (req, res) => {
  const { type } = req.params;
  // TODO: Implement logic to fetch a document by ID
  res.status(200).json({ message: `Get document with Type: ${type}` });
};

exports.getFileById = async (req, res) => {
  const { id } = req.params;
  const file = await prisma.file.findUnique({
    where: {
      file_id: id,
    },
  });

  const file_url = await supabase.storage.from('file_storage').createSignedUrl(file.file_source.split('/')[1], 300);
  res.status(200).json({ "file_url": file_url.data.signedUrl, "name": file.file_name, "extension": file.file_name.split('.')[1]  }); 

};

///////////////////////////////  POST ROUTES ///////////////////////////////

/**
 * Create a new document
 * @route POST /docs/create
 * @param {file} req.body.file The file to be uploaded
 * @return {object} A success message with details of created file or an error message
 * */
exports.createDocument = (req, res) => {
  // TODO: Implement logic to create a new document
  res.status(201).json({ message: "Document created" });
};

/**
 * Upload multiple documents
 * @route POST /docs/upload
 * @param {file} req.body.files The files to be uploaded
 * @return {object} A success message with details of uploaded files or an error message
 * */
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

///////////////////////////////  PUT ROUTES ///////////////////////////////

/**
 * Update a document by ID
 * @route PUT /docs/update/:id
 * @param {string} req.params.id The ID of the document to update
 * @return {object} A success message with details of updated file or an error message
 */
exports.updateDocument = (req, res) => {
  const { id } = req.params;
  // TODO: Implement logic to update a document by ID
  res.status(200).json({ message: `Document with ID: ${id} updated` });
};

/////////////////////////////// DELETE ROUTES ///////////////////////////////

/**
 * Delete a document by ID
 * @route DELETE /docs/delete/:id
 * @param {string} req.params.id The ID of the document to delete
 * @return {object} A success message with details of deleted file or an error message
 */
exports.deleteDocument = (req, res) => {
  const { id } = req.params;
  // TODO: Implement logic to delete a document by ID
  res.status(200).json({ message: `Document with ID: ${id} deleted` });
};
