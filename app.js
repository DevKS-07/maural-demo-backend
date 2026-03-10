require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { clerkMiddleware } = require("@clerk/express");
const routes = require("./routes");

const app = express();

// Clerk middleware — must be first so req.auth() is available everywhere
app.use(clerkMiddleware());

// Raw body parser for Clerk webhook route — must come before express.json()
// Svix needs the unparsed request body to verify the webhook signature
app.use("/api/webhooks", express.raw({ type: "application/json" }));

// General middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(helmet());
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(morgan("combined"));

// Routes
app.use("/api", routes);

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
