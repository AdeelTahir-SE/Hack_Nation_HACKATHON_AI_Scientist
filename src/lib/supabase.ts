/**
 * supabase.ts — Lazy singleton Supabase client
 *
 * Uses a lazy getter so the client is only constructed when first called.
 * This prevents Next.js from crashing at module load time if the env vars
 * are not set (e.g. during build or cold-start before .env is loaded).
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "[supabase] Missing env vars. Add NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file.\n" +
        "Run supabase_setup.sql in your Supabase SQL Editor first.",
    );
  }

  _client = createClient(url, key);
  return _client;
}
