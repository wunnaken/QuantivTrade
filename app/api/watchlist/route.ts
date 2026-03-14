import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export type WatchlistItemRow = {
  id: string;
  user_id: string;
  ticker: string;
  name: string | null;
  created_at: string | null;
};

export async function GET() {
  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("watchlist")
    .select("id, ticker, name, created_at")
    .eq("user_id", profileId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[watchlist] GET error:", error);
    return NextResponse.json({ error: "Failed to load watchlist" }, { status: 500 });
  }

  const items = (data || []).map((row) => ({
    ticker: row.ticker,
    name: row.name ?? undefined,
  }));
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { ticker: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ticker = String(body.ticker || "").trim().toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { error } = await supabase.from("watchlist").insert({
    user_id: profileId,
    ticker,
    name: body.name?.trim() || null,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already in watchlist" }, { status: 409 });
    }
    console.error("[watchlist] POST error:", error);
    return NextResponse.json({ error: "Failed to add to watchlist" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ticker = request.nextUrl.searchParams.get("ticker")?.trim().toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("watchlist")
    .delete()
    .eq("user_id", profileId)
    .eq("ticker", ticker);

  if (error) {
    console.error("[watchlist] DELETE error:", error);
    return NextResponse.json({ error: "Failed to remove from watchlist" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
