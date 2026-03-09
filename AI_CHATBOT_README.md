# AI Chatbot — Technical Documentation

## Overview

The Maural KMS AI Chatbot is a multi-agent RAG (Retrieval-Augmented Generation) pipeline built on top of **Ollama (local LLM)** and Supabase pgvector. It answers questions about uploaded documents with high accuracy, streaming responses to the frontend in real time.

All AI inference runs **100% locally** — no data is sent to any third-party AI service. Models are served by Ollama running on `http://localhost:11434`.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Node.js (Express 5) | API server |
| LLM | Ollama `qwen3.5:9b` | Specialized agent responses, intent routing, combining, guardrails |
| Embeddings | Ollama `nomic-embed-text` | Converts text to 768-dimensional vectors |
| Vector Database | Supabase pgvector (PostgreSQL) | Stores and searches document embeddings |
| ORM | Prisma | File metadata queries (File table) |
| LLM SDK | LangChain (`@langchain/ollama`) | ChatOllama and OllamaEmbeddings wrappers |
| File Storage | Supabase Storage (`file_storage` bucket) | Stores the original uploaded files |
| PDF Parsing | `pdf-parse` v1 | Extracts text from PDF files |
| Excel Parsing | `xlsx` (SheetJS) | Extracts text from `.xlsx` / `.xls` files |
| Word Parsing | `mammoth` | Extracts text from `.docx` files |
| Streaming | SSE (Server-Sent Events) | Streams answer chunks to the frontend |

---

## Prerequisites

### 1. Install Ollama

Download and install Ollama from [https://ollama.com](https://ollama.com), then pull the required models:

```bash
ollama pull qwen3.5:9b
ollama pull nomic-embed-text
```

Verify Ollama is running:

```bash
curl http://localhost:11434/api/tags
```

### 2. Install Node dependencies

```bash
npm install @langchain/ollama @langchain/core langchain @supabase/supabase-js pdf-parse@1 xlsx mammoth
```

### Full dependency list (relevant to AI chatbot)

```json
"@langchain/core": "^0.3.x",
"@langchain/ollama": "^0.2.x",
"langchain": "^0.3.x",
"@supabase/supabase-js": "^2.76.0",
"@prisma/client": "^6.x",
"pdf-parse": "^1.1.4",
"xlsx": "^0.18.5",
"mammoth": "^1.11.0"
```

> **Note:** Use `pdf-parse@1` specifically. Version 2.x changed to a class-based API incompatible with the current integration.

### Required environment variables

```env
# Ollama (local model — no data leaves the machine)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=qwen3.5:9b
OLLAMA_EMBED_MODEL=nomic-embed-text

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
```

---

## Supabase Database Setup

The `document_embeddings` table must use `vector(768)` dimensions to match `nomic-embed-text` output.

Run the following in your Supabase SQL Editor:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create embeddings table
CREATE TABLE IF NOT EXISTS document_embeddings (
  id        bigserial PRIMARY KEY,
  content   text,
  metadata  jsonb,
  embedding vector(768)
);

-- Create similarity search function
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),
  match_count     int DEFAULT 15,
  filter          jsonb DEFAULT '{}'
)
RETURNS TABLE (
  id         bigint,
  content    text,
  metadata   jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_embeddings.id,
    document_embeddings.content,
    document_embeddings.metadata,
    1 - (document_embeddings.embedding <=> query_embedding) AS similarity
  FROM document_embeddings
  ORDER BY document_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant access to service role
GRANT ALL ON TABLE document_embeddings TO service_role;
GRANT ALL ON SEQUENCE document_embeddings_id_seq TO service_role;
ALTER TABLE document_embeddings DISABLE ROW LEVEL SECURITY;
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat/stream` | SSE streaming chat (primary) |
| `POST` | `/api/chat` | JSON chat (fallback) |
| `POST` | `/api/chat/ingest` | Ingest all documents from Supabase Storage |

---

## Document Ingestion Pipeline

Before the chatbot can answer questions, documents must be ingested. Call `POST /api/chat/ingest` after uploading files to Supabase Storage. For local development, use the ingestion script:

```bash
node scripts/ingest-local.js
```

Place files in the `uploads/` folder before running the script.

```
Upload file to Supabase Storage (or place in uploads/)
         ↓
  Register in File table (Prisma)
         ↓
  POST /api/chat/ingest  (or run ingest-local.js)
         ↓
  Download/read file buffer
         ↓
  Extract text (PDF / XLSX / DOCX / TXT / CSV / JSON)
         ↓
  Sanitize text (strip null bytes, lone surrogates)
         ↓
  Chunk text (1000 chars, 150-char overlap)
         ↓
  Embed chunks with nomic-embed-text (via Ollama, local)
         ↓
  Delete old chunks for this file (idempotent)
         ↓
  Insert new rows into document_embeddings table
```

### Supported file types

| Extension | Parser |
|---|---|
| `.pdf` | `pdf-parse` |
| `.xlsx`, `.xls` | SheetJS (`xlsx`) — each sheet converted to CSV text |
| `.docx` | `mammoth` — extracts raw text from Word documents |
| `.txt`, `.md`, `.csv`, `.json` | Raw UTF-8 buffer |
| Other | Skipped (no extractable text) |

---

## Chunking

**Strategy:** Sliding window with overlap

| Parameter | Value |
|---|---|
| Chunk size | **1000 characters** |
| Overlap | **150 characters** |
| Method | Simple character-based sliding window |

Each chunk stores:
- `content` — the raw text slice
- `metadata.file_id` — UUID of the source file
- `metadata.file_name` — original filename
- `metadata.client_id` — client association (nullable)
- `metadata.ctg_id` — category association, FK → Category table (nullable)
- `metadata.chunk_index` — position of chunk within the document

**Why overlap?** The 150-character overlap ensures that sentences or ideas that span a chunk boundary are captured in at least one chunk, preventing context loss at cut points.

---

## Embedding

**Model:** `nomic-embed-text` (Ollama, local)
**Dimensions:** 768
**Provider:** Ollama via LangChain `OllamaEmbeddings`

Each chunk's text is converted to a 768-dimensional float vector and stored in the `embedding` column of the `document_embeddings` table in Supabase (pgvector).

The same model is used at query time to embed the user's question, producing a comparable vector for similarity search. Since Ollama runs locally, no data leaves the machine during embedding.

---

## Top-K Retrieval

**Default:** `topK = 15`

When a user sends a message, the query is embedded and compared against all stored chunk vectors using cosine similarity via Supabase's `match_documents` RPC function. The **15 most similar chunks** are returned.

### Document coverage guarantee

After the top-K search, the system checks which files have **no chunks** in the results. For any missing file, it fetches at least 1 chunk directly from `document_embeddings` regardless of similarity score. This ensures the model always has content from every document in the knowledge base, even for queries that are semantically unrelated to a particular file.

Additionally, a **document index** (list of all file names from the File table) is prepended to the context on every request, so the model always knows what documents exist.

---

## Similarity — Cosine Distance

**Metric:** Cosine similarity
**Range:** 0.0 (unrelated) → 1.0 (identical)

Cosine similarity measures the angle between two vectors in 768-dimensional space. It is direction-sensitive (meaning matters) rather than magnitude-sensitive (length of text doesn't skew results).

```
similarity = (A · B) / (|A| × |B|)
```

Supabase pgvector uses the `<=>` operator for cosine distance. The `match_documents` function converts this to similarity (`1 - distance`) and returns results ordered from most to least relevant.

---

## Memory (Conversation History)

**Type:** Short-term, client-side
**Window:** Last **10 conversation turns**

The frontend sends the full conversation history with each request in the `history` array. The backend trims this to the most recent 10 turns and injects them into the LLM messages array between the system prompt and the current user message.

```
[System Prompt + Retrieved Docs]
[User turn 1]
[Assistant turn 1]
...
[User turn N (last 10)]
[Current user message]
```

There is no server-side session storage — memory lives entirely in the frontend and is passed per request. This keeps the backend stateless and horizontally scalable.

---

## Multi-Agent Architecture

Each request passes through a 5-step pipeline:

```
User Message
     │
     ├────────────────────────────┐
     ▓                            ▓
[Intent Router]          [Document Retrieval]
qwen3.5:9b, temp=0       pgvector top-15 chunks
→ ["summarize","predict"] → relevant document text
     │                            │
     └──────────┬─────────────────┘
                ▓
     [Parallel Specialized Agents]
      One qwen3.5:9b agent per detected intent
      ┌──────────┬──────────┬──────────┬──────────┬──────────┐
      summarize  analyze    predict    explain    qa
      └──────────┴──────────┴──────────┴──────────┴──────────┘
                ▓
     [Response Combiner]  ← only if more than 1 intent
      qwen3.5:9b: merges sections into one coherent answer
                ▓
     [Guardrail Agent]
      qwen3.5:9b, temp=0, JSON output
      • Checks every claim against source documents
      • Labels unlabeled general knowledge
      • Revises hallucinated claims
      • Returns: { validatedAnswer, confidence, issues[] }
                ▓
     Stream answer → SSE chunks → sources → guardrail metadata → [DONE]
```

### LLM calls per request

| Scenario | Total LLM calls | Model used |
|---|---|---|
| Single intent (e.g. `qa`) | 3 | 3× qwen3.5:9b |
| Two intents (e.g. `summarize + predict`) | 4 | 4× qwen3.5:9b |
| Three intents | 5 | 5× qwen3.5:9b |

All calls go to the local Ollama server — zero external API calls.

---

## Intent Types

| Intent | Trigger | Agent behaviour |
|---|---|---|
| `summarize` | "summarize", "overview", "condense" | Bullet points, executive summary, key takeaway |
| `analyze` | "analyze", "trends", "compare", "insights" | Step-by-step reasoning, quantified observations |
| `predict` | "predict", "forecast", "expect", "next quarter" | Confidence labels (High / Medium / Low), no invented numbers |
| `explain` | "explain", "what is", "how does", "clarify" | Plain language, analogies, step-by-step |
| `qa` | Default — direct factual question | Direct answer grounded in documents |

---

## Guardrail

The guardrail runs on every response before it reaches the user.

| Condition | Action |
|---|---|
| Claim not in documents, not labeled | Revised — claim removed or labeled `(General knowledge)` |
| Prediction without confidence label | Revised — confidence label added |
| All claims grounded | Original answer returned unchanged |
| Confidence score < 60 | Transparency note prepended to answer |
| Guardrail LLM fails | Original answer returned (never blocks) |

---

## Privacy Guarantee

Since all AI inference runs locally via Ollama:

- No user queries leave the machine
- No document content is sent to OpenAI or any cloud AI provider
- The only external service used is Supabase (for storing document metadata and vectors in your own project)
- Ollama models (`qwen3.5:9b`, `nomic-embed-text`) run entirely on local hardware

---

## File Structure (AI Chatbot related files)

```
maural-kms-api/
├── controllers/
│   ├── chat.controller.js       # Orchestration — streaming + JSON endpoints
│   └── ingest.controller.js     # Document ingestion pipeline (Supabase Storage)
├── services/
│   ├── ragService.js            # Document retrieval + prompt construction
│   ├── intentRouter.js          # Multi-intent detection (qwen3.5:9b, local)
│   ├── promptTemplates.js       # Per-intent system prompts
│   └── guardrail.js             # Answer accuracy verification (qwen3.5:9b, local)
├── routes/
│   └── chatRoutes.js            # /stream, /, /ingest routes
├── scripts/
│   └── ingest-local.js          # Local ingestion script (reads from uploads/ folder)
├── lib/
│   └── prisma.js                # Prisma singleton
└── uploads/                     # Temporary Multer upload directory (gitignored)
```
