import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";
import type { BriefingPreferences } from "@/lib/briefing-preferences";

export const dynamic = "force-dynamic";

export async function GET() {
  const profileId = await getCurrentProfileId();
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("ui_preferences")
    .eq("user_id", profileId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const prefs = (data?.ui_preferences as Record<string, unknown> | null)?.briefingPreferences ?? null;
  return NextResponse.json({ preferences: prefs });
}

export async function PATCH(req: Request) {
  const profileId = await getCurrentProfileId();
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let preferences: BriefingPreferences | null = null;
  try {
    const body = await req.json();
    preferences = body.preferences ?? null;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("ui_preferences")
    .eq("user_id", profileId)
    .single();

  if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 });

  const prev = (existing?.ui_preferences ?? {}) as Record<string, unknown>;
  const next = { ...prev, briefingPreferences: preferences };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ ui_preferences: next })
    .eq("user_id", profileId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
