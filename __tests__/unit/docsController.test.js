const docsController = require("../../controllers/docsController");

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
  test("getAllDocuments should return 200 and a message", () => {
    const req = {};
    const res = createRes();

    docsController.getAllDocuments(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Get all documents" });
  });
});
