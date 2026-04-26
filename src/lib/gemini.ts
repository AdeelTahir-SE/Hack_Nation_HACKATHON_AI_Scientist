import { Ollama } from "ollama";

import type { ExperimentPlan, LiteratureReference, NoveltySignal, ProtocolReference } from "@/types/plan";

type GenerationInput = {
  hypothesis: string;
  novelty: NoveltySignal;
  references: LiteratureReference[];
  protocols: ProtocolReference[];
  retrievedEvidence: string[];
  reviewExamples: string[];
};

/* ─── Primitive helpers ──────────────────────────────────────── */

function toText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((v) => toText(v)).filter(Boolean).join("; ");
  if (value && typeof value === "object") {
    const first = Object.values(value as Record<string, unknown>)[0];
    return toText(first);
  }
  return "";
}

function parseCandidateToNumber(raw: string): number {
  const cleaned = raw.replace(/[$,\s]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const text = value.trim();
    const preferredMoney = text.match(/\$\s*\d{1,3}(?:,\d{3})+(?:\.\d+)?/);
    if (preferredMoney?.[0]) return parseCandidateToNumber(preferredMoney[0]);
    const plainMoney = text.match(/\$\s*\d+(?:\.\d+)?/);
    if (plainMoney?.[0]) return parseCandidateToNumber(plainMoney[0]);
    const generic = text.match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/);
    if (generic?.[0]) return parseCandidateToNumber(generic[0]);
  }

  return null;
}

/* ─── Array / structure normalizers ─────────────────────────── */

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => {
        if (typeof item === "string") return [item.trim()];
        if (item && typeof item === "object") {
          // Some models return [{step: "...", description: "..."}, ...]
          const row = item as Record<string, unknown>;
          const candidate =
            toText(row.step || row.action || row.description || row.text || row.content || row.name);
          return candidate ? [candidate] : Object.values(row).map((v) => toText(v)).filter(Boolean);
        }
        return [];
      })
      .map((s) => s.replace(/^[-*•·\d.):\s]+/, "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    // Numbered list: "1. Foo 2. Bar" or newline/semicolon separated
    const byNumber = value.split(/\s(?=\d+[.)]\s)/).map((s) => s.replace(/^\d+[.)]\s*/, "").trim()).filter(Boolean);
    if (byNumber.length > 1) return byNumber;
    return value.split(/\n|;/).map((s) => s.replace(/^[-*•·\d.):\s]+/, "").trim()).filter(Boolean);
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${toText(v)}`.trim())
      .filter((s) => s !== ":");
  }

  return [];
}

function normalizeMaterials(value: unknown): ExperimentPlan["materials"] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return {
            item: item.replace(/^[-*•·\d.):\s]+/, "").trim(),
            catalog: "N/A",
            supplier: "N/A",
            estimatedCostUSD: toNullableNumber(item),
          };
        }
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        return {
          item: toText(row.item || row.name || row.material || row.reagent || row.chemical) || "Unknown",
          catalog:
            toText(row.catalog || row.catalogNumber || row.catalog_no || row.catalog_number || row.sku || row.id) ||
            "N/A",
          supplier:
            toText(row.supplier || row.vendor || row.company || row.manufacturer || row.source) || "N/A",
          estimatedCostUSD: toNullableNumber(
            row.estimatedCostUSD ??
              row.estimated_cost_usd ??
              row.cost ??
              row.price ??
              row.amount ??
              row.value,
          ),
        };
      })
      .filter((item): item is ExperimentPlan["materials"][number] => Boolean(item?.item));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([k, v]) => ({
      item: k,
      catalog: "N/A",
      supplier: "N/A",
      estimatedCostUSD: toNullableNumber(v),
    }));
  }

  return [];
}

function normalizeBudget(value: unknown): ExperimentPlan["budget"] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          // "Reagents: $2000"
          const parts = item.split(/:\s*/);
          return {
            category: (parts[0] || item).replace(/^[-*•·\d.):\s]+/, "").trim() || "Miscellaneous",
            amountUSD: toNullableNumber(parts[1] || item) || 0,
            notes: item,
          };
        }
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        return {
          category: toText(row.category || row.type || row.name || row.item || row.label) || "Miscellaneous",
          amountUSD:
            toNullableNumber(
              row.amountUSD ??
                row.amount ??
                row.cost ??
                row.value ??
                row.total ??
                row.price,
            ) || 0,
          notes: toText(row.notes || row.note || row.description || row.details || row.justification),
        };
      })
      .filter((item): item is ExperimentPlan["budget"][number] => Boolean(item?.category));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([k, v]) => ({
      category: k,
      amountUSD: toNullableNumber(v) || 0,
      notes: typeof v === "string" ? v : "",
    }));
  }

  return [];
}

function normalizeTimeline(value: unknown): ExperimentPlan["timeline"] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          // "Week 1-2: Setup"
          return { phase: item.replace(/^[-*•·\d.):\s]+/, "").trim(), duration: "", dependencies: [] };
        }
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        return {
          phase: toText(row.phase || row.stage || row.step || row.name || row.task) || "Phase",
          duration: toText(row.duration || row.time || row.eta || row.weeks || row.length || row.period),
          dependencies: normalizeStringArray(
            row.dependencies || row.dependsOn || row.depends_on || row.requires || row.prerequisites,
          ),
        };
      })
      .filter((item): item is ExperimentPlan["timeline"][number] => Boolean(item?.phase));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([k, v]) => ({
      phase: k,
      duration: toText(v),
      dependencies: [],
    }));
  }

  return [];
}

/* ─── Fallback generators ────────────────────────────────────── */

function fallbackProtocol(hypothesis: string): string[] {
  return [
    `Define the experimental groups and controls for: ${hypothesis}`,
    "Prepare all required reagents and materials following safety protocols.",
    "Execute the experimental procedure with n≥3 biological replicates.",
    "Collect measurements at each defined time point.",
    "Apply appropriate statistical analysis (e.g., Student's t-test or ANOVA).",
    "Document all observations and compare against the stated hypothesis.",
  ];
}

function fallbackMaterials(): ExperimentPlan["materials"] {
  return [
    { item: "Primary reagents (hypothesis-specific)", catalog: "N/A", supplier: "N/A", estimatedCostUSD: 500 },
    { item: "Standard consumables (pipettes, plates, tubes)", catalog: "N/A", supplier: "N/A", estimatedCostUSD: 150 },
    { item: "Personal protective equipment", catalog: "N/A", supplier: "N/A", estimatedCostUSD: 50 },
  ];
}

function fallbackBudget(): ExperimentPlan["budget"] {
  return [
    { category: "Reagents & Consumables", amountUSD: 700, notes: "Estimated based on typical experiment scale." },
    { category: "Equipment Usage", amountUSD: 300, notes: "Core facility rates." },
    { category: "Personnel", amountUSD: 500, notes: "Research assistant time." },
  ];
}

function fallbackTimeline(): ExperimentPlan["timeline"] {
  return [
    { phase: "Setup & Preparation", duration: "1 week", dependencies: [] },
    { phase: "Experiment Execution", duration: "2–3 weeks", dependencies: ["Setup & Preparation"] },
    { phase: "Data Analysis & Write-up", duration: "1 week", dependencies: ["Experiment Execution"] },
  ];
}

function fallbackValidation(): string[] {
  return [
    "Statistically significant result (p < 0.05) in the primary outcome measure.",
    "Consistent results across biological replicates (CV < 20%).",
    "Appropriate negative and positive controls behave as expected.",
    "Results can be reproduced in at least one independent repeat experiment.",
  ];
}

/* ─── JSON extraction ────────────────────────────────────────── */

function extractJsonObject(text: string): string {
  const trimmed = text.trim();

  // Already clean JSON
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  // Code block: ```json ... ``` or ``` ... ```
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlock?.[1]?.trim().startsWith("{")) return codeBlock[1].trim();

  // Extract from first { to last }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);

  return trimmed;
}

function safeJsonParse(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    // Try to salvage truncated JSON by finding the last complete top-level value
    try {
      // Remove trailing incomplete field/value
      const fixed = text.replace(/,\s*"[^"]*"\s*:\s*[^,}\]]*$/, "").replace(/,?\s*$/, "") + "}";
      const parsed = JSON.parse(fixed);
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch { /* ignore */ }
    return null;
  }
}

/* ─── Shape normalizer ───────────────────────────────────────── */

function normalizePlanShape(root: Record<string, unknown>): Partial<ExperimentPlan> {
  // Some models wrap inside "plan", "experiment", "result", "output" etc.
  const unwrapped =
    (root.plan || root.experiment || root.result || root.output || root.data || root.experiment_plan) as
      | Record<string, unknown>
      | undefined;

  const src: Record<string, unknown> =
    unwrapped && typeof unwrapped === "object" && !Array.isArray(unwrapped) ? unwrapped : root;

  return {
    protocol: normalizeStringArray(
      src.protocol ||
        src.procedure ||
        src.methodology ||
        src.methods ||
        src.steps ||
        src.experimental_procedure ||
        src.experimental_steps,
    ),
    materials: normalizeMaterials(
      src.materials ||
        src.reagents ||
        src.equipment ||
        src.supplies ||
        src.materials_and_reagents ||
        src.reagents_and_equipment,
    ),
    budget: normalizeBudget(
      src.budget ||
        src.costs ||
        src.cost_breakdown ||
        src.estimated_costs ||
        src.financials ||
        src.funding,
    ),
    timeline: normalizeTimeline(
      src.timeline ||
        src.schedule ||
        src.phases ||
        src.milestones ||
        src.project_timeline ||
        src.experimental_timeline,
    ),
    validation: normalizeStringArray(
      src.validation ||
        src.success_criteria ||
        src.successCriteria ||
        src.criteria ||
        src.expected_outcomes ||
        src.outcomes ||
        src.evaluation,
    ),
  };
}

/* ─── Validation: lenient — uses fallbacks for empty arrays ─── */

function applyFallbacks(
  plan: Partial<ExperimentPlan>,
  hypothesis: string,
): ExperimentPlan["protocol"] extends string[]
  ? ExperimentPlan
  : never {
  const result: ExperimentPlan = {
    hypothesis: hypothesis,
    novelty: "not_found",
    references: [],
    protocols: [],
    retrievedEvidence: [],
    protocol: plan.protocol?.length ? plan.protocol : fallbackProtocol(hypothesis),
    materials: plan.materials?.length ? plan.materials : fallbackMaterials(),
    budget: plan.budget?.length ? plan.budget : fallbackBudget(),
    timeline: plan.timeline?.length ? plan.timeline : fallbackTimeline(),
    validation: plan.validation?.length ? plan.validation : fallbackValidation(),
  };

  const hasAnyRealContent =
    plan.protocol?.length ||
    plan.materials?.length ||
    plan.budget?.length ||
    plan.timeline?.length ||
    plan.validation?.length;

  if (!hasAnyRealContent) {
    throw new Error(
      "Model returned a response with no usable content. Please try again or check the model / API key.",
    );
  }

  return result as unknown as ReturnType<typeof applyFallbacks>;
}

/* ─── Prompt builder ─────────────────────────────────────────── */

// Supplier and resource context injected into every generation
const SUPPLIER_CONTEXT = `
SUPPLIER REFERENCES (use these for realistic catalog numbers and pricing):
- Thermo Fisher Scientific: thermofisher.com — reagents, cell culture media, antibodies, PCR kits
  Example catalog refs: Gibco DMEM (cat. 11965092), TRIzol (cat. 15596026), DAPI (cat. 62248)
- Sigma-Aldrich / Merck: sigmaaldrich.com — chemicals, solvents, standards
  Example catalog refs: Trehalose (cat. T9531), DMSO (cat. D2650), PBS (cat. D8537)
- QIAGEN: qiagen.com — RNA/DNA extraction kits, PCR reagents
  Example catalog refs: RNeasy Mini Kit (cat. 74104), QIAamp DNA Mini Kit (cat. 51304)
- Promega: promega.com — luciferase assays, cloning, cell viability
  Example catalog refs: CellTiter-Glo (cat. G7570), GoTaq qPCR (cat. A6001)
- IDT (Integrated DNA Technologies): idtdna.com — primers, gBlocks, CRISPR guides
  Example catalog refs: Custom primers ~$0.22/base, Alt-R Cas9 (cat. 1081058)
- ATCC: atcc.org — authenticated cell lines and microorganisms
  Example catalog refs: HeLa (ATCC CCL-2), HEK293 (ATCC CRL-1573)
- Addgene: addgene.org — plasmids and viral vectors
  Example: lentiCRISPRv2 (Addgene #52961)

SCIENTIFIC STANDARDS TO FOLLOW:
- For qPCR experiments: follow MIQE guidelines (Bustin et al. 2009, ncbi.nlm.nih.gov/pmc/articles/PMC2737408)
  → report primer efficiency, reference gene validation, melt curve analysis
- For cell viability: use at least two complementary assays (e.g. Trypan blue + MTT or CellTiter-Glo)
- For CRISPR: verify editing efficiency by Sanger sequencing + Tracking of Indels by Decomposition (TIDE) analysis
- Include n≥3 biological replicates minimum; state statistical test (t-test, ANOVA, Mann-Whitney)
- For animal studies: include ARRIVE 2.0 reporting checklist items in protocol

PROTOCOL REPOSITORY STANDARDS:
- Format protocol steps like protocols.io: numbered, specific, include instrument settings,
  volumes, concentrations, incubation times, and temperatures
- Each step should be independently executable (no ambiguous "as appropriate" instructions)
- Include safety notes for hazardous reagents (e.g. DMSO penetration, RNase-free conditions)
`.trim();

function buildPrompt(input: GenerationInput, strict = false): string {
  const jsonSchema = `
Return ONLY a raw JSON object with these exact top-level keys:
{
  "protocol": [
    // Array of 6-12 numbered strings. Each step must include:
    // - Specific volumes, concentrations, temperatures, and durations
    // - Instrument settings where relevant (e.g. centrifuge: 300×g, 5 min)
    // - Safety notes for hazardous materials
    // - Reference protocol repository source where applicable
    "Step text here..."
  ],
  "materials": [
    // Array of 8-15 items. Each object MUST have:
    {
      "item": "Full reagent/equipment name",
      "catalog": "Supplier catalog number (e.g. T9531, 74104, CCL-2)",
      "supplier": "Supplier name (Sigma-Aldrich, Thermo Fisher, QIAGEN, ATCC, etc.)",
      "estimatedCostUSD": 125.00  // realistic USD price as number, not string
    }
  ],
  "budget": [
    // Array of 4-7 line items. Each object:
    {
      "category": "Category name (e.g. Reagents & Consumables, Cell Lines, Equipment Rental, Personnel, Sequencing)",
      "amountUSD": 2500,  // number, realistic for academic lab
      "notes": "Justification and breakdown notes"
    }
  ],
  "timeline": [
    // Array of 4-8 phases with realistic week estimates
    {
      "phase": "Phase name",
      "duration": "e.g. Week 1–2 (2 weeks)",
      "dependencies": ["Prior phase name"]  // empty array if no dependency
    }
  ],
  "validation": [
    // Array of 4-6 specific, measurable success criteria
    // Each must include a numeric threshold (e.g. p < 0.05, ≥15% increase, CV < 20%)
    "Criterion text here..."
  ]
}`;

  const protocolSection =
    input.protocols.length > 0
      ? [
          "Matched protocol repository entries — ground the experiment steps in these:",
          input.protocols
            .map((p, i) => `  [P${i + 1}] "${p.title}" — ${p.source} — ${p.url}`)
            .join("\n"),
        ].join("\n")
      : "No direct protocol repository match found. Generate a detailed, step-by-step protocol following protocols.io and Bio-protocol conventions as described in SUPPLIER REFERENCES above.";

  const systemInstruction = strict
    ? "CRITICAL: Output ONLY valid raw JSON. No markdown, no prose, no code fences, no explanation. Start your response with { and end with }."
    : "You are AI Scientist. Output ONLY a valid JSON object — no markdown, no code fences, no explanation. Your output will be machine-parsed.";

  return [
    systemInstruction,
    "",
    "=== SCIENTIFIC HYPOTHESIS ===",
    input.hypothesis,
    "",
    `Novelty assessment: ${
      input.novelty === "exact"
        ? "EXACT MATCH — this experiment exists. Generate a plan that meaningfully extends it."
        : input.novelty === "similar"
        ? "SIMILAR WORK EXISTS — improve on prior methods with better controls or outcomes."
        : "NOVEL DIRECTION — no strong prior match. This is a first-of-kind experiment plan."
    }`,
    "",
    "=== PRIOR LITERATURE ===",
    input.references.length
      ? input.references
          .map((r, i) => `  ${i + 1}. ${r.title} (${r.source}${r.year ? `, ${r.year}` : ""})`)
          .join("\n")
      : "  No closely related literature found.",
    "",
    "=== PROTOCOL SOURCES ===",
    protocolSection,
    "",
    "=== RETRIEVED EVIDENCE ===",
    input.retrievedEvidence.length
      ? input.retrievedEvidence.map((e, i) => `  [${i + 1}] ${e}`).join("\n")
      : "  None",
    "",
    "=== SCIENTIST FEEDBACK (from prior similar experiments) ===",
    input.reviewExamples.length
      ? input.reviewExamples.join("\n")
      : "  None — generate a plan that would earn 5/5 from an expert PI.",
    "",
    "=== SUPPLIER & STANDARDS CONTEXT ===",
    SUPPLIER_CONTEXT,
    "",
    "=== OUTPUT SCHEMA ===",
    jsonSchema,
  ].join("\n");
}

/* ─── Main export ────────────────────────────────────────────── */

export async function generateExperimentPlan(input: GenerationInput): Promise<ExperimentPlan> {
  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey || apiKey.includes("your_")) {
    throw new Error("Ollama API key is missing. Set OLLAMA_API_KEY in your environment.");
  }

  const model = process.env.OLLAMA_MODEL || "gpt-oss:120b";
  const baseUrl = process.env.OLLAMA_BASE_URL || "https://ollama.com";

  const ollama = new Ollama({
    host: baseUrl,
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  async function attemptGeneration(strict: boolean): Promise<Partial<ExperimentPlan>> {
    const response = await ollama.chat({
      model,
      stream: false,
      format: "json",
      options: { temperature: strict ? 0.05 : 0.2 },
      messages: [
        {
          role: "system",
          content:
            "You are AI Scientist. Your only job is to output a valid JSON object — no markdown, no prose, no code fences, no commentary. Output the JSON object and nothing else.",
        },
        {
          role: "user",
          content: buildPrompt(input, strict),
        },
      ],
    });

    const rawText = response.message?.content ?? "";
    console.log(`[generate-plan] raw response (${rawText.length} chars, strict=${strict}):\n`, rawText.slice(0, 2000));

    const extracted = extractJsonObject(rawText);
    const parsed = safeJsonParse(extracted);

    if (!parsed) {
      console.warn("[generate-plan] JSON parse failed. Raw snippet:", rawText.slice(0, 500));
      throw new Error("JSON parse failed");
    }

    return normalizePlanShape(parsed);
  }

  let partial: Partial<ExperimentPlan>;

  try {
    partial = await attemptGeneration(false);
  } catch (firstErr) {
    const firstMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);

    if (/401|unauthorized/i.test(firstMsg)) {
      throw new Error(
        "Ollama authentication failed (401). Verify OLLAMA_API_KEY and OLLAMA_BASE_URL.",
      );
    }

    console.warn("[generate-plan] First attempt failed:", firstMsg, "— retrying with strict prompt…");

    try {
      partial = await attemptGeneration(true);
    } catch (secondErr) {
      const secondMsg = secondErr instanceof Error ? secondErr.message : String(secondErr);
      if (/401|unauthorized/i.test(secondMsg)) {
        throw new Error("Ollama authentication failed (401). Verify OLLAMA_API_KEY and OLLAMA_BASE_URL.");
      }
      throw new Error(`Ollama request failed after retry: ${secondMsg}`);
    }
  }

  // Apply fallbacks for any missing sections rather than throwing
  const withFallbacks = applyFallbacks(partial, input.hypothesis);

  return {
    ...withFallbacks,
    hypothesis: input.hypothesis,
    novelty: input.novelty,
    references: input.references,
    retrievedEvidence: input.retrievedEvidence,
  };
}
