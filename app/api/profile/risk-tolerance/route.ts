import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const VALID = ["conservative", "moderate", "aggressive"] as const;
type RiskTolerance = (typeof VALID)[number];

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

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
  return NextResponse.json({ risk_tolerance: prefs.risk_tolerance ?? "moderate" });
}

export async function PATCH(request: NextRequest) {
  const profileId = await getCurrentProfileId();
  if (!profileId) return bad("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const value = body?.risk_tolerance as RiskTolerance | undefined;
  if (!value || !VALID.includes(value)) return bad("Invalid risk_tolerance value");

  const supabase = createServerClient();
  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("ui_preferences")
    .eq("user_id", profileId)
    .single();

  if (selectError) return bad(selectError.message, 500);

  const prevPrefs = (existing?.ui_preferences ?? {}) as Record<string, unknown>;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ ui_preferences: { ...prevPrefs, risk_tolerance: value } })
    .eq("user_id", profileId);

  if (updateError) return bad(updateError.message, 500);

  return NextResponse.json({ ok: true });
}
