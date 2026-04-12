import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function generateKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `qt_${hex}`;
}

// GET — return existing key (or null if none)
export async function GET() {
  const profileId = await getCurrentProfileId();
  if (!profileId) return bad("Unauthorized", 401);

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("ui_preferences")
    .eq("user_id", profileId)
    .single();

  if (error) return bad(error.message, 500);

  const prefs = (data?.ui_preferences ?? {}) as Record<string, unknown>;
  return NextResponse.json({ key: prefs.api_key ?? null });
}

// POST — generate or regenerate key
export async function POST() {
  const profileId = await getCurrentProfileId();
  if (!profileId) return bad("Unauthorized", 401);

  const supabase = createServerClient();
  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("ui_preferences")
    .eq("user_id", profileId)
    .single();

  if (selectError) return bad(selectError.message, 500);

  const prevPrefs = (existing?.ui_preferences ?? {}) as Record<string, unknown>;
  const newKey = generateKey();

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ ui_preferences: { ...prevPrefs, api_key: newKey } })
    .eq("user_id", profileId);

  if (updateError) return bad(updateError.message, 500);

  return NextResponse.json({ key: newKey });
}
