# AI Chatbot Pipeline Architecture

## Overview

When a user sends a message, the pipeline runs through several stages — some in parallel, some sequential. Each stage has different computational demands. This document maps out the full flow and identifies which tasks suit a small/fast model versus a large reasoning model.

---

## Full Pipeline Flow

```
User sends message
        │
        ▼
┌───────────────────────────────────────────────┐
│         PARALLEL (runs all at once)           │
│                                               │
│  ┌─────────────────┐  ┌───────────────────┐  │
│  │ Intent Detection│  │ Document Retrieval│  │
│  │  (small model)  │  │                   │  │
│  └─────────────────┘  │  ┌─────────────┐  │  │
│                        │  │Query Rewrite│  │  │
│  ┌─────────────────┐  │  │(small model)│  │  │
│  │  KPI Business   │  │  └─────────────┘  │  │
│  │  Data Fetch     │  │  ┌─────────────┐  │  │
│  │  (DB query)     │  │  │ File List   │  │  │
│  └─────────────────┘  │  │ (DB query)  │  │  │
│                        │  └─────────────┘  │  │
│                        │  ┌─────────────┐  │  │
│                        │  │Vector Search│  │  │
│                        │  │+ Keyword    │  │  │
│                        │  │Search (DB)  │  │  │
│                        │  └─────────────┘  │  │
│                        └───────────────────┘  │
└───────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────┐
│         ANSWER GENERATION                     │
│                                               │
│  System prompt + KPI data + document chunks   │
│  + conversation history + user question       │
│                                               │
│         → Big reasoning model                 │
└───────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────┐
│  Multi-intent merge (if >1 intent detected)   │
│         → Big reasoning model                 │
└───────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────┐
│  Guardrail check — is answer grounded?        │
│         → Small model                         │
└───────────────────────────────────────────────┘
        │
        ▼
  Stream answer to frontend (SSE) + sources
```

---

## Model Assignment

### Small / Fast Model (1–2B parameters)

These tasks are simple, well-defined, and do not require deep reasoning. Using a small model here saves significant latency on every single request.

| Task | File | Why small model is enough |
|---|---|---|
| **Query rewriting** | `services/ragService.js` | Single instruction: rewrite this question. No reasoning, just reformatting. |
| **Intent detection** | `services/intentRouter.js` | Classification into fixed categories (finance, leads, documents, etc.). Pure labelling task. |
| **Guardrail check** | `services/guardrail.js` | Yes/no verification with a confidence score. Structured output from a clear prompt. |

**Recommended models:** `qwen2.5:1.5b`, `llama3.2:1b`, `phi3.5:mini`

---

### Large / Reasoning Model (7B+ parameters)

These tasks require reading large amounts of context, synthesising across multiple sources, and producing coherent, accurate, nuanced responses.

| Task | File | Why big model is needed |
|---|---|---|
| **Answer generation** | `controllers/chat.controller.js` | Reads 12+ document chunks + live KPI data + conversation history. Must reason across all of it accurately. |
| **Multi-intent merging** | `controllers/chat.controller.js` | Combines answers from multiple specialised agents into one coherent response without contradiction. |

**Recommended models:** `qwen2.5:7b`, `llama3.1:8b`, `mistral:7b`

---

## Why Both Vector and Keyword Search

The document retrieval uses two search methods combined:

- **Vector search** — converts the question into a 768-dimensional embedding and finds chunks that are *semantically similar*. Catches synonyms and paraphrasing. Example: "how is the company performing financially" matches chunks about "gross margin" and "EBITDA".

- **Keyword search** — PostgreSQL full-text search that matches *exact terms*. Catches proper nouns, brand names, and specific figures that may not cluster well in vector space. Example: "Pemmerations", "JGA", "$5M–$20M".

Neither alone covers all cases. Together they close each other's blind spots.

---

## Query Rewriting Logic

Query rewriting only fires when the question is **8 words or fewer** (vague or follow-up questions like "tell me more" or "explain that"). Longer, specific questions already embed well and skip the rewrite entirely to save latency.

When rewriting does run, it executes in **parallel** with the `allFiles` database lookup — so the extra LLM call does not add to the critical path.

---

## Current Performance Characteristics

| Stage | Runs in parallel? | Model size | Approx cost |
|---|---|---|---|
| Intent detection | Yes | Currently: big — should be small | High (can be reduced) |
| Query rewriting | Yes (with DB lookup) | Currently: big — should be small | Medium (skipped for long queries) |
| KPI data fetch | Yes | DB query — no model | Low |
| File list fetch | Yes (with rewrite) | DB query — no model | Low |
| Vector + keyword search | After embed | DB query — no model | Low |
| Answer generation | After all parallel | Big model | High (unavoidable) |
| Guardrail check | After answer | Currently: big — should be small | High (can be reduced) |

---

## Recommended Next Step

Switch intent detection and guardrail to a dedicated small model instance. These two tasks run on **every single message** and currently use the same heavy model as answer generation — which is the biggest avoidable latency cost in the pipeline.
