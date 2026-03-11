/**
 * Intent Router
 *
 * Detects ALL intents present in a user message and returns them as an array.
 * This allows a single message like "Summarize Q3 and predict Q4" to be split
 * into two parallel sub-task agents.
 *
 * Valid intents:
 *   summarize — condense a document or topic into key points
 *   analyze   — trends, comparisons, data insights
 *   reason    — cross-document inference, root cause, risk, direct Q&A (default)
 *   predict   — forecasts, projections, future scenarios
 */

const { ChatOllama } = require("@langchain/ollama");
const { OLLAMA_BASE_URL, OLLAMA_CHAT_MODEL } = require("../config/env");

const VALID_INTENTS = ["summarize", "analyze", "reason", "predict"];

const ROUTER_SYSTEM_PROMPT = `You are an intent classifier for a Knowledge Management System (KMS) chatbot.

Your job is to identify ALL intents present in the user's message. A single message may contain multiple intents.

Valid intents:
- summarize: User wants a summary, overview, condensed version, or key takeaways
- analyze: User wants data analysis, trends, comparisons, patterns, KPIs, or bottlenecks
- reason: User wants cross-document inference, root cause analysis, risk identification, alignment checks, dependency mapping, "what would happen if" scenarios, or is asking any direct factual question
- predict: User wants forecasts, projections, growth ceilings, churn risk, or future scenarios

Rules:
1. Return a JSON object with a single key "intents" containing an array of intent strings.
2. Include only intents that are clearly present — do not over-detect.
3. Maximum 3 intents per message.
4. If nothing specific matches, return ["reason"].
5. Never return an empty array.
6. Use "reason" for all direct factual questions — it handles both simple lookups and complex inference.

Examples:
- "What is the revenue?" → {"intents": ["reason"]}
- "Summarize the Q3 report" → {"intents": ["summarize"]}
- "Summarize Q3 results and predict what Q4 will look like" → {"intents": ["summarize", "predict"]}
- "Where is the founder spending most time on tactical tasks?" → {"intents": ["reason", "analyze"]}
- "Cross-reference our 3-year vision with this month's meeting notes" → {"intents": ["reason"]}
- "Which KPIs have been off-track and what is the common denominator?" → {"intents": ["analyze", "reason"]}
- "What would fail if the founder took 30 days off?" → {"intents": ["reason", "predict"]}`;

let _routerLLM = null;
function getRouterLLM() {
  if (!_routerLLM) {
    _routerLLM = new ChatOllama({
      baseUrl: OLLAMA_BASE_URL,
      model: OLLAMA_CHAT_MODEL,
      temperature: 0,
      format: "json",
      numCtx: 4096,
    });
  }
  return _routerLLM;
}

/**
 * Detect all intents in the user's message.
 * @param {string} message
 * @returns {Promise<string[]>} — array of 1–3 valid intent strings
 */
async function detectIntents(message) {
  try {
    const llm = getRouterLLM();
    const response = await llm.invoke([
      { role: "system", content: ROUTER_SYSTEM_PROMPT },
      { role: "user", content: message },
    ]);

    const parsed = JSON.parse(response.content);
    const intents = (parsed.intents || [])
      .map((i) => i.toLowerCase().trim())
      .filter((i) => VALID_INTENTS.includes(i))
      .slice(0, 3);

    return intents.length > 0 ? intents : ["reason"];
  } catch (err) {
    console.warn(
      "[intentRouter] Failed to parse intent, defaulting to reason:",
      err.message,
    );
    return ["reason"];
  }
}

module.exports = { detectIntents, VALID_INTENTS };
