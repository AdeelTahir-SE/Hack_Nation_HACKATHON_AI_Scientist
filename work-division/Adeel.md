# Adeel - Technical Lead and AI Plan Generation (Extra Scope)

## Core Responsibilities
- Design the overall Next.js-only architecture (no separate Express backend).
- Implement `app/api/generate-plan/route.ts` endpoint.
- Integrate Gemini API (free tier) and create `lib/gemini.ts` prompt + response parsing logic.
- Define and enforce JSON schema/output format for experiment plans.
- Implement robust fallback handling for malformed model output.

## Extra Responsibilities (Slightly More Work)
- Own end-to-end integration across all modules before demo.
- Finalize environment configuration and API key handling (`.env.local` guidance).
- Lead final testing pass: API routes, UI flow, and edge-case prompts.
- Prepare 2-3 demo hypotheses and verify output quality for each.

## Deliverables
- Working generation API route with structured output.
- Shared plan response contract used by frontend.
- Integration checklist completion before final submission.

## Coordination
- Provide API contract to Abdullah for rendering.
- Sync with Sadiq for merging literature QC context into prompt.
- Sync with Moazzam for review feedback schema reuse.

