import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { AUTH_EMAIL_COOKIE, AUTH_NAME_COOKIE } from "./auth-cookie";

export type SessionUser = { email: string; name: string };

/**
 * Reads the current demo-auth user from cookies (set by client on sign-in).
 * Returns null if not logged in. Used by API routes to resolve profile id.
 */
export async function getSessionFromCookies(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const email = cookieStore.get(AUTH_EMAIL_COOKIE)?.value;
  const name = cookieStore.get(AUTH_NAME_COOKIE)?.value;
  if (!email) return null;
  return {
    email: decodeURIComponent(email),
    name: name ? decodeURIComponent(name) : "Trader",
  };
}

/**
 * Returns the current user's profile id (uuid). Gets or creates profile by session email.
 * Returns null if not authenticated.
 */
export async function getCurrentProfileId(): Promise<string | null> {
  const session = await getSessionFromCookies();
  if (!session) return null;

  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", session.email)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: inserted, error } = await supabase
    .from("profiles")
    .insert({
      email: session.email,
      name: session.name || "Trader",
      joined_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !inserted) return null;
  return inserted.id;
}
