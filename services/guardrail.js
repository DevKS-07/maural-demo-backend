/**
 * Guardrail Service
 *
 * After an agent generates an answer, this service verifies that:
 * 1. All specific facts/numbers are grounded in the retrieved documents.
 * 2. Any use of general knowledge is explicitly labeled "(General knowledge)".
 * 3. There are no hallucinated claims.
 *
 * If issues are found, the guardrail provides a revised answer.
 * If confidence is low (<60), a transparency note is prepended.
 *
 * This NEVER blocks a response — it always returns something useful.
 */

const { ChatOllama } = require("@langchain/ollama");

const GUARDRAIL_SYSTEM_PROMPT = `You are an accuracy verifier for a Knowledge Management System (KMS) chatbot.

You will be given:
1. The user's question
2. The source document excerpts that were retrieved (ground truth)
3. The generated answer to verify

Your job:
- Check whether every specific claim, number, date, or fact in the answer is supported by the source documents.
- If a claim uses general knowledge (not from the documents), verify it is ALREADY labeled with "(General knowledge)".
- If a claim is not in the documents AND not labeled as general knowledge, that is a hallucination.
- If predictions are made without uncertainty labels (High/Medium/Low confidence), flag that.

Respond with a JSON object in this exact format:
{
  "isAccurate": boolean,
  "confidence": number (0-100, how confident the answer is grounded),
  "issues": string[] (list of specific problems found, empty array if none),
  "revisedAnswer": string | null (provide a corrected version if issues exist, otherwise null)
}

Rules for your revision:
- Fix hallucinations by removing or clearly labeling the unsupported claims.
- Add "(General knowledge)" labels to unlabeled general-knowledge claims.
- Do NOT remove useful content — just correct what is wrong.
- Preserve the original formatting (bullets, headers, etc.) in the revision.
- If no issues found, set revisedAnswer to null.`;

let _guardrailLLM = null;
function getGuardrailLLM() {
  if (!_guardrailLLM) {
    _guardrailLLM = new ChatOllama({
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      model: process.env.OLLAMA_CHAT_MODEL || "qwen3.5:9b",
      headers: { "ngrok-skip-browser-warning": "true" },
      temperature: 0,
      format: "json",
      numCtx: 8192,
    });
  }
  return _guardrailLLM;
}

/**
 * Verify and optionally revise a generated answer.
 *
 * @param {string} answer        - The generated answer to check
 * @param {Array}  docs          - Retrieved document chunks (from ragService)
 * @param {string} question      - The original user question
 * @returns {Promise<{validatedAnswer: string, confidence: number, issues: string[]}>}
 */
async function checkAndRefine(answer, docs, question) {
  // If no documents were retrieved, skip the grounding check
  // (answer is entirely from general knowledge — that's already the fallback behavior)
  if (!docs || docs.length === 0) {
    return {
      validatedAnswer: answer,
      confidence: 70,
      issues: [],
    };
  }

  const docContext = docs
    .map((d, i) => {
      const meta = d.metadata || {};
      return `[Doc ${i + 1}: ${meta.file_name || "Document"}]\n${d.content}`;
    })
    .join("\n\n---\n\n");

  try {
    const llm = getGuardrailLLM();
    const response = await llm.invoke([
      { role: "system", content: GUARDRAIL_SYSTEM_PROMPT },
      {
        role: "user",
        content: `QUESTION:\n${question}\n\nSOURCE DOCUMENTS:\n${docContext}\n\nGENERATED ANSWER:\n${answer}`,
      },
    ]);

    const result = JSON.parse(response.content);
    const confidence =
      typeof result.confidence === "number" ? result.confidence : 75;
    const issues = Array.isArray(result.issues) ? result.issues : [];

    // Decide which answer to use
    let validatedAnswer = answer;

    if (result.revisedAnswer && issues.length > 0) {
      // Use the guardrail's revised version
      validatedAnswer = result.revisedAnswer;
    }

    // If confidence is low, prepend a transparency note
    if (confidence < 60) {
      validatedAnswer =
        `**Note:** Limited document coverage for this question — parts of this answer draw on general knowledge and may not reflect your specific data.\n\n` +
        validatedAnswer;
    }

    return { validatedAnswer, confidence, issues };
  } catch (err) {
    // Guardrail failed — return original answer rather than blocking
    console.warn(
      "[guardrail] Verification failed, returning original answer:",
      err.message,
    );
    return {
      validatedAnswer: answer,
      confidence: 70,
      issues: [],
    };
  }
}

module.exports = { checkAndRefine };
