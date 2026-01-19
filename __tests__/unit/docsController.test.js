jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({})),
}));

jest.mock("@prisma/client", () => {
  const mPrisma = {
    file: {
      findMany: jest.fn().mockResolvedValue([{ id: 1, name: "test.pdf" }]),
    },
  };
  return { PrismaClient: jest.fn(() => mPrisma) };
});

const docsController = require("../../controllers/docs.controller.js");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("Docs Controller - Unit Tests", () => {
  // Test for docs_Testing function
  test("docs_Testing should return 200 and a success message", () => {
    const req = {};
    const res = createRes();

    docsController.docs_Testing(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith("Docs API is working");
  });

  // Test for getAllDocuments function
  test("getAllDocuments should return 200 and documents array", async () => {
    const req = {};
    const res = createRes();

    await docsController.getAllDocuments(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ id: 1, name: "test.pdf" }]);
  });
});
