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

const prisma = require("../../lib/prisma");
const clientController = require("../../controllers/client.controller");

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

const MOCK_CLIENT = {
  client_id: 1,
  client_name: "Acme Corp",
  industry: "Technology",
  founded: "2010-01-01",
  key_contacts: 5,
  company_location: "Seattle, WA",
  organization_chart: "https://example.com/chart",
  gpt_types: "standard",
  storage_bucket: "a1b2c3d4-uuid",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Client Controller - Unit Tests", () => {
  beforeEach(() => jest.clearAllMocks());

  // ========================================================================
  // GET / — clientTesting
  // ========================================================================
  describe("clientTesting", () => {
    test("returns 200 and success message", () => {
      const req = {};
      const res = createRes();

      clientController.clientTesting(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith("Client API is working");
    });
  });

  // ========================================================================
  // GET /all — getAllClients
  // ========================================================================
  describe("getAllClients", () => {
    test("returns 200 with array of clients", async () => {
      prisma.client.findMany.mockResolvedValue([MOCK_CLIENT]);
      const req = {};
      const res = createRes();

      await clientController.getAllClients(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([MOCK_CLIENT]);
    });

    test("returns 500 when prisma throws", async () => {
      prisma.client.findMany.mockRejectedValue(new Error("DB error"));
      const req = {};
      const res = createRes();

      await clientController.getAllClients(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to retrieve clients" }),
      );
    });
  });

  // ========================================================================
  // GET /:clientId — getClientById
  // ========================================================================
  describe("getClientById", () => {
    test("returns 200 with client when found", async () => {
      prisma.client.findUnique.mockResolvedValue(MOCK_CLIENT);
      const req = { params: { clientId: "1" } };
      const res = createRes();

      await clientController.getClientById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(MOCK_CLIENT);
    });

    test("returns 404 when client not found", async () => {
      prisma.client.findUnique.mockResolvedValue(null);
      const req = { params: { clientId: "999" } };
      const res = createRes();

      await clientController.getClientById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Client with ID 999 not found" }),
      );
    });

    test("returns 500 when prisma throws", async () => {
      prisma.client.findUnique.mockRejectedValue(new Error("DB error"));
      const req = { params: { clientId: "1" } };
      const res = createRes();

      await clientController.getClientById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to retrieve client" }),
      );
    });
  });

  // ========================================================================
  // GET /:clientId/users — getClientUsers
  // ========================================================================
  describe("getClientUsers", () => {
    test("returns 200 with users array", async () => {
      const mockUsers = [{ user_id: 1, first_name: "Jane", email: "jane@acme.com" }];
      prisma.user.findMany.mockResolvedValue(mockUsers);
      const req = { params: { clientId: "1" } };
      const res = createRes();

      await clientController.getClientUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockUsers);
    });

    test("returns empty array when client has no users", async () => {
      prisma.user.findMany.mockResolvedValue([]);
      const req = { params: { clientId: "1" } };
      const res = createRes();

      await clientController.getClientUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([]);
    });

    test("returns 500 when prisma throws", async () => {
      prisma.user.findMany.mockRejectedValue(new Error("DB error"));
      const req = { params: { clientId: "1" } };
      const res = createRes();

      await clientController.getClientUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to retrieve client users" }),
      );
    });
  });

  // ========================================================================
  // GET /:clientId/files — getClientFiles
  // ========================================================================
  describe("getClientFiles", () => {
    test("returns 200 with files array", async () => {
      const mockFiles = [{ file_id: "abc-123", file_name: "contract.pdf" }];
      prisma.file.findMany.mockResolvedValue(mockFiles);
      const req = { params: { clientId: "1" } };
      const res = createRes();

      await clientController.getClientFiles(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockFiles);
    });

    test("returns 500 when prisma throws", async () => {
      prisma.file.findMany.mockRejectedValue(new Error("DB error"));
      const req = { params: { clientId: "1" } };
      const res = createRes();

      await clientController.getClientFiles(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to retrieve client files" }),
      );
    });
  });

  // ========================================================================
  // POST / — createClient
  // ========================================================================
  describe("createClient", () => {
    test("returns 201 with created client", async () => {
      prisma.client.create.mockResolvedValue(MOCK_CLIENT);
      const req = {
        body: {
          client_name: "Acme Corp",
          industry: "Technology",
          company_location: "Seattle, WA",
        },
      };
      const res = createRes();

      await clientController.createClient(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(MOCK_CLIENT);
    });

    test("returns 400 when client_name is missing", async () => {
      const req = { body: { industry: "Technology" } };
      const res = createRes();

      await clientController.createClient(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "client_name is required" }),
      );
    });

    test("returns 500 when prisma throws", async () => {
      prisma.client.create.mockRejectedValue(new Error("DB error"));
      const req = { body: { client_name: "Acme Corp" } };
      const res = createRes();

      await clientController.createClient(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to create client" }),
      );
    });
  });

  // ========================================================================
  // PUT /:clientId — updateClient
  // ========================================================================
  describe("updateClient", () => {
    test("returns 200 with updated client", async () => {
      const updated = { ...MOCK_CLIENT, client_name: "Acme International" };
      prisma.client.update.mockResolvedValue(updated);
      const req = {
        params: { clientId: "1" },
        body: { client_name: "Acme International" },
      };
      const res = createRes();

      await clientController.updateClient(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updated);
    });

    test("returns 500 when prisma throws", async () => {
      prisma.client.update.mockRejectedValue(new Error("DB error"));
      const req = {
        params: { clientId: "1" },
        body: { client_name: "Acme International" },
      };
      const res = createRes();

      await clientController.updateClient(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to update client with ID 1" }),
      );
    });
  });

  // ========================================================================
  // DELETE /:clientId — deleteClient
  // ========================================================================
  describe("deleteClient", () => {
    test("returns 200 with success message", async () => {
      prisma.client.delete.mockResolvedValue(MOCK_CLIENT);
      const req = { params: { clientId: "1" } };
      const res = createRes();

      await clientController.deleteClient(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "Client with ID 1 deleted" });
    });

    test("returns 500 when prisma throws", async () => {
      prisma.client.delete.mockRejectedValue(new Error("DB error"));
      const req = { params: { clientId: "1" } };
      const res = createRes();

      await clientController.deleteClient(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to delete client with ID 1" }),
      );
    });
  });
});
