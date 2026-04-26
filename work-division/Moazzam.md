# Moazzam - Scientist Review Loop and Retrieval Store

## Core Responsibilities
- Design feedback data model in app memory (experiment type, domain, section corrections).
- Design vector storage schema for in-app retrieval store (documents, chunks, embeddings, metadata).
- Implement `app/api/submit-review/route.ts` endpoint.
- Build review interface components for rating and section-level annotations.
- Implement retrieval utility to fetch relevant historical feedback for similar experiments.
- Maintain retrieval indexing and metadata filtering logic.

## Deliverables
- Functional review submission flow.
- In-app schema and insertion/query logic.
- Reusable feedback retrieval helper for generation context.
- Retrieval-ready schema and query templates for similarity search.

## Coordination
- Share stored feedback format with Adeel for few-shot context integration.
- Share vector schema and indexing assumptions with Adeel for LangChain retriever wiring.
- Work with Abdullah to connect review UI into results page.

