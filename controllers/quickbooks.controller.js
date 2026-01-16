const axios = require("axios");
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { createClient } = require("@supabase/supabase-js");
const prisma = new PrismaClient();

const CLIENT_ID = process.env.QUICKBOOKS_CLIENT_ID;
const CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET;
const REDIRECT_URI = process.env.QUICKBOOKS_REDIRECT_URI;

const installQuickbooks = async (req, res) => {
  res.status(200).send("QuickBooks installation endpoint - to be implemented");
};

const getQuickbooksCallback = async (req, res) => {
  res
    .status(200)
    .send("QuickBooks OAuth callback endpoint - to be implemented");
};

const connectionSuccessHandler = async (req, res) => {
  res
    .status(200)
    .send("QuickBooks connection success handler - to be implemented");
};

const getQuickbooksStatus = async (req, res) => {
  res
    .status(200)
    .send("QuickBooks connection status endpoint - to be implemented");
};

module.exports = {
  installQuickbooks,
  getQuickbooksCallback,
  connectionSuccessHandler,
  getQuickbooksStatus,
};
