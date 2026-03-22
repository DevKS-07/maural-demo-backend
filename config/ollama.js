// ─────────────────────────────────────────────────────────────────────────────
// Shared Ollama configuration helpers
//
// Centralizes the API key header so every ChatOllama / OllamaEmbeddings
// instance automatically authenticates with a remote Ollama proxy.
// When OLLAMA_API_KEY is empty (local dev), no extra headers are sent.
// ─────────────────────────────────────────────────────────────────────────────

const { OLLAMA_API_KEY } = require("./env");

/**
 * Returns the headers object to pass to ChatOllama / OllamaEmbeddings.
 * Empty object when no API key is configured (local Ollama).
 */
function getOllamaHeaders() {
  if (!OLLAMA_API_KEY) return {};
  return { "X-Ollama-Api-Key": OLLAMA_API_KEY };
}

module.exports = { getOllamaHeaders };
