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
 * Each ingested chunk stores { org_id, ctg_id, file_id, file_name }
 * in its metadata. This function uses org_id to enforce document isolation
 * between organisations.
 *
 * @param {string}                    query      - User question to embed
 * @param {string|string[]|"all"}     orgIds     - Restrict to these organisation IDs, or "all"
 * @param {number}                    topK       - Number of chunks to return
 * @returns {Promise<Array<{content:string, metadata:object, similarity:number}>>}
 */
async function retrieveDocuments(query, orgIds, topK = 15) {
  const supabase = getSupabase();
  const embeddings = getEmbeddings();

  // Normalise → ["uuid-1", "uuid-2"] or null
  const orgIdList = normaliseOrgIds(orgIds);

  // -------------------------------------------------------------------------
  // Build the list of files the model should know about (scoped to organisation).
  // We use raw SQL because the Prisma schema may not yet be migrated to the
  // live DB — explicit column names avoids SELECT * failures.
  // -------------------------------------------------------------------------
  let allFiles;
  try {
    if (orgIdList) {
      // Only files belonging to the requested organisation(s)
      allFiles = await prisma.$queryRaw`
        SELECT file_id::text AS file_id, file_name
        FROM   "File"
        WHERE  org_id = ANY(${orgIdList}::uuid[])
      `;
    } else {
      // Admin / no filter — return all files
      allFiles = await prisma.$queryRaw`
        SELECT file_id::text AS file_id, file_name FROM "File"
      `;
    }
  } catch {
    // Fallback if org_id column doesn't exist yet (pre-migration)
    allFiles = await prisma.$queryRaw`
      SELECT file_id::text AS file_id, file_name FROM "File"
    `;
  }

  // -------------------------------------------------------------------------
  // Build the filter for the match_documents RPC.
  // Uses the real org_id column for fast, indexed tenant isolation.
  // Pass org_ids as a UUID array; null means "all" (admin).
  // -------------------------------------------------------------------------

  // Embed the incoming query
  const queryEmbedding = await embeddings.embedQuery(query);

  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: queryEmbedding,
    match_count: topK,
    filter_org_ids: orgIdList, // null = all orgs (admin), array = scoped
  });

  if (error) {
    console.warn(
      "[ragService] match_documents RPC warning (table may be empty or not yet created):",
      error.message,
    );
    return [];
  }

  let chunks = data || [];

  // -------------------------------------------------------------------------
  // Document coverage guarantee: every file the organisation owns should have at
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
