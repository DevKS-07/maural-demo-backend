// ---------------------------------------------------------------------------
// Supabase storage mock
// ---------------------------------------------------------------------------
const mockStorageFrom = {
  list: jest.fn(),
  remove: jest.fn(),
};

const mockCreateBucket = jest.fn();
const mockDeleteBucket = jest.fn();

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

const prisma = require("../../lib/prisma");
const orgController = require("../../controllers/org.controller");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

const MOCK_ORG = {
  org_id: "a1b2c3d4-uuid",
  org_name: "Acme Corp",
  industry: "Technology",
  founded: "2010-01-01",
  key_contacts: 5,
  company_location: "Seattle, WA",
  organization_chart: "https://example.com/chart",
  gpt_types: "standard",
  storage_bucket: "bucket-uuid-1234",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Org Controller - Unit Tests", () => {
  beforeEach(() => jest.clearAllMocks());

  // ========================================================================
  // GET / — orgTesting
  // ========================================================================
  describe("orgTesting", () => {
    test("returns 200 and success message", () => {
      const req = {};
      const res = createRes();

      orgController.orgTesting(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith("Organisation API is working");
    });
  });

  // ========================================================================
  // GET /all — getAllOrgs
  // ========================================================================
  describe("getAllOrgs", () => {
    test("returns 200 with array of organisations", async () => {
      prisma.organisation.findMany.mockResolvedValue([MOCK_ORG]);
      const req = {};
      const res = createRes();

      await orgController.getAllOrgs(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([MOCK_ORG]);
    });

    test("returns 500 when prisma throws", async () => {
      prisma.organisation.findMany.mockRejectedValue(new Error("DB error"));
      const req = {};
      const res = createRes();

      await orgController.getAllOrgs(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to retrieve organisations" }),
      );
    });
  });

  // ========================================================================
  // GET /:orgId — getOrgById
  // ========================================================================
  describe("getOrgById", () => {
    test("returns 200 with organisation when found", async () => {
      prisma.organisation.findUnique.mockResolvedValue(MOCK_ORG);
      const req = { params: { orgId: "a1b2c3d4-uuid" } };
      const res = createRes();

      await orgController.getOrgById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(MOCK_ORG);
    });

    test("returns 404 when organisation not found", async () => {
      prisma.organisation.findUnique.mockResolvedValue(null);
      const req = { params: { orgId: "nonexistent-uuid" } };
      const res = createRes();

      await orgController.getOrgById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Organisation with ID nonexistent-uuid not found" }),
      );
    });

    test("returns 500 when prisma throws", async () => {
      prisma.organisation.findUnique.mockRejectedValue(new Error("DB error"));
      const req = { params: { orgId: "a1b2c3d4-uuid" } };
      const res = createRes();

      await orgController.getOrgById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to retrieve organisation" }),
      );
    });
  });

  // ========================================================================
  // GET /:orgId/users — getOrgUsers
  // ========================================================================
  describe("getOrgUsers", () => {
    test("returns 200 with users array", async () => {
      const mockUsers = [{ user_id: 1, first_name: "Jane", email: "jane@acme.com" }];
      prisma.user.findMany.mockResolvedValue(mockUsers);
      const req = { params: { orgId: "a1b2c3d4-uuid" } };
      const res = createRes();

      await orgController.getOrgUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockUsers);
    });

    test("returns empty array when organisation has no users", async () => {
      prisma.user.findMany.mockResolvedValue([]);
      const req = { params: { orgId: "a1b2c3d4-uuid" } };
      const res = createRes();

      await orgController.getOrgUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([]);
    });

    test("returns 500 when prisma throws", async () => {
      prisma.user.findMany.mockRejectedValue(new Error("DB error"));
      const req = { params: { orgId: "a1b2c3d4-uuid" } };
      const res = createRes();

      await orgController.getOrgUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to retrieve organisation users" }),
      );
    });
  });

  // ========================================================================
  // GET /:orgId/files — getOrgFiles
  // ========================================================================
  describe("getOrgFiles", () => {
    test("returns 200 with files array", async () => {
      const mockFiles = [{ file_id: "abc-123", file_name: "contract.pdf" }];
      prisma.file.findMany.mockResolvedValue(mockFiles);
      const req = { params: { orgId: "a1b2c3d4-uuid" } };
      const res = createRes();

      await orgController.getOrgFiles(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockFiles);
    });

    test("returns 500 when prisma throws", async () => {
      prisma.file.findMany.mockRejectedValue(new Error("DB error"));
      const req = { params: { orgId: "a1b2c3d4-uuid" } };
      const res = createRes();

      await orgController.getOrgFiles(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to retrieve organisation files" }),
      );
    });
  });

  // ========================================================================
  // POST / — createOrg
  // ========================================================================
  describe("createOrg", () => {
    test("returns 201 and creates Supabase storage bucket", async () => {
      prisma.organisation.create.mockResolvedValue(MOCK_ORG);
      mockCreateBucket.mockResolvedValue({ error: null });

      const req = {
        body: {
          org_name: "Acme Corp",
          industry: "Technology",
          company_location: "Seattle, WA",
        },
      };
      const res = createRes();

      await orgController.createOrg(req, res);

      expect(mockCreateBucket).toHaveBeenCalledWith("bucket-uuid-1234", { public: false });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(MOCK_ORG);
    });

    test("returns 201 even if bucket creation fails (best-effort)", async () => {
      prisma.organisation.create.mockResolvedValue(MOCK_ORG);
      mockCreateBucket.mockResolvedValue({ error: { message: "Bucket limit reached" } });

      const req = { body: { org_name: "Acme Corp" } };
      const res = createRes();

      await orgController.createOrg(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(MOCK_ORG);
    });

    test("returns 400 when org_name is missing", async () => {
      const req = { body: { industry: "Technology" } };
      const res = createRes();

      await orgController.createOrg(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "org_name is required" }),
      );
    });

    test("returns 500 when prisma throws", async () => {
      prisma.organisation.create.mockRejectedValue(new Error("DB error"));
      const req = { body: { org_name: "Acme Corp" } };
      const res = createRes();

      await orgController.createOrg(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to create organisation" }),
      );
    });
  });

  // ========================================================================
  // PUT /:orgId — updateOrg
  // ========================================================================
  describe("updateOrg", () => {
    test("returns 200 with updated organisation", async () => {
      const updated = { ...MOCK_ORG, org_name: "Acme International" };
      prisma.organisation.update.mockResolvedValue(updated);
      const req = {
        params: { orgId: "a1b2c3d4-uuid" },
        body: { org_name: "Acme International" },
      };
      const res = createRes();

      await orgController.updateOrg(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updated);
    });

    test("returns 500 when prisma throws", async () => {
      prisma.organisation.update.mockRejectedValue(new Error("DB error"));
      const req = {
        params: { orgId: "a1b2c3d4-uuid" },
        body: { org_name: "Acme International" },
      };
      const res = createRes();

      await orgController.updateOrg(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to update organisation with ID a1b2c3d4-uuid" }),
      );
    });
  });

  // ========================================================================
  // DELETE /:orgId — deleteOrg
  // ========================================================================
  describe("deleteOrg", () => {
    test("returns 200, deletes org and cleans up storage bucket", async () => {
      prisma.organisation.findUnique.mockResolvedValue({ storage_bucket: "bucket-uuid-1234" });
      prisma.organisation.delete.mockResolvedValue(MOCK_ORG);
      mockStorageFrom.list.mockResolvedValue({
        data: [{ name: "report.pdf" }, { name: "contract.docx" }],
      });
      mockStorageFrom.remove.mockResolvedValue({ error: null });
      mockDeleteBucket.mockResolvedValue({ error: null });

      const req = { params: { orgId: "a1b2c3d4-uuid" } };
      const res = createRes();

      await orgController.deleteOrg(req, res);

      expect(prisma.organisation.findUnique).toHaveBeenCalledWith({
        where: { org_id: "a1b2c3d4-uuid" },
        select: { storage_bucket: true },
      });
      expect(mockStorageFrom.remove).toHaveBeenCalledWith([
        "uploads/report.pdf",
        "uploads/contract.docx",
      ]);
      expect(mockDeleteBucket).toHaveBeenCalledWith("bucket-uuid-1234");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "Organisation with ID a1b2c3d4-uuid deleted" });
    });

    test("returns 200 even if bucket cleanup fails (best-effort)", async () => {
      prisma.organisation.findUnique.mockResolvedValue({ storage_bucket: "bucket-uuid-1234" });
      prisma.organisation.delete.mockResolvedValue(MOCK_ORG);
      mockStorageFrom.list.mockRejectedValue(new Error("Storage error"));

      const req = { params: { orgId: "a1b2c3d4-uuid" } };
      const res = createRes();

      await orgController.deleteOrg(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "Organisation with ID a1b2c3d4-uuid deleted" });
    });

    test("returns 500 when prisma throws", async () => {
      prisma.organisation.findUnique.mockResolvedValue({ storage_bucket: "bucket-uuid-1234" });
      prisma.organisation.delete.mockRejectedValue(new Error("DB error"));
      const req = { params: { orgId: "a1b2c3d4-uuid" } };
      const res = createRes();

      await orgController.deleteOrg(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to delete organisation with ID a1b2c3d4-uuid" }),
      );
    });
  });
});
