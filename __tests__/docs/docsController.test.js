// ---------------------------------------------------------------------------
// Supabase storage mock — variables must be prefixed with "mock" so Jest's
// hoisting allows them to be referenced inside jest.mock() factories.
// ---------------------------------------------------------------------------
const mockStorageFrom = {
  download: jest.fn(),
  upload: jest.fn(),
  remove: jest.fn(),
};

const mockEq = jest.fn().mockResolvedValue({ error: null });
const mockDeleteChain = { eq: mockEq };
const mockFromTable = jest.fn().mockReturnValue({
  delete: jest.fn().mockReturnValue(mockDeleteChain),
});

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn().mockReturnValue({
    storage: {
      from: jest.fn().mockReturnValue(mockStorageFrom),
    },
    from: mockFromTable,
  }),
}));

jest.mock("../../lib/prisma", () => ({
  file: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  comment: {
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  activity_Log: {
    findMany: jest.fn(),
  },
}));

jest.mock("mime-types", () => ({
  lookup: jest.fn().mockReturnValue("application/pdf"),
}));

const prisma = require("../../lib/prisma");
const docsController = require("../../controllers/docs.controller");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  res.end = jest.fn();
  return res;
};

const MOCK_FILE_META = {
  file_id: "abc-123-uuid",
  file_name: "report.pdf",
  file_size: 204800,
  file_source: "file_storage/uploads/report.pdf",
  ctg_id: 1,
  org_id: "a1b2c3d4-uuid",
  user_id: 5,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Docs Controller - Unit Tests", () => {
  beforeEach(() => jest.clearAllMocks());

  // ========================================================================
  // GET / — docs_Testing
  // ========================================================================
  describe("docs_Testing", () => {
    test("returns 200 and success message", () => {
      const req = {};
      const res = createRes();

      docsController.docs_Testing(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith("Docs API is working");
    });
  });

  // ========================================================================
  // GET /all — getAllDocuments
  // ========================================================================
  describe("getAllDocuments", () => {
    test("returns 200 with documents array", async () => {
      prisma.file.findMany.mockResolvedValue([MOCK_FILE_META]);
      const req = {};
      const res = createRes();

      await docsController.getAllDocuments(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([MOCK_FILE_META]);
    });

    test("returns 500 when prisma throws", async () => {
      prisma.file.findMany.mockRejectedValue(new Error("DB error"));
      const req = {};
      const res = createRes();

      await docsController.getAllDocuments(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to retrieve documents" }),
      );
    });
  });

  // ========================================================================
  // GET /category/:ctgId — getDocumentsByCategory
  // ========================================================================
  describe("getDocumentsByCategory", () => {
    test("returns 200 with filtered documents", async () => {
      const mockDocs = [{ ...MOCK_FILE_META, Category: { ctg_id: 1, ctg_name: "Legal" } }];
      prisma.file.findMany.mockResolvedValue(mockDocs);
      const req = { params: { ctgId: "1" } };
      const res = createRes();

      await docsController.getDocumentsByCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockDocs);
    });

    test("returns 200 with empty array when no docs in category", async () => {
      prisma.file.findMany.mockResolvedValue([]);
      const req = { params: { ctgId: "99" } };
      const res = createRes();

      await docsController.getDocumentsByCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([]);
    });

    test("returns 500 when prisma throws", async () => {
      prisma.file.findMany.mockRejectedValue(new Error("DB error"));
      const req = { params: { ctgId: "1" } };
      const res = createRes();

      await docsController.getDocumentsByCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to retrieve documents by category" }),
      );
    });
  });

  // ========================================================================
  // GET /:id — getDocumentById (streams file)
  // ========================================================================
  describe("getDocumentById", () => {
    test("streams file with correct headers on success", async () => {
      prisma.file.findUnique.mockResolvedValue(MOCK_FILE_META);
      const mockArrayBuffer = new ArrayBuffer(8);
      mockStorageFrom.download.mockResolvedValue({
        data: { arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer) },
        error: null,
      });
      const req = { params: { id: "abc-123-uuid" } };
      const res = createRes();

      await docsController.getDocumentById(req, res);

      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
      expect(res.setHeader).toHaveBeenCalledWith("Content-Length", expect.any(Number));
      expect(res.end).toHaveBeenCalled();
    });

    test("returns 404 when file not found in database", async () => {
      prisma.file.findUnique.mockResolvedValue(null);
      const req = { params: { id: "nonexistent-uuid" } };
      const res = createRes();

      await docsController.getDocumentById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "File not found" });
    });

    test("returns 500 when Supabase download fails", async () => {
      prisma.file.findUnique.mockResolvedValue(MOCK_FILE_META);
      mockStorageFrom.download.mockResolvedValue({
        data: null,
        error: { message: "Storage error" },
      });
      const req = { params: { id: "abc-123-uuid" } };
      const res = createRes();

      await docsController.getDocumentById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to download file from storage" }),
      );
    });

    test("returns 500 when prisma throws", async () => {
      prisma.file.findUnique.mockRejectedValue(new Error("DB error"));
      const req = { params: { id: "abc-123-uuid" } };
      const res = createRes();

      await docsController.getDocumentById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to retrieve document" }),
      );
    });
  });

  // ========================================================================
  // GET /:id/comments — getDocumentComments
  // ========================================================================
  describe("getDocumentComments", () => {
    test("returns 200 with comments array", async () => {
      const mockComments = [{ id: 1, comment: "Looks good", file_id: "abc-123-uuid" }];
      prisma.comment.findMany.mockResolvedValue(mockComments);
      const req = { params: { id: "abc-123-uuid" } };
      const res = createRes();

      await docsController.getDocumentComments(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockComments);
    });

    test("returns 500 when prisma throws", async () => {
      prisma.comment.findMany.mockRejectedValue(new Error("DB error"));
      const req = { params: { id: "abc-123-uuid" } };
      const res = createRes();

      await docsController.getDocumentComments(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to retrieve document comments" }),
      );
    });
  });

  // ========================================================================
  // GET /:id/activity — getDocumentActivity
  // ========================================================================
  describe("getDocumentActivity", () => {
    test("returns 200 with activity array", async () => {
      const mockActivity = [{ log_id: 1, ActivityType: { activity_name: "view" } }];
      prisma.activity_Log.findMany.mockResolvedValue(mockActivity);
      const req = { params: { id: "abc-123-uuid" } };
      const res = createRes();

      await docsController.getDocumentActivity(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockActivity);
    });

    test("returns 500 when prisma throws", async () => {
      prisma.activity_Log.findMany.mockRejectedValue(new Error("DB error"));
      const req = { params: { id: "abc-123-uuid" } };
      const res = createRes();

      await docsController.getDocumentActivity(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to retrieve document activity" }),
      );
    });
  });

  // ========================================================================
  // POST / — createDocument
  // ========================================================================
  describe("createDocument", () => {
    const mockFile = {
      originalname: "report.pdf",
      buffer: Buffer.from("fake content"),
      mimetype: "application/pdf",
      size: 204800,
    };

    test("returns 201 with created file record on success", async () => {
      mockStorageFrom.upload.mockResolvedValue({
        data: { fullPath: "file_storage/uploads/report.pdf" },
        error: null,
      });
      prisma.file.create.mockResolvedValue(MOCK_FILE_META);

      const req = { file: mockFile, body: { ctg_id: "1", org_id: "a1b2c3d4-uuid", user_id: "5" } };
      const res = createRes();

      await docsController.createDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(MOCK_FILE_META);
    });

    test("returns 400 when no file is provided", async () => {
      const req = { file: undefined, body: {} };
      const res = createRes();

      await docsController.createDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "No file provided" });
    });

    test("returns 500 when Supabase upload fails", async () => {
      mockStorageFrom.upload.mockResolvedValue({
        data: null,
        error: { message: "Storage quota exceeded" },
      });

      const req = { file: mockFile, body: {} };
      const res = createRes();

      await docsController.createDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to upload file to storage" }),
      );
    });

    test("returns 500 when prisma.file.create throws", async () => {
      mockStorageFrom.upload.mockResolvedValue({
        data: { fullPath: "file_storage/uploads/report.pdf" },
        error: null,
      });
      prisma.file.create.mockRejectedValue(new Error("DB error"));

      const req = { file: mockFile, body: {} };
      const res = createRes();

      await docsController.createDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to create document" }),
      );
    });
  });

  // ========================================================================
  // POST /:id/comments — addDocumentComment
  // ========================================================================
  describe("addDocumentComment", () => {
    test("returns 201 with created comment", async () => {
      const newComment = { id: 1, file_id: "abc-123-uuid", comment: "Looks good", user_id: 5 };
      prisma.comment.create.mockResolvedValue(newComment);

      const req = { params: { id: "abc-123-uuid" }, body: { comment: "Looks good", user_id: "5" } };
      const res = createRes();

      await docsController.addDocumentComment(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(newComment);
    });

    test("returns 400 when comment text is missing", async () => {
      const req = { params: { id: "abc-123-uuid" }, body: { user_id: "5" } };
      const res = createRes();

      await docsController.addDocumentComment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "comment text is required" });
    });

    test("returns 500 when prisma throws", async () => {
      prisma.comment.create.mockRejectedValue(new Error("DB error"));

      const req = { params: { id: "abc-123-uuid" }, body: { comment: "Looks good" } };
      const res = createRes();

      await docsController.addDocumentComment(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to add comment" }),
      );
    });
  });

  // ========================================================================
  // PUT /:id — updateDocument
  // ========================================================================
  describe("updateDocument", () => {
    test("returns 200 with updated file metadata", async () => {
      const updated = { ...MOCK_FILE_META, file_name: "updated_report.pdf" };
      prisma.file.update.mockResolvedValue(updated);

      const req = {
        params: { id: "abc-123-uuid" },
        body: { file_name: "updated_report.pdf", ctg_id: "2" },
      };
      const res = createRes();

      await docsController.updateDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updated);
    });

    test("returns 500 when prisma throws", async () => {
      prisma.file.update.mockRejectedValue(new Error("DB error"));

      const req = { params: { id: "abc-123-uuid" }, body: { file_name: "updated_report.pdf" } };
      const res = createRes();

      await docsController.updateDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to update document with ID abc-123-uuid" }),
      );
    });
  });

  // ========================================================================
  // DELETE /:id — deleteDocument
  // ========================================================================
  describe("deleteDocument", () => {
    test("returns 200 and removes file from storage, database, and embeddings", async () => {
      prisma.file.delete.mockResolvedValue(MOCK_FILE_META);
      mockStorageFrom.remove.mockResolvedValue({ error: null });

      const req = { params: { id: "abc-123-uuid" } };
      const res = createRes();

      await docsController.deleteDocument(req, res);

      expect(prisma.file.delete).toHaveBeenCalled();
      expect(mockStorageFrom.remove).toHaveBeenCalledWith(["uploads/report.pdf"]);
      expect(mockFromTable).toHaveBeenCalledWith("document_embeddings");
      expect(mockEq).toHaveBeenCalledWith("metadata->>file_id", "abc-123-uuid");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "Document with ID abc-123-uuid deleted" });
    });

    test("returns 500 when prisma throws", async () => {
      prisma.file.delete.mockRejectedValue(new Error("DB error"));

      const req = { params: { id: "abc-123-uuid" } };
      const res = createRes();

      await docsController.deleteDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to delete document with ID abc-123-uuid" }),
      );
    });
  });

  // ========================================================================
  // DELETE /:id/comments/:commentId — deleteDocumentComment
  // ========================================================================
  describe("deleteDocumentComment", () => {
    test("returns 200 with success message", async () => {
      prisma.comment.delete.mockResolvedValue({ id: 1 });

      const req = { params: { id: "abc-123-uuid", commentId: "1" } };
      const res = createRes();

      await docsController.deleteDocumentComment(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "Comment with ID 1 deleted" });
    });

    test("returns 500 when prisma throws", async () => {
      prisma.comment.delete.mockRejectedValue(new Error("DB error"));

      const req = { params: { id: "abc-123-uuid", commentId: "1" } };
      const res = createRes();

      await docsController.deleteDocumentComment(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to delete comment with ID 1" }),
      );
    });
  });
});
