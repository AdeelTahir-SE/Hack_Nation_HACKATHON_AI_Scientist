import { NextResponse } from "next/server";

import { ingestKnowledgeChunks } from "@/lib/rag";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      chunks?: Array<{ id?: string; text?: string; metadata?: Record<string, string> }>;
    };

    const chunks = (body.chunks || [])
      .filter((chunk) => chunk.id && chunk.text)
      .map((chunk) => ({
        id: String(chunk.id),
        text: String(chunk.text),
        metadata: chunk.metadata,
      }));

    if (!chunks.length) {
      return NextResponse.json({ error: "No valid chunks were provided." }, { status: 400 });
    }

    const inserted = ingestKnowledgeChunks(chunks);
    return NextResponse.json({ ok: true, inserted });
  } catch {
    return NextResponse.json({ error: "Failed to ingest chunks." }, { status: 500 });
  }
}
