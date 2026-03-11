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
 * Client-scoped retrieval:
 *   Every File belongs to a Client via client_id. Every ingested chunk carries
 *   client_id in its metadata. Pass a clientId (or array of clientIds) to restrict
 *   the vector search to only that client's documents.
 *   Pass "all" (or omit) to search across ALL clients' documents (admin use).
 *
 *   When clientIds is provided the RPC filter enforces the scope at the DB level
 *   (single client). For multiple clients the RPC fetches a larger result set and
 *   JavaScript post-filters to keep only the relevant clients' chunks.
 *
 *   ctg_id can be used to further narrow results to a specific document category.
 */

const { OllamaEmbeddings } = require("@langchain/ollama");
const { createClient } = require("@supabase/supabase-js");
const prisma = require("../lib/prisma");
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_ANON_KEY,
  OLLAMA_BASE_URL,
  OLLAMA_EMBED_MODEL,
} = require("../config/env");

// ---------------------------------------------------------------------------
// Supabase client — same project the rest of the app uses
// ---------------------------------------------------------------------------
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
    );
  }
  return _supabase;
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
    });
  }
  return _embeddings;
}

// ---------------------------------------------------------------------------
// Document retrieval
// ---------------------------------------------------------------------------

/**
 * Normalise the clientIds argument into a plain array of numbers, or null.
 * null means "all clients" (admin / unrestricted search).
 *
 * @param {number|number[]|string|"all"|null|undefined} raw
 * @returns {number[]|null}
 */
function normaliseClientIds(raw) {
  if (!raw || raw === "all") return null;
  const arr = Array.isArray(raw) ? raw : [raw];
  const nums = arr.map(Number).filter((n) => !isNaN(n) && n > 0);
  return nums.length > 0 ? nums : null;
}

/**
 * Retrieve the top-K most relevant document chunks from Supabase pgvector,
 * scoped to the specified client(s).
 *
 * Each ingested chunk stores { client_id, ctg_id, file_id, file_name }
 * in its metadata. This function uses client_id to enforce document isolation
 * between clients.
 *
 * @param {string}                    query      - User question to embed
 * @param {number|number[]|"all"}     clientIds  - Restrict to these client IDs, or "all"
 * @param {number}                    topK       - Number of chunks to return
 * @returns {Promise<Array<{content:string, metadata:object, similarity:number}>>}
 */
async function retrieveDocuments(query, clientIds, topK = 15) {
  const supabase = getSupabase();
  const embeddings = getEmbeddings();

  // Normalise → [1, 2, 3] or null
  const clientIdList = normaliseClientIds(clientIds);

  // -------------------------------------------------------------------------
  // Build the list of files the model should know about (scoped to client).
  // We use raw SQL because the Prisma schema may not yet be migrated to the
  // live DB — explicit column names avoids SELECT * failures.
  // -------------------------------------------------------------------------
  let allFiles;
  try {
    if (clientIdList) {
      // Only files belonging to the requested client(s)
      allFiles = await prisma.$queryRaw`
        SELECT file_id::text AS file_id, file_name
        FROM   "File"
        WHERE  client_id = ANY(${clientIdList}::bigint[])
      `;
    } else {
      // Admin / no filter — return all files
      allFiles = await prisma.$queryRaw`
        SELECT file_id::text AS file_id, file_name FROM "File"
      `;
    }
  } catch {
    // Fallback if client_id column doesn't exist yet (pre-migration)
    allFiles = await prisma.$queryRaw`
      SELECT file_id::text AS file_id, file_name FROM "File"
    `;
  }

  // -------------------------------------------------------------------------
  // Build the JSONB filter for the match_documents RPC.
  // The RPC uses `metadata @> filter` (JSONB containment).
  // Single-client: pass directly. Multi-client: no RPC filter — post-filter in JS.
  // -------------------------------------------------------------------------
  const rpcFilter =
    clientIdList && clientIdList.length === 1
      ? { client_id: clientIdList[0] }
      : {};

  // Fetch more rows for multi-client so post-filter still gets topK results
  const fetchCount =
    clientIdList && clientIdList.length > 1 ? topK * clientIdList.length : topK;

  // Embed the incoming query
  const queryEmbedding = await embeddings.embedQuery(query);

  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: queryEmbedding,
    match_count: fetchCount,
    filter: rpcFilter,
  });

  if (error) {
    console.warn(
      "[ragService] match_documents RPC warning (table may be empty or not yet created):",
      error.message,
    );
    return [];
  }

  let chunks = data || [];

  // Post-filter: for multiple clients, keep only chunks belonging to those clients.
  if (clientIdList && clientIdList.length > 1) {
    chunks = chunks
      .filter((c) => clientIdList.includes(Number(c.metadata?.client_id)))
      .slice(0, topK);
  }

  // -------------------------------------------------------------------------
  // Document coverage guarantee: every file the client owns should have at
  // least one chunk visible to the model, even if it scored outside topK.
  // -------------------------------------------------------------------------
  const representedFileIds = new Set(
    chunks.map((c) => c.metadata?.file_id).filter(Boolean),
  );
  const missingFiles = allFiles.filter(
    (f) => !representedFileIds.has(f.file_id),
  );

  if (missingFiles.length > 0) {
    const missingIds = missingFiles.map((f) => f.file_id);
    const { data: fallbackChunks } = await supabase
      .from("document_embeddings")
      .select("content, metadata")
      .in("metadata->>file_id", missingIds)
      .limit(missingFiles.length); // 1 chunk per missing file is enough

    if (fallbackChunks && fallbackChunks.length > 0) {
      const seen = new Set();
      for (const chunk of fallbackChunks) {
        const fid = chunk.metadata?.file_id;
        if (fid && !seen.has(fid)) {
          seen.add(fid);
          chunks.push({ ...chunk, similarity: 0 });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Prepend a synthetic "document index" entry so the model always knows
  // which files belong to this client, regardless of similarity scores.
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
 * @returns {Array<{role:string, content:string}>}
 */
function buildMessagesForIntent(message, docs, history = [], systemPrompt) {
  const context = formatContext(docs);

  // Append the retrieved document context to the system prompt
  const fullSystemPrompt = `${systemPrompt}

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
