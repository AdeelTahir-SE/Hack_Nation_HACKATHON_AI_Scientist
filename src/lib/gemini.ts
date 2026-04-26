import type { ExperimentPlan, LiteratureReference, NoveltySignal } from "@/types/plan";

type GenerationInput = {
  hypothesis: string;
  novelty: NoveltySignal;
  references: LiteratureReference[];
  retrievedEvidence: string[];
  reviewExamples: string[];
};

function safeJsonParse(text: string): Partial<ExperimentPlan> | null {
  try {
    return JSON.parse(text) as Partial<ExperimentPlan>;
  } catch {
    return null;
  }
}

function buildFallbackPlan(input: GenerationInput): ExperimentPlan {
  const materials = [
    {
      item: "Primary assay kit",
      catalog: "KIT-001",
      supplier: "Thermo Fisher",
      estimatedCostUSD: 320,
    },
    {
      item: "Control reagent set",
      catalog: "CR-104",
      supplier: "Sigma-Aldrich",
      estimatedCostUSD: 180,
    },
    {
      item: "Consumables",
      catalog: "LAB-GEN",
      supplier: "VWR",
      estimatedCostUSD: 150,
    },
  ];

  return {
    hypothesis: input.hypothesis,
    novelty: input.novelty,
    references: input.references,
    retrievedEvidence: input.retrievedEvidence,
    protocol: [
      "Define treatment and control groups with random allocation and inclusion criteria.",
      "Run a pilot with n=3 replicates per arm to validate assay dynamic range.",
      "Execute full experiment with fixed incubation and sampling windows.",
      "Record reagent lots, temperature logs, and operator notes at each step.",
      "Analyze primary endpoint against predefined success threshold and controls.",
    ],
    materials,
    budget: [
      { category: "Reagents", amountUSD: 650, notes: "Core assay and controls" },
      { category: "Labor", amountUSD: 900, notes: "Two technicians over 2 weeks" },
      { category: "QC and repeats", amountUSD: 250, notes: "Contingency for reruns" },
    ],
    timeline: [
      { phase: "Setup and calibration", duration: "2 days", dependencies: [] },
      { phase: "Pilot run", duration: "3 days", dependencies: ["Setup and calibration"] },
      { phase: "Main execution", duration: "1 week", dependencies: ["Pilot run"] },
      { phase: "Analysis and validation", duration: "3 days", dependencies: ["Main execution"] },
    ],
    validation: [
      "Primary metric must exceed predefined threshold versus control.",
      "Technical replicate CV should be below 15 percent.",
      "Effect size and confidence intervals must agree with pilot trend.",
    ],
  };
}

function mergePlan(
  generated: Partial<ExperimentPlan> | null,
  fallback: ExperimentPlan,
): ExperimentPlan {
  if (!generated) return fallback;

  return {
    ...fallback,
    ...generated,
    hypothesis: fallback.hypothesis,
    novelty: fallback.novelty,
    references: fallback.references,
    retrievedEvidence: fallback.retrievedEvidence,
    protocol: generated.protocol?.length ? generated.protocol : fallback.protocol,
    materials: generated.materials?.length ? generated.materials : fallback.materials,
    budget: generated.budget?.length ? generated.budget : fallback.budget,
    timeline: generated.timeline?.length ? generated.timeline : fallback.timeline,
    validation: generated.validation?.length ? generated.validation : fallback.validation,
  };
}

export async function generateExperimentPlan(input: GenerationInput): Promise<ExperimentPlan> {
  const fallback = buildFallbackPlan(input);

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey.includes("your_")) {
    return fallback;
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const prompt = [
    "You are AI Scientist. Return strict JSON only.",
    "Build a practical experiment plan grounded in provided evidence.",
    "JSON keys required: protocol, materials, budget, timeline, validation.",
    "Hypothesis:",
    input.hypothesis,
    "Novelty:",
    input.novelty,
    "References:",
    JSON.stringify(input.references),
    "Retrieved evidence:",
    JSON.stringify(input.retrievedEvidence),
    "Scientist feedback examples:",
    JSON.stringify(input.reviewExamples),
  ].join("\n");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    return fallback;
  }

  const json = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const parsed = safeJsonParse(rawText);

  return mergePlan(parsed, fallback);
}
