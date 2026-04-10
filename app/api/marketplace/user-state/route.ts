import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** GET /api/marketplace/user-state
 *  Returns disc_dismissed flag + all per-listing states for this user.
 */
export async function GET() {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerClient();

  const [prefsResult, statesResult] = await Promise.all([
    supabase.from("profiles").select("ui_preferences").eq("user_id", userId).single(),
    supabase.from("marketplace_user_state").select("*").eq("user_id", userId),
  ]);

  const prefs = (prefsResult.data?.ui_preferences ?? {}) as Record<string, unknown>;
  const discDismissed = !!prefs.mp_disc_dismissed;

  const byListing: Record<string, { ack_at: string | null; defer_at: string | null; titles: unknown[] }> = {};
  for (const row of statesResult.data ?? []) {
    byListing[row.listing_id] = {
      ack_at: row.ack_at ?? null,
      defer_at: row.defer_at ?? null,
      titles: Array.isArray(row.titles) ? row.titles : [],
    };
  }

  return NextResponse.json({ discDismissed, byListing });
}

/** PATCH /api/marketplace/user-state
 *  Update one or more fields. All fields are optional.
 */
export async function PATCH(request: NextRequest) {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    disc_dismissed?: boolean;
    listing_id?: string;
    ack_at?: string;
    defer_at?: string | null;
    titles?: unknown[];
  } | null;

  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const supabase = createServerClient();

  // Update global disclaimer dismissed flag in ui_preferences
  if (body.disc_dismissed !== undefined) {
    const { data: current } = await supabase
      .from("profiles")
      .select("ui_preferences")
      .eq("user_id", userId)
      .single();
    const prefs = ((current?.ui_preferences ?? {}) as Record<string, unknown>);
    await supabase.from("profiles").update({
      ui_preferences: { ...prefs, mp_disc_dismissed: body.disc_dismissed },
    }).eq("user_id", userId);
  }

  // Update per-listing state
  if (body.listing_id) {
    const patch: Record<string, unknown> = { user_id: userId, listing_id: body.listing_id };
    if (body.ack_at !== undefined) patch.ack_at = body.ack_at;
    if (body.defer_at !== undefined) patch.defer_at = body.defer_at;
    if (body.titles !== undefined) patch.titles = body.titles;

    await supabase
      .from("marketplace_user_state")
      .upsert(patch, { onConflict: "user_id,listing_id" });
  }

  return NextResponse.json({ ok: true });
}
