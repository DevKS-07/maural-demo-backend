/**
 * RAG (Retrieval-Augmented Generation) Service
 *
 * Uses the SAME Supabase project already configured in .env:
 *   SUPABASE_URL  / SUPABASE_ANON_KEY
 *
 * Requires the following to exist in Supabase (run the SQL once):
 *   - table: document_embeddings (id, content, metadata jsonb, embedding vector(1536))
 *   - function: match_documents(query_embedding, match_count, filter)
 *
 * Organisation-scoped retrieval:
 *   Every File belongs to an Organisation via org_id. Every ingested chunk carries
 *   org_id in its metadata. Pass an orgId (or array of orgIds) to restrict
 *   the vector search to only that organisation's documents.
 *   Pass "all" (or omit) to search across ALL organisations' documents (admin use).
 *
 *   When orgIds is provided the RPC filter enforces the scope at the DB level
 *   (single organisation). For multiple organisations the RPC fetches a larger result set and
 *   JavaScript post-filters to keep only the relevant organisations' chunks.
 *
 *   ctg_id can be used to further narrow results to a specific document category.
 */

const { OllamaEmbeddings, ChatOllama } = require("@langchain/ollama");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");
const { Pool } = require("pg");
const prisma = require("../lib/prisma");

const { OLLAMA_BASE_URL, OLLAMA_EMBED_MODEL, OLLAMA_CHAT_MODEL, DIRECT_URL } = require("../config/env");
const { getOllamaHeaders } = require("../config/ollama");

// ---------------------------------------------------------------------------
// Dedicated pg Pool for vector queries.
// Uses DIRECT_URL (no pgbouncer) so that SET ivfflat.probes persists on the
// same connection — pgbouncer routes each statement to a different backend,
// making session-level SET ineffective.
// ---------------------------------------------------------------------------
let _vectorPool = null;
function getVectorPool() {
  if (!_vectorPool) {
    _vectorPool = new Pool({
      connectionString: DIRECT_URL || process.env.DATABASE_URL,
    });
  }
  return _vectorPool;
}

/**
 * Run a vector similarity query on a dedicated client so that
 * `SET ivfflat.probes` applies to the same connection as the SELECT.
 */
async function vectorQuery(sql) {
  const pool = getVectorPool();
  const client = await pool.connect();
  try {
    // The IVFFlat index uses 100 lists; probe all of them to guarantee correct
    // results. Without this, default probes=1 visits 1 list and misses all rows.
    await client.query("SET ivfflat.probes = 100");
    const result = await client.query(sql);
    return result.rows;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Embeddings model (lazy singleton)
// ---------------------------------------------------------------------------
let _embeddings = null;
function getEmbeddings() {
  if (!_embeddings) {
    _embeddings = new OllamaEmbeddings({
      baseUrl: OLLAMA_BASE_URL,
      model: OLLAMA_EMBED_MODEL,
      headers: getOllamaHeaders(),
    });
  }
  return _embeddings;
}

// ---------------------------------------------------------------------------
// LLM for query rewriting (lazy singleton, low temperature for consistency)
// ---------------------------------------------------------------------------
let _rewriteLLM = null;
function getRewriteLLM() {
  if (!_rewriteLLM) {
    _rewriteLLM = new ChatOllama({
      baseUrl: OLLAMA_BASE_URL,
      model: OLLAMA_CHAT_MODEL,
      temperature: 0,
      numCtx: 1024,
      headers: getOllamaHeaders(),
    });
  }
  return _rewriteLLM;
}

/**
 * Rewrite a user question into a dense, search-optimised query.
 * Vague follow-ups like "tell me more" are expanded into specific queries.
 * Returns the original query unchanged if the LLM call fails.
 */
async function rewriteQuery(query, history = []) {
  // Build a short conversation snippet for context (last 2 turns only)
  const historySnippet = (history || [])
    .slice(-2)
    .map((t) => `${t.role}: ${t.content}`)
    .join("\n");

  try {
    const llm = getRewriteLLM();
    const response = await llm.invoke([
      new SystemMessage(
        "You are a search query optimiser. " +
        "Given a user question (and optional recent conversation), " +
        "rewrite it as a single, specific, self-contained search query " +
        "that will retrieve the most relevant document chunks from a knowledge base. " +
        "Output ONLY the rewritten query — no explanation, no punctuation at the end.",
      ),
      new HumanMessage(
        `${historySnippet ? `Recent conversation:\n${historySnippet}\n\n` : ""}User question: ${query}`,
      ),
    ]);
    const rewritten = (response.content || "").toString().trim();
    if (rewritten.length > 0) {
      console.log(`[ragService] query rewrite: "${query}" → "${rewritten}"`);
      return rewritten;
    }
  } catch (err) {
    console.warn("[ragService] query rewrite failed, using original:", err.message);
  }
  return query;
}

// ---------------------------------------------------------------------------
// Document retrieval
// ---------------------------------------------------------------------------

/**
 * Normalise the orgIds argument into a plain array of UUID strings, or null.
 * null means "all organisations" (admin / unrestricted search).
 *
 * @param {string|string[]|"all"|null|undefined} raw
 * @returns {string[]|null}
 */
function normaliseOrgIds(raw) {
  if (!raw || raw === "all") return null;
  const arr = Array.isArray(raw) ? raw : [raw];
  const ids = arr.map(String).filter((s) => s.length > 0);
  return ids.length > 0 ? ids : null;
}

/**
 * Retrieve the top-K most relevant document chunks from Supabase pgvector,
 * scoped to the specified organisation(s).
 *
 * Uses three techniques combined:
 *  1. Query rewriting  — LLM rewrites the question into a better search query
 *  2. Vector search    — cosine similarity on 768-dim embeddings (top 12)
 *  3. Keyword search   — PostgreSQL full-text search (tsvector) for exact terms
 * Results from both searches are merged and deduplicated by content.
 *
 * @param {string}                    query      - User question to embed
 * @param {string|string[]|"all"}     orgIds     - Restrict to these organisation IDs, or "all"
 * @param {number}                    topK       - Number of chunks to return from each search
 * @param {Array}                     history    - Prior conversation turns (for query rewriting)
 * @returns {Promise<Array<{content:string, metadata:object, similarity:number}>>}
 */
async function retrieveDocuments(query, orgIds, topK = 12, history = []) {
  const embeddings = getEmbeddings();

  // Normalise → ["uuid-1", "uuid-2"] or null
  const orgIdList = normaliseOrgIds(orgIds);

  // -------------------------------------------------------------------------
  // Option C — Only rewrite vague/short queries (≤ 8 words).
  // Specific questions already embed well; rewriting them adds latency with
  // no accuracy gain.
  // Option B — Run rewriting and the allFiles DB lookup in parallel so the
  // extra LLM call doesn't block the DB query.
  // -------------------------------------------------------------------------
  const isVague = query.trim().split(/\s+/).length <= 8;

  const [searchQuery, allFiles] = await Promise.all([
    // Only call the LLM rewriter for short/vague queries
    isVague ? rewriteQuery(query, history) : Promise.resolve(query),

    // allFiles DB lookup runs in parallel regardless
    (async () => {
      try {
        if (orgIdList) {
          return await prisma.$queryRaw`
            SELECT file_id::text AS file_id, file_name
            FROM   "File"
            WHERE  org_id = ANY(${orgIdList}::uuid[])
          `;
        }
        return await prisma.$queryRaw`
          SELECT file_id::text AS file_id, file_name FROM "File"
        `;
      } catch {
        return await prisma.$queryRaw`
          SELECT file_id::text AS file_id, file_name FROM "File"
        `;
      }
    })(),
  ]);

  // -------------------------------------------------------------------------
  // Step 2 — Vector similarity search
  // Uses a dedicated pg Pool client so that SET ivfflat.probes persists on the
  // same connection as the SELECT (pgbouncer would route them to different
  // backends, making the SET ineffective).
  // -------------------------------------------------------------------------
  const queryEmbedding = await embeddings.embedQuery(searchQuery);
  const vecStr = "[" + queryEmbedding.join(",") + "]";
  const orgFilter = orgIdList ? orgIdList.map((id) => `'${id}'`).join(",") : null;
  const orgWhere = orgFilter ? `WHERE org_id = ANY(ARRAY[${orgFilter}]::uuid[])` : "";

  let vectorChunks = [];
  try {
    const rows = await vectorQuery(
      `SELECT content, metadata,
              1 - (embedding <=> '${vecStr}'::vector) AS similarity
       FROM document_embeddings
       ${orgWhere}
       ORDER BY embedding <=> '${vecStr}'::vector
       LIMIT ${topK}`,
    );
    vectorChunks = rows.map((r) => ({
      content: r.content,
      metadata: r.metadata,
      similarity: parseFloat(r.similarity),
    }));
  } catch (err) {
    console.warn("[ragService] vector search failed:", err.message);
  }

  // -------------------------------------------------------------------------
  // Step 3 — Keyword (full-text) search
  // Converts the rewritten query to a tsquery and matches against content.
  // Gives a score of 0.5 (lower than a true vector match) so vector results
  // rank higher when both return the same chunk.
  // -------------------------------------------------------------------------
  let keywordChunks = [];
  try {
    // Build a simple tsquery: split into words, join with & (AND)
    const tsWords = searchQuery
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .join(" & ");

    if (tsWords.length > 0) {
      const orgWhereKeyword = orgFilter
        ? `AND org_id = ANY(ARRAY[${orgFilter}]::uuid[])`
        : "";
      const rows = await vectorQuery(
        `SELECT content, metadata, 0.5 AS similarity
         FROM document_embeddings
         WHERE to_tsvector('english', content) @@ to_tsquery('english', '${tsWords}')
         ${orgWhereKeyword}
         LIMIT ${topK}`,
      );
      keywordChunks = rows.map((r) => ({
        content: r.content,
        metadata: r.metadata,
        similarity: parseFloat(r.similarity),
      }));
    }
  } catch (err) {
    console.warn("[ragService] keyword search failed:", err.message);
  }

  // -------------------------------------------------------------------------
  // Merge vector + keyword results — deduplicate by content, keep highest score
  // -------------------------------------------------------------------------
  const seen = new Map(); // content → chunk
  for (const chunk of [...vectorChunks, ...keywordChunks]) {
    const key = chunk.content;
    if (!seen.has(key) || chunk.similarity > seen.get(key).similarity) {
      seen.set(key, chunk);
    }
  }
  let chunks = Array.from(seen.values()).sort((a, b) => b.similarity - a.similarity);

  // -------------------------------------------------------------------------
  // Prepend a synthetic "document index" entry so the model always knows
  // which files belong to this organisation, regardless of similarity scores.
  // -------------------------------------------------------------------------
  const fileIndex = {
    content: `Available documents in the knowledge base:\n${allFiles
      .map((f) => `- ${f.file_name}`)
      .join("\n")}`,
    metadata: { file_name: "__index__", chunk_index: -1 },
    similarity: 1,
  };

  return [fileIndex, ...chunks];
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function formatContext(docs) {
  if (!docs || docs.length === 0) {
    return "No relevant documents were found in the knowledge base.";
  }
  return docs
    .map((doc, i) => {
      const meta = doc.metadata || {};
      return `[${i + 1}] ${meta.file_name || "Document"}\n${doc.content}`;
    })
    .join("\n\n---\n\n");
}

/**
 * Build the messages array for the OpenAI ChatCompletion call
 * using an intent-specific system prompt from promptTemplates.js.
 *
 * @param {string} message          Current user question
 * @param {Array}  docs             Retrieved document chunks
 * @param {Array}  history          Prior conversation turns [{role, content}]
 * @param {string} systemPrompt     Intent-specific system prompt (from promptTemplates.js)
 * @param {string} [businessContext] Formatted KPI/VTO text block (optional)
 * @returns {Array<{role:string, content:string}>}
 */
function buildMessagesForIntent(message, docs, history = [], systemPrompt, businessContext) {
  const context = formatContext(docs);

  // Build the full system prompt with optional business data + document context
  let fullSystemPrompt = systemPrompt;

  if (businessContext) {
    fullSystemPrompt += `

CRITICAL INSTRUCTION: The section below contains REAL, LIVE financial KPI data for this organisation.
You MUST use these exact numbers when answering questions about financial performance, gross margin,
EBITDA, revenue, labor, or sales. Do NOT say data is unavailable if it appears below.

--- BUSINESS DATA (KPIs & VTO) ---
${businessContext}
--- END OF BUSINESS DATA ---`;
  }

  fullSystemPrompt += `

--- RETRIEVED DOCUMENTS ---
${context}
--- END OF DOCUMENTS ---`;

  const messages = [{ role: "system", content: fullSystemPrompt }];

  // Include conversation history (last 5 turns to stay within token budget)
  const trimmed = (history || []).slice(-5);
  for (const turn of trimmed) {
    if (turn.role && turn.content) {
      messages.push({ role: turn.role, content: turn.content });
    }
  }

  messages.push({ role: "user", content: message });
  return messages;
}

// Keep legacy export for any existing callers
function buildMessages(message, docs, history = []) {
  const { getSystemPrompt } = require("./promptTemplates");
  return buildMessagesForIntent(
    message,
    docs,
    history,
    getSystemPrompt("reason"),
  );
}

// ---------------------------------------------------------------------------
// Source mapping (frontend format)
// ---------------------------------------------------------------------------

/**
 * Map retrieved chunks to the citation format the frontend expects.
 * Deduplicates by file_name so each document appears only once.
 *
 * @param {Array} docs
 * @returns {Array<{title:string, type:string, snippet:string}>}
 */
function mapSources(docs) {
  const seen = new Set();
  const sources = [];

  for (const doc of docs || []) {
    const meta = doc.metadata || {};
    const title = meta.file_name || "Document";
    if (title === "__index__") continue; // skip the synthetic index entry
    if (seen.has(title)) continue;
    seen.add(title);
    sources.push({
      title,
      type: "Knowledge Base",
      snippet: (doc.content || "").slice(0, 200),
    });
  }

  return sources;
}

module.exports = {
  retrieveDocuments,
  buildMessages,
  buildMessagesForIntent,
  mapSources,
};
