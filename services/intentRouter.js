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
 *   predict   — forecasts, projections, future scenarios
 *   explain   — plain-language breakdown of a concept
 *   qa        — direct factual question/answer (default)
 */

const { ChatOpenAI } = require("@langchain/openai");

const VALID_INTENTS = ["summarize", "analyze", "predict", "explain", "qa"];

const ROUTER_SYSTEM_PROMPT = `You are an intent classifier for a Knowledge Management System (KMS) chatbot.

Your job is to identify ALL intents present in the user's message. A single message may contain multiple intents.

Valid intents:
- summarize: User wants a summary, overview, or condensed version of something
- analyze: User wants data analysis, trends, comparisons, patterns, or insights
- predict: User wants forecasts, predictions, projections, or future scenarios
- explain: User wants something explained, clarified, or broken down simply
- qa: User is asking a direct factual question (use this when none of the above fit)

Rules:
1. Return a JSON object with a single key "intents" containing an array of intent strings.
2. Include only intents that are clearly present — do not over-detect.
3. Maximum 3 intents per message.
4. If nothing specific matches, return ["qa"].
5. Never return an empty array.

Examples:
- "What is the revenue?" → {"intents": ["qa"]}
- "Summarize the Q3 report" → {"intents": ["summarize"]}
- "Summarize Q3 results and predict what Q4 will look like" → {"intents": ["summarize", "predict"]}
- "Analyze the sales trends and explain why they dropped" → {"intents": ["analyze", "explain"]}
- "What happened in Q3, why did costs rise, and what do you expect next quarter?" → {"intents": ["qa", "analyze", "predict"]}`;

let _routerLLM = null;
function getRouterLLM() {
  if (!_routerLLM) {
    _routerLLM = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "gpt-4o-mini",
      temperature: 0,
      modelKwargs: { response_format: { type: "json_object" } },
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

    return intents.length > 0 ? intents : ["qa"];
  } catch (err) {
    console.warn("[intentRouter] Failed to parse intent, defaulting to qa:", err.message);
    return ["qa"];
  }
}

module.exports = { detectIntents, VALID_INTENTS };
