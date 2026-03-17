// Mock lib/prisma before any require() calls
jest.mock("../../lib/prisma", () => ({
  organisation: {
    findUnique: jest.fn(),
  },
}));

// Mock @clerk/express
jest.mock("@clerk/express", () => ({
  clerkClient: {
    invitations: {
      createInvitation: jest.fn(),
      getInvitationList: jest.fn(),
      revokeInvitation: jest.fn(),
    },
  },
}));

const prisma = require("../../lib/prisma");
const { clerkClient } = require("@clerk/express");
const invitationController = require("../../controllers/invitation.controller");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const MOCK_INVITATION = {
  id: "inv_abc123",
  email_address: "newuser@example.com",
  status: "pending",
  public_metadata: { role: "org_staff", org_id: "a1b2c3d4-uuid" },
  created_at: 1700000000000,
};

const MOCK_ORG = {
  org_id: "a1b2c3d4-uuid",
  org_name: "Test Organisation",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Invitation Controller - Unit Tests", () => {
  beforeEach(() => jest.clearAllMocks());

  // ========================================================================
  // POST /invite — createInvitation
  // ========================================================================
  describe("createInvitation", () => {
    test("returns 201 with invitation on success", async () => {
      prisma.organisation.findUnique.mockResolvedValue(MOCK_ORG);
      clerkClient.invitations.createInvitation.mockResolvedValue(MOCK_INVITATION);

      const req = {
        body: {
          email_address: "newuser@example.com",
          role: "org_staff",
          org_id: "a1b2c3d4-uuid",
        },
      };
      const res = createRes();

      await invitationController.createInvitation(req, res);

      expect(prisma.organisation.findUnique).toHaveBeenCalledWith({
        where: { org_id: "a1b2c3d4-uuid" },
      });
      expect(clerkClient.invitations.createInvitation).toHaveBeenCalledWith({
        emailAddress: "newuser@example.com",
        publicMetadata: { role: "org_staff", org_id: "a1b2c3d4-uuid" },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(MOCK_INVITATION);
    });

    test("returns 201 without org_id (admin-level invite)", async () => {
      clerkClient.invitations.createInvitation.mockResolvedValue(MOCK_INVITATION);

      const req = {
        body: { email_address: "newuser@example.com", role: "admin" },
      };
      const res = createRes();

      await invitationController.createInvitation(req, res);

      expect(prisma.organisation.findUnique).not.toHaveBeenCalled();
      expect(clerkClient.invitations.createInvitation).toHaveBeenCalledWith({
        emailAddress: "newuser@example.com",
        publicMetadata: { role: "admin", org_id: null },
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test("defaults role to org_staff when not provided", async () => {
      clerkClient.invitations.createInvitation.mockResolvedValue(MOCK_INVITATION);

      const req = {
        body: { email_address: "newuser@example.com" },
      };
      const res = createRes();

      await invitationController.createInvitation(req, res);

      expect(clerkClient.invitations.createInvitation).toHaveBeenCalledWith({
        emailAddress: "newuser@example.com",
        publicMetadata: { role: "org_staff", org_id: null },
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test("returns 400 when email_address is missing", async () => {
      const req = { body: { role: "org_staff" } };
      const res = createRes();

      await invitationController.createInvitation(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "email_address is required" }),
      );
    });

    test("returns 400 when role is invalid", async () => {
      const req = {
        body: { email_address: "newuser@example.com", role: "ceo" },
      };
      const res = createRes();

      await invitationController.createInvitation(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("Invalid role") }),
      );
    });

    test("returns 404 when org_id does not exist", async () => {
      prisma.organisation.findUnique.mockResolvedValue(null);

      const req = {
        body: {
          email_address: "newuser@example.com",
          role: "org_staff",
          org_id: "nonexistent-uuid",
        },
      };
      const res = createRes();

      await invitationController.createInvitation(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("not found") }),
      );
    });

    test("returns 409 when invitation already exists", async () => {
      const clerkError = new Error("duplicate");
      clerkError.status = 422;
      clerkError.errors = [{ code: "duplicate_record" }];
      clerkClient.invitations.createInvitation.mockRejectedValue(clerkError);

      const req = {
        body: { email_address: "existing@example.com" },
      };
      const res = createRes();

      await invitationController.createInvitation(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    test("returns 500 on unexpected Clerk error", async () => {
      clerkClient.invitations.createInvitation.mockRejectedValue(new Error("Clerk API down"));

      const req = {
        body: { email_address: "newuser@example.com" },
      };
      const res = createRes();

      await invitationController.createInvitation(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to create invitation" }),
      );
    });
  });

  // ========================================================================
  // GET /invitations — listInvitations
  // ========================================================================
  describe("listInvitations", () => {
    const mockList = {
      data: [
        { ...MOCK_INVITATION, status: "pending" },
        { ...MOCK_INVITATION, id: "inv_def456", status: "accepted" },
        { ...MOCK_INVITATION, id: "inv_ghi789", status: "revoked" },
      ],
    };

    test("returns 200 with all invitations", async () => {
      clerkClient.invitations.getInvitationList.mockResolvedValue(mockList);

      const req = { query: {} };
      const res = createRes();

      await invitationController.listInvitations(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockList.data);
    });

    test("returns 200 filtered by status=pending", async () => {
      clerkClient.invitations.getInvitationList.mockResolvedValue(mockList);

      const req = { query: { status: "pending" } };
      const res = createRes();

      await invitationController.listInvitations(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const result = res.json.mock.calls[0][0];
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("pending");
    });

    test("returns 500 on Clerk error", async () => {
      clerkClient.invitations.getInvitationList.mockRejectedValue(new Error("Clerk API down"));

      const req = { query: {} };
      const res = createRes();

      await invitationController.listInvitations(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to retrieve invitations" }),
      );
    });
  });

  // ========================================================================
  // DELETE /invite/:invitationId — revokeInvitation
  // ========================================================================
  describe("revokeInvitation", () => {
    test("returns 200 on successful revocation", async () => {
      const revokedInvitation = { ...MOCK_INVITATION, status: "revoked" };
      clerkClient.invitations.revokeInvitation.mockResolvedValue(revokedInvitation);

      const req = { params: { invitationId: "inv_abc123" } };
      const res = createRes();

      await invitationController.revokeInvitation(req, res);

      expect(clerkClient.invitations.revokeInvitation).toHaveBeenCalledWith("inv_abc123");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Invitation revoked" }),
      );
    });

    test("returns 404 when invitation not found", async () => {
      const clerkError = new Error("Not found");
      clerkError.status = 404;
      clerkClient.invitations.revokeInvitation.mockRejectedValue(clerkError);

      const req = { params: { invitationId: "inv_nonexistent" } };
      const res = createRes();

      await invitationController.revokeInvitation(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("not found") }),
      );
    });

    test("returns 500 on unexpected error", async () => {
      clerkClient.invitations.revokeInvitation.mockRejectedValue(new Error("Clerk API down"));

      const req = { params: { invitationId: "inv_abc123" } };
      const res = createRes();

      await invitationController.revokeInvitation(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to revoke invitation" }),
      );
    });
  });
});
