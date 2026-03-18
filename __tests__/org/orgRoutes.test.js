// Mock Supabase before any require() calls
const mockStorageFrom = {
  list: jest.fn(),
  remove: jest.fn(),
};

const mockCreateBucket = jest.fn().mockResolvedValue({ error: null });
const mockDeleteBucket = jest.fn().mockResolvedValue({ error: null });

jest.mock("../../lib/supabase", () => ({
  getSupabase: jest.fn().mockReturnValue({
    storage: {
      createBucket: mockCreateBucket,
      deleteBucket: mockDeleteBucket,
      from: jest.fn().mockReturnValue(mockStorageFrom),
    },
  }),
}));

// Mock lib/prisma before any require() calls
jest.mock("../../lib/prisma", () => ({
  organisation: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  file: {
    findMany: jest.fn(),
  },
}));

const request = require("supertest");
const express = require("express");
const prisma = require("../../lib/prisma");
const orgRouter = require("../../routes/org.routes");

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

let app;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use("/org", orgRouter);
});

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_ORG = {
  org_id: "a1b2c3d4-uuid",
  org_name: "Acme Corp",
  industry: "Technology",
  founded: "2010-01-01",
  company_location: "Seattle, WA",
  storage_bucket: "bucket-uuid-1234",
  gpt_types: "standard",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Org Routes - Integration Tests", () => {

  // ========================================================================
  // GET /org/
  // ========================================================================
  describe("GET /org/", () => {
    test("returns 200 and testing message", async () => {
      const res = await request(app).get("/org/");

      expect(res.status).toBe(200);
      expect(res.text).toBe("Organisation API is working");
    });
  });

  // ========================================================================
  // GET /org/all
  // ========================================================================
  describe("GET /org/all", () => {
    test("returns 200 with organisations array", async () => {
      prisma.organisation.findMany.mockResolvedValue([MOCK_ORG]);

      const res = await request(app).get("/org/all");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([MOCK_ORG]);
    });

    test("returns 500 on database error", async () => {
      prisma.organisation.findMany.mockRejectedValue(new Error("DB error"));

      const res = await request(app).get("/org/all");

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("message", "Failed to retrieve organisations");
    });
  });

  // ========================================================================
  // GET /org/:orgId
  // ========================================================================
  describe("GET /org/:orgId", () => {
    test("returns 200 with organisation when found", async () => {
      prisma.organisation.findUnique.mockResolvedValue(MOCK_ORG);

      const res = await request(app).get("/org/a1b2c3d4-uuid");

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ org_name: "Acme Corp" });
    });

    test("returns 404 when organisation not found", async () => {
      prisma.organisation.findUnique.mockResolvedValue(null);

      const res = await request(app).get("/org/nonexistent-uuid");

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("message", "Organisation with ID nonexistent-uuid not found");
    });

    test("returns 500 on database error", async () => {
      prisma.organisation.findUnique.mockRejectedValue(new Error("DB error"));

      const res = await request(app).get("/org/a1b2c3d4-uuid");

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // GET /org/:orgId/users
  // ========================================================================
  describe("GET /org/:orgId/users", () => {
    test("returns 200 with users array", async () => {
      const mockUsers = [{ user_id: 1, first_name: "Jane", email: "jane@acme.com" }];
      prisma.user.findMany.mockResolvedValue(mockUsers);

      const res = await request(app).get("/org/a1b2c3d4-uuid/users");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockUsers);
    });

    test("returns 200 with empty array when no users", async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const res = await request(app).get("/org/a1b2c3d4-uuid/users");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test("returns 500 on database error", async () => {
      prisma.user.findMany.mockRejectedValue(new Error("DB error"));

      const res = await request(app).get("/org/a1b2c3d4-uuid/users");

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // GET /org/:orgId/files
  // ========================================================================
  describe("GET /org/:orgId/files", () => {
    test("returns 200 with files array", async () => {
      const mockFiles = [{ file_id: "abc-123", file_name: "contract.pdf" }];
      prisma.file.findMany.mockResolvedValue(mockFiles);

      const res = await request(app).get("/org/a1b2c3d4-uuid/files");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockFiles);
    });

    test("returns 500 on database error", async () => {
      prisma.file.findMany.mockRejectedValue(new Error("DB error"));

      const res = await request(app).get("/org/a1b2c3d4-uuid/files");

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // POST /org/
  // ========================================================================
  describe("POST /org/", () => {
    test("returns 201 with created organisation", async () => {
      prisma.organisation.create.mockResolvedValue(MOCK_ORG);

      const res = await request(app).post("/org/").send({
        org_name: "Acme Corp",
        industry: "Technology",
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ org_name: "Acme Corp" });
    });

    test("returns 400 when org_name is missing", async () => {
      const res = await request(app).post("/org/").send({ industry: "Technology" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message", "org_name is required");
    });

    test("returns 500 on database error", async () => {
      prisma.organisation.create.mockRejectedValue(new Error("DB error"));

      const res = await request(app).post("/org/").send({ org_name: "Acme Corp" });

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // PUT /org/:orgId
  // ========================================================================
  describe("PUT /org/:orgId", () => {
    test("returns 200 with updated organisation", async () => {
      const updated = { ...MOCK_ORG, org_name: "Acme International" };
      prisma.organisation.update.mockResolvedValue(updated);

      const res = await request(app).put("/org/a1b2c3d4-uuid").send({ org_name: "Acme International" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ org_name: "Acme International" });
    });

    test("returns 500 on database error", async () => {
      prisma.organisation.update.mockRejectedValue(new Error("DB error"));

      const res = await request(app).put("/org/a1b2c3d4-uuid").send({ org_name: "Acme International" });

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // DELETE /org/:orgId
  // ========================================================================
  describe("DELETE /org/:orgId", () => {
    test("returns 200 with success message", async () => {
      prisma.organisation.findUnique.mockResolvedValue({ storage_bucket: "bucket-uuid-1234" });
      prisma.organisation.delete.mockResolvedValue(MOCK_ORG);
      mockStorageFrom.list.mockResolvedValue({ data: [] });

      const res = await request(app).delete("/org/a1b2c3d4-uuid");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message", "Organisation with ID a1b2c3d4-uuid deleted");
    });

    test("returns 500 on database error", async () => {
      prisma.organisation.findUnique.mockResolvedValue({ storage_bucket: "bucket-uuid-1234" });
      prisma.organisation.delete.mockRejectedValue(new Error("DB error"));

      const res = await request(app).delete("/org/a1b2c3d4-uuid");

      expect(res.status).toBe(500);
    });
  });
});
