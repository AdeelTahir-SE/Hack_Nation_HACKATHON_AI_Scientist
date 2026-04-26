import { Ollama } from "ollama";

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

function toText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
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

    // Prefer a currency value written with thousands separators (e.g. $30,000)
    const preferredMoney = text.match(/\$\s*\d{1,3}(?:,\d{3})+(?:\.\d+)?/);
    if (preferredMoney?.[0]) return parseCandidateToNumber(preferredMoney[0]);

    // Then fallback to simple dollar amounts (e.g. $1200)
    const plainMoney = text.match(/\$\s*\d+(?:\.\d+)?/);
    if (plainMoney?.[0]) return parseCandidateToNumber(plainMoney[0]);

    // Finally use the first generic number token
    const generic = text.match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/);
    if (generic?.[0]) return parseCandidateToNumber(generic[0]);
  }

  return null;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => toText(item))
      .filter(Boolean)
      .map((item) => item.replace(/^[-*\d.)\s]+/, "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const numbered = value
      .split(/\s(?=\d+\.\s)/)
      .map((item) => item.replace(/^\d+\.\s*/, "").trim())
      .filter(Boolean);

    if (numbered.length > 1) return numbered;

    return value
      .split(/\n|;/)
      .map((item) => item.replace(/^[-*\d.)\s]+/, "").trim())
      .filter(Boolean);
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => `${key}: ${toText(val)}`.trim())
      .filter((item) => item !== ":");
  }

  return [];
}

function normalizeMaterials(value: unknown): ExperimentPlan["materials"] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return {
            item: item.trim(),
            catalog: "N/A",
            supplier: "N/A",
            estimatedCostUSD: toNullableNumber(item),
          };
        }

        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;

        return {
          item: toText(row.item || row.name || row.material),
          catalog: toText(row.catalog || row.catalogNumber || row.catalog_no || row.sku) || "N/A",
          supplier: toText(row.supplier || row.vendor || row.company) || "N/A",
          estimatedCostUSD: toNullableNumber(
            row.estimatedCostUSD || row.estimated_cost_usd || row.cost || row.price,
          ),
        };
      })
      .filter((item): item is ExperimentPlan["materials"][number] => Boolean(item?.item));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => ({
        item: key,
        catalog: "N/A",
        supplier: "N/A",
        estimatedCostUSD: toNullableNumber(val),
      }))
      .filter((item) => Boolean(item.item));
  }

  return [];
}

function normalizeBudget(value: unknown): ExperimentPlan["budget"] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;

        return {
          category: toText(row.category || row.type || row.name),
          amountUSD:
            toNullableNumber(row.amountUSD || row.amount || row.cost || row.value) || 0,
          notes: toText(row.notes || row.note || row.description),
        };
      })
      .filter((item): item is ExperimentPlan["budget"][number] => Boolean(item?.category));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => ({
        category: key,
        amountUSD: toNullableNumber(val) || 0,
        notes: typeof val === "string" ? val : "",
      }))
      .filter((item) => Boolean(item.category));
  }

  return [];
}

function normalizeTimeline(value: unknown): ExperimentPlan["timeline"] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;

        return {
          phase: toText(row.phase || row.stage || row.step),
          duration: toText(row.duration || row.time || row.eta),
          dependencies: normalizeStringArray(row.dependencies || row.dependsOn || row.depends_on),
        };
      })
      .filter((item): item is ExperimentPlan["timeline"][number] => Boolean(item?.phase));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => ({
        phase: key,
        duration: toText(val),
        dependencies: [],
      }))
      .filter((item) => Boolean(item.phase));
  }

  return [];
}

function normalizePlanShape(raw: unknown): Partial<ExperimentPlan> | null {
  if (!raw || typeof raw !== "object") return null;

  const root = raw as Record<string, unknown>;
  const planLike =
    root.plan && typeof root.plan === "object"
      ? (root.plan as Record<string, unknown>)
      : root;

  return {
    protocol: normalizeStringArray(planLike.protocol || planLike.methodology || planLike.steps),
    validation: normalizeStringArray(planLike.validation || planLike.successCriteria),
    materials: normalizeMaterials(planLike.materials || planLike.reagents),
    budget: normalizeBudget(planLike.budget || planLike.costs),
    timeline: normalizeTimeline(planLike.timeline || planLike.phases),
  };
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return trimmed.slice(first, last + 1);
  }

  return trimmed;
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
        (typeof item.estimatedCostUSD === "number" || item.estimatedCostUSD === null),
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
  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey || apiKey.includes("your_")) {
    throw new Error(
      "Ollama API key is missing. Set OLLAMA_API_KEY in your environment.",
    );
  }

  const model = process.env.OLLAMA_MODEL || "gpt-oss:120b";
  const baseUrl = process.env.OLLAMA_BASE_URL || "https://ollama.com";

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

  const ollama = new Ollama({
    host: baseUrl,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  let rawText = "";

  try {
    const response = await ollama.chat({
      model,
      stream: false,
      format: "json",
      options: {
        temperature: 0.2,
      },
      messages: [
        {
          role: "system",
          content:
            "You are AI Scientist. Output valid JSON only with keys: protocol, materials, budget, timeline, validation.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    rawText = response.message?.content || "";
    console.log(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Ollama error";
    if (/401|unauthorized/i.test(message)) {
      throw new Error(
        "Ollama authentication failed (401). Verify OLLAMA_API_KEY is valid for Ollama Cloud and OLLAMA_BASE_URL is https://ollama.com.",
      );
    }
    console.log(error)

    throw new Error(`Ollama request failed: ${message}`);
  }

  const parsed = normalizePlanShape(
    safeJsonParse(extractJsonObject(rawText)),
  );

  if (!validatePlanShape(parsed)) {
    throw new Error(
      `Ollama ${model} response could not be parsed into a valid experiment plan schema.`,
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
