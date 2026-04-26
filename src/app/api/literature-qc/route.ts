import { NextResponse } from "next/server";

import { searchLiterature } from "@/lib/literature";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { hypothesis?: string };
    const hypothesis = body.hypothesis?.trim();

    if (!hypothesis) {
      return NextResponse.json({ error: "Hypothesis is required." }, { status: 400 });
    }

    const result = await searchLiterature(hypothesis);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to run literature quality control." },
      { status: 500 },
    );
  }
}
