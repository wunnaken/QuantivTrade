import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export type ProfileRow = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function GET() {
  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", profileId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json(data as ProfileRow);
}

export async function PATCH(request: NextRequest) {
  const profileId = await getCurrentProfileId();
  if (!profileId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json() as {
    bubble_ids?: string[];
    xp_total?: number;
    name?: string;
    username?: string;
    bio?: string | null;
    avatar_url?: string | null;
  };

  const supabase = createServerClient();

  // Handle profile field updates (name, username, bio, avatar_url)
  const profileUpdates: Record<string, unknown> = {};
  if (typeof body.name === "string") profileUpdates.name = body.name;
  if (typeof body.username === "string") profileUpdates.username = body.username;
  if ("bio" in body) profileUpdates.bio = body.bio ?? null;
  if ("avatar_url" in body) profileUpdates.avatar_url = body.avatar_url ?? null;

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await supabase.from("profiles").update(profileUpdates).eq("user_id", profileId);
    if (error) {
      console.error("[profile/me PATCH] profile update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Handle ui_preferences updates (bubble_ids, xp_total)
  if ("bubble_ids" in body || "xp_total" in body) {
    const { data: current } = await supabase
      .from("profiles")
      .select("ui_preferences")
      .eq("user_id", profileId)
      .single();

    const currentPrefs = (current?.ui_preferences as Record<string, unknown>) ?? {};
    const nextPrefs: Record<string, unknown> = { ...currentPrefs };

    if (Array.isArray(body.bubble_ids)) nextPrefs.bubble_ids = body.bubble_ids;
    if (typeof body.xp_total === "number") nextPrefs.xp_total = body.xp_total;

    await supabase.from("profiles").update({ ui_preferences: nextPrefs }).eq("user_id", profileId);
  }

  return NextResponse.json({ ok: true });
}
