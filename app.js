const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const routes = require("./routes");


const app = express();

// Middlewares
app.use(helmet()); // for setting various HTTP headers for app security
app.use(cors()); // Enable CORS for all routes
app.use(bodyParser.json()); // for parsing application/json
app.use(morgan("combined")); // for logging HTTP requests

// Routes
app.use("/", routes); // Use the routes defined in routes.js


// #######################################################
// ############# 404 & Error Handling Routes #############
// #######################################################

// 500 handler for server errors
app.use((err, req, res, next) => {
  console.log(err.stack);
  res
    .status(500)
    .send("Something went wrong on our side. We're working to fix it!");
});

// 404 handler for undefined routes
app.use((req, res) => {
  console.log("Error 404: Not Found");
  res.status(404).send("Error 404: Not Found");
});

module.exports = app;
