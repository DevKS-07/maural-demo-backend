// ---------------------------------------------------------------------------
// Supabase storage mock
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

jest.mock("../../lib/supabase", () => ({
  getSupabase: jest.fn().mockReturnValue({
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
  organisation: {
    findUnique: jest.fn(),
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
  ...jest.requireActual("mime-types"),
  lookup: jest.fn().mockReturnValue("application/pdf"),
}));

const request = require("supertest");
const express = require("express");
const prisma = require("../../lib/prisma");
const docsRouter = require("../../routes/docs.routes");

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

let app;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use("/docs", docsRouter);
});

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

describe("Docs Routes - Integration Tests", () => {

  // ========================================================================
  // GET /docs/
  // ========================================================================
  describe("GET /docs/", () => {
    test("returns 200 and testing message", async () => {
      const res = await request(app).get("/docs/");

      expect(res.status).toBe(200);
      expect(res.text).toBe("Docs API is working");
    });
  });

  // ========================================================================
  // GET /docs/all
  // ========================================================================
  describe("GET /docs/all", () => {
    test("returns 200 with documents array", async () => {
      prisma.file.findMany.mockResolvedValue([MOCK_FILE_META]);

      const res = await request(app).get("/docs/all");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([MOCK_FILE_META]);
    });

    test("returns 500 on database error", async () => {
      prisma.file.findMany.mockRejectedValue(new Error("DB error"));

      const res = await request(app).get("/docs/all");

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("message", "Failed to retrieve documents");
    });
  });

  // ========================================================================
  // GET /docs/category/:ctgId
  // ========================================================================
  describe("GET /docs/category/:ctgId", () => {
    test("returns 200 with filtered documents", async () => {
      const mockDocs = [{ ...MOCK_FILE_META, Category: { ctg_id: 1, ctg_name: "Legal" } }];
      prisma.file.findMany.mockResolvedValue(mockDocs);

      const res = await request(app).get("/docs/category/1");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockDocs);
    });

    test("returns 500 on database error", async () => {
      prisma.file.findMany.mockRejectedValue(new Error("DB error"));

      const res = await request(app).get("/docs/category/1");

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // GET /docs/:id
  // ========================================================================
  describe("GET /docs/:id", () => {
    test("streams file with 200 on success", async () => {
      prisma.file.findUnique.mockResolvedValue(MOCK_FILE_META);
      const mockArrayBuffer = new ArrayBuffer(8);
      mockStorageFrom.download.mockResolvedValue({
        data: { arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer) },
        error: null,
      });

      const res = await request(app).get("/docs/abc-123-uuid");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/pdf/);
    });

    test("returns 404 when document not found", async () => {
      prisma.file.findUnique.mockResolvedValue(null);

      const res = await request(app).get("/docs/nonexistent-uuid");

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("message", "File not found");
    });

    test("returns 500 when Supabase download fails", async () => {
      prisma.file.findUnique.mockResolvedValue(MOCK_FILE_META);
      mockStorageFrom.download.mockResolvedValue({
        data: null,
        error: { message: "Storage error" },
      });

      const res = await request(app).get("/docs/abc-123-uuid");

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // GET /docs/:id/comments
  // ========================================================================
  describe("GET /docs/:id/comments", () => {
    test("returns 200 with comments array", async () => {
      const mockComments = [{ id: 1, comment: "Great doc" }];
      prisma.comment.findMany.mockResolvedValue(mockComments);

      const res = await request(app).get("/docs/abc-123-uuid/comments");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockComments);
    });

    test("returns 500 on database error", async () => {
      prisma.comment.findMany.mockRejectedValue(new Error("DB error"));

      const res = await request(app).get("/docs/abc-123-uuid/comments");

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // GET /docs/:id/activity
  // ========================================================================
  describe("GET /docs/:id/activity", () => {
    test("returns 200 with activity array", async () => {
      const mockActivity = [{ log_id: 1, ActivityType: { activity_name: "view" } }];
      prisma.activity_Log.findMany.mockResolvedValue(mockActivity);

      const res = await request(app).get("/docs/abc-123-uuid/activity");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockActivity);
    });

    test("returns 500 on database error", async () => {
      prisma.activity_Log.findMany.mockRejectedValue(new Error("DB error"));

      const res = await request(app).get("/docs/abc-123-uuid/activity");

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // POST /docs/ (multipart file upload)
  // ========================================================================
  describe("POST /docs/", () => {
    test("returns 201 with created file record", async () => {
      prisma.organisation.findUnique.mockResolvedValue({ storage_bucket: "bucket-uuid-1234" });
      mockStorageFrom.upload.mockResolvedValue({
        data: { fullPath: "bucket-uuid-1234/uploads/report.pdf" },
        error: null,
      });
      prisma.file.create.mockResolvedValue(MOCK_FILE_META);

      const res = await request(app)
        .post("/docs/")
        .field("ctg_id", "1")
        .field("org_id", "a1b2c3d4-uuid")
        .field("user_id", "5")
        .attach("file", Buffer.from("fake pdf content"), "report.pdf");

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ file_name: "report.pdf" });
    });

    test("returns 400 when no file is attached", async () => {
      const res = await request(app).post("/docs/").send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message", "No file provided");
    });

    test("returns 400 when org_id is missing", async () => {
      const res = await request(app)
        .post("/docs/")
        .attach("file", Buffer.from("fake pdf content"), "report.pdf");

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message", "org_id is required");
    });

    test("returns 500 when Supabase upload fails", async () => {
      prisma.organisation.findUnique.mockResolvedValue({ storage_bucket: "bucket-uuid-1234" });
      mockStorageFrom.upload.mockResolvedValue({
        data: null,
        error: { message: "Storage error" },
      });

      const res = await request(app)
        .post("/docs/")
        .field("org_id", "a1b2c3d4-uuid")
        .attach("file", Buffer.from("fake pdf content"), "report.pdf");

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // POST /docs/:id/comments
  // ========================================================================
  describe("POST /docs/:id/comments", () => {
    test("returns 201 with created comment", async () => {
      const newComment = { id: 1, file_id: "abc-123-uuid", comment: "Looks good" };
      prisma.comment.create.mockResolvedValue(newComment);

      const res = await request(app)
        .post("/docs/abc-123-uuid/comments")
        .send({ comment: "Looks good", user_id: "5" });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ comment: "Looks good" });
    });

    test("returns 400 when comment text is missing", async () => {
      const res = await request(app)
        .post("/docs/abc-123-uuid/comments")
        .send({ user_id: "5" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message", "comment text is required");
    });

    test("returns 500 on database error", async () => {
      prisma.comment.create.mockRejectedValue(new Error("DB error"));

      const res = await request(app)
        .post("/docs/abc-123-uuid/comments")
        .send({ comment: "Looks good" });

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // PUT /docs/:id
  // ========================================================================
  describe("PUT /docs/:id", () => {
    test("returns 200 with updated file metadata", async () => {
      const updated = { ...MOCK_FILE_META, file_name: "updated_report.pdf" };
      prisma.file.update.mockResolvedValue(updated);

      const res = await request(app)
        .put("/docs/abc-123-uuid")
        .send({ file_name: "updated_report.pdf" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ file_name: "updated_report.pdf" });
    });

    test("returns 500 on database error", async () => {
      prisma.file.update.mockRejectedValue(new Error("DB error"));

      const res = await request(app)
        .put("/docs/abc-123-uuid")
        .send({ file_name: "updated_report.pdf" });

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // DELETE /docs/:id
  // ========================================================================
  describe("DELETE /docs/:id", () => {
    test("returns 200 with success message", async () => {
      prisma.file.delete.mockResolvedValue(MOCK_FILE_META);
      mockStorageFrom.remove.mockResolvedValue({ error: null });

      const res = await request(app).delete("/docs/abc-123-uuid");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message", "Document with ID abc-123-uuid deleted");
    });

    test("returns 500 on database error", async () => {
      prisma.file.delete.mockRejectedValue(new Error("DB error"));

      const res = await request(app).delete("/docs/abc-123-uuid");

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // DELETE /docs/:id/comments/:commentId
  // ========================================================================
  describe("DELETE /docs/:id/comments/:commentId", () => {
    test("returns 200 with success message", async () => {
      prisma.comment.delete.mockResolvedValue({ id: 1 });

      const res = await request(app).delete("/docs/abc-123-uuid/comments/1");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message", "Comment with ID 1 deleted");
    });

    test("returns 500 on database error", async () => {
      prisma.comment.delete.mockRejectedValue(new Error("DB error"));

      const res = await request(app).delete("/docs/abc-123-uuid/comments/1");

      expect(res.status).toBe(500);
    });
  });
});
