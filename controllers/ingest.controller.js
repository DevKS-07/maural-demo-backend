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
const { OllamaEmbeddings } = require("@langchain/ollama");
const prisma = require("../lib/prisma");
const pdfParse = require("pdf-parse");
const XLSX = require("xlsx");
const mammoth = require("mammoth");
const { createWorker } = require("tesseract.js");
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_ANON_KEY,
  OLLAMA_BASE_URL,
  OLLAMA_EMBED_MODEL,
} = require("../config/env");
// Polyfill DOMMatrix and Path2D before loading pdfjs-dist so it can render pages correctly
const { createCanvas, DOMMatrix, Path2D } = require("@napi-rs/canvas");
globalThis.DOMMatrix = DOMMatrix;
globalThis.Path2D = Path2D;
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

// ---------------------------------------------------------------------------
// Supabase client (same project as the rest of the app)
// ---------------------------------------------------------------------------
function getSupabase() {
  return createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
  );
}

// ---------------------------------------------------------------------------
// OCR helpers — used when pdf-parse finds no selectable text (image-based PDF)
// ---------------------------------------------------------------------------

class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext("2d") };
  }
  reset({ canvas }, width, height) {
    canvas.width = width;
    canvas.height = height;
  }
  destroy(canvasAndContext) {
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

async function ocrImageBuffer(imageBuffer) {
  const worker = await createWorker("eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(imageBuffer);
    return sanitizeText(text || "");
  } finally {
    await worker.terminate();
  }
}

async function ocrPdf(pdfBuffer) {
  const canvasFactory = new NodeCanvasFactory();
  const pdfDoc = await pdfjsLib
    .getDocument({ data: new Uint8Array(pdfBuffer), verbosity: 0 })
    .promise;
  const pageTexts = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvasAndContext = canvasFactory.create(
      viewport.width,
      viewport.height,
    );
    await page.render({
      canvasContext: canvasAndContext.context,
      viewport,
      canvasFactory,
    }).promise;
    const text = await ocrImageBuffer(
      canvasAndContext.canvas.toBuffer("image/png"),
    );
    if (text.trim()) pageTexts.push(`[Page ${pageNum}]\n${text}`);
    page.cleanup();
  }

  return pageTexts.join("\n\n");
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

  if (error)
    throw new Error(
      `Storage download failed for "${pathInBucket}": ${error.message}`,
    );
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
    .replace(/\u0000/g, "") // eslint-disable-line no-control-regex -- intentional null byte strip
    .replace(/[\uD800-\uDFFF]/g, "") // lone surrogates (invalid Unicode)
    .replace(/\uFFFD/g, ""); // replacement character from bad decoding
}

async function extractText(buffer, fileName) {
  const ext = fileName.split(".").pop().toLowerCase();
  switch (ext) {
    case "pdf": {
      const result = await pdfParse(buffer);
      const text = sanitizeText(result.text || "");
      if (text.trim().length > 50) return text;
      console.log(`[ingest] No selectable text in "${fileName}" — running OCR...`);
      return await ocrPdf(buffer);
    }
    case "png":
    case "jpg":
    case "jpeg":
    case "tiff":
    case "bmp":
    case "gif":
      return await ocrImageBuffer(buffer);
    case "xlsx":
    case "xls": {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      return workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        const csv = XLSX.utils.sheet_to_csv(sheet, { skipHidden: true });
        return `[Sheet: ${name}]\n${csv}`;
      }).join("\n\n");
    }
    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
      return sanitizeText(result.value || "");
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
const CHUNK_SIZE = 1000; // characters per chunk
const CHUNK_OVERLAP = 150; // overlap between consecutive chunks

function chunkText(text, _fileName) {
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
  const embeddings = new OllamaEmbeddings({
    baseUrl: OLLAMA_BASE_URL,
    model: OLLAMA_EMBED_MODEL,
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
// Ingest a single file — reusable by the upload route for auto-ingestion
// ---------------------------------------------------------------------------
async function ingestSingleFile(file) {
  const supabase = getSupabase();

  const buffer = await downloadFile(supabase, file.file_source);

  const rawText = await extractText(buffer, file.file_name);
  if (!rawText.trim()) {
    console.log(`[ingest] Skipping "${file.file_name}" — no extractable text.`);
    return { skipped: true };
  }

  const chunks = chunkText(rawText, file.file_name);
  if (chunks.length === 0) return { skipped: true };

  const vectors = await embedBatch(chunks.map((c) => c.content));

  const rows = chunks.map((chunk, i) => ({
    content: chunk.content,
    metadata: {
      file_id: String(file.file_id),
      file_name: file.file_name,
      org_id: file.org_id || null,
      ctg_id: file.ctg_id ? Number(file.ctg_id) : null,
      chunk_index: chunk.chunkIndex,
    },
    embedding: vectors[i],
  }));

  await supabase
    .from("document_embeddings")
    .delete()
    .eq("metadata->>file_id", String(file.file_id));

  await upsertChunks(supabase, rows);

  console.log(
    `[ingest] ✓ "${file.file_name}" — ${rows.length} chunks ingested.`,
  );
  return { chunks: rows.length };
}

exports.ingestSingleFile = ingestSingleFile;

// ---------------------------------------------------------------------------
// Main ingestion handler (bulk — all files)
// ---------------------------------------------------------------------------
exports.ingest = async (req, res) => {
  try {
    const supabase = getSupabase();

    // 1. Fetch all files from the File table.
    // Raw SQL with explicit columns avoids SELECT * failures caused by any
    // Prisma-schema / live-DB column mismatches during schema evolution.
    const files = await prisma.$queryRaw`
      SELECT file_id::text AS file_id,
             file_name,
             file_source,
             org_id,
             ctg_id
      FROM   "File"
    `;

    if (files.length === 0) {
      return res.status(200).json({
        message: "No files found in the database to ingest.",
        ingested: 0,
      });
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
          console.log(
            `[ingest] Skipping "${file.file_name}" — no extractable text.`,
          );
          continue;
        }

        // 4. Chunk
        const chunks = chunkText(rawText, file.file_name);
        if (chunks.length === 0) continue;

        // 5. Embed all chunks in one batch call
        const vectors = await embedBatch(chunks.map((c) => c.content));

        // 6. Prepare rows for document_embeddings.
        // org_id enables the RAG service to scope retrieval to a specific organisation.
        // ctg_id enables filtering by document category (FK → Category table).
        const rows = chunks.map((chunk, i) => ({
          content: chunk.content,
          metadata: {
            file_id: file.file_id,
            file_name: file.file_name,
            org_id: file.org_id || null,
            ctg_id: file.ctg_id ? Number(file.ctg_id) : null,
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
        console.log(
          `[ingest] ✓ "${file.file_name}" — ${rows.length} chunks ingested.`,
        );
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
