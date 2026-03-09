/**
 * Chat Controller — Multi-Agent Orchestration
 *
 * Pipeline per request:
 *  1. [parallel] Intent detection (gpt-4o-mini) + Document retrieval (pgvector)
 *  2. [parallel] One specialized agent per detected intent (gpt-4o)
 *  3. [if >1 intent] Combine sub-answers into one coherent response (gpt-4o-mini)
 *  4. Guardrail check — verify grounding, fix hallucinations (gpt-4o-mini)
 *  5. Stream the validated answer to the frontend (SSE)
 *
 * SSE event sequence:
 *   data: {"type":"intent","intents":["summarize","predict"]}
 *   data: {"type":"chunk","text":"..."}   ← word-by-word from buffer
 *   data: {"type":"sources","sources":[...]}
 *   data: {"type":"guardrail","confidence":87,"issues":[]}
 *   data: [DONE]
 */

const { ChatOllama } = require("@langchain/ollama");
const { detectIntents } = require("../services/intentRouter");
const { getSystemPrompt } = require("../services/promptTemplates");
const {
  retrieveDocuments,
  buildMessagesForIntent,
  mapSources,
} = require("../services/ragService");
const { checkAndRefine } = require("../services/guardrail");

// ---------------------------------------------------------------------------
// LLM factory
// ---------------------------------------------------------------------------
function getLLM({ temperature = 0.3 } = {}) {
  return new ChatOllama({
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model: process.env.OLLAMA_CHAT_MODEL || "qwen3.5:9b",
    temperature,
    numCtx: 8192,
  });
}

// ---------------------------------------------------------------------------
// Run a single specialized agent for one intent
// ---------------------------------------------------------------------------
async function runAgent(intent, message, docs, history) {
  const systemPrompt = getSystemPrompt(intent);
  const messages = buildMessagesForIntent(message, docs, history, systemPrompt);

  // Temperature varies by intent: predictions slightly higher, factual QA lower
  const temperature =
    intent === "predict" ? 0.4 : intent === "reason" ? 0.3 : 0.2;
  const llm = getLLM({ temperature });
  const response = await llm.invoke(messages);
  return response.content || "";
}

// ---------------------------------------------------------------------------
// Combine multiple sub-answers into one coherent response
// ---------------------------------------------------------------------------
const COMBINER_PROMPT = `You are combining multiple analysis results into one well-structured response.
Each section was produced by a different specialized agent. Your job is to:
1. Merge the sections with clear headers matching each intent (e.g. ## Summary, ## Forecast).
2. Remove any redundancy between sections.
3. Ensure the combined response flows naturally and reads as one coherent answer.
4. Preserve all specific data, numbers, and labeled uncertainty markers.
Do not add new information — only organize and merge what you receive.`;

async function combineAnswers(intents, answers, question) {
  const sections = intents
    .map(
      (intent, i) =>
        `### ${intent.charAt(0).toUpperCase() + intent.slice(1)}\n${answers[i]}`,
    )
    .join("\n\n");

  const llm = getLLM({ temperature: 0.1 });
  const response = await llm.invoke([
    { role: "system", content: COMBINER_PROMPT },
    {
      role: "user",
      content: `ORIGINAL QUESTION: ${question}\n\nSECTIONS TO COMBINE:\n\n${sections}`,
    },
  ]);
  return response.content || sections; // fallback to raw sections if combiner fails
}

// ---------------------------------------------------------------------------
// Stream a pre-built string character-by-character (preserves streaming UX
// after the guardrail has validated the full answer)
// ---------------------------------------------------------------------------
function streamFromBuffer(text, sendEvent, chunkSize = 4) {
  return new Promise((resolve) => {
    let pos = 0;
    function sendNext() {
      if (pos >= text.length) {
        resolve();
        return;
      }
      const end = Math.min(pos + chunkSize, text.length);
      sendEvent({ type: "chunk", text: text.slice(pos, end) });
      pos = end;
      setImmediate(sendNext); // non-blocking — yields to event loop between chunks
    }
    sendNext();
  });
}

// ---------------------------------------------------------------------------
// Shared orchestration logic (used by both streaming + non-streaming)
// ---------------------------------------------------------------------------
async function orchestrate(message, clientIds, history) {
  // Step 1 — intent detection and document retrieval run in parallel
  const [intents, docs] = await Promise.all([
    detectIntents(message),
    retrieveDocuments(message, clientIds, 5),
  ]);

  console.log(`[chat] Detected intents: [${intents.join(", ")}]`);

  // Step 2 — one specialized agent per intent, all run in parallel
  const agentAnswers = await Promise.all(
    intents.map((intent) => runAgent(intent, message, docs, history)),
  );

  // Step 3 — combine if multiple intents detected
  let combinedAnswer;
  if (intents.length === 1) {
    combinedAnswer = agentAnswers[0];
  } else {
    combinedAnswer = await combineAnswers(intents, agentAnswers, message);
  }

  // Step 4 — guardrail: verify grounding, fix hallucinations
  const { validatedAnswer, confidence, issues } = await checkAndRefine(
    combinedAnswer,
    docs,
    message,
  );

  // Step 5 — map sources for frontend citation chips
  const sources = mapSources(docs);

  return { validatedAnswer, intents, sources, confidence, issues };
}

// ---------------------------------------------------------------------------
// POST /api/chat/stream — SSE streaming (primary path)
// ---------------------------------------------------------------------------
exports.streamChat = async (req, res) => {
  const { message, clientIds = "all", history = [] } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required" });
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sendEvent = (data) => {
    res.write(
      `data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`,
    );
  };

  try {
    const { validatedAnswer, intents, sources, confidence, issues } =
      await orchestrate(message, clientIds, history);

    // 1. Send detected intents (frontend can show intent badge)
    sendEvent({ type: "intent", intents });

    // 2. Stream the guardrail-validated answer word-by-word from buffer
    await streamFromBuffer(validatedAnswer, sendEvent);

    // 3. Send source citations
    sendEvent({ type: "sources", sources });

    // 4. Send guardrail metadata
    sendEvent({ type: "guardrail", confidence, issues });

    // 5. Done
    sendEvent("[DONE]");
  } catch (err) {
    console.error("[chat.controller] streamChat error:", err.message);
    sendEvent({
      type: "error",
      message: "An error occurred while generating the response.",
    });
    sendEvent("[DONE]");
  } finally {
    res.end();
  }
};

// ---------------------------------------------------------------------------
// POST /api/chat — non-streaming JSON fallback
// ---------------------------------------------------------------------------
exports.chat = async (req, res) => {
  const { message, clientIds = "all", history = [] } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    const { validatedAnswer, intents, sources, confidence, issues } =
      await orchestrate(message, clientIds, history);

    return res.status(200).json({
      answer: validatedAnswer,
      sources,
      intents,
      guardrail: { confidence, issues },
    });
  } catch (err) {
    console.error("[chat.controller] chat error:", err.message);
    return res
      .status(500)
      .json({ error: "Failed to generate a response. Please try again." });
  }
};
