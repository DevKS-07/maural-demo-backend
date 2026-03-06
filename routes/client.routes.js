const express = require("express");

const clientController = require("../controllers/client.controller");
const router = express.Router();

// Home route for testing
router.get("/", clientController.clientTesting);

// **************************  GET ROUTES **************************

router.get("/all", clientController.getAllClients); // Get all clients (Super Admin, Admin)

router.get("/:clientId", clientController.getClientById); // Get a client by ID

router.get("/:clientId/users", clientController.getClientUsers); // Get all users belonging to a client

router.get("/:clientId/files", clientController.getClientFiles); // Get all files/documents of a client

// **************************  POST ROUTES **************************

router.post("/", clientController.createClient); // Register/create a new client

// **************************  PUT ROUTES **************************

router.put("/:clientId", clientController.updateClient); // Update client's profile by ID

// ************************** DELETE ROUTES **************************

router.delete("/:clientId", clientController.deleteClient); // Delete a client by ID

module.exports = router;
