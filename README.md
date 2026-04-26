# AI Scientist - From Hypothesis to Runnable Experiment

> Fulcrum Science x MIT Challenge #04
> An AI-powered tool that compresses weeks of experiment scoping into minutes by generating complete, operationally realistic experiment plans that a real lab could pick up and run.

---

## The Problem

Turning a scientific question into a runnable experiment takes weeks of manual work: designing the protocol, estimating costs, sourcing materials, staffing the team. It is not the ideas that slow science down, it is the operations.

A senior scientist who has run a similar experiment before can scope a proposal in hours. One who has not may take days, and the quality difference is real. A plan with the wrong chemical concentration or an unrealistic timeline can send a lab down the wrong path for weeks.

AI Scientist closes this gap.

---

## What It Does

A focused, end-to-end application with five stages:

Natural Language Question -> Literature QC -> Retrieval Grounding -> Full Experiment Plan -> Scientist Review Loop

### 1. Input
Enter any scientific hypothesis in plain language. The system handles everything from diagnostics to climate science.

### 2. Literature Quality Control
Before generating a plan, the tool runs a fast novelty check:
- Not found - you are breaking new ground
- Similar work exists - builds on prior art with references
- Exact match found - the protocol has been done before

Returns 1 to 3 relevant references from arXiv, OpenAlex, Crossref, or protocol repositories.

### 3. Retrieval Grounding for Better Results
To improve reliability and reduce hallucinations, generation is grounded with a retrieval layer:
- Protocol snippets, reagent notes, and prior reviews are chunked and embedded
- Embeddings are stored in an in-app vector memory layer
- LangChain retrieves the most relevant context per hypothesis
- Retrieved evidence is injected into the final generation prompt

### 4. Full Experiment Plan
The core deliverable is a complete, operationally grounded plan including:

| Section | What is Included |
|---|---|
| Protocol | Step-by-step methodology grounded in real published protocols |
| Materials and Supply Chain | Specific reagents, catalog numbers, and suppliers |
| Budget | Realistic cost estimates with itemized line items |
| Timeline | Phased breakdown with dependencies |
| Validation | How success or failure will be measured |

Quality bar: Would a real scientist trust this plan enough to order materials and start running it by Friday?

---

## Stretch Goal: Scientist Review Loop

The system implements a learning feedback loop where every expert correction makes the next plan better:

- Structured review interface: scientists rate, correct, and annotate protocol steps, reagent choices, budget lines, and timeline assumptions
- Feedback store: corrections captured in structured form, tagged by experiment type and domain
- Generation layer: prior feedback incorporated as few-shot examples when producing new plans of the same type

The result is a system that compounds in value over time. Not just a tool, a platform.

---

## Sample Inputs

| Domain | Hypothesis |
|---|---|
| Diagnostics | A paper-based electrochemical biosensor functionalized with anti-CRP antibodies will detect C-reactive protein in whole blood at concentrations below 0.5 mg/L within 10 minutes |
| Gut Health | Supplementing C57BL/6 mice with Lactobacillus rhamnosus GG for 4 weeks will reduce intestinal permeability by at least 30 percent compared to controls, measured by FITC-dextran assay |
| Cell Biology | Replacing sucrose with trehalose as a cryoprotectant will increase post-thaw viability of HeLa cells by at least 15 percentage points compared to the standard DMSO protocol |
| Climate | Introducing Sporomusa ovata into a bioelectrochemical system at -400mV vs SHE will fix CO2 into acetate at >=150 mmol/L/day, outperforming current biocatalytic carbon capture benchmarks by 20 percent |

Strong hypotheses name a specific intervention, state a measurable outcome with a threshold, give a mechanistic reason, and imply a clear control condition.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 / React 19 |
| Backend | Next.js Route Handlers (app/api/*) |
| AI Generation | Ollama (local, self-hosted LLM — Qwen / any compatible model) |
| LLM Orchestration | LangChain (JavaScript/TypeScript) |
| Literature Search | arXiv API, OpenAlex API, Crossref API |
| Vector Store | In-memory retrieval index (hash embedding, cosine similarity) |
| Feedback Store | **Supabase** (PostgreSQL — persistent across restarts) |
| Deployment | Vercel / Local |

---

## Project Structure

```
ai-scientist/  (src/ layout)
|- src/
|  |- app/
|  |  |- page.tsx                           # All UI: input, results, review loop (single page)
|  |  |- layout.tsx                          # Root layout + metadata
|  |  |- globals.css                         # Design system tokens + component styles
|  |  |- api/
|  |     |- generate-plan/route.ts           # Main plan generation endpoint
|  |     |- literature-qc/route.ts           # Novelty check endpoint
|  |     |- submit-review/route.ts           # Scientist feedback → Supabase
|  |     |- ingest-knowledge/route.ts        # Chunk and embed protocols into vector store
|  |- lib/
|  |  |- gemini.ts                           # Ollama client + prompt builder + JSON normalizers
|  |  |- rag.ts                              # LangChain-style retrieval pipeline
|  |  |- vectorstore.ts                      # In-memory hash embedding + cosine similarity
|  |  |- literature.ts                       # arXiv, OpenAlex, and Crossref search
|  |  |- feedback.ts                         # Supabase-backed review store
|  |  |- supabase.ts                         # Lazy singleton Supabase client
|  |- types/
|     |- plan.ts                             # Shared TypeScript types
|- supabase_setup.sql                        # SQL to run in Supabase SQL Editor
|- README.md
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- [Ollama](https://ollama.com) installed and running locally (`ollama serve`)
- A compatible model pulled locally, e.g. `ollama pull qwen2.5:7b`

### Installation

1. Clone the repository.
2. Enter the project folder.
3. Install dependencies:

```bash
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Ollama — local server (no API key required for local use)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b

# Literature search APIs (no key required for public access)
ARXIV_BASE_URL=https://export.arxiv.org/api/query
OPENALEX_BASE_URL=https://api.openalex.org
CROSSREF_BASE_URL=https://api.crossref.org
```

> **Note:** `OLLAMA_API_KEY` is only needed if you are using Ollama Cloud (remote hosted). For local Ollama, leave it unset or omit it entirely. Set `OLLAMA_BASE_URL=http://localhost:11434` to point at your local Ollama server.

### Ollama Quick Check

Make sure Ollama is running:

```bash
ollama serve
```

Verify the server is responding:

```bash
curl http://localhost:11434/api/tags
```

Pull the model used by the app (if not already done):

```bash
ollama pull qwen2.5:7b
```

### Supabase Setup (Scientist Review Loop)

The feedback store is backed by Supabase so reviews persist across server restarts and team members.

**Step 1 — Create a free Supabase project:** https://supabase.com → New Project

**Step 2 — Run the table setup SQL:**
- Open your Supabase project → SQL Editor → New Query
- Paste the entire contents of `supabase_setup.sql` (included in this repo)
- Click **Run** — this creates the `reviews` table with RLS policies

**Step 3 — Add credentials to your `.env.local`:**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Both values are at: **Supabase Dashboard → Settings → API**

**What this enables:**
- Reviews survive server restarts, `npm run dev` restarts, and Vercel cold starts
- Multiple team members can leave reviews from different machines
- The judge can see feedback from Plan 1 carry into Plan 2 even after a full restart

> Without Supabase credentials set, the server will throw a clear error when the first review is submitted.

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## How It Works

### Plan Generation Pipeline

```
User hypothesis
-> Literature QC (arXiv / OpenAlex / Crossref)
-> Novelty signal: not found / similar / exact match
-> 1 to 3 references surfaced
-> Retrieval grounding (LangChain + in-app vector index)
   - Query embedding for hypothesis
   - Similarity search over protocol chunks, reagent notes, and past reviewed plans
   - Top-k evidence selection and context compression
-> Context assembly
   - Hypothesis + novelty signal
   - Relevant prior protocols from literature hits
   - Retrieved evidence from vector store
   - Domain-specific feedback from store if similar experiments exist
-> Ollama generation with structured prompt
-> Parsed experiment plan
   - Protocol steps
   - Materials with catalog numbers
   - Budget line items
   - Phased timeline
   - Validation approach
-> Rendered UI with section navigation
```

### Why This Improves Results

- More factual grounding from retrieved experimental evidence
- Better reagent and protocol specificity across domains
- Lower hallucination rate in budget and timeline details
- Higher consistency across repeated prompts for similar hypotheses

### Feedback Loop (Stretch Goal)

```
Scientist reviews generated plan (Section 5 — Review Loop UI)
-> Star rating (1–5) + per-section correction textareas
-> Structured annotations saved to Supabase reviews table
   - hypothesis, score, merged section corrections, timestamp
-> Next similar experiment request
-> Feedback retrieved from Supabase (keyword token match)
-> Injected as few-shot examples into Ollama generation prompt
-> Improved plan generated with no re-prompting required
```

> Reviews persist across server restarts and deployments — every correction permanently improves future plans.

---

## Protocol Sources

The generation layer is grounded in real protocol repositories:

- protocols.io: https://protocols.io
- Bio-protocol: https://bio-protocol.org
- Nature Protocols: https://nature.com/nprot
- JoVE: https://jove.com
- OpenWetWare: https://openwetware.org

Reagent references sourced from Thermo Fisher, Sigma-Aldrich, Promega, Qiagen, ATCC, and IDT.

---

## Evaluation Criteria

Plans are evaluated against the following standard:

Would a real scientist trust this plan enough to order the materials and start running it?

Specifically:
- Is the protocol grounded in real published methodology?
- Do materials include actual catalog numbers and suppliers?
- Is the budget realistic with itemized line items?
- Does the timeline have phased dependencies, not just a total duration?
- Is the validation approach measurable and experiment-specific?

---

## Contact

Built for the Fulcrum Science x MIT Club Challenge #04.

Questions about the challenge:
- arun@fulcrum.science
- jonas@fulcrum.science
