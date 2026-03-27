/**
 * Local Ingestion Script
 *
 * Reads files from the uploads/ folder, registers them in the File table,
 * embeds text with OpenAI, and stores chunks in document_embeddings (pgvector).
 *
 * Handles:
 *  - Real binary files (PDF, XLSX, DOCX, TXT, etc.)
 *  - JSON-wrapped multer file objects (buffer stored as { type:"Buffer", data:[...] })
 *
 * Usage:
 *   node scripts/ingest-local.js
 *
 * Safe to re-run — existing chunks per file are deleted before re-inserting.
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { getSupabase } = require("../lib/supabase");
const { OpenAIEmbeddings } = require("@langchain/openai");
const prisma = require("../lib/prisma");
const pdfParse = require("pdf-parse");
const XLSX = require("xlsx");
const mammoth = require("mammoth");
const { createWorker } = require("tesseract.js");
// Polyfill DOMMatrix and Path2D before loading pdfjs-dist so it can render pages correctly
const { createCanvas, DOMMatrix, Path2D } = require("@napi-rs/canvas");
globalThis.DOMMatrix = DOMMatrix;
globalThis.Path2D = Path2D;
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
const UPLOADS_DIR = path.join(__dirname, "../uploads");
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;

// ---------------------------------------------------------------------------
// OCR helpers — used when pdf-parse finds no selectable text (image-based PDF)
// ---------------------------------------------------------------------------

// pdfjs-dist requires a canvas factory to render pages server-side.
// We provide one backed by @napi-rs/canvas (prebuilt binaries, no native compile).
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

/**
 * OCR an image buffer (PNG/JPG/TIFF) via Tesseract.
 */
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

/**
 * Render every page of an image-based PDF to PNG and OCR each page.
 * Scale = 2.0 gives ~144 dpi which is enough for reliable OCR.
 */
async function ocrPdf(pdfBuffer) {
  const canvasFactory = new NodeCanvasFactory();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    // Suppress pdfjs console warnings about missing CMap / standard fonts
    verbosity: 0,
  });
  const pdfDoc = await loadingTask.promise;
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

    const pngBuffer = canvasAndContext.canvas.toBuffer("image/png");
    const text = await ocrImageBuffer(pngBuffer);
    if (text.trim()) pageTexts.push(`[Page ${pageNum}]\n${text}`);
    page.cleanup();
  }

  return pageTexts.join("\n\n");
}

// Supabase client is now centralized in lib/supabase.js

function sanitizeText(text) {
  return text
    .replace(/\u0000/g, "") // eslint-disable-line no-control-regex -- intentional null byte strip
    .replace(/[\uD800-\uDFFF]/g, "")
    .replace(/\uFFFD/g, "");
}

// ---------------------------------------------------------------------------
// Some files in uploads/ are JSON-serialised multer file objects.
// Detect them and unwrap to get the real buffer and real filename.
// ---------------------------------------------------------------------------
function resolveFile(diskName) {
  const filePath = path.join(UPLOADS_DIR, diskName);
  const raw = fs.readFileSync(filePath);

  // JSON-wrapped multer object starts with '{'
  if (raw[0] === 0x7b) {
    try {
      const parsed = JSON.parse(raw.toString("utf8"));
      if (
        parsed.buffer &&
        parsed.buffer.type === "Buffer" &&
        Array.isArray(parsed.buffer.data)
      ) {
        return {
          buffer: Buffer.from(parsed.buffer.data),
          realName: parsed.originalname || diskName,
        };
      }
    } catch {
      // fall through — treat as binary
    }
  }

  return { buffer: raw, realName: diskName };
}

async function extractText(buffer, fileName) {
  const ext = fileName.split(".").pop().toLowerCase();
  switch (ext) {
    case "pdf": {
      const result = await pdfParse(buffer);
      const text = sanitizeText(result.text || "");
      // If pdf-parse found meaningful text, use it.
      // Otherwise the PDF is image-based — fall back to OCR.
      if (text.trim().length > 50) return text;
      console.log(`  [ocr] No selectable text found — running OCR...`);
      return await ocrPdf(buffer);
    }
    case "png":
    case "jpg":
    case "jpeg":
    case "tiff":
    case "bmp":
    case "gif":
      return await ocrImageBuffer(buffer);
    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
      return sanitizeText(result.value || "");
    }
    case "xlsx":
    case "xls": {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      return workbook.SheetNames.map((name) => {
        const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name], {
          skipHidden: true,
        });
        return `[Sheet: ${name}]\n${csv}`;
      }).join("\n\n");
    }
    case "txt":
    case "md":
    case "csv":
    case "json":
      return sanitizeText(buffer.toString("utf-8"));
    default:
      return "";
  }
}

function chunkText(text) {
  const chunks = [];
  let start = 0;
  let index = 0;
  while (start < text.length) {
    chunks.push({
      content: text.slice(start, Math.min(start + CHUNK_SIZE, text.length)),
      chunkIndex: index++,
    });
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

// Use raw SQL to insert/find File records, bypassing the Prisma schema/DB column mismatch.
async function upsertFileRecord(realName, fileSize) {
  const existing = await prisma.$queryRaw`
    SELECT file_id FROM "File" WHERE file_name = ${realName} LIMIT 1
  `;
  if (existing.length > 0) {
    return existing[0].file_id;
  }

  const inserted = await prisma.$queryRaw`
    INSERT INTO "File" (file_name, file_size, file_source)
    VALUES (${realName}, ${fileSize}, ${"local/" + realName})
    RETURNING file_id
  `;
  return inserted[0].file_id;
}

async function main() {
  const supabase = getSupabase();
  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small",
  });

  const diskFiles = fs
    .readdirSync(UPLOADS_DIR)
    .filter((f) => !f.startsWith("."));
  if (diskFiles.length === 0) {
    console.log("No files found in uploads/");
    return;
  }

  console.log(
    `Found ${diskFiles.length} file(s) in uploads/:\n  ${diskFiles.join("\n  ")}\n`,
  );

  let totalChunks = 0;
  const errors = [];

  for (const diskName of diskFiles) {
    let realName, buffer;
    try {
      ({ buffer, realName } = resolveFile(diskName));
    } catch (err) {
      console.error(`[err]  "${diskName}": could not read — ${err.message}`);
      errors.push({ file: diskName, error: err.message });
      continue;
    }

    console.log(
      `\nProcessing: "${realName}" (${(buffer.length / 1024).toFixed(1)} KB)`,
    );

    try {
      // 1. Extract text
      const rawText = await extractText(buffer, realName);
      if (!rawText.trim()) {
        console.log(`[skip] No extractable text (unsupported format)`);
        continue;
      }
      console.log(`[text] ${rawText.length} characters extracted`);

      // 2. Register in File table (idempotent)
      const fileId = await upsertFileRecord(realName, buffer.length);
      console.log(`[db]   file_id: ${fileId}`);

      // 3. Chunk
      const chunks = chunkText(rawText);
      console.log(`[chunk] ${chunks.length} chunks`);

      // 4. Embed all chunks in one batch
      const vectors = await embeddings.embedDocuments(
        chunks.map((c) => c.content),
      );
      console.log(`[embed] ${vectors.length} vectors`);

      // 5. Build rows.
      // org_id / ctg_id are null here because local uploads are not yet
      // associated with a specific organisation or category. Set them after updating
      // the File record (e.g. via the admin UI or SQL).
      const rows = chunks.map((chunk, i) => ({
        content: chunk.content,
        metadata: {
          file_id: fileId,
          file_name: realName,
          org_id: null, // assign after migrating File table
          ctg_id: null, // assign after migrating File table (FK → Category)
          chunk_index: chunk.chunkIndex,
        },
        org_id: null, // assign after associating File with an organisation
        embedding: vectors[i],
      }));

      // 6. Delete old chunks for this file
      await supabase
        .from("document_embeddings")
        .delete()
        .eq("metadata->>file_id", fileId);

      // 7. Insert new chunks
      const { error } = await supabase.from("document_embeddings").insert(rows);
      if (error) throw new Error(`Supabase insert: ${error.message}`);

      totalChunks += rows.length;
      console.log(`[ok]   ${rows.length} chunks stored`);
    } catch (err) {
      console.error(`[err]  "${realName}": ${err.message}`);
      errors.push({ file: realName, error: err.message });
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Ingestion complete`);
  console.log(
    `Files processed : ${diskFiles.length - errors.length} / ${diskFiles.length}`,
  );
  console.log(`Total chunks    : ${totalChunks}`);
  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`);
    errors.forEach((e) => console.log(`  - ${e.file}: ${e.error}`));
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
