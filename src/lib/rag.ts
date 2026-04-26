import { searchSimilar, upsertDocuments, vectorStoreSize } from "@/lib/vectorstore";

const baselineKnowledge = [
  "Use randomized assignment with explicit control arms to reduce confounding.",
  "Include at least three biological replicates and predefine exclusion criteria.",
  "Quantify uncertainty using confidence intervals and effect sizes, not only p-values.",
  "Capture reagent lot numbers and storage conditions for reproducibility.",
];

let seeded = false;

function seedVectorStore() {
  if (seeded || vectorStoreSize() > 0) return;

  upsertDocuments(
    baselineKnowledge.map((text, index) => ({
      id: `baseline-${index + 1}`,
      text,
      metadata: { source: "internal-guidance", domain: "general" },
    })),
  );

  seeded = true;
}

export function ingestKnowledgeChunks(
  chunks: Array<{ id: string; text: string; metadata?: Record<string, string> }>,
): number {
  seedVectorStore();
  return upsertDocuments(chunks);
}

export function retrieveEvidence(query: string, topK = 4): string[] {
  seedVectorStore();
  const results = searchSimilar(query, topK);

  if (!results.length) {
    return [
      "No vector evidence retrieved; use conservative protocol defaults and include pilot phase.",
    ];
  }

  return results.map((result) => result.text);
}
