import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

/**
 * Returns the current authenticated user's Supabase Auth UUID.
 * Use this in all API routes. Returns null if not signed in.
 */
export async function getCurrentProfileId(): Promise<string | null> {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

// Keep for backwards compat — same as getCurrentProfileId
export const getUserId = getCurrentProfileId;
