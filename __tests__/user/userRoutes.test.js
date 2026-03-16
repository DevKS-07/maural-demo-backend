// Mock lib/prisma before any require() calls
jest.mock("../../lib/prisma", () => ({
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  activity_Log: {
    findMany: jest.fn(),
  },
  file: {
    findMany: jest.fn(),
  },
  comment: {
    findMany: jest.fn(),
  },
}));

const request = require("supertest");
const express = require("express");
const prisma = require("../../lib/prisma");
const userRouter = require("../../routes/user.routes");

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

let app;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use("/user", userRouter);
});

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_USER = {
  user_id: 1,
  first_name: "Jane",
  last_name: "Doe",
  email: "jane@example.com",
  phone: "555-1234",
  status: "active",
  org_id: "a1b2c3d4-uuid",
  role_id: 2,
};

const MOCK_USER_WITH_ROLE = {
  ...MOCK_USER,
  Role: {
    role_id: 2,
    role_name: "Admin",
    RolePermission: [
      { Permission: { permission_id: 1, permission_name: "read_docs" } },
    ],
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("User Routes - Integration Tests", () => {

  // ========================================================================
  // GET /user/
  // ========================================================================
  describe("GET /user/", () => {
    test("returns 200 and testing message", async () => {
      const res = await request(app).get("/user/");

      expect(res.status).toBe(200);
      expect(res.text).toBe("User API is working");
    });
  });

  // ========================================================================
  // GET /user/all
  // ========================================================================
  describe("GET /user/all", () => {
    test("returns 200 with users array", async () => {
      prisma.user.findMany.mockResolvedValue([MOCK_USER]);

      const res = await request(app).get("/user/all");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([MOCK_USER]);
    });

    test("returns 500 on database error", async () => {
      prisma.user.findMany.mockRejectedValue(new Error("DB error"));

      const res = await request(app).get("/user/all");

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("message", "Failed to retrieve users");
    });
  });

  // ========================================================================
  // GET /user/:userId
  // ========================================================================
  describe("GET /user/:userId", () => {
    test("returns 200 with user when found", async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);

      const res = await request(app).get("/user/1");

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ first_name: "Jane", email: "jane@example.com" });
    });

    test("returns 404 when user not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app).get("/user/999");

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("message", "User with ID 999 not found");
    });

    test("returns 500 on database error", async () => {
      prisma.user.findUnique.mockRejectedValue(new Error("DB error"));

      const res = await request(app).get("/user/1");

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // GET /user/:userId/activity
  // ========================================================================
  describe("GET /user/:userId/activity", () => {
    test("returns 200 with activity array", async () => {
      const mockActivity = [{ log_id: 1, ActivityType: { activity_name: "upload" } }];
      prisma.activity_Log.findMany.mockResolvedValue(mockActivity);

      const res = await request(app).get("/user/1/activity");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockActivity);
    });

    test("returns 500 on database error", async () => {
      prisma.activity_Log.findMany.mockRejectedValue(new Error("DB error"));

      const res = await request(app).get("/user/1/activity");

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // GET /user/:userId/files
  // ========================================================================
  describe("GET /user/:userId/files", () => {
    test("returns 200 with files array", async () => {
      const mockFiles = [{ file_id: "abc-123", file_name: "report.pdf" }];
      prisma.file.findMany.mockResolvedValue(mockFiles);

      const res = await request(app).get("/user/1/files");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockFiles);
    });

    test("returns 500 on database error", async () => {
      prisma.file.findMany.mockRejectedValue(new Error("DB error"));

      const res = await request(app).get("/user/1/files");

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // GET /user/:userId/comments
  // ========================================================================
  describe("GET /user/:userId/comments", () => {
    test("returns 200 with comments array", async () => {
      const mockComments = [{ id: 1, comment: "Great document" }];
      prisma.comment.findMany.mockResolvedValue(mockComments);

      const res = await request(app).get("/user/1/comments");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockComments);
    });

    test("returns 500 on database error", async () => {
      prisma.comment.findMany.mockRejectedValue(new Error("DB error"));

      const res = await request(app).get("/user/1/comments");

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // GET /user/:userId/permissions
  // ========================================================================
  describe("GET /user/:userId/permissions", () => {
    test("returns 200 with permissions array", async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER_WITH_ROLE);

      const res = await request(app).get("/user/1/permissions");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ permission_id: 1, permission_name: "read_docs" }]);
    });

    test("returns 404 when user not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app).get("/user/999/permissions");

      expect(res.status).toBe(404);
    });
  });

  // ========================================================================
  // POST /user/
  // ========================================================================
  describe("POST /user/", () => {
    test("returns 201 with created user", async () => {
      prisma.user.create.mockResolvedValue(MOCK_USER);

      const res = await request(app).post("/user/").send({
        first_name: "Jane",
        last_name: "Doe",
        email: "jane@example.com",
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ first_name: "Jane" });
    });

    test("returns 400 when required fields are missing", async () => {
      const res = await request(app).post("/user/").send({ first_name: "Jane" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message", "first_name, last_name, and email are required");
    });

    test("returns 500 on database error", async () => {
      prisma.user.create.mockRejectedValue(new Error("DB error"));

      const res = await request(app).post("/user/").send({
        first_name: "Jane",
        last_name: "Doe",
        email: "jane@example.com",
      });

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // PUT /user/:userId
  // ========================================================================
  describe("PUT /user/:userId", () => {
    test("returns 200 with updated user", async () => {
      const updated = { ...MOCK_USER, first_name: "Janet" };
      prisma.user.update.mockResolvedValue(updated);

      const res = await request(app).put("/user/1").send({ first_name: "Janet" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ first_name: "Janet" });
    });

    test("returns 500 on database error", async () => {
      prisma.user.update.mockRejectedValue(new Error("DB error"));

      const res = await request(app).put("/user/1").send({ first_name: "Janet" });

      expect(res.status).toBe(500);
    });
  });

  // ========================================================================
  // DELETE /user/:userId
  // ========================================================================
  describe("DELETE /user/:userId", () => {
    test("returns 200 with success message", async () => {
      prisma.user.delete.mockResolvedValue(MOCK_USER);

      const res = await request(app).delete("/user/1");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message", "User with ID 1 deleted");
    });

    test("returns 500 on database error", async () => {
      prisma.user.delete.mockRejectedValue(new Error("DB error"));

      const res = await request(app).delete("/user/1");

      expect(res.status).toBe(500);
    });
  });
});
