# Moazzam - Scientist Review Loop and Feedback Store

## Core Responsibilities
- Design feedback data model in Supabase (experiment type, domain, section corrections).
- Design vector storage schema in Supabase pgvector (documents, chunks, embeddings, metadata).
- Implement `app/api/submit-review/route.ts` endpoint.
- Build review interface components for rating and section-level annotations.
- Implement retrieval utility to fetch relevant historical feedback for similar experiments.
- Maintain SQL migration scripts for vector index setup and metadata filters.

## Deliverables
- Functional review submission flow.
- Supabase table schema and insertion/query logic.
- Reusable feedback retrieval helper for generation context.
- pgvector-ready schema and query templates for similarity search.

## Coordination
- Share stored feedback format with Adeel for few-shot context integration.
- Share vector schema and indexing assumptions with Adeel for LangChain retriever wiring.
- Work with Abdullah to connect review UI into results page.

