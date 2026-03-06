const prisma = require("../lib/prisma");

///////////////////////////////  HOME ROUTE (Test Route) ///////////////////////////////

/**
 * A simple route to test if the Client API is working
 * @route GET /clients/
 * @returns {string} - A success message - "Client API is working"
 * */
exports.clientTesting = (req, res) => {
  res.status(200).send("Client API is working");
};

///////////////////////////////  GET ROUTES ///////////////////////////////

/**
 * ### FOR SUPER ADMIN / ADMIN ONLY ###
 * Get all clients
 * @route GET /clients/all
 * @returns {array} - An array of client objects
 * */
exports.getAllClients = async (req, res) => {
  try {
    const clients = await prisma.client.findMany();
    res.status(200).json(clients);
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve clients", error });
  }
};

/**
 * Get a single client by ID
 * @route GET /clients/:clientId
 * @param {string} req.params.clientId - The ID of the client to retrieve
 * @returns {object} - The client object if found, otherwise an error message
 * */
exports.getClientById = async (req, res) => {
  const { clientId } = req.params;
  try {
    const client = await prisma.client.findUnique({
      where: { client_id: BigInt(clientId) },
    });
    if (!client) {
      return res
        .status(404)
        .json({ message: `Client with ID ${clientId} not found` });
    }
    res.status(200).json(client);
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve client", error });
  }
};

/**
 * Get all users (employees) belonging to a client
 * @route GET /clients/:clientId/users
 * @param {string} req.params.clientId - The ID of the client
 * @returns {array} - An array of user objects belonging to the client
 * */
exports.getClientUsers = async (req, res) => {
  const { clientId } = req.params;
  try {
    const users = await prisma.user.findMany({
      where: { client_id: BigInt(clientId) },
    });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve client users", error });
  }
};

/**
 * Get all files (documents) belonging to a client
 * @route GET /clients/:clientId/files
 * @param {string} req.params.clientId - The ID of the client
 * @returns {array} - An array of file objects belonging to the client
 * */
exports.getClientFiles = async (req, res) => {
  const { clientId } = req.params;
  try {
    const files = await prisma.file.findMany({
      where: { client_id: BigInt(clientId) },
    });
    res.status(200).json(files);
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve client files", error });
  }
};

///////////////////////////////  POST ROUTES ///////////////////////////////

/**
 * ### FOR SUPER ADMIN / ADMIN ONLY ###
 * Create / register a new client
 * @route POST /clients/
 * @param {string} req.body.client_name - The name of the client (required)
 * @param {string} req.body.industry - The industry the client operates in
 * @param {string} req.body.founded - The founding date of the client (ISO date string)
 * @param {number} req.body.key_contacts - User ID of the key contact person
 * @param {string} req.body.company_location - Physical location of the client
 * @param {string} req.body.organization_chart - URL or description of the org chart
 * @param {string} req.body.gpt_types - GPT configuration types for the client
 * @returns {object} - The newly created client object
 * */
exports.createClient = async (req, res) => {
  const {
    client_name,
    industry,
    founded,
    key_contacts,
    company_location,
    organization_chart,
    gpt_types,
  } = req.body;

  if (!client_name) {
    return res.status(400).json({ message: "client_name is required" });
  }

  try {
    const newClient = await prisma.client.create({
      data: {
        client_name,
        industry,
        founded: founded ? new Date(founded) : undefined,
        key_contacts: key_contacts ? BigInt(key_contacts) : undefined,
        company_location,
        organization_chart,
        gpt_types,
      },
    });
    res.status(201).json(newClient);
  } catch (error) {
    res.status(500).json({ message: "Failed to create client", error });
  }
};

///////////////////////////////  PUT ROUTES ///////////////////////////////

/**
 * ### FOR SUPER ADMIN / ADMIN / CLIENT EXECUTIVE ###
 * Update a client's profile by ID
 * @route PUT /clients/:clientId
 * @param {string} req.params.clientId - The ID of the client to update
 * @param {string} req.body.client_name - Updated client name
 * @param {string} req.body.industry - Updated industry
 * @param {string} req.body.founded - Updated founding date (ISO date string)
 * @param {number} req.body.key_contacts - Updated key contact user ID
 * @param {string} req.body.company_location - Updated company location
 * @param {string} req.body.organization_chart - Updated org chart
 * @param {string} req.body.gpt_types - Updated GPT types
 * @returns {object} - The updated client object
 * */
exports.updateClient = async (req, res) => {
  const { clientId } = req.params;
  const {
    client_name,
    industry,
    founded,
    key_contacts,
    company_location,
    organization_chart,
    gpt_types,
  } = req.body;

  try {
    const updatedClient = await prisma.client.update({
      where: { client_id: BigInt(clientId) },
      data: {
        client_name,
        industry,
        founded: founded ? new Date(founded) : undefined,
        key_contacts: key_contacts ? BigInt(key_contacts) : undefined,
        company_location,
        organization_chart,
        gpt_types,
      },
    });
    res.status(200).json(updatedClient);
  } catch (error) {
    res
      .status(500)
      .json({ message: `Failed to update client with ID ${clientId}`, error });
  }
};

///////////////////////////////  DELETE ROUTES ///////////////////////////////

/**
 * ### FOR SUPER ADMIN ONLY ###
 * Delete a client by ID
 * @route DELETE /clients/:clientId
 * @param {string} req.params.clientId - The ID of the client to delete
 * @returns {object} - A success message
 * */
exports.deleteClient = async (req, res) => {
  const { clientId } = req.params;
  try {
    await prisma.client.delete({
      where: { client_id: BigInt(clientId) },
    });
    res.status(200).json({ message: `Client with ID ${clientId} deleted` });
  } catch (error) {
    res
      .status(500)
      .json({ message: `Failed to delete client with ID ${clientId}`, error });
  }
};
