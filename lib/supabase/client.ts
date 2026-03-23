import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * Supabase client for use in React components (browser).
 * Uses @supabase/ssr so the session is stored in cookies,
 * making it visible to server-side Route Handlers and the proxy.
 */
export function createClient(): SupabaseClient {
  if (typeof window !== "undefined" && browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.");
  }

  const client = createBrowserClient(url, anonKey);
  if (typeof window !== "undefined") browserClient = client;
  return client;
}
