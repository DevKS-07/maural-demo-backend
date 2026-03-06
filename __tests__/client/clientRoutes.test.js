// Mock lib/prisma before any require() calls
jest.mock("../../lib/prisma", () => ({
  client: {
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
const clientRouter = require("../../routes/client.routes");

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

let app;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use("/client", clientRouter);
});

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_CLIENT = {
  client_id: 1,
  client_name: "Acme Corp",
  industry: "Technology",
  founded: "2010-01-01",
  company_location: "Seattle, WA",
  gpt_types: "standard",
  storage_bucket: "a1b2c3d4-uuid",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Client Routes - Integration Tests", () => {

  // ========================================================================
  // GET /client/
  // ========================================================================
  describe("GET /client/", () => {
    test("returns 200 and testing message", async () => {
      const res = await request(app).get("/client/");

      expect(res.status).toBe(200);
      expect(res.text).toBe("Client API is working");
    });
  });

  // ========================================================================
  // GET /client/all
  // ========================================================================
  describe("GET /client/all", () => {
    test("returns 200 with clients array", async () => {
      prisma.client.findMany.mockResolvedValue([MOCK_CLIENT]);

      const res = await request(app).get("/client/all");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([MOCK_CLIENT]);
    });

    test("returns 500 on database error", async () => {
      prisma.client.findMany.mockRejectedValue(new Error("DB error"));

      const res = await request(app).get("/client/all");

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("message", "Failed to retrieve clients");
    });
  });

  // ========================================================================
  // GET /client/:clientId
  // ========================================================================
  describe("GET /client/:clientId", () => {
    test("returns 200 with client when found", async () => {
      prisma.client.findUnique.mockResolvedValue(MOCK_CLIENT);

      const res = await request(app).get("/client/1");

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ client_name: "Acme Corp" });
    });

    test("returns 404 when client not found", async () => {
      prisma.client.findUnique.mockResolvedValue(null);

      const res = await request(app).get("/client/999");

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("message", "Client with ID 999 not found");
    });

    test("returns 500 on database error", async () => {
      prisma.client.findUnique.mockRejectedValue(new Error("DB error"));

      const res = await request(app).get("/client/1");

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // GET /client/:clientId/users
  // ========================================================================
  describe("GET /client/:clientId/users", () => {
    test("returns 200 with users array", async () => {
      const mockUsers = [{ user_id: 1, first_name: "Jane", email: "jane@acme.com" }];
      prisma.user.findMany.mockResolvedValue(mockUsers);

      const res = await request(app).get("/client/1/users");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockUsers);
    });

    test("returns 200 with empty array when no users", async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const res = await request(app).get("/client/1/users");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test("returns 500 on database error", async () => {
      prisma.user.findMany.mockRejectedValue(new Error("DB error"));

      const res = await request(app).get("/client/1/users");

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // GET /client/:clientId/files
  // ========================================================================
  describe("GET /client/:clientId/files", () => {
    test("returns 200 with files array", async () => {
      const mockFiles = [{ file_id: "abc-123", file_name: "contract.pdf" }];
      prisma.file.findMany.mockResolvedValue(mockFiles);

      const res = await request(app).get("/client/1/files");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockFiles);
    });

    test("returns 500 on database error", async () => {
      prisma.file.findMany.mockRejectedValue(new Error("DB error"));

      const res = await request(app).get("/client/1/files");

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // POST /client/
  // ========================================================================
  describe("POST /client/", () => {
    test("returns 201 with created client", async () => {
      prisma.client.create.mockResolvedValue(MOCK_CLIENT);

      const res = await request(app).post("/client/").send({
        client_name: "Acme Corp",
        industry: "Technology",
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ client_name: "Acme Corp" });
    });

    test("returns 400 when client_name is missing", async () => {
      const res = await request(app).post("/client/").send({ industry: "Technology" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message", "client_name is required");
    });

    test("returns 500 on database error", async () => {
      prisma.client.create.mockRejectedValue(new Error("DB error"));

      const res = await request(app).post("/client/").send({ client_name: "Acme Corp" });

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // PUT /client/:clientId
  // ========================================================================
  describe("PUT /client/:clientId", () => {
    test("returns 200 with updated client", async () => {
      const updated = { ...MOCK_CLIENT, client_name: "Acme International" };
      prisma.client.update.mockResolvedValue(updated);

      const res = await request(app).put("/client/1").send({ client_name: "Acme International" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ client_name: "Acme International" });
    });

    test("returns 500 on database error", async () => {
      prisma.client.update.mockRejectedValue(new Error("DB error"));

      const res = await request(app).put("/client/1").send({ client_name: "Acme International" });

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // DELETE /client/:clientId
  // ========================================================================
  describe("DELETE /client/:clientId", () => {
    test("returns 200 with success message", async () => {
      prisma.client.delete.mockResolvedValue(MOCK_CLIENT);

      const res = await request(app).delete("/client/1");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message", "Client with ID 1 deleted");
    });

    test("returns 500 on database error", async () => {
      prisma.client.delete.mockRejectedValue(new Error("DB error"));

      const res = await request(app).delete("/client/1");

      expect(res.status).toBe(500);
    });
  });
});
