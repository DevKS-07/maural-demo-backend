require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const routes = require("./routes");
const cookieParser = require("cookie-parser");
const session = require("express-session");

const app = express();

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // for parsing application/json
app.use(helmet()); // for setting various HTTP headers for app security
// app.use(cors()); // Enable CORS for all routes
app.use(
  // Enable CORS with specific settings
  cors({
    origin: "http://localhost:3000", // For now, allowing only frontend server
    credentials: true,
  }),
);

app.use(cookieParser()); // for parsing cookies
app.use(morgan("combined")); // for logging HTTP requests

// Use a session to keep track of client IDs (if needed)
app.use(
  session({
    secret: Math.random().toString(36).substring(2),
    resave: false,
    saveUninitialized: true,
  }),
);

// Routes
app.use("/api", routes); // Use the routes defined in routes.js

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
