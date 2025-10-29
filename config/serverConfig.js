/**
 * Environment config for server (e.g., port, host etc.)
 *  */

module.exports = {
  port: process.env.PORT || 5002,
  host: process.env.HOST || "localhost",
  apiVersion: "/api/v1",
};
