# Adeel - Technical Lead and AI Plan Generation (Extra Scope)

## Core Responsibilities
- Design the overall Next.js-only architecture (no separate Express backend).
- Implement `app/api/generate-plan/route.ts` endpoint.
- Integrate Gemini API (free tier) and create `lib/gemini.ts` prompt + response parsing logic.
- Implement LangChain orchestration layer for prompt chaining and retrieval-augmented generation.
- Build `lib/rag.ts` to retrieve top-k evidence from vector store and compress context.
- Define and enforce JSON schema/output format for experiment plans.
- Implement robust fallback handling for malformed model output.

## Extra Responsibilities (Slightly More Work)
- Own end-to-end integration across all modules before demo.
- Finalize environment configuration and API key handling (`.env.local` guidance).
- Implement ingestion flow endpoint (`app/api/ingest-knowledge/route.ts`) for chunking + embedding.
- Own ranking settings (k, similarity threshold, rerank heuristics) for quality tuning.
- Lead final testing pass: API routes, UI flow, and edge-case prompts.
- Prepare 2-3 demo hypotheses and verify output quality for each.

## Deliverables
- Working generation API route with structured output.
- Shared plan response contract used by frontend.
- Working RAG path with LangChain retrieval from Supabase pgvector.
- Integration checklist completion before final submission.

## Coordination
- Provide API contract to Abdullah for rendering.
- Sync with Sadiq for merging literature QC context and metadata into retrieval filters.
- Sync with Moazzam for vector table schema, embeddings ingestion, and feedback schema reuse.

