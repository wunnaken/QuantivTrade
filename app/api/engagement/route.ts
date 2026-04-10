import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerClient();
  const { data } = await supabase
    .from("user_engagement")
    .select("*")
    .eq("user_id", userId)
    .single();

  return NextResponse.json({ engagement: data ?? null });
}

export async function PATCH(request: NextRequest) {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const allowed = [
    "xp_from_trades", "xp_from_streak_days", "xp_from_posts", "xp_from_reactions",
    "login_streak", "journal_streak", "briefing_streak",
    "last_login", "last_journal", "last_briefing",
    "best_login_streak", "best_journal_streak", "best_briefing_streak",
    "login_history", "journal_history", "briefing_history",
  ];

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("user_engagement")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
