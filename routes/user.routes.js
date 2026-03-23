const express = require("express");

const userController = require("../controllers/user.controller");
const invitationController = require("../controllers/invitation.controller");
const { requireRole } = require("../middleware/auth.middleware");
const router = express.Router();

// Home route for testing
router.get("/", userController.user_Testing);

// **************************  INVITATION ROUTES **************************
// (must be before /:userId to avoid Express matching "invite" as a userId)

router.post("/invite", requireRole("org_executive"), invitationController.createInvitation);
router.get("/invitations", requireRole("org_executive"), invitationController.listInvitations);
router.delete("/invite/:invitationId", requireRole("org_executive"), invitationController.revokeInvitation);

// **************************  GET ROUTES **************************

router.get("/all", userController.getAllUsers); // Get all users (Super Admin, Admin)

router.get("/:userId", userController.getUserById); // Get a user by ID

router.get("/:userId/activity", userController.getUserActivity); // Get user's activity logs

router.get("/:userId/files", userController.getUserFiles); // Get files uploaded by a user

router.get("/:userId/comments", userController.getUserComments); // Get comments made by a user

router.get("/:userId/permissions", userController.getUserPermissions); // Get user's permissions via their role

// **************************  PUT ROUTES **************************

router.put("/:userId", userController.updateUser); // Update user's profile by ID

// ************************** DELETE ROUTES **************************

router.delete("/:userId", userController.deleteUser); // Delete user by ID

module.exports = router;
