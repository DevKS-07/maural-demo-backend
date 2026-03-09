// All mocks must be declared before any require() calls.
// Paths are relative to this test file (__tests__/unit/).

jest.mock("@langchain/ollama", () => ({
  ChatOllama: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: "agent answer" }),
  })),
}));

jest.mock("../../services/intentRouter", () => ({
  detectIntents: jest.fn(),
}));

jest.mock("../../services/promptTemplates", () => ({
  getSystemPrompt: jest.fn().mockReturnValue("you are a helpful assistant"),
}));

jest.mock("../../services/ragService", () => ({
  retrieveDocuments: jest.fn(),
  buildMessagesForIntent: jest.fn().mockReturnValue([]),
  mapSources: jest.fn().mockReturnValue([{ file_id: "abc", file_name: "report.pdf" }]),
}));

jest.mock("../../services/guardrail", () => ({
  checkAndRefine: jest.fn(),
}));

const { streamChat, chat } = require("../../controllers/chat.controller");
const { detectIntents } = require("../../services/intentRouter");
const { retrieveDocuments, mapSources } = require("../../services/ragService");
const { checkAndRefine } = require("../../services/guardrail");

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const DOCS = [{ file_id: "abc", content: "quarterly report content" }];
const GUARDRAIL = { validatedAnswer: "The answer.", confidence: 88, issues: [] };

/** Wire up the three async services used by orchestrate(). */
function mockOrchestrate({ intents = ["summarize"] } = {}) {
  detectIntents.mockResolvedValue(intents);
  retrieveDocuments.mockResolvedValue(DOCS);
  checkAndRefine.mockResolvedValue(GUARDRAIL);
}

// ---------------------------------------------------------------------------
// Mock response builders
// ---------------------------------------------------------------------------

/** Chainable res mock for JSON routes (status/json). */
function createJsonRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

/**
 * Full res mock that covers both the early-return JSON path and the SSE path
 * so we don't need two separate builders.
 */
function createSseRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  res.flushHeaders = jest.fn();
  res.write = jest.fn();
  res.end = jest.fn();
  return res;
}

/**
 * Parse every res.write() call into plain objects.
 * SSE format: "data: <body>\n\n"
 */
function parseSseEvents(res) {
  return res.write.mock.calls.map(([raw]) => {
    const body = raw.replace(/^data: /, "").replace(/\n\n$/, "");
    if (body === "[DONE]") return "[DONE]";
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("chat controller", () => {
  beforeEach(() => jest.clearAllMocks());

  // ========================================================================
  // POST /api/chat — non-streaming JSON
  // ========================================================================
  describe("chat (JSON)", () => {
    test("returns 400 when message is absent", async () => {
      const req = { body: {} };
      const res = createJsonRes();

      await chat(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "message is required" });
    });

    test("returns 400 when message is not a string", async () => {
      const req = { body: { message: 99 } };
      const res = createJsonRes();

      await chat(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "message is required" });
    });

    test("returns 200 with correct response shape on success", async () => {
      mockOrchestrate();
      const req = { body: { message: "Summarize the Q3 report." } };
      const res = createJsonRes();

      await chat(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        answer: GUARDRAIL.validatedAnswer,
        sources: [{ file_id: "abc", file_name: "report.pdf" }],
        intents: ["summarize"],
        guardrail: { confidence: GUARDRAIL.confidence, issues: GUARDRAIL.issues },
      });
    });

    test("uses default clientIds and history when omitted", async () => {
      mockOrchestrate();
      const req = { body: { message: "What is the net income?" } };
      const res = createJsonRes();

      await chat(req, res);

      // retrieveDocuments should be called with "all" as clientIds (the default) and top-k of 5
      expect(retrieveDocuments).toHaveBeenCalledWith("What is the net income?", "all", 5);
    });

    test("returns 500 when orchestrate throws", async () => {
      detectIntents.mockRejectedValue(new Error("LLM unavailable"));
      retrieveDocuments.mockResolvedValue([]);
      const req = { body: { message: "What happened in Q3?" } };
      const res = createJsonRes();

      await chat(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Failed to generate a response. Please try again.",
      });
    });
  });

  // ========================================================================
  // POST /api/chat/stream — SSE streaming
  // ========================================================================
  describe("streamChat (SSE)", () => {
    test("returns 400 JSON before setting SSE headers when message is absent", async () => {
      const req = { body: {} };
      const res = createSseRes();

      await streamChat(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "message is required" });
      // SSE setup must NOT have started
      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.flushHeaders).not.toHaveBeenCalled();
    });

    test("sets required SSE headers", async () => {
      mockOrchestrate();
      const req = { body: { message: "What are the key risks?" } };
      const res = createSseRes();

      await streamChat(req, res);

      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
      expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache");
      expect(res.setHeader).toHaveBeenCalledWith("Connection", "keep-alive");
      expect(res.setHeader).toHaveBeenCalledWith("X-Accel-Buffering", "no");
      expect(res.flushHeaders).toHaveBeenCalled();
    });

    test("sends events in correct order: intent → chunks → sources → guardrail → [DONE]", async () => {
      mockOrchestrate();
      const req = { body: { message: "Give me a summary." } };
      const res = createSseRes();

      await streamChat(req, res);

      const events = parseSseEvents(res);
      const nonChunkTypes = events
        .filter((e) => typeof e === "string" || e.type !== "chunk")
        .map((e) => (typeof e === "string" ? e : e.type));

      expect(nonChunkTypes).toEqual(["intent", "sources", "guardrail", "[DONE]"]);
    });

    test("intent event carries the detected intents array", async () => {
      mockOrchestrate({ intents: ["summarize"] });
      const req = { body: { message: "Summarize the report." } };
      const res = createSseRes();

      await streamChat(req, res);

      const intentEvent = parseSseEvents(res).find((e) => e.type === "intent");
      expect(intentEvent).toEqual({ type: "intent", intents: ["summarize"] });
    });

    test("chunk events reconstruct the full validated answer", async () => {
      mockOrchestrate();
      const req = { body: { message: "Tell me about the report." } };
      const res = createSseRes();

      await streamChat(req, res);

      const assembled = parseSseEvents(res)
        .filter((e) => e.type === "chunk")
        .map((e) => e.text)
        .join("");

      expect(assembled).toBe(GUARDRAIL.validatedAnswer);
    });

    test("guardrail event contains confidence and issues", async () => {
      mockOrchestrate();
      const req = { body: { message: "Explain the cash flow." } };
      const res = createSseRes();

      await streamChat(req, res);

      const guardrailEvent = parseSseEvents(res).find((e) => e.type === "guardrail");
      expect(guardrailEvent).toEqual({
        type: "guardrail",
        confidence: GUARDRAIL.confidence,
        issues: GUARDRAIL.issues,
      });
    });

    test("sends error event then [DONE] when orchestrate throws", async () => {
      detectIntents.mockRejectedValue(new Error("network timeout"));
      retrieveDocuments.mockResolvedValue([]);
      const req = { body: { message: "Summarize everything." } };
      const res = createSseRes();

      await streamChat(req, res);

      const events = parseSseEvents(res);
      expect(events).toContainEqual({
        type: "error",
        message: "An error occurred while generating the response.",
      });
      expect(events[events.length - 1]).toBe("[DONE]");
    });

    test("calls res.end exactly once regardless of success or failure", async () => {
      mockOrchestrate();
      const req = { body: { message: "What is the net income?" } };
      const res = createSseRes();

      await streamChat(req, res);

      expect(res.end).toHaveBeenCalledTimes(1);
    });

    test("handles multiple intents and still sends a single intent event", async () => {
      mockOrchestrate({ intents: ["summarize", "predict"] });
      const req = { body: { message: "Summarize and forecast revenue." } };
      const res = createSseRes();

      await streamChat(req, res);

      const events = parseSseEvents(res);
      const intentEvents = events.filter((e) => e.type === "intent");
      expect(intentEvents).toHaveLength(1);
      expect(intentEvents[0].intents).toEqual(["summarize", "predict"]);
    });
  });
});
