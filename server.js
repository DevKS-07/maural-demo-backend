require("dotenv").config({
  path: `.env.${process.env.NODE_ENV || "development"}.local`,
});

const app = require("./app");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "localhost";

/* Start the server */
app.listen(PORT, () => {
  console.log(`Server is running at http://${HOST}:${PORT}`);
});
