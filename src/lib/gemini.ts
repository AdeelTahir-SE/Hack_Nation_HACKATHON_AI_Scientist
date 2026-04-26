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

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string");
}

function validatePlanShape(generated: Partial<ExperimentPlan> | null): generated is ExperimentPlan {
  if (!generated) return false;

  if (!isNonEmptyStringArray(generated.protocol)) return false;
  if (!isNonEmptyStringArray(generated.validation)) return false;

  const materialsValid =
    Array.isArray(generated.materials) &&
    generated.materials.length > 0 &&
    generated.materials.every(
      (item) =>
        typeof item.item === "string" &&
        typeof item.catalog === "string" &&
        typeof item.supplier === "string" &&
        typeof item.estimatedCostUSD === "number",
    );

  const budgetValid =
    Array.isArray(generated.budget) &&
    generated.budget.length > 0 &&
    generated.budget.every(
      (item) =>
        typeof item.category === "string" &&
        typeof item.amountUSD === "number" &&
        typeof item.notes === "string",
    );

  const timelineValid =
    Array.isArray(generated.timeline) &&
    generated.timeline.length > 0 &&
    generated.timeline.every(
      (item) =>
        typeof item.phase === "string" &&
        typeof item.duration === "string" &&
        Array.isArray(item.dependencies),
    );

  return materialsValid && budgetValid && timelineValid;
}

export async function generateExperimentPlan(input: GenerationInput): Promise<ExperimentPlan> {

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey.includes("your_")) {
    throw new Error(
      "Gemini API key is missing. Set GEMINI_API_KEY or GOOGLE_API_KEY in your environment.",
    );
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
    const details = await res.text();
    throw new Error(`Gemini request failed (${res.status}): ${details.slice(0, 240)}`);
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

  if (!validatePlanShape(parsed)) {
    throw new Error(
      "Gemini response could not be parsed into a valid experiment plan schema.",
    );
  }

  return {
    ...parsed,
    hypothesis: input.hypothesis,
    novelty: input.novelty,
    references: input.references,
    retrievedEvidence: input.retrievedEvidence,
  };
}
