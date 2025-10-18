const app = require("./app");
const { port, host } = require("./config/serverConfig");

const PORT = port;
const HOST = host;

/* Start the server */
app.listen(PORT, () => {
  console.log(`Server is running at http://${HOST}:${PORT}`);
});
