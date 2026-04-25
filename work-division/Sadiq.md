# Sadiq - Literature QC and Novelty Signal

## Core Responsibilities
- Implement `app/api/literature-qc/route.ts` using Semantic Scholar and arXiv.
- Build novelty classification logic: not found, similar work exists, exact match found.
- Return top 1-3 references with title, source, year, and link.
- Add timeout/retry handling and safe fallback when external APIs are rate-limited.
- Normalize and enrich references with metadata fields needed for vector ingestion (domain, method, assay, organism).
- Curate high-quality source snippets for chunking to improve retrieval precision.

## Deliverables
- Reliable literature QC endpoint.
- Normalized reference response format for UI and generation context.
- Basic test cases for novelty signal behavior.
- Ingestion-ready literature payload for embedding pipeline.

## Coordination
- Provide reference payload shape to Abdullah for display.
- Provide novelty signal output to Adeel for inclusion in generation prompt.
- Sync with Moazzam on metadata conventions used in vector store filtering.

