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

A focused, end-to-end application with three stages:

Natural Language Question -> Literature QC -> Full Experiment Plan

### 1. Input
Enter any scientific hypothesis in plain language. The system handles everything from diagnostics to climate science.

### 2. Literature Quality Control
Before generating a plan, the tool runs a fast novelty check:
- Not found - you are breaking new ground
- Similar work exists - builds on prior art with references
- Exact match found - the protocol has been done before

Returns 1 to 3 relevant references from arXiv, Semantic Scholar, or protocol repositories.

### 3. Full Experiment Plan
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
| Frontend | Next.js / React |
| Backend | Next.js Route Handlers (app/api/*) |
| AI Generation | Google Gemini API (free tier) |
| Literature Search | Semantic Scholar API, arXiv |
| Database | Supabase (feedback store) |
| Deployment | Vercel |

---

## Project Structure

ai-scientist/
|- app/                                  # Next.js app directory
|  |- page.tsx                           # Main input interface
|  |- results/                           # Plan display and navigation
|  |- review/                            # Scientist review interface
|  |- api/
|     |- generate-plan/route.ts          # Main plan generation endpoint
|     |- literature-qc/route.ts          # Novelty check endpoint
|     |- submit-review/route.ts          # Scientist feedback endpoint
|- components/
|  |- HypothesisInput/                   # Natural language input
|  |- LiteratureQC/                      # Novelty signal display
|  |- ExperimentPlan/                    # Full plan renderer
|  |  |- Protocol.tsx
|  |  |- Materials.tsx
|  |  |- Budget.tsx
|  |  |- Timeline.tsx
|  |  |- Validation.tsx
|  |- ScientistReview/                   # Feedback and annotation UI
|- lib/
|  |- gemini.ts                          # Gemini API integration
|  |- literature.ts                      # arXiv and Semantic Scholar search
|  |- feedback.ts                        # Feedback store logic
|- README.md

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Google AI Studio API key for Gemini free tier: https://aistudio.google.com/app/apikey
- A Supabase project for the feedback store: https://supabase.com

### Installation

1. Clone your repository.
2. Enter the project folder.
3. Install dependencies with npm install.

### Environment Variables

Create a .env.local file with:

GEMINI_API_KEY=your_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SEMANTIC_SCHOLAR_API_KEY=your_key_here

### Run Locally

Start development server with npm run dev and open http://localhost:3000

---

## How It Works

### Plan Generation Pipeline

User hypothesis
-> Literature QC (Semantic Scholar / arXiv)
-> Novelty signal: not found / similar / exact match
-> 1 to 3 references surfaced
-> Context assembly
   - Hypothesis + novelty signal
   - Relevant prior protocols from literature hits
   - Domain-specific feedback from store if similar experiments exist
-> Gemini generation with structured prompt
-> Parsed experiment plan
   - Protocol steps
   - Materials with catalog numbers
   - Budget line items
   - Phased timeline
   - Validation approach
-> Rendered UI with section navigation

### Feedback Loop (Stretch Goal)

Scientist reviews generated plan
-> Structured annotations stored in Supabase
   - Experiment type tag
   - Domain tag
   - Section-level corrections
-> Next similar experiment request
-> Feedback retrieved as few-shot examples
-> Improved generation with no re-prompting required

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
