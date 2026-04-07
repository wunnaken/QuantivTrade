import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Store on globalThis so HMR module re-evaluation doesn't create a second client
const g = globalThis as typeof globalThis & { __supabaseBrowserClient?: SupabaseClient };

/**
 * Supabase client for use in React components (browser).
 * Uses @supabase/ssr so the session is stored in cookies,
 * making it visible to server-side Route Handlers and the proxy.
 */
export function createClient(): SupabaseClient {
  if (typeof window === "undefined") {
    // SSR context — create a fresh client (no singleton needed server-side)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createBrowserClient(url, anonKey);
  }

  if (!g.__supabaseBrowserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.");
    }
    g.__supabaseBrowserClient = createBrowserClient(url, anonKey);
  }

  return g.__supabaseBrowserClient;
}
