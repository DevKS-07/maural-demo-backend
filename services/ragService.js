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
 * Folder-scoped retrieval:
 *   Pass folderIds as an array of folder IDs to restrict retrieval to those folders.
 *   Pass "all" (or omit) to search across all ingested documents.
 */

const { OpenAIEmbeddings } = require("@langchain/openai");
const { createClient } = require("@supabase/supabase-js");
const prisma = require("../lib/prisma");

// ---------------------------------------------------------------------------
// Supabase client — same project the rest of the app uses
// ---------------------------------------------------------------------------
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
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
    _embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "text-embedding-ada-002",
    });
  }
  return _embeddings;
}

// ---------------------------------------------------------------------------
// Document retrieval
// ---------------------------------------------------------------------------

/**
 * Retrieve the top-K most relevant document chunks from Supabase pgvector.
 *
 * clientIds is accepted (matches the frontend contract) but currently used
 * as a best-effort filter on `metadata->folder_id`. If the ingested documents
 * don't carry a matching folder_id the search falls back to all documents.
 *
 * @param {string} query
 * @param {number[]|"all"} clientIds
 * @param {number} topK
 * @returns {Promise<Array<{content:string, metadata:object, similarity:number}>>}
 */
async function retrieveDocuments(query, _clientIds, topK = 15) {
  const supabase = getSupabase();
  const embeddings = getEmbeddings();

  // Fetch all file names from the File table so the model always knows
  // what documents exist, regardless of vector similarity scores.
  const allFiles = await prisma.file.findMany({
    select: { file_id: true, file_name: true },
  });

  // Embed the incoming query
  const queryEmbedding = await embeddings.embedQuery(query);

  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: queryEmbedding,
    match_count: topK,
    filter: {},
  });

  if (error) {
    console.warn(
      "[ragService] match_documents RPC warning (table may be empty or not yet created):",
      error.message
    );
    return [];
  }

  const chunks = data || [];

  // Guarantee at least 1 chunk per file in the knowledge base.
  // Files whose chunks all scored outside topK would otherwise be invisible to the model.
  const representedFileIds = new Set(
    chunks.map((c) => c.metadata?.file_id).filter(Boolean)
  );
  const missingFiles = allFiles.filter((f) => !representedFileIds.has(f.file_id));

  if (missingFiles.length > 0) {
    const missingIds = missingFiles.map((f) => f.file_id);
    const { data: fallbackChunks } = await supabase
      .from("document_embeddings")
      .select("content, metadata")
      .in("metadata->>file_id", missingIds)
      .limit(missingFiles.length); // 1 chunk per missing file is enough

    if (fallbackChunks && fallbackChunks.length > 0) {
      // Deduplicate: one chunk per missing file
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

  // Prepend a synthetic "document index" entry so the model always has the
  // full list of available files, even if a file's chunks scored low.
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

  // Include conversation history (last 10 turns to stay within token budget)
  const trimmed = (history || []).slice(-10);
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
  return buildMessagesForIntent(message, docs, history, getSystemPrompt("qa"));
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

module.exports = { retrieveDocuments, buildMessages, buildMessagesForIntent, mapSources };
