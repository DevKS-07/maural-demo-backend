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

const prisma = require("../../lib/prisma");
const userController = require("../../controllers/user.controller");

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

const MOCK_USER = {
  user_id: 1,
  first_name: "Jane",
  last_name: "Doe",
  email: "jane@example.com",
  phone: "555-1234",
  gender: "female",
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
      { Permission: { permission_id: 2, permission_name: "upload_docs" } },
    ],
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("User Controller - Unit Tests", () => {
  beforeEach(() => jest.clearAllMocks());

  // ========================================================================
  // GET / — user_Testing
  // ========================================================================
  describe("user_Testing", () => {
    test("returns 200 and success message", () => {
      const req = {};
      const res = createRes();

      userController.user_Testing(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith("User API is working");
    });
  });

  // ========================================================================
  // GET /all — getAllUsers
  // ========================================================================
  describe("getAllUsers", () => {
    test("returns 200 with array of users", async () => {
      prisma.user.findMany.mockResolvedValue([MOCK_USER]);
      const req = {};
      const res = createRes();

      await userController.getAllUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([MOCK_USER]);
    });

    test("returns 500 when prisma throws", async () => {
      prisma.user.findMany.mockRejectedValue(new Error("DB error"));
      const req = {};
      const res = createRes();

      await userController.getAllUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to retrieve users" }),
      );
    });
  });

  // ========================================================================
  // GET /:userId — getUserById
  // ========================================================================
  describe("getUserById", () => {
    test("returns 200 with user when found", async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);
      const req = { params: { userId: "1" } };
      const res = createRes();

      await userController.getUserById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(MOCK_USER);
    });

    test("returns 404 when user not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const req = { params: { userId: "999" } };
      const res = createRes();

      await userController.getUserById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "User with ID 999 not found" }),
      );
    });

    test("returns 500 when prisma throws", async () => {
      prisma.user.findUnique.mockRejectedValue(new Error("DB error"));
      const req = { params: { userId: "1" } };
      const res = createRes();

      await userController.getUserById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to retrieve user" }),
      );
    });
  });

  // ========================================================================
  // GET /:userId/activity — getUserActivity
  // ========================================================================
  describe("getUserActivity", () => {
    test("returns 200 with activity array", async () => {
      const mockActivity = [{ log_id: 1, activity_type: 1, ActivityType: { activity_name: "upload" } }];
      prisma.activity_Log.findMany.mockResolvedValue(mockActivity);
      const req = { params: { userId: "1" } };
      const res = createRes();

      await userController.getUserActivity(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockActivity);
    });

    test("returns 500 when prisma throws", async () => {
      prisma.activity_Log.findMany.mockRejectedValue(new Error("DB error"));
      const req = { params: { userId: "1" } };
      const res = createRes();

      await userController.getUserActivity(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to retrieve user activity" }),
      );
    });
  });

  // ========================================================================
  // GET /:userId/files — getUserFiles
  // ========================================================================
  describe("getUserFiles", () => {
    test("returns 200 with files array", async () => {
      const mockFiles = [{ file_id: "abc", file_name: "report.pdf" }];
      prisma.file.findMany.mockResolvedValue(mockFiles);
      const req = { params: { userId: "1" } };
      const res = createRes();

      await userController.getUserFiles(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockFiles);
    });

    test("returns 500 when prisma throws", async () => {
      prisma.file.findMany.mockRejectedValue(new Error("DB error"));
      const req = { params: { userId: "1" } };
      const res = createRes();

      await userController.getUserFiles(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to retrieve user files" }),
      );
    });
  });

  // ========================================================================
  // GET /:userId/comments — getUserComments
  // ========================================================================
  describe("getUserComments", () => {
    test("returns 200 with comments array", async () => {
      const mockComments = [{ id: 1, comment: "Great doc", file_id: "abc" }];
      prisma.comment.findMany.mockResolvedValue(mockComments);
      const req = { params: { userId: "1" } };
      const res = createRes();

      await userController.getUserComments(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockComments);
    });

    test("returns 500 when prisma throws", async () => {
      prisma.comment.findMany.mockRejectedValue(new Error("DB error"));
      const req = { params: { userId: "1" } };
      const res = createRes();

      await userController.getUserComments(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to retrieve user comments" }),
      );
    });
  });

  // ========================================================================
  // GET /:userId/permissions — getUserPermissions
  // ========================================================================
  describe("getUserPermissions", () => {
    test("returns 200 with flattened permissions array", async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER_WITH_ROLE);
      const req = { params: { userId: "1" } };
      const res = createRes();

      await userController.getUserPermissions(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([
        { permission_id: 1, permission_name: "read_docs" },
        { permission_id: 2, permission_name: "upload_docs" },
      ]);
    });

    test("returns empty array when user has no role", async () => {
      prisma.user.findUnique.mockResolvedValue({ ...MOCK_USER, Role: null });
      const req = { params: { userId: "1" } };
      const res = createRes();

      await userController.getUserPermissions(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([]);
    });

    test("returns 404 when user not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const req = { params: { userId: "999" } };
      const res = createRes();

      await userController.getUserPermissions(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "User with ID 999 not found" }),
      );
    });

    test("returns 500 when prisma throws", async () => {
      prisma.user.findUnique.mockRejectedValue(new Error("DB error"));
      const req = { params: { userId: "1" } };
      const res = createRes();

      await userController.getUserPermissions(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to retrieve user permissions" }),
      );
    });
  });

  // ========================================================================
  // POST / — createUser
  // ========================================================================
  describe("createUser", () => {
    test("returns 201 with created user", async () => {
      prisma.user.create.mockResolvedValue(MOCK_USER);
      const req = {
        body: {
          first_name: "Jane",
          last_name: "Doe",
          email: "jane@example.com",
          org_id: "a1b2c3d4-uuid",
          role_id: "2",
        },
      };
      const res = createRes();

      await userController.createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(MOCK_USER);
    });

    test("returns 400 when first_name is missing", async () => {
      const req = { body: { last_name: "Doe", email: "jane@example.com" } };
      const res = createRes();

      await userController.createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "first_name, last_name, and email are required" }),
      );
    });

    test("returns 400 when last_name is missing", async () => {
      const req = { body: { first_name: "Jane", email: "jane@example.com" } };
      const res = createRes();

      await userController.createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("returns 400 when email is missing", async () => {
      const req = { body: { first_name: "Jane", last_name: "Doe" } };
      const res = createRes();

      await userController.createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("returns 500 when prisma throws", async () => {
      prisma.user.create.mockRejectedValue(new Error("DB error"));
      const req = {
        body: { first_name: "Jane", last_name: "Doe", email: "jane@example.com" },
      };
      const res = createRes();

      await userController.createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to create user" }),
      );
    });
  });

  // ========================================================================
  // PUT /:userId — updateUser
  // ========================================================================
  describe("updateUser", () => {
    test("returns 200 with updated user", async () => {
      const updated = { ...MOCK_USER, first_name: "Janet" };
      prisma.user.update.mockResolvedValue(updated);
      const req = {
        params: { userId: "1" },
        body: { first_name: "Janet", last_name: "Doe", email: "jane@example.com" },
      };
      const res = createRes();

      await userController.updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updated);
    });

    test("returns 500 when prisma throws", async () => {
      prisma.user.update.mockRejectedValue(new Error("DB error"));
      const req = {
        params: { userId: "1" },
        body: { first_name: "Janet", last_name: "Doe", email: "jane@example.com" },
      };
      const res = createRes();

      await userController.updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to update user with ID 1" }),
      );
    });
  });

  // ========================================================================
  // DELETE /:userId — deleteUser
  // ========================================================================
  describe("deleteUser", () => {
    test("returns 200 with success message", async () => {
      prisma.user.delete.mockResolvedValue(MOCK_USER);
      const req = { params: { userId: "1" } };
      const res = createRes();

      await userController.deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "User with ID 1 deleted" });
    });

    test("returns 500 when prisma throws", async () => {
      prisma.user.delete.mockRejectedValue(new Error("DB error"));
      const req = { params: { userId: "1" } };
      const res = createRes();

      await userController.deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to delete user with ID 1" }),
      );
    });
  });
});
