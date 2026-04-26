# Hack Nation — Project Submission

> **Team ID:** HN-9663
> **Event:** Fulcrum Science x MIT Club Challenge #04

---

## Team

| Name | Role |
|---|---|
| Adeel Tahir | Technical Lead — AI Generation & RAG Pipeline |
| Abdullah | Frontend UI & Results Experience |
| Moazzam | Scientist Review Loop & Retrieval Store |
| Sadiq | Literature QC & Novelty Signal |

---

## Project Title

**AI Scientist — From Hypothesis to Runnable Experiment**

---

## Short Description

An AI-powered research tool that transforms a plain-language scientific hypothesis into a complete, operationally grounded experiment plan — covering step-by-step protocol, materials with catalog numbers, budget line items, phased timeline, and measurable validation criteria — in minutes instead of weeks. Powered by Ollama (local LLM), LangChain RAG, and real-time literature search across arXiv, OpenAlex, and Crossref.

---

## Structured Project Description

### 1. Problem & Challenge

Turning a scientific question into a runnable experiment requires weeks of manual work: designing the protocol, estimating costs, sourcing materials, and staffing the team. The bottleneck is not the idea — it is the operational scoping.

A senior scientist with prior experience in a domain can scope a proposal in hours. A junior researcher may take days, and the quality difference is significant. A plan with the wrong reagent concentration or an unrealistic timeline can send a lab down the wrong path for weeks, burning budget and time.

AI Scientist closes this gap by automating the hardest, most time-consuming parts of experiment design.

---

### 2. Target Audience

- **Academic researchers and PhD students** who need to scope experiments outside their primary domain
- **Lab PIs and project managers** who want faster turnaround on feasibility assessments
- **Biotech and life-science startups** scoping new assays without a dedicated protocol library
- **Science educators** building realistic, grounded teaching materials

---

### 3. Solution & Core Features

AI Scientist is a focused, end-to-end Next.js application with four stages:

**Natural Language Input → Literature QC → Retrieval Grounding → Full Experiment Plan**

**Feature 1 — Literature Quality Control**
Before generating a plan, a fast novelty check is performed against arXiv, OpenAlex, and Crossref:
- *Not found* — the hypothesis is novel
- *Similar work exists* — the plan builds on prior art with references
- *Exact match* — the protocol already exists; the plan extends it

**Feature 2 — Retrieval-Augmented Generation (RAG)**
Protocol snippets, reagent notes, and prior reviews are chunked and embedded into an in-app vector index. LangChain retrieves the top-k most relevant evidence per hypothesis and injects it into the generation prompt, grounding outputs in real methodology rather than hallucinated steps.

**Feature 3 — Structured Experiment Plan**
The core deliverable is a complete, operationally realistic plan with five sections:
- Protocol (6–12 numbered steps with volumes, temperatures, instrument settings)
- Materials (8–15 items with supplier catalog numbers and realistic USD pricing)
- Budget (4–7 line items with justifications)
- Timeline (4–8 phased milestones with dependencies)
- Validation (4–6 measurable success criteria with numeric thresholds)

**Feature 4 — Scientist Review Loop (Stretch Goal)**
A structured feedback interface lets scientists rate, correct, and annotate generated plans. Feedback is stored by experiment type and domain, then surfaced as few-shot examples for future similar experiments — making the system more accurate over time.

---

### 4. Unique Selling Proposition (USP)

Existing AI writing tools produce generic, ungrounded science text. AI Scientist is different in three key ways:

1. **Operational specificity**: Plans include actual supplier catalog numbers (Thermo Fisher, Sigma-Aldrich, QIAGEN, ATCC), realistic USD pricing, and instrument-level step detail — not vague guidance.
2. **Grounded generation**: A RAG pipeline backed by real protocol sources (protocols.io, Bio-protocol, Nature Protocols) reduces hallucinations in reagent and timeline details.
3. **Novelty awareness**: Every plan is informed by a live literature sweep so the scientist knows immediately whether they are breaking new ground or building on prior art.
4. **Self-improving via feedback**: The Scientist Review Loop means every expert correction becomes a few-shot example for the next similar experiment — compounding value over time rather than staying static.

---

### 5. Implementation & Technology

**Architecture**
The application is a pure Next.js project (no separate backend server). All API logic lives in Next.js Route Handlers under `app/api/`.

**LLM — Ollama (local)**
- *Library:* `ollama` npm package (`^0.6.3`)
- *Model:* Any Ollama-compatible model (default: `qwen2.5:7b`, configurable via `OLLAMA_MODEL` env var)
- *Integration:* `src/lib/gemini.ts` wraps the Ollama client, builds structured prompts with a strict JSON schema, handles multi-attempt retry with increasing strictness, and applies five normalizers to handle any model output shape variation

**RAG Pipeline — LangChain**
- `src/lib/rag.ts` orchestrates query embedding, similarity search, and context compression
- `src/lib/vectorstore.ts` manages an in-memory vector index (upgradeable to Pinecone or pgvector)
- Retrieved evidence is injected into the generation prompt as numbered context blocks

**Literature Search**
- `src/lib/literature.ts` fans out to arXiv, OpenAlex, and Crossref in parallel
- Returns top 1–3 references with title, source, year, and URL
- Novelty classification: `not_found`, `similar`, or `exact`

**Feedback Store**
- `src/lib/feedback.ts` stores structured corrections in app memory
- Tagged by experiment type and domain for retrieval as few-shot examples

**Frontend**
- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4 for styling
- Single-page hypothesis input with literature QC status display and full five-section plan renderer

**Key env vars:**
```
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
ARXIV_BASE_URL=https://export.arxiv.org/api/query
OPENALEX_BASE_URL=https://api.openalex.org
CROSSREF_BASE_URL=https://api.crossref.org
```

---

### 6. Results & Impact

**What we achieved within the hackathon:**
- End-to-end working pipeline: hypothesis in → structured experiment plan out, in under 60 seconds on local hardware
- Robust output normalization that handles any model response shape (arrays, objects, strings) without crashing
- Live literature QC with novelty signal surfaced in the UI before the plan is shown
- RAG retrieval grounding the generation with domain-relevant protocol snippets
- Scientist Review Loop prototype enabling structured feedback capture and few-shot injection

**Demonstrated value:**
- A biosensor hypothesis (anti-CRP on paper strip, <0.5 mg/L CRP in 10 min) produces a 10-step protocol, 12 materials with real catalog numbers, a $4,200 budget breakdown, and a 6-week phased timeline — in roughly 45 seconds
- The same system handles cells, climate, gut microbiome, and CRISPR hypotheses without domain-specific tuning
- Running entirely on a local Ollama model means zero API cost at demo time and full data privacy

**Future impact:**
- Reducing experiment scoping time from weeks to minutes democratizes access to high-quality protocol design for labs without senior domain expertise
- The feedback loop creates a compounding knowledge asset: every reviewed plan improves future outputs for similar experiment types

---

## Additional Information

**Note on `lib/gemini.ts` filename:** The file is named `gemini.ts` for historical reasons (an early prototype used the Gemini API). The actual implementation uses the Ollama JavaScript client throughout — the filename is an artifact and the code is entirely Ollama-based.

**Ollama model flexibility:** The app works with any model available on the local Ollama server. We recommend `qwen2.5:7b` for a good balance of speed and structured JSON output quality. Larger models (e.g., `qwen2.5:72b`, `llama3.1:70b`) improve plan specificity but require more VRAM.

**Upgrade paths:**
- Vector store: swap in-memory index for Pinecone, Weaviate, or pgvector
- Feedback store: persist to PostgreSQL or Supabase for multi-session learning
- Deployment: Vercel (frontend + API routes) + a remote Ollama server or any hosted LLM endpoint

---

## Live Project URL

> _(Not yet deployed — runs locally via `npm run dev` on `http://localhost:3000`)_

---

## GitHub Repository URL

> https://github.com/AdeelTahir-SE/Hack_Nation_HACKATHON_AI_Scientist

---

## Technologies / Tags

`Next.js` · `React` · `TypeScript` · `Ollama` · `LangChain` · `RAG` · `LLM` · `Tailwind CSS` · `arXiv API` · `OpenAlex` · `Crossref` · `Vector Store` · `Qwen`

## Additional Tags

`experiment-planning` · `scientific-ai` · `protocol-generation` · `literature-search` · `novelty-detection` · `scientist-review-loop` · `few-shot-learning` · `local-llm` · `life-science` · `research-automation`

---

## Media Checklist

| Asset | Status | Notes |
|---|---|---|
| Team Photo | ⬜ To upload | Landscape, 16:9, good lighting, all faces visible |
| Demo Video (max 60s) | ⬜ To record | UI/UX showcase — hypothesis input → plan output flow |
| Tech Video (max 60s) | ⬜ To record | Stack walkthrough — Ollama, LangChain RAG, literature QC, review loop |
| Screenshots / Diagrams | ⬜ To add | Input page, results page (all 5 sections), literature QC panel |

> ⚠️ **Both Demo Video and Tech Video are required by the jury.** Projects missing either video may score lower. Record these before final submission.

### Demo Video Script Outline (60s)
1. **(0–5s)** Show the hypothesis input field; type a real hypothesis (e.g. CRP biosensor)
2. **(5–15s)** Submit — show the literature QC panel loading and displaying novelty signal + references
3. **(15–35s)** Scroll through the generated plan: Protocol steps → Materials table → Budget → Timeline → Validation
4. **(35–50s)** Open the Scientist Review section; show the rating and annotation UI
5. **(50–60s)** Quick summary: "Local Ollama + LangChain RAG → full experiment plan in under 60 seconds"

### Tech Video Script Outline (60s)
1. **(0–10s)** Architecture overview: Next.js frontend, `/api/` route handlers, Ollama local LLM
2. **(10–25s)** Show `lib/gemini.ts` — prompt building, JSON schema, multi-attempt retry, normalizers
3. **(25–40s)** Show `lib/rag.ts` + `lib/vectorstore.ts` — chunking, embedding, top-k retrieval, context injection
4. **(40–52s)** Show `lib/literature.ts` — parallel arXiv / OpenAlex / Crossref search + novelty classification
5. **(52–60s)** Show `lib/feedback.ts` — review store + few-shot injection for next experiment of same type
