import { NextResponse } from "next/server";

import { getReviewExamples } from "@/lib/feedback";
import { generateExperimentPlan } from "@/lib/gemini";
import { searchLiterature } from "@/lib/literature";
import { ingestKnowledgeChunks, retrieveEvidence } from "@/lib/rag";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { hypothesis?: string };
    const hypothesis = body.hypothesis?.trim();

    if (!hypothesis) {
      return NextResponse.json({ error: "Hypothesis is required." }, { status: 400 });
    }

    const literature = await searchLiterature(hypothesis);

    if (literature.references.length) {
      ingestKnowledgeChunks(
        literature.references.map((ref, index) => ({
          id: `${ref.source}-${index}-${ref.title.slice(0, 30)}`,
          text: `${ref.title}. Source: ${ref.source}. URL: ${ref.url}`,
          metadata: {
            source: ref.source,
            domain: "literature",
            title: ref.title,
          },
        })),
      );
    }

    const reviewExamples = getReviewExamples(hypothesis);
    const retrievedEvidence = retrieveEvidence(
      `${hypothesis}\n${literature.references.map((ref) => ref.title).join("\n")}`,
      4,
    );

    const plan = await generateExperimentPlan({
      hypothesis,
      novelty: literature.novelty,
      references: literature.references,
      retrievedEvidence,
      reviewExamples,
    });

    return NextResponse.json(plan);
  } catch {
    return NextResponse.json({ error: "Failed to generate experiment plan." }, { status: 500 });
  }
}
