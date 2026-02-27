# AI Chatbot — Technical Documentation

## Overview

The Maural KMS AI Chatbot is a multi-agent RAG (Retrieval-Augmented Generation) pipeline built on top of OpenAI and Supabase pgvector. It answers questions about uploaded documents with high accuracy, streaming responses to the frontend in real time.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Node.js (Express 5) | API server |
| LLM | OpenAI `gpt-4o` | Specialized agent responses |
| LLM (light tasks) | OpenAI `gpt-4o-mini` | Intent routing, combining, guardrails |
| Embeddings | OpenAI `text-embedding-ada-002` | Converts text to 1536-dimensional vectors |
| Vector Database | Supabase pgvector (PostgreSQL) | Stores and searches document embeddings |
| ORM | Prisma | File metadata queries (File table) |
| LLM SDK | LangChain (`@langchain/openai`) | ChatOpenAI and OpenAIEmbeddings wrappers |
| File Storage | Supabase Storage (`file_storage` bucket) | Stores the original uploaded files |
| PDF Parsing | `pdf-parse` v1 | Extracts text from PDF files |
| Excel Parsing | `xlsx` (SheetJS) | Extracts text from `.xlsx` / `.xls` files |
| Streaming | SSE (Server-Sent Events) | Streams answer chunks to the frontend |

---

## Dependencies to Install

Run the following command to install all AI chatbot dependencies:

```bash
npm install @langchain/openai @langchain/core langchain @supabase/supabase-js pdf-parse@1 xlsx
```

### Full dependency list (relevant to AI chatbot)

```json
"@langchain/core": "^1.1.27",
"@langchain/openai": "^1.2.9",
"langchain": "^1.2.25",
"@supabase/supabase-js": "^2.76.0",
"@prisma/client": "^6.18.0",
"pdf-parse": "^1.1.4",
"xlsx": "^0.18.5"
```

> **Note:** Use `pdf-parse@1` specifically. Version 2.x changed to a class-based API incompatible with the current integration.

### Required environment variables

```env
OPENAI_API_KEY=sk-proj-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat/stream` | SSE streaming chat (primary) |
| `POST` | `/api/chat` | JSON chat (fallback) |
| `POST` | `/api/chat/ingest` | Ingest all documents from Supabase Storage |
| `GET` | `/api/clients` | List all clients |

---

## Document Ingestion Pipeline

Before the chatbot can answer questions, documents must be ingested. Call `POST /api/chat/ingest` after uploading files to Supabase Storage.

```
Upload file to Supabase Storage
         ↓
  Register in File table (Prisma)
         ↓
  POST /api/chat/ingest
         ↓
  Download file from Supabase Storage
         ↓
  Extract text (PDF / XLSX / TXT / CSV / JSON)
         ↓
  Sanitize text (strip null bytes, lone surrogates)
         ↓
  Chunk text (1000 chars, 150-char overlap)
         ↓
  Embed chunks with text-embedding-ada-002
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
- `metadata.folder_id` — folder association (nullable)
- `metadata.chunk_index` — position of chunk within the document

**Why overlap?** The 150-character overlap ensures that sentences or ideas that span a chunk boundary are captured in at least one chunk, preventing context loss at cut points.

---

## Embedding

**Model:** `text-embedding-ada-002` (OpenAI)
**Dimensions:** 1536
**Provider:** OpenAI via LangChain `OpenAIEmbeddings`

Each chunk's text is converted to a 1536-dimensional float vector and stored in the `embedding` column of the `document_embeddings` table in Supabase (pgvector).

The same model is used at query time to embed the user's question, producing a comparable vector for similarity search.

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

Cosine similarity measures the angle between two vectors in 1536-dimensional space. It is direction-sensitive (meaning matters) rather than magnitude-sensitive (length of text doesn't skew results).

```
similarity = (A · B) / (|A| × |B|)
```

Supabase pgvector uses the `<=>` operator for cosine distance. The `match_documents` function converts this to similarity (`1 - distance`) and returns results ordered from most to least relevant.

Chunks with similarity above the threshold set in the `match_documents` function (typically `0.0` — no minimum, all top-K returned) are passed to the LLM as context.

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
gpt-4o-mini, temp=0      pgvector top-15 chunks
→ ["summarize","predict"] → relevant document text
     │                            │
     └──────────┬─────────────────┘
                ▓
     [Parallel Specialized Agents]
      One gpt-4o agent per detected intent
      ┌──────────┬──────────┬──────────┬──────────┬──────────┐
      summarize  analyze    predict    explain    qa
      └──────────┴──────────┴──────────┴──────────┴──────────┘
                ▓
     [Response Combiner]  ← only if more than 1 intent
      gpt-4o-mini: merges sections into one coherent answer
                ▓
     [Guardrail Agent]
      gpt-4o-mini, temp=0, JSON output
      • Checks every claim against source documents
      • Labels unlabeled general knowledge
      • Revises hallucinated claims
      • Returns: { validatedAnswer, confidence, issues[] }
                ▓
     Stream answer → SSE chunks → sources → guardrail metadata → [DONE]
```

### LLM calls per request

| Scenario | Total LLM calls | Models used |
|---|---|---|
| Single intent (e.g. `qa`) | 3 | mini + gpt-4o + mini |
| Two intents (e.g. `summarize + predict`) | 4 | mini + 2× gpt-4o + mini |
| Three intents | 5 | mini + 3× gpt-4o + mini |

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

## File Structure (AI Chatbot related files)

```
maural-kms-api/
├── controllers/
│   ├── chat.controller.js       # Orchestration — streaming + JSON endpoints
│   └── ingest.controller.js     # Document ingestion pipeline
├── services/
│   ├── ragService.js            # Document retrieval + prompt construction
│   ├── intentRouter.js          # Multi-intent detection (gpt-4o-mini)
│   ├── promptTemplates.js       # Per-intent system prompts
│   └── guardrail.js             # Answer accuracy verification
├── routes/
│   └── chatRoutes.js            # /stream, /, /ingest routes
├── lib/
│   └── prisma.js                # Prisma singleton
└── uploads/                     # Temporary Multer upload directory (gitignored)
```
