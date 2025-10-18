const request = require("supertest");
const express = require("express");
const homeRouter = require("../../routes/homeRoutes");

describe("homeRoutes", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use("/", homeRouter);
  });

  // Test the home route
  test("GET / responds with 200 and welcome message", async () => {
    const res = await request(app).get("/");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text/);
    expect(res.text).toBe("Welcome to the Maural KMS API");
  });

  // Test an unknown route i.e. 404 Not Found
  test("GET unknown route responds with 404", async () => {
    const res = await request(app).get("/unknown-route");
    expect(res.status).toBe(404);
  });
});
