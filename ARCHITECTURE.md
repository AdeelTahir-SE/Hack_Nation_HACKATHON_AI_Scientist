# AI Scientist — System Architecture

> End-to-end architecture for a hypothesis-to-experiment-plan AI platform.
> Built on Next.js, Ollama (local LLM), LangChain RAG, and live literature APIs.

---

## 1. High-Level System Overview

```mermaid
graph TB
    subgraph CLIENT["🖥️  Browser Client"]
        UI["Next.js UI\n(React 19 · Tailwind CSS 4)"]
    end

    subgraph SERVER["⚙️  Next.js Server  (Route Handlers)"]
        direction TB
        LitAPI["/api/literature-qc\nNovelty check"]
        GenAPI["/api/generate-plan\nFull plan generation"]
        ReviewAPI["/api/submit-review\nFeedback capture"]
        IngestAPI["/api/ingest-knowledge\nChunk & embed"]
    end

    subgraph LIBS["📚  Core Libraries  (src/lib/)"]
        direction TB
        LIT["literature.ts\narXiv · OpenAlex · Crossref"]
        RAG["rag.ts\nLangChain retrieval"]
        VS["vectorstore.ts\nIn-memory vector index"]
        GEN["gemini.ts\nOllama client + prompt builder"]
        FB["feedback.ts\nReview store"]
    end

    subgraph LLM["🤖  Ollama LLM"]
        OL["ollama serve\n(localhost:11434)\nqwen2.5:7b or any compatible model"]
    end

    subgraph EXTAPIS["🌐  External Literature APIs"]
        AX["arXiv API"]
        OA["OpenAlex API"]
        CR["Crossref API"]
    end

    UI -->|"1 · submit hypothesis"| LitAPI
    UI -->|"2 · generate plan"| GenAPI
    UI -->|"3 · submit review"| ReviewAPI

    LitAPI --> LIT
    LIT --> AX & OA & CR

    GenAPI --> LIT
    GenAPI --> RAG
    RAG --> VS
    GenAPI --> GEN
    GEN -->|"ollama.chat()"| OL

    ReviewAPI --> FB
    FB -.->|"few-shot examples"| GEN

    IngestAPI --> RAG
    RAG --> VS
```

---

## 2. Request Lifecycle — Full Plan Generation

The core user journey, step by step:

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant LitQC as /api/literature-qc
    participant GenPlan as /api/generate-plan
    participant Lit as literature.ts
    participant RAG as rag.ts
    participant VS as vectorstore.ts
    participant Ollama as Ollama (local)

    User->>UI: Enter hypothesis & click Generate
    UI->>LitQC: POST { hypothesis }

    Note over LitQC,Lit: Phase 1 — Novelty Check
    LitQC->>Lit: searchLiterature(hypothesis)
    Lit-->>LitQC: { signal, references[1..3] }
    LitQC-->>UI: Novelty signal + references shown

    UI->>GenPlan: POST { hypothesis, novelty, references }

    Note over GenPlan,VS: Phase 2 — RAG Retrieval
    GenPlan->>RAG: retrieveEvidence(hypothesis, k=4)
    RAG->>VS: searchSimilar(queryEmbedding)
    VS-->>RAG: top-k { text, score }[]
    RAG-->>GenPlan: evidence[]

    Note over GenPlan,Ollama: Phase 3 — LLM Generation
    GenPlan->>GenPlan: buildPrompt(hypothesis, novelty,\n  references, evidence, feedback)
    GenPlan->>Ollama: ollama.chat({ model, messages,\n  format: "json", temperature: 0.2 })
    Ollama-->>GenPlan: raw JSON string

    Note over GenPlan: Phase 4 — Parse & Normalize
    GenPlan->>GenPlan: extractJsonObject(raw)
    GenPlan->>GenPlan: normalizePlanShape(parsed)
    GenPlan->>GenPlan: applyFallbacks(partial, hypothesis)
    GenPlan-->>UI: ExperimentPlan { protocol,\n  materials, budget, timeline,\n  validation }

    UI->>User: Render 5-section experiment plan
```

---

## 3. RAG Pipeline — Retrieval-Augmented Generation

```mermaid
flowchart LR
    subgraph INGEST["📥 Ingestion  (one-time)"]
        I1["Protocol text\n(protocols.io, Bio-protocol,\nNature Protocols, JoVE)"]
        I2["Reagent notes\n& supplier sheets"]
        I3["Reviewed experiment\nplans (feedback store)"]
        I1 & I2 & I3 --> CH["Chunk\n(sentence-level)"]
        CH --> EMB["Embed\nbuildEmbedding(text)\n→ 256-dim hash vector"]
        EMB --> MEM["In-Memory\nVector Store\n(globalThis singleton)"]
    end

    subgraph QUERY["🔍 Query  (per request)"]
        Q1["User hypothesis"] --> QE["Embed hypothesis\nbuildEmbedding(hypothesis)"]
        QE --> SIM["Cosine similarity\nsearch over store"]
        MEM --> SIM
        SIM --> TK["Top-k=4 chunks\n(ranked by score)"]
        TK --> CTX["Context block\ninjected into prompt"]
    end
```

**Embedding approach:** Token-hash bag-of-words in a 256-dimensional float vector, normalized to unit length for cosine similarity. Zero external API calls — runs entirely in-process. Upgradeable to sentence-transformers or OpenAI embeddings without changing the interface.

---

## 4. LLM Prompt Architecture

```mermaid
flowchart TD
    H["🧬 Hypothesis"] --> PB
    N["📡 Novelty signal\n(not_found / similar / exact)"] --> PB
    R["📄 Literature refs\n(arXiv, OpenAlex, Crossref)"] --> PB
    E["🔬 Retrieved evidence\n(top-k protocol chunks)"] --> PB
    F["💬 Expert feedback\n(few-shot examples\nfrom review store)"] --> PB
    S["🏭 Supplier context\n(Thermo Fisher, Sigma,\nQIAGEN, ATCC, IDT)"] --> PB

    PB["buildPrompt()"] --> SYS["system: 'Output only valid JSON'"]
    PB --> USR["user: assembled prompt\nwith JSON output schema"]

    SYS --> OL["Ollama ollama.chat()\ntemperature 0.2 → 0.05 on retry"]
    USR --> OL

    OL --> RAW["raw string response"]
    RAW --> EX["extractJsonObject()"]
    EX --> PARSE["safeJsonParse()"]
    PARSE --> NORM["normalizePlanShape()\nhandles any field naming variant"]
    NORM --> FB2["applyFallbacks()\nfills empty sections"]
    FB2 --> PLAN["✅ ExperimentPlan\n{ protocol · materials\n  budget · timeline · validation }"]

    style PLAN fill:#1a7a4a,color:#fff,stroke:#0d5c35
    style OL fill:#2d4a8a,color:#fff,stroke:#1a3060
```

---

## 5. Scientist Review Feedback Loop

```mermaid
flowchart LR
    P["Generated Plan\n(first run)"] --> R["Scientist Review UI\n/api/submit-review"]
    R --> FS["feedback.ts\nIn-memory review store\n{ experimentType, domain,\n  sectionCorrections, rating }"]
    FS -.->|"Next similar hypothesis"| GEN["gemini.ts\nbuildPrompt()\nfew-shot examples injected"]
    GEN --> P2["Improved Plan\n(subsequent runs)"]

    style P2 fill:#1a7a4a,color:#fff,stroke:#0d5c35
    style FS fill:#7a4a1a,color:#fff,stroke:#5c3010
```

The feedback loop is self-improving: every expert correction tagged with `experimentType` and `domain` is surfaced as a few-shot example the next time a similar hypothesis is submitted. No retraining required.

---

## 6. File & Module Map

```mermaid
graph TD
    subgraph APP["src/app/"]
        PG["page.tsx\nHypothesis input UI\nResults renderer"]
        subgraph API["api/"]
            R1["generate-plan/route.ts"]
            R2["literature-qc/route.ts"]
            R3["submit-review/route.ts"]
            R4["ingest-knowledge/route.ts"]
        end
    end

    subgraph LIB["src/lib/"]
        GEM["gemini.ts\nOllama client\nPrompt builder\nJSON normalizers"]
        RAG2["rag.ts\nEvidence retrieval\nKnowledge ingestion"]
        VEC["vectorstore.ts\nHash embedding\nCosine similarity\nIn-memory store"]
        LIT2["literature.ts\narXiv · OpenAlex\nCrossref search"]
        FBK["feedback.ts\nReview store\nFew-shot retrieval"]
    end

    subgraph TYPES["src/types/"]
        TP["plan.ts\nExperimentPlan\nLiteratureReference\nNoveltySignal"]
    end

    R1 --> GEM & RAG2 & LIT2 & FBK
    R2 --> LIT2
    R3 --> FBK
    R4 --> RAG2
    RAG2 --> VEC
    PG --> R1 & R2 & R3
    GEM & LIT2 & FBK --> TP
```

---

## 7. Tech Stack — Deep Dive

### 7.1 Frontend

| Technology | Version | Role |
|---|---|---|
| **Next.js** | 16.2.4 | Full-stack React framework. App Router for routing, Route Handlers for API. |
| **React** | 19.2.4 | Component model. Used for hypothesis form, literature QC panel, 5-section plan renderer, review interface. |
| **TypeScript** | ^5 | Strict typing across all lib modules and API contracts. |
| **Tailwind CSS** | ^4 | Utility-first styling. Dark theme, glassmorphism cards, responsive layout. |

**Design highlights:**
- Single-page hypothesis input with real-time validation
- Animated loading states during LLM generation (~30–60s)
- Five collapsible sections: Protocol · Materials · Budget · Timeline · Validation
- Literature QC badge showing novelty signal + clickable reference cards
- Scientist Review panel with per-section rating and annotation fields

---

### 7.2 Backend (Next.js Route Handlers)

All server logic runs as edge-compatible Route Handlers — no separate Express/Fastify server.

| Route | Method | Purpose |
|---|---|---|
| `/api/literature-qc` | `POST` | Fan-out to arXiv, OpenAlex, Crossref. Returns novelty signal + top-3 refs. |
| `/api/generate-plan` | `POST` | Orchestrates RAG retrieval → prompt assembly → Ollama call → plan normalization. |
| `/api/submit-review` | `POST` | Stores structured expert feedback in in-memory review store. |
| `/api/ingest-knowledge` | `POST` | Accepts text chunks, embeds them, upserts into vector store. |

---

### 7.3 AI Generation — Ollama

| Attribute | Detail |
|---|---|
| **Library** | `ollama` npm (`^0.6.3`) |
| **Default model** | `qwen2.5:7b` (configurable via `OLLAMA_MODEL`) |
| **Server** | Local: `http://localhost:11434` (configurable via `OLLAMA_BASE_URL`) |
| **Auth** | None for local; `Authorization: Bearer <key>` header for Ollama Cloud |
| **Call mode** | `ollama.chat()`, non-streaming, `format: "json"` |
| **Temperature** | `0.2` (first attempt) → `0.05` (retry with strict prompt) |
| **Retry logic** | 2 attempts: relaxed prompt → strict prompt. Auth errors surface immediately. |

**Why Ollama?**
- Zero API cost — runs entirely on local hardware
- Full data privacy — no hypothesis leaves the machine
- Model-agnostic — swap `qwen2.5:7b` for `llama3.1:8b`, `mistral:7b`, or any GGUF model without code changes
- JSON mode (`format: "json"`) improves structured output reliability

**Supported local models (tested):**
- `qwen2.5:7b` — recommended (fast, good JSON discipline)
- `qwen2.5:72b` — higher quality, requires ~48GB VRAM
- `llama3.1:8b` — good general purpose
- `mistral:7b` — fast, lighter VRAM

---

### 7.4 RAG Pipeline

| Component | Implementation |
|---|---|
| **Orchestrator** | `src/lib/rag.ts` — `retrieveEvidence(query, k=4)`, `ingestKnowledgeChunks(chunks)` |
| **Embedding** | `buildEmbedding()` — 256-dim hash bag-of-words, L2-normalized. Pure TypeScript, zero dependencies. |
| **Similarity** | Cosine similarity over all stored vectors, sorted descending, slice top-k. |
| **Store** | `globalThis.__aiScientistVectorStore` — survives hot-reload, resets on cold server restart. |
| **Seeding** | 4 baseline scientific-method guidelines auto-seeded on first use. |
| **Upgrade path** | Replace `vectorstore.ts` with Pinecone / Weaviate / pgvector adapter. The `rag.ts` interface is unchanged. |

---

### 7.5 Literature Search

| API | Base URL | What it returns |
|---|---|---|
| **arXiv** | `export.arxiv.org/api/query` | Preprint papers, full text search, Atom XML feed |
| **OpenAlex** | `api.openalex.org` | Open scholarly metadata, DOI, citation counts |
| **Crossref** | `api.crossref.org` | Peer-reviewed DOIs, journal metadata, publisher info |

**Novelty classification logic (`literature.ts`):**
- `exact` — title similarity score > 0.85, same domain
- `similar` — 1–3 references found with moderate relevance
- `not_found` — no match above threshold

All three APIs are queried in parallel with `Promise.allSettled()`. Individual API failures are silently skipped — the endpoint never errors on a single bad API.

---

### 7.6 Feedback Store

| Attribute | Detail |
|---|---|
| **Implementation** | `src/lib/feedback.ts` — in-memory `Map` keyed by experiment type + domain |
| **Stored fields** | `experimentType`, `domain`, `sectionCorrections`, `rating`, `timestamp` |
| **Retrieval** | `getFeedbackExamples(type, domain, limit=3)` — returns top examples formatted as few-shot blocks |
| **Injection point** | `buildPrompt()` in `gemini.ts` — section: `SCIENTIST FEEDBACK (from prior similar experiments)` |
| **Upgrade path** | Swap in-memory Map for PostgreSQL / Supabase with one adapter file change |

---

## 8. Data Flow Summary

```
User → [Hypothesis text]
       ↓
   /api/literature-qc
       ↓
   arXiv + OpenAlex + Crossref  →  novelty signal + 1–3 refs
       ↓
   /api/generate-plan
       ↓
   vectorstore cosine search  →  top-4 evidence chunks
       ↓
   feedback store lookup  →  0–3 few-shot expert corrections
       ↓
   buildPrompt()  →  [system | user] message pair with full JSON schema
       ↓
   Ollama ollama.chat()  →  raw JSON string
       ↓
   extractJsonObject() → safeJsonParse() → normalizePlanShape() → applyFallbacks()
       ↓
   ExperimentPlan { protocol · materials · budget · timeline · validation }
       ↓
   UI renders 5-section plan  →  Scientist reviews  →  feedback stored
       ↓
   (next similar hypothesis benefits from the stored correction)
```

---

## 9. Upgrade Roadmap

| Component | Current | Upgrade Option |
|---|---|---|
| LLM | Ollama local | Remote Ollama server, OpenAI, Anthropic, Groq |
| Embedding | 256-dim hash vector | `text-embedding-3-small`, `nomic-embed-text` via Ollama |
| Vector store | In-memory `globalThis` | Pinecone, Weaviate, Qdrant, pgvector (Supabase) |
| Feedback store | In-memory `Map` | PostgreSQL, Supabase, MongoDB |
| Literature QC | arXiv + OpenAlex + Crossref | PubMed, Semantic Scholar, Scopus, IEEE Xplore |
| Deployment | Local `npm run dev` | Vercel (frontend + API) + remote Ollama server |

---

*Built for Fulcrum Science × MIT Club Challenge #04 · Team HN-9663*
