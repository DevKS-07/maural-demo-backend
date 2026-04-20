# AI Model Switching Guide

## Background & Context

The original design goal for the Maural KMS AI pipeline was **complete data privacy**: all AI inference was to run locally via [Ollama](https://ollama.com), with no user queries or document content ever leaving the server. This was a deliberate architectural choice and a key differentiator for the project — organizations uploading sensitive business documents could be assured their data was never transmitted to a third-party AI service.

**Models used in the original local-only implementation:**
- Chat / reasoning: `qwen3.5:9b` via Ollama (local)
- Embeddings: `nomic-embed-text` via Ollama (local) — **768-dimensional vectors**

**Why we switched to OpenAI:**
During the final project phase the team's AWS EC2 instance (which hosted the Ollama server) exhausted its free credits and was shut down. To keep the system running for the demonstration, AI inference was migrated to the OpenAI API. This is a temporary measure. If re-deployed to a private cloud instance with enough RAM (minimum ~8 GB for `qwen3.5:9b`), switching back to Ollama restores the full privacy guarantee.

**Current state (OpenAI):**
- Chat / reasoning: `gpt-4o-mini` via OpenAI API
- Embeddings: `text-embedding-3-small` via OpenAI API — **1536-dimensional vectors**

---

## Architecture Overview — Where Models Are Used

There are exactly **two distinct model roles** in the system. They can be changed independently of each other, but changing the **embedding model always requires re-ingesting all documents**.

```
CHAT MODEL              EMBEDDING MODEL
─────────────────       ──────────────────────────────
Intent routing          Document ingestion (write)
Per-intent agents       Document retrieval / search (read)
Response combining
Guardrail verification
Query rewriting
```

### Files that import the AI client

| File | Uses | What for |
|---|---|---|
| `services/intentRouter.js` | Chat model | Classify user intent |
| `services/ragService.js` | Chat model + Embeddings | Query rewriting, agents, retrieval |
| `services/guardrail.js` | Chat model | Verify answer accuracy |
| `controllers/ingest.controller.js` | Embeddings only | Embed document chunks on upload |
| `config/openai.js` | — | Shared API key helper |
| `config/env.js` | — | Exports all model env vars |

---

## The Critical Embeddings Rule

> **Changing the embedding model requires recreating the `document_embeddings` table and re-ingesting every document. This is non-negotiable.**

The `document_embeddings` table has a `vector(N)` column where `N` is fixed at creation. OpenAI `text-embedding-3-small` produces **1536-dimensional** vectors; Ollama `nomic-embed-text` produces **768-dimensional** vectors. These are incompatible — you cannot query a 768-dim table with a 1536-dim query vector, and PostgreSQL will error.

**Changing only the chat model is safe and does not require any database changes.**

---

## Option A — Switch Back to Ollama (Local, Privacy-First)

Choose this when you are deploying to a private server and want no data leaving your infrastructure.

**Hardware requirements:** Minimum 8 GB RAM for `qwen3.5:9b`. Ollama runs on the same machine as the Node.js API or on a separate host accessible via `OLLAMA_BASE_URL`.

### Step 1 — Install Ollama and Pull Models

On the host server:

```bash
# Install Ollama (Linux)
curl -fsSL https://ollama.com/install.sh | sh

# Pull the required models
ollama pull qwen3.5:9b
ollama pull nomic-embed-text

# Verify Ollama is running
curl http://localhost:11434/api/tags
```

### Step 2 — Install the LangChain/Ollama Package

```bash
npm install @langchain/ollama
```

The `@langchain/openai` package can remain installed — it is not harmful to have both. Only the import statements in the service files matter.

### Step 3 — Update Environment Variables

In your `.env` (or hosting platform's secrets vault):

```env
# Add these:
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=qwen3.5:9b
OLLAMA_EMBED_MODEL=nomic-embed-text

# Remove or leave blank (no longer used):
# OPENAI_API_KEY=
# OPENAI_CHAT_MODEL=
# OPENAI_EMBED_MODEL=
```

### Step 4 — Add an Ollama Config Helper

Create `config/ollama.js`:

```js
const { OLLAMA_BASE_URL, OLLAMA_CHAT_MODEL, OLLAMA_EMBED_MODEL } = require("./env");

function getOllamaBaseUrl() {
  return OLLAMA_BASE_URL || "http://localhost:11434";
}

module.exports = { getOllamaBaseUrl, OLLAMA_CHAT_MODEL, OLLAMA_EMBED_MODEL };
```

And add these to `config/env.js` exports:

```js
OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
OLLAMA_CHAT_MODEL: process.env.OLLAMA_CHAT_MODEL || "qwen3.5:9b",
OLLAMA_EMBED_MODEL: process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text",
```

### Step 5 — Update `services/intentRouter.js`

```js
// BEFORE (OpenAI)
const { ChatOpenAI } = require("@langchain/openai");
const { OPENAI_CHAT_MODEL } = require("../config/env");
const { getOpenAIApiKey } = require("../config/openai");

const model = new ChatOpenAI({
  apiKey: getOpenAIApiKey(),
  model: OPENAI_CHAT_MODEL,
  temperature: 0,
});

// AFTER (Ollama)
const { ChatOllama } = require("@langchain/ollama");
const { OLLAMA_CHAT_MODEL } = require("../config/env");
const { getOllamaBaseUrl } = require("../config/ollama");

const model = new ChatOllama({
  baseUrl: getOllamaBaseUrl(),
  model: OLLAMA_CHAT_MODEL,
  temperature: 0,
});
```

### Step 6 — Update `services/guardrail.js`

Apply the same substitution as Step 5 — replace `ChatOpenAI` with `ChatOllama` and update the import/constructor.

### Step 7 — Update `services/ragService.js`

Two replacements are needed — the chat model (for agents and query rewriting) and the embeddings model:

```js
// BEFORE (OpenAI)
const { OpenAIEmbeddings, ChatOpenAI } = require("@langchain/openai");
const { OPENAI_CHAT_MODEL, OPENAI_EMBED_MODEL } = require("../config/env");
const { getOpenAIApiKey } = require("../config/openai");

const embeddings = new OpenAIEmbeddings({
  apiKey: getOpenAIApiKey(),
  model: OPENAI_EMBED_MODEL,
});

const chatModel = new ChatOpenAI({
  apiKey: getOpenAIApiKey(),
  model: OPENAI_CHAT_MODEL,
  temperature: 0.1,
});

// AFTER (Ollama)
const { OllamaEmbeddings, ChatOllama } = require("@langchain/ollama");
const { OLLAMA_CHAT_MODEL, OLLAMA_EMBED_MODEL } = require("../config/env");
const { getOllamaBaseUrl } = require("../config/ollama");

const embeddings = new OllamaEmbeddings({
  baseUrl: getOllamaBaseUrl(),
  model: OLLAMA_EMBED_MODEL,
});

const chatModel = new ChatOllama({
  baseUrl: getOllamaBaseUrl(),
  model: OLLAMA_CHAT_MODEL,
  temperature: 0.1,
});
```

### Step 8 — Update `controllers/ingest.controller.js`

```js
// BEFORE (OpenAI)
const { OpenAIEmbeddings } = require("@langchain/openai");
const { OPENAI_EMBED_MODEL } = require("../config/env");
const { getOpenAIApiKey } = require("../config/openai");

const embedder = new OpenAIEmbeddings({
  apiKey: getOpenAIApiKey(),
  model: OPENAI_EMBED_MODEL,
});

// AFTER (Ollama)
const { OllamaEmbeddings } = require("@langchain/ollama");
const { OLLAMA_EMBED_MODEL } = require("../config/env");
const { getOllamaBaseUrl } = require("../config/ollama");

const embedder = new OllamaEmbeddings({
  baseUrl: getOllamaBaseUrl(),
  model: OLLAMA_EMBED_MODEL,
});
```

### Step 9 — Recreate the document_embeddings Table (CRITICAL)

Because `nomic-embed-text` produces **768-dimensional** vectors (vs OpenAI's 1536), the table must be dropped and recreated.

> **Warning:** This deletes all existing embeddings. All documents must be re-ingested after this step.

Run in Supabase SQL Editor:

```sql
-- Drop the existing table (deletes all embeddings)
DROP TABLE IF EXISTS document_embeddings CASCADE;

-- Recreate with 768 dimensions (nomic-embed-text)
CREATE TABLE document_embeddings (
  id        bigserial PRIMARY KEY,
  content   text,
  metadata  jsonb,
  org_id    uuid REFERENCES "Organisation"(org_id) ON DELETE CASCADE,
  embedding vector(768)
);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_org_id
  ON document_embeddings (org_id);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_embedding
  ON document_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Also update the match_documents function to use the new dimensions
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),
  match_count     int DEFAULT 15,
  filter_org_ids  uuid[] DEFAULT NULL
)
RETURNS TABLE (id bigint, content text, metadata jsonb, similarity float)
LANGUAGE plpgsql AS $$
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

GRANT ALL ON TABLE document_embeddings TO service_role;
GRANT ALL ON SEQUENCE document_embeddings_id_seq TO service_role;
ALTER TABLE document_embeddings DISABLE ROW LEVEL SECURITY;
```

### Step 10 — Re-ingest All Documents

After restarting the server, trigger a full re-ingestion:

```bash
# Via API (production)
POST /api/chat/ingest

# Or via local script (development)
node scripts/ingest-local.js
```

All documents must be re-embedded with the new model before the chatbot will return accurate results.

---

## Option B — Change OpenAI Chat Model Only (Safe)

Changing the chat model does not affect embeddings or require any database changes. Only update the environment variable:

```env
OPENAI_CHAT_MODEL=gpt-4o        # More capable, higher cost
# or
OPENAI_CHAT_MODEL=gpt-4o-mini   # Default — balanced cost/quality
# or
OPENAI_CHAT_MODEL=gpt-3.5-turbo # Cheapest, lower quality
```

Restart the server. No code changes, no re-ingestion needed.

---

## Option C — Change OpenAI Embedding Model Only

> **Warning:** Changing the embedding model requires dropping and recreating the table and re-ingesting all documents.

OpenAI embedding models and their dimensions:

| Model | Dimensions | Notes |
|---|---|---|
| `text-embedding-3-small` | 1536 | Current default — good balance |
| `text-embedding-3-large` | 3072 | Higher quality, higher cost |
| `text-embedding-ada-002` | 1536 | Older model, same dims as 3-small |

If switching between `text-embedding-3-small` and `text-embedding-ada-002` (both 1536 dims), you still must re-ingest — vectors from different models are semantically incompatible even at the same dimension count.

Steps:
1. Update `OPENAI_EMBED_MODEL` in environment variables.
2. Drop and recreate the `document_embeddings` table with the correct dimension count (see Step 9 above, replacing `vector(768)` with the new model's dimension count).
3. Re-ingest all documents via `POST /api/chat/ingest`.

---

## Option D — Switch to Anthropic Claude or Google Gemini

LangChain supports multiple providers. For Anthropic Claude:

```bash
npm install @langchain/anthropic
```

```js
const { ChatAnthropic } = require("@langchain/anthropic");

const model = new ChatAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-3-5-sonnet-20241022",
  temperature: 0,
});
```

Note: Anthropic does not provide an embeddings API. You would need to use a separate provider for embeddings (e.g., keep OpenAI embeddings for document search while using Claude for chat). Mixed-provider setups are supported by the architecture.

---

## Quick Reference — Decision Matrix

| Situation | Safe to just change env vars? | Re-ingest required? |
|---|---|---|
| Change chat model (same provider) | Yes | No |
| Change chat model (different provider) | No — code change needed | No |
| Change embedding model (same dims) | No — still must rebuild table | Yes |
| Change embedding model (different dims) | No — code + SQL change needed | Yes |
| Switch from OpenAI to Ollama | No — code changes in 4 files | Yes |
| Switch from Ollama to OpenAI | No — code changes in 4 files | Yes |

---

## Checking Current Embedding Dimensions

To verify what dimension your current table uses:

```sql
SELECT
  attname AS column_name,
  atttypmod AS dimensions
FROM pg_attribute
WHERE attrelid = 'document_embeddings'::regclass
  AND attname = 'embedding';
```

The `atttypmod` value equals the dimension count for vector columns (e.g., `1536` or `768`).

---

*See [AI_CHATBOT_README.md](AI_CHATBOT_README.md) for the full technical pipeline documentation.*
*See [PRODUCTION_HANDOVER_CHECKLIST.html](PRODUCTION_HANDOVER_CHECKLIST.html) for the production deployment checklist.*
