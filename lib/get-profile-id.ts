import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns the current user's bigint profile id from the profiles table.
 * The rooms/trade-call tables reference profiles.id (bigint), not the auth UUID.
 */
export async function getProfileId(supabase: SupabaseClient): Promise<number | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();
  return (data?.id as number) ?? null;
}

/**
 * Returns both the bigint profile id and basic profile info.
 */
export async function getProfileInfo(supabase: SupabaseClient): Promise<{
  id: number;
  username: string | null;
  name: string | null;
} | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, username, name")
    .eq("user_id", user.id)
    .single();
  if (!data?.id) return null;
  return { id: data.id as number, username: data.username as string | null, name: data.name as string | null };
}
