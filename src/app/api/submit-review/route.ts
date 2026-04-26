import { NextResponse } from "next/server";

import { saveReview } from "@/lib/feedback";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      hypothesis?: string;
      score?: number;
      comments?: string;
    };

    const hypothesis = body.hypothesis?.trim();
    const score = Number(body.score);

    if (!hypothesis || Number.isNaN(score) || score < 1 || score > 5) {
      return NextResponse.json(
        { error: "Valid hypothesis and score (1-5) are required." },
        { status: 400 },
      );
    }

    const stored = saveReview({
      hypothesis,
      score,
      comments: body.comments?.trim(),
    });

    return NextResponse.json({ ok: true, review: stored });
  } catch {
    return NextResponse.json({ error: "Failed to save review." }, { status: 500 });
  }
}
