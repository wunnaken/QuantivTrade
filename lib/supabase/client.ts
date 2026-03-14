import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * Supabase client for use in React components (browser).
 * Uses anon key — row-level security (RLS) applies.
 */
export function createClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.");
  }

  if (typeof window !== "undefined" && browserClient) {
    return browserClient;
  }

  const client = createSupabaseClient(url, anonKey);
  if (typeof window !== "undefined") browserClient = client;
  return client;
}
