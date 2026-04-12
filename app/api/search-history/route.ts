import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const MAX = 4;

async function getPrefs(supabase: ReturnType<typeof createServerClient>, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("ui_preferences")
    .eq("user_id", userId)
    .single();
  return (data?.ui_preferences as Record<string, unknown>) ?? {};
}

async function savePrefs(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  prefs: Record<string, unknown>,
  queries: string[],
) {
  const { error } = await supabase
    .from("profiles")
    .update({ ui_preferences: { ...prefs, recent_searches: queries } })
    .eq("user_id", userId);
  return error;
}

export async function GET() {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ queries: [] });

  const supabase = createServerClient();
  const prefs = await getPrefs(supabase, userId);
  const queries = Array.isArray(prefs.recent_searches) ? (prefs.recent_searches as string[]) : [];
  return NextResponse.json({ queries });
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ ok: false });

  const body = await req.json() as { query?: string };
  const query = body.query?.trim();
  if (!query) return NextResponse.json({ ok: false });

  const supabase = createServerClient();
  const prefs = await getPrefs(supabase, userId);
  const existing: string[] = Array.isArray(prefs.recent_searches) ? (prefs.recent_searches as string[]) : [];
  const updated = [query, ...existing.filter((q) => q !== query)].slice(0, MAX);

  const error = await savePrefs(supabase, userId, prefs, updated);
  if (error) return NextResponse.json({ ok: false }, { status: 500 });

  return NextResponse.json({ ok: true, queries: updated });
}

// Uses query param ?q= to avoid body-parsing issues with DELETE
export async function DELETE(req: NextRequest) {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ ok: false });

  const query = req.nextUrl.searchParams.get("q")?.trim();
  if (!query) return NextResponse.json({ ok: false });

  const supabase = createServerClient();
  const prefs = await getPrefs(supabase, userId);
  const existing: string[] = Array.isArray(prefs.recent_searches) ? (prefs.recent_searches as string[]) : [];
  const updated = existing.filter((q) => q !== query);

  const error = await savePrefs(supabase, userId, prefs, updated);
  if (error) return NextResponse.json({ ok: false }, { status: 500 });

  return NextResponse.json({ ok: true, queries: updated });
}
