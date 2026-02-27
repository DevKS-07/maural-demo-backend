/**
 * Document Ingestion Controller
 *
 * Reads every file from Supabase Storage (via the File table),
 * extracts text, chunks it, embeds with OpenAI, and upserts into
 * the `document_embeddings` table in the same Supabase project.
 *
 * POST /api/chat/ingest
 *   — Call this once after uploading documents, or whenever new files are added.
 *   — It is idempotent: re-running re-embeds files already processed.
 */

const { createClient } = require("@supabase/supabase-js");
const { OpenAIEmbeddings } = require("@langchain/openai");
const prisma = require("../lib/prisma");
const pdfParse = require("pdf-parse");
const XLSX = require("xlsx");

// ---------------------------------------------------------------------------
// Supabase client (same project as the rest of the app)
// ---------------------------------------------------------------------------
function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );
}

// ---------------------------------------------------------------------------
// Text extraction helpers
// ---------------------------------------------------------------------------

/**
 * Download a file from Supabase Storage and return its raw Buffer.
 * file_source is stored as "file_storage/filename.ext" (the fullPath from upload).
 */
async function downloadFile(supabase, fileSource) {
  // file_source example: "file_storage/report.pdf"
  // We need just the path inside the bucket: "report.pdf"
  const pathInBucket = fileSource.split("/").slice(1).join("/");
  const { data, error } = await supabase.storage
    .from("file_storage")
    .download(pathInBucket);

  if (error) throw new Error(`Storage download failed for "${pathInBucket}": ${error.message}`);
  // data is a Blob in Node; convert to Buffer
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Extract plain text from a buffer based on file extension.
 * Supports: PDF, TXT, MD, CSV, JSON. Others return empty string.
 */
// Strip characters that Supabase/Postgres can't store as valid JSON text
function sanitizeText(text) {
  return text
    .replace(/\u0000/g, "") // null bytes
    .replace(/[\uD800-\uDFFF]/g, "") // lone surrogates (invalid Unicode)
    .replace(/\uFFFD/g, ""); // replacement character from bad decoding
}

async function extractText(buffer, fileName) {
  const ext = fileName.split(".").pop().toLowerCase();
  switch (ext) {
    case "pdf": {
      const result = await pdfParse(buffer);
      return sanitizeText(result.text || "");
    }
    case "xlsx":
    case "xls": {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      // Concatenate all sheets: each sheet becomes a CSV-like block of text
      return workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        const csv = XLSX.utils.sheet_to_csv(sheet, { skipHidden: true });
        return `[Sheet: ${name}]\n${csv}`;
      }).join("\n\n");
    }
    case "txt":
    case "md":
    case "csv":
    case "json":
      return sanitizeText(buffer.toString("utf-8"));
    default:
      return ""; // binary / unsupported format — skip
  }
}

// ---------------------------------------------------------------------------
// Text chunker (simple sliding window, no extra deps needed)
// ---------------------------------------------------------------------------
const CHUNK_SIZE = 1000;   // characters per chunk
const CHUNK_OVERLAP = 150; // overlap between consecutive chunks

function chunkText(text, fileName) {
  const chunks = [];
  let start = 0;
  let index = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push({
      content: text.slice(start, end),
      chunkIndex: index++,
    });
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Embed a batch of strings with OpenAI (handles rate limits via batching)
// ---------------------------------------------------------------------------
async function embedBatch(texts) {
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "text-embedding-ada-002",
  });
  return embeddings.embedDocuments(texts);
}

// ---------------------------------------------------------------------------
// Upsert a batch of chunks into document_embeddings
// ---------------------------------------------------------------------------
async function upsertChunks(supabase, chunks) {
  const { error } = await supabase.from("document_embeddings").insert(chunks);
  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Main ingestion handler
// ---------------------------------------------------------------------------
exports.ingest = async (req, res) => {
  try {
    const supabase = getSupabase();

    // 1. Fetch all files from the File table
    const files = await prisma.file.findMany();

    if (files.length === 0) {
      return res.status(200).json({ message: "No files found in the database to ingest.", ingested: 0 });
    }

    let totalChunks = 0;
    const errors = [];

    for (const file of files) {
      try {
        // 2. Download from Supabase Storage
        const buffer = await downloadFile(supabase, file.file_source);

        // 3. Extract text
        const rawText = await extractText(buffer, file.file_name);
        if (!rawText.trim()) {
          console.log(`[ingest] Skipping "${file.file_name}" — no extractable text.`);
          continue;
        }

        // 4. Chunk
        const chunks = chunkText(rawText, file.file_name);
        if (chunks.length === 0) continue;

        // 5. Embed all chunks in one batch call
        const vectors = await embedBatch(chunks.map((c) => c.content));

        // 6. Prepare rows for document_embeddings
        const rows = chunks.map((chunk, i) => ({
          content: chunk.content,
          metadata: {
            file_id: file.file_id,
            file_name: file.file_name,
            folder_id: file.folder_id ? Number(file.folder_id) : null,
            chunk_index: chunk.chunkIndex,
          },
          embedding: vectors[i],
        }));

        // 7. Upsert into Supabase (delete old chunks for this file first to avoid duplicates)
        await supabase
          .from("document_embeddings")
          .delete()
          .eq("metadata->>file_id", file.file_id);

        await upsertChunks(supabase, rows);

        totalChunks += rows.length;
        console.log(`[ingest] ✓ "${file.file_name}" — ${rows.length} chunks ingested.`);
      } catch (fileErr) {
        console.error(`[ingest] ✗ "${file.file_name}":`, fileErr.message);
        errors.push({ file: file.file_name, error: fileErr.message });
      }
    }

    return res.status(200).json({
      message: `Ingestion complete. ${totalChunks} chunks stored across ${files.length - errors.length} files.`,
      totalFiles: files.length,
      successFiles: files.length - errors.length,
      totalChunks,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("[ingest] Fatal error:", err.message);
    return res.status(500).json({ error: "Ingestion failed: " + err.message });
  }
};
