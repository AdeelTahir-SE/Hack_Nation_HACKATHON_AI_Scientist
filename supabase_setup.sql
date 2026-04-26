-- ============================================================
-- AI Scientist — Supabase Setup
-- Paste this entire file into: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Reviews table
--    Stores every scientist review submitted via /api/submit-review
--    Used by getReviewExamples() to inject few-shot corrections into
--    the next Ollama generation prompt for similar hypotheses.

CREATE TABLE IF NOT EXISTS public.reviews (
  id          BIGSERIAL PRIMARY KEY,
  hypothesis  TEXT        NOT NULL,         -- full hypothesis text submitted
  score       SMALLINT    NOT NULL           -- 1–5 star rating
                CHECK (score >= 1 AND score <= 5),
  comments    TEXT        DEFAULT '',        -- merged section corrections + general notes
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Index for fast recency-ordered lookups (most reviews are fetched
--    as "last N matching reviews")
CREATE INDEX IF NOT EXISTS reviews_created_at_idx
  ON public.reviews (created_at DESC);

-- 3. Full-text search index on hypothesis for faster token matching
--    (used by getReviewExamples keyword filter)
CREATE INDEX IF NOT EXISTS reviews_hypothesis_gin_idx
  ON public.reviews USING GIN (to_tsvector('english', hypothesis));

-- 4. Row Level Security (RLS)
--    Enable RLS so the anon key can only INSERT and SELECT,
--    never UPDATE or DELETE. This protects the feedback store.

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Allow anyone with the anon key to insert a review
CREATE POLICY "allow_insert_reviews"
  ON public.reviews
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anyone with the anon key to read reviews
--   (needed so getReviewExamples can retrieve matching feedback)
CREATE POLICY "allow_select_reviews"
  ON public.reviews
  FOR SELECT
  TO anon
  USING (true);

-- 5. Verify — run this SELECT after setup to confirm the table exists
-- SELECT id, LEFT(hypothesis, 60) AS hyp, score, created_at
-- FROM public.reviews
-- ORDER BY created_at DESC
-- LIMIT 10;

-- ============================================================
-- That's it. Add these to your .env.local:
--
--   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
--   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
--
-- Both values are in: Supabase Dashboard → Settings → API
-- ============================================================
