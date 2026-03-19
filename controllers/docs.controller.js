const prisma = require("../lib/prisma");
const mime = require("mime-types");
const { getSupabase } = require("../lib/supabase");

///////////////////////////////  HOME ROUTE (Test Route) ///////////////////////////////

/**
 * Test route to check if the Docs API is working
 * @route GET /docs/
 * @returns {string} A success message
 * */
exports.docs_Testing = (req, res) => {
  res.status(200).send("Docs API is working");
};

///////////////////////////////  GET ROUTES ///////////////////////////////

/**
 * Get all documents
 * @route GET /docs/all
 * @returns {array} An array of file metadata objects
 * */
exports.getAllDocuments = async (req, res) => {
  try {
    const documents = await prisma.file.findMany();
    res.status(200).json(documents);
  } catch (error) {
    console.error("Failed to retrieve documents:", error.message);
    res.status(500).json({ message: "Failed to retrieve documents" });
  }
};

/**
 * Get all documents belonging to a category
 * @route GET /docs/category/:ctgId
 * @param {string} req.params.ctgId - The ID of the category to filter by
 * @returns {array} An array of file metadata objects in the given category
 * */
exports.getDocumentsByCategory = async (req, res) => {
  const { ctgId } = req.params;
  try {
    const documents = await prisma.file.findMany({
      where: { ctg_id: BigInt(ctgId) },
      include: { Category: true },
    });
    res.status(200).json(documents);
  } catch (_error) {
    res
      .status(500)
      .json({ message: "Failed to retrieve documents by category" });
  }
};

/**
 * Get a single document by ID and stream the file from Supabase Storage
 * @route GET /docs/:id
 * @param {string} req.params.id - The UUID of the document to retrieve
 * @returns {Buffer} The raw file buffer with correct Content-Type headers
 * */
exports.getDocumentById = async (req, res) => {
  const { id } = req.params;
  try {
    const file_meta = await prisma.file.findUnique({
      where: { file_id: id },
    });

    if (!file_meta) {
      return res.status(404).json({ message: "File not found" });
    }

    // Parse bucket name and path from file_source (e.g. "bucket-uuid/uploads/file.pdf")
    const firstSlash = file_meta.file_source.indexOf("/");
    const bucketName = file_meta.file_source.substring(0, firstSlash);
    const filePath = file_meta.file_source.substring(firstSlash + 1);

    const { data: fileBlob, error } = await getSupabase().storage
      .from(bucketName)
      .download(filePath);

    if (error) {
      return res
        .status(500)
        .json({ message: "Failed to download file from storage" });
    }

    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    const mimeType =
      mime.lookup(file_meta.file_name) || "application/octet-stream";

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", buffer.length);
    res.end(buffer);
  } catch (error) {
    console.error("Failed to retrieve document:", error.message);
    res.status(500).json({ message: "Failed to retrieve document" });
  }
};

/**
 * Get all comments on a document
 * @route GET /docs/:id/comments
 * @param {string} req.params.id - The UUID of the document
 * @returns {array} An array of comment objects for the document
 * */
exports.getDocumentComments = async (req, res) => {
  const { id } = req.params;
  try {
    const comments = await prisma.comment.findMany({
      where: { file_id: id },
    });
    res.status(200).json(comments);
  } catch (_error) {
    res
      .status(500)
      .json({ message: "Failed to retrieve document comments" });
  }
};

/**
 * Get the activity log for a document
 * @route GET /docs/:id/activity
 * @param {string} req.params.id - The UUID of the document
 * @returns {array} An array of activity log entries for the document
 * */
exports.getDocumentActivity = async (req, res) => {
  const { id } = req.params;
  try {
    const activity = await prisma.activity_Log.findMany({
      where: { file_id: id },
      include: { ActivityType: true },
    });
    res.status(200).json(activity);
  } catch (_error) {
    res
      .status(500)
      .json({ message: "Failed to retrieve document activity" });
  }
};

///////////////////////////////  POST ROUTES ///////////////////////////////

/**
 * Upload a file to Supabase Storage and create its metadata record in the database
 * @route POST /docs/
 * @param {file}   req.file          - The file uploaded via multipart/form-data (field name: "file")
 * @param {number} req.body.ctg_id   - Category ID to assign to the document
 * @param {string} req.body.org_id  - Organisation UUID that owns this document
 * @param {number} req.body.user_id  - User ID of the uploader
 * @returns {object} The created file metadata record
 * */
exports.createDocument = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file provided" });
  }

  const { ctg_id, org_id, user_id } = req.body;

  if (!org_id) {
    return res.status(400).json({ message: "org_id is required" });
  }

  // --- Org-level authorization ---
  if (typeof req.auth === "function") {
    const { sessionClaims, userId: clerkId } = req.auth();
    const userRole = sessionClaims?.publicMetadata?.role;
    const isAdmin = userRole === "admin" || userRole === "super_admin";

    if (!isAdmin) {
      const dbUser = await prisma.user.findUnique({
        where: { clerk_id: clerkId },
        select: { org_id: true },
      });

      if (!dbUser?.org_id) {
        return res
          .status(403)
          .json({ message: "You are not assigned to any organisation" });
      }

      if (dbUser.org_id !== org_id) {
        return res.status(403).json({
          message:
            "You can only upload documents to your own organisation",
        });
      }
    }
  }

  // Resolve the org's storage bucket
  const org = await prisma.organisation.findUnique({
    where: { org_id },
    select: { storage_bucket: true },
  });

  if (!org) {
    return res.status(404).json({ message: `Organisation with ID ${org_id} not found` });
  }

  const safeName = encodeURIComponent(req.file.originalname);
  const bucketName = org.storage_bucket;

  try {
    const { data, error } = await getSupabase().storage
      .from(bucketName)
      .upload(`uploads/${safeName}`, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (error) {
      return res
        .status(500)
        .json({ message: "Failed to upload file to storage" });
    }

    const newFile = await prisma.file.create({
      data: {
        file_name: safeName,
        file_size: req.file.size,
        file_source: data.fullPath,
        ctg_id: ctg_id ? BigInt(ctg_id) : undefined,
        org_id,
        user_id: user_id ? BigInt(user_id) : undefined,
      },
    });

    res.status(201).json(newFile);
  } catch (error) {
    console.error("Failed to create document:", error.message);
    res.status(500).json({ message: "Failed to create document" });
  }
};

/**
 * Add a comment to a document
 * @route POST /docs/:id/comments
 * @param {string} req.params.id    - The UUID of the document to comment on
 * @param {string} req.body.comment - The comment text
 * @param {number} req.body.user_id - The ID of the user posting the comment
 * @returns {object} The created comment object
 * */
exports.addDocumentComment = async (req, res) => {
  const { id } = req.params;
  const { comment, user_id } = req.body;

  if (!comment) {
    return res.status(400).json({ message: "comment text is required" });
  }

  try {
    const newComment = await prisma.comment.create({
      data: {
        file_id: id,
        comment,
        user_id: user_id ? BigInt(user_id) : undefined,
        created_at: new Date(),
      },
    });
    res.status(201).json(newComment);
  } catch (error) {
    console.error("Failed to add comment:", error.message);
    res.status(500).json({ message: "Failed to add comment" });
  }
};

///////////////////////////////  PUT ROUTES ///////////////////////////////

/**
 * Update document metadata by ID (does not replace the file itself)
 * @route PUT /docs/:id
 * @param {string} req.params.id      - The UUID of the document to update
 * @param {string} req.body.file_name - Updated file name
 * @param {number} req.body.ctg_id    - Updated category ID
 * @param {string} req.body.org_id    - Updated organisation UUID
 * @returns {object} The updated file metadata record
 * */
exports.updateDocument = async (req, res) => {
  const { id } = req.params;
  const { file_name, ctg_id, org_id } = req.body;

  try {
    const updatedFile = await prisma.file.update({
      where: { file_id: id },
      data: {
        file_name,
        ctg_id: ctg_id ? BigInt(ctg_id) : undefined,
        org_id: org_id || undefined,
      },
    });
    res.status(200).json(updatedFile);
  } catch (_error) {
    res
      .status(500)
      .json({ message: `Failed to update document with ID ${id}` });
  }
};

///////////////////////////////  DELETE ROUTES ///////////////////////////////

/**
 * Delete a document by ID — removes from Supabase Storage and the database
 * @route DELETE /docs/:id
 * @param {string} req.params.id - The UUID of the document to delete
 * @returns {object} A success message
 * */
exports.deleteDocument = async (req, res) => {
  const { id } = req.params;
  try {
    const file = await prisma.file.delete({
      where: { file_id: id },
    });

    // Parse bucket name and path from file_source
    const firstSlash = file.file_source.indexOf("/");
    const bucketName = file.file_source.substring(0, firstSlash);
    const storagePath = file.file_source.substring(firstSlash + 1);

    const supabase = getSupabase();
    await supabase.storage.from(bucketName).remove([storagePath]);

    // Remove all embedding chunks for this file so the AI no longer sees it
    await supabase
      .from("document_embeddings")
      .delete()
      .eq("metadata->>file_id", String(id));

    res.status(200).json({ message: `Document with ID ${id} deleted` });
  } catch (_error) {
    res
      .status(500)
      .json({ message: `Failed to delete document with ID ${id}` });
  }
};

/**
 * Delete a comment from a document
 * @route DELETE /docs/:id/comments/:commentId
 * @param {string} req.params.id        - The UUID of the document (for context)
 * @param {string} req.params.commentId - The ID of the comment to delete
 * @returns {object} A success message
 * */
exports.deleteDocumentComment = async (req, res) => {
  const { commentId } = req.params;
  try {
    await prisma.comment.delete({
      where: { id: BigInt(commentId) },
    });
    res.status(200).json({ message: `Comment with ID ${commentId} deleted` });
  } catch (error) {
    console.error(`Failed to delete comment with ID ${commentId}:`, error.message);
    res.status(500).json({
      message: `Failed to delete comment with ID ${commentId}`,
    });
  }
};
