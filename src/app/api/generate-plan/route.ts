import { NextResponse } from "next/server";

import { getReviewExamples } from "@/lib/feedback";
import { generateExperimentPlan } from "@/lib/gemini";
import { searchLiterature } from "@/lib/literature";
import { ingestKnowledgeChunks, retrieveEvidence } from "@/lib/rag";
import type { LiteratureReference, NoveltySignal, ProtocolReference } from "@/types/plan";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      hypothesis?: string;
      literature?: {
        novelty: NoveltySignal;
        references: LiteratureReference[];
        protocols: ProtocolReference[];
      };
    };
    const hypothesis = body.hypothesis?.trim();

    if (!hypothesis) {
      return NextResponse.json({ error: "Hypothesis is required." }, { status: 400 });
    }

    const literature = body.literature || (await searchLiterature(hypothesis));

    if (literature.references.length) {
      ingestKnowledgeChunks(
        literature.references.map((ref, index) => ({
          id: `${ref.source}-${index}-${ref.title.slice(0, 30)}`,
          text: `${ref.title}. Source: ${ref.source}. URL: ${ref.url}`,
          metadata: { source: ref.source, domain: "literature", title: ref.title },
        })),
      );
    }

    // Also ingest protocol references into the knowledge base
    if (literature.protocols?.length) {
      ingestKnowledgeChunks(
        literature.protocols.map((p, index) => ({
          id: `protocol-${index}-${p.title.slice(0, 30)}`,
          text: `Protocol: ${p.title}. Repository: ${p.source}. URL: ${p.url}`,
          metadata: { source: p.source, domain: "protocol", title: p.title },
        })),
      );
    }

    const [reviewExamples, retrievedEvidence] = await Promise.all([
      getReviewExamples(hypothesis),
      Promise.resolve(
        retrieveEvidence(
          `${hypothesis}\n${literature.references.map((r) => r.title).join("\n")}\n${(literature.protocols || []).map((p) => p.title).join("\n")}`,
          5,
        )
      ),
    ]);

    const plan = await generateExperimentPlan({
      hypothesis,
      novelty: literature.novelty,
      references: literature.references,
      protocols: literature.protocols || [],
      retrievedEvidence,
      reviewExamples,
    });

    return NextResponse.json({
      ...plan,
      protocols: literature.protocols || [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate experiment plan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
