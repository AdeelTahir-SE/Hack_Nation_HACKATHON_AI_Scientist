/**
 * feedback.ts — Supabase-backed scientist review store
 *
 * Replaces the previous in-memory globalThis store.
 * Reviews now persist across server restarts, Vercel deployments,
 * and multiple team members — enabling the real compounding improvement loop.
 *
 * Table: public.reviews
 *   id          BIGSERIAL PRIMARY KEY
 *   hypothesis  TEXT NOT NULL
 *   score       SMALLINT NOT NULL (1–5)
 *   comments    TEXT DEFAULT ''
 *   created_at  TIMESTAMPTZ DEFAULT NOW()
 *
 * See supabase_setup.sql for the full table + RLS policy setup.
 */

import { getSupabase } from "@/lib/supabase";
import type { ReviewPayload } from "@/types/plan";

/* ── Types ─────────────────────────────────────────────────── */

export type StoredReview = ReviewPayload & {
  id: number;
  created_at: string;
};

/* ── Save a review ─────────────────────────────────────────── */

export async function saveReview(review: ReviewPayload): Promise<StoredReview> {
  const { data, error } = await getSupabase()
    .from("reviews")
    .insert({
      hypothesis: review.hypothesis.trim(),
      score: review.score,
      comments: review.comments?.trim() ?? "",
    })
    .select()
    .single();

  if (error) {
    console.error("[feedback] saveReview error:", error.message);
    throw new Error(`Failed to save review: ${error.message}`);
  }

  return data as StoredReview;
}

/* ── Get few-shot examples for a hypothesis ────────────────── */
/**
 * Finds the most recent reviews whose hypothesis shares keyword tokens
 * with the current hypothesis, then formats them as few-shot prompt blocks.
 *
 * Matching strategy:
 *   - Tokenise the inbound hypothesis into lowercased words (>3 chars)
 *   - Pull the last `poolSize` reviews from Supabase ordered by recency
 *   - Filter in JS for token overlap (fast enough at small scale)
 *   - Return the last `limit` matching reviews as formatted strings
 *
 * This gives the LLM direct expert corrections as named context, e.g.:
 *   "Review score 3/5: Protocol: centrifuge 400×g not 300×g | Timeline: 72h"
 */
export async function getReviewExamples(
  hypothesis: string,
  limit = 3,
  poolSize = 50,
): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("reviews")
    .select("hypothesis, score, comments, created_at")
    .order("created_at", { ascending: false })
    .limit(poolSize);

  if (error) {
    console.error("[feedback] getReviewExamples error:", error.message);
    return []; // degrade gracefully — don't break generation
  }

  if (!data || data.length === 0) return [];

  // Tokenise the current hypothesis for keyword matching
  const queryTokens = new Set(
    hypothesis
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 3),
  );

  const matched = (data as StoredReview[])
    .filter((review) => {
      const reviewTokens = review.hypothesis
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/);
      return reviewTokens.some((t) => queryTokens.has(t));
    })
    .slice(0, limit);

  return matched.map(
    (r) =>
      `Review score ${r.score}/5: ${r.comments || "No corrections provided."}`,
  );
}
