/**
 * Main Express app setup
 *
 *  */

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
// const routes = require("./routes");

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(morgan("combined"));
// app.use("/api", routes);

// Basic route
app.get("/", (req, res) => {
  res.send("Welcome to the Maural KMS API");
});

// Error handling middleware
// 500 handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// 404 handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(404).send("Error 404: Not Found");
});

module.exports = app;

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
