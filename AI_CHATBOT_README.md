# AI Chatbot — Technical Documentation

## Overview

The Maural KMS AI Chatbot is a multi-agent **hybrid RAG** (Retrieval-Augmented Generation) pipeline built on top of **Ollama (local LLM)** and PostgreSQL pgvector. It combines **vector similarity search**, **keyword (full-text) search**, and **LLM-based query rewriting** to retrieve the most relevant document chunks. It answers questions about uploaded documents, business KPIs, and strategic VTO data with high accuracy, streaming responses to the frontend in real time.

All AI inference runs **100% locally** — no data is sent to any third-party AI service. Models are served by Ollama running on `http://localhost:11434`.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Node.js (Express 5) | API server |
| LLM | Ollama `qwen3.5:9b` | Specialized agent responses, intent routing, combining, guardrails |
| Embeddings | Ollama `nomic-embed-text` | Converts text to 768-dimensional vectors |
| Vector Database | PostgreSQL pgvector (Supabase) | Stores and searches document embeddings |
| Direct DB Driver | `pg` (node-postgres) Pool | Dedicated connection bypassing pgbouncer for vector queries (IVFFlat probe persistence) |
| ORM | Prisma | File metadata queries (File table) |
| LLM SDK | LangChain (`@langchain/ollama`) | ChatOllama and OllamaEmbeddings wrappers |
| File Storage | Supabase Storage (per-org buckets) | Stores the original uploaded files in organisation-specific buckets |
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
npm install @langchain/ollama @langchain/core langchain @supabase/supabase-js pg pdf-parse@1 xlsx mammoth
```

### Full dependency list (relevant to AI chatbot)

```json
"@langchain/core": "^0.3.x",
"@langchain/ollama": "^0.2.x",
"langchain": "^0.3.x",
"@supabase/supabase-js": "^2.76.0",
"@prisma/client": "^6.x",
"pg": "^8.x",
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

The `document_embeddings` table must use `vector(768)` dimensions to match `nomic-embed-text` output. It includes a real `org_id` column (FK → Organisation) for database-level tenant isolation during vector search.

Run the following in your Supabase SQL Editor:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create embeddings table with org_id for tenant isolation
CREATE TABLE IF NOT EXISTS document_embeddings (
  id        bigserial PRIMARY KEY,
  content   text,
  metadata  jsonb,
  org_id    uuid REFERENCES "Organisation"(org_id) ON DELETE CASCADE,
  embedding vector(768)
);

-- Index on org_id for fast tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_document_embeddings_org_id
  ON document_embeddings (org_id);

-- Tenant-scoped similarity search function
-- filter_org_ids: pass a UUID array to scope results to specific organisations,
--                 or NULL to search across all organisations (admin use).
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),
  match_count     int DEFAULT 15,
  filter_org_ids  uuid[] DEFAULT NULL
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
  WHERE (filter_org_ids IS NULL OR document_embeddings.org_id = ANY(filter_org_ids))
  ORDER BY document_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- IVFFlat index for fast approximate nearest-neighbour search
-- lists = 100 → the retrieval code sets `SET ivfflat.probes = 100` to probe all lists
CREATE INDEX IF NOT EXISTS idx_document_embeddings_embedding
  ON document_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Grant access to service role
GRANT ALL ON TABLE document_embeddings TO service_role;
GRANT ALL ON SEQUENCE document_embeddings_id_seq TO service_role;
ALTER TABLE document_embeddings DISABLE ROW LEVEL SECURITY;
```

> **Note:** The `match_documents` RPC function above is retained for backwards compatibility, but the current retrieval code (`ragService.js`) uses **direct SQL** via a dedicated `pg` Pool connection (bypassing pgbouncer) to ensure `SET ivfflat.probes` persists on the same connection as the vector query.

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
  Insert new rows into document_embeddings table (with org_id for tenant isolation)
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
- `metadata.org_id` — organisation association (nullable)
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

## Hybrid Retrieval

**Default:** `topK = 12` per search method

The retrieval pipeline uses three techniques combined:

### 1. Query Rewriting (LLM)

Short or vague queries (**8 words or fewer**) — such as "tell me more" or "explain that" — are rewritten by the LLM into a dense, self-contained search query before embedding. The rewriter receives the **last 2 conversation turns** for context so it can expand follow-up questions accurately.

- Longer, specific questions skip rewriting entirely to save latency.
- The rewrite runs **in parallel** with the file-list database lookup, so it adds no extra wall-clock time to the critical path.

### 2. Vector Similarity Search

The (potentially rewritten) query is embedded with `nomic-embed-text` and compared against all stored chunk vectors using **cosine similarity** via direct SQL on a dedicated `pg` Pool connection. The **12 most similar chunks** are returned.

The dedicated Pool uses `DIRECT_URL` (bypassing pgbouncer) because:

- `SET ivfflat.probes = 100` must persist on the same connection as the `SELECT`. Pgbouncer routes each statement to a different backend, silently resetting session-level settings.
- 768-dimensional vector literals produce ~19 KB SQL strings that can exceed pgbouncer's default packet limits.

### 3. Keyword (Full-Text) Search

PostgreSQL `tsvector` full-text search matches **exact terms** in chunk content. This catches proper nouns, brand names, and specific figures that may not cluster well in vector space (e.g. "Pemmerations", "JGA", "$5M–$20M").

Keyword results are assigned a fixed similarity score of `0.5` (lower than vector matches) so vector results rank higher when both methods return the same chunk.

### Merge and Deduplication

Results from both searches are merged and deduplicated by content — if the same chunk appears in both result sets, the higher similarity score is kept. The final list is sorted by descending similarity.

### Document Index

A synthetic **document index** entry (list of all file names belonging to the organisation) is prepended to the context on every request. This ensures the model always knows what documents exist, even if no chunks from a particular file scored high enough to appear in the results.

### Organisation-scoped retrieval (tenant isolation)

Tenant isolation is enforced at **two layers**:

**Layer 1 — Middleware (`requireOrgAccess`):** Before any chat logic runs, the `requireOrgAccess("body")` middleware checks the authenticated user's role:

- **`admin` / `super_admin`**: Cross-org access allowed — `orgIds` from the request body is passed through as-is.
- **`org_executive` / `org_staff`**: The middleware looks up the user's `org_id` from the database (via their Clerk `clerk_id`) and **force-overrides** `req.body.orgIds` with that value. Any client-supplied `orgIds` is ignored.

This prevents non-admin users from querying documents or business data belonging to other organisations.

**Layer 2 — Database (`org_id` filter):** Every document chunk is associated with an organisation via the `org_id` column on `document_embeddings`. Both vector and keyword queries include a `WHERE org_id = ANY(...)` clause when `orgIds` are specified, enforcing tenant isolation at the database level. Passing `NULL` searches all organisations (admin use).

---

## Similarity — Cosine Distance

**Metric:** Cosine similarity
**Range:** 0.0 (unrelated) → 1.0 (identical)

Cosine similarity measures the angle between two vectors in 768-dimensional space. It is direction-sensitive (meaning matters) rather than magnitude-sensitive (length of text doesn't skew results).

```
similarity = (A · B) / (|A| × |B|)
```

Supabase pgvector uses the `<=>` operator for cosine distance. The `match_documents` function converts this to similarity (`1 - distance`) and returns results ordered from most to least relevant. When `filter_org_ids` is provided, only vectors belonging to those organisations are considered.

---

## Memory (Conversation History)

**Type:** Short-term, client-side
**Window:** Last **5 conversation turns** (agent context) / last **2 turns** (query rewriting)

The frontend sends the full conversation history with each request in the `history` array. The backend uses this in two places:

- **Agent context:** Trimmed to the most recent **5 turns** and injected into the LLM messages array between the system prompt and the current user message.
- **Query rewriting:** The last **2 turns** are passed to the query rewriter so it can expand vague follow-up questions (e.g. "tell me more") into self-contained search queries.

```
[System Prompt + Business Data (KPIs & VTO) + Retrieved Docs]
[User turn 1]
[Assistant turn 1]
...
[User turn N (last 10)]
[Current user message]
```

There is no server-side session storage — memory lives entirely in the frontend and is passed per request. This keeps the backend stateless and horizontally scalable.

---

## Business Data Context (KPIs & VTO)

In addition to document embeddings, the chatbot has access to **live business data** for the requesting organisation. This data is fetched from the database (not from external APIs) on every chat request and injected into the system prompt alongside document chunks.

### Data Sources

| Source | Database Table | What It Contains |
|---|---|---|
| **Financial KPIs** | `FinanceKpi` | Revenue, profit, EBITDA, cash position, burn rate, runway, DSO, valuation metrics, budget variance |
| **Leads KPIs** | `LeadsKpi` | Sales funnel (leads → deals won), conversion rate, pipeline coverage, recurring revenue, client concentration |
| **Labor KPIs** | `LaborKpi` | Headcount, utilization, labor cost/hour, revenue per FTE, founder dependency |
| **VTO** | `VTO` | Core values, mission, vision, 10-year targets, marketing strategy, 3-year picture |

### How It Works

1. When a chat request arrives with `orgIds`, the **Business Data Service** (`services/businessDataService.js`) queries the database for the latest KPI snapshots and VTO data for those organisation(s) — in parallel with intent detection and document retrieval.
2. Each data source (financial, leads, labor, VTO) is formatted as a human-readable text block.
3. The formatted text is injected into the system prompt in a dedicated section between the intent-specific instructions and the document context:

```
[Intent-specific system prompt + shared rules]

--- BUSINESS DATA (KPIs & VTO) ---
=== FINANCIAL KPIs (Period: Jan 1, 2026 – Mar 1, 2026) ===
Total Income: $450,000
Net Income: $112,500 (Net Margin: 25.0%)
...

=== VTO — Vision/Traction Organizer (2026 Strategic Plan, 2026) ===
Core Values: Innovation, Integrity, Client-First
Mission: ...
--- END OF BUSINESS DATA ---

--- RETRIEVED DOCUMENTS ---
[1] report.pdf
...
--- END OF DOCUMENTS ---
```

4. Business data sources appear as **citation chips** in the frontend alongside document sources (e.g., "Financial KPIs (Jan–Mar 2026)", "VTO — 2026 Strategic Plan").

### Scoping

- Business data is **only injected when orgIds are scoped** to specific organisation(s). When `orgIds` is `"all"` (admin cross-org mode), business data is omitted to avoid bloating the prompt.
- If no KPI or VTO data exists for an organisation, those sections are simply omitted — the chatbot falls back to document-only context gracefully.
- All database queries use `.catch(() => null)` so a failure in one data source never blocks the others.

---

## Multi-Agent Architecture

Each request passes through a 5-step pipeline:

```
User Message
     │
     ├────────────────────────────┬────────────────────────────┐
     ▓                            ▓                            ▓
[Intent Router]          [Hybrid Document Retrieval]  [Business Data Service]
qwen3.5:9b, temp=0       ┌─ Query Rewrite (LLM,      DB queries (no LLM call)
→ ["summarize","predict"]  │  ≤8 words only)           → KPI snapshots + VTO data
                           ├─ Vector Search (top-12)
                           ├─ Keyword Search (tsvector)
                           └─ Merge + Deduplicate
     │                            │                            │
     └──────────┬─────────────────┴────────────────────────────┘
                ▓
     [Parallel Specialized Agents]
      One qwen3.5:9b agent per detected intent
      System prompt includes: business data + document context
      ┌──────────┬──────────┬──────────┬──────────┬──────────┐
      summarize  analyze    predict    explain    qa
      └──────────┴──────────┴──────────┴──────────┴──────────┘
                ▓
     [Response Combiner]  ← only if more than 1 intent
      qwen3.5:9b: merges sections into one coherent answer
                ▓
     [Guardrail Agent]
      qwen3.5:9b, temp=0, JSON output
      • Checks every claim against source documents and business data
      • Labels unlabeled general knowledge
      • Revises hallucinated claims
      • Returns: { validatedAnswer, confidence, issues[] }
                ▓
     Stream answer → SSE chunks → sources → guardrail metadata → [DONE]
```

### LLM calls per request

| Scenario | Total LLM calls | Model used |
|---|---|---|
| Single intent, long query (no rewrite) | 3 | 3× qwen3.5:9b |
| Single intent, short query (with rewrite) | 4 | 4× qwen3.5:9b |
| Two intents, long query | 4 | 4× qwen3.5:9b |
| Two intents, short query (with rewrite) | 5 | 5× qwen3.5:9b |

Query rewriting adds 1 LLM call only for short/vague queries (≤ 8 words). All calls go to the local Ollama server — zero external API calls.

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
│   ├── ragService.js            # Hybrid retrieval (vector + keyword + query rewrite) + prompt construction
│   ├── businessDataService.js   # KPI + VTO data fetching and formatting for chat context
│   ├── intentRouter.js          # Multi-intent detection (qwen3.5:9b, local)
│   ├── promptTemplates.js       # Per-intent system prompts
│   └── guardrail.js             # Answer accuracy verification (qwen3.5:9b, local)
├── routes/
│   └── chatRoutes.js            # /stream, /, /ingest routes
├── scripts/
│   └── ingest-local.js          # Local ingestion script (reads from uploads/ folder)
├── lib/
│   ├── prisma.js                # Prisma singleton (uses DATABASE_URL via pgbouncer)
│   └── prismaVector.js          # Dedicated Prisma client using DIRECT_URL (bypasses pgbouncer for vector queries)
├── docs/
│   └── ai-pipeline-architecture.md  # Pipeline architecture diagram and model assignment guide
└── uploads/                     # Temporary Multer upload directory (gitignored)
```
