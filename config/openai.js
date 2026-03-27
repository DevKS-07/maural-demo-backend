// ─────────────────────────────────────────────────────────────────────────────
// Shared OpenAI configuration helpers
// ─────────────────────────────────────────────────────────────────────────────

const { OPENAI_API_KEY } = require("./env");

/**
 * Returns the apiKey to pass to ChatOpenAI / OpenAIEmbeddings.
 * Throws at startup if the key is missing so errors surface early.
 */
function getOpenAIApiKey() {
  if (!OPENAI_API_KEY) {
    throw new Error("[openai] OPENAI_API_KEY environment variable is not set.");
  }
  return OPENAI_API_KEY;
}

module.exports = { getOpenAIApiKey };
