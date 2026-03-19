import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/api-auth";

export type WatchlistItemRow = {
  id: string;
  user_id: string;
  ticker: string;
  name: string | null;
  created_at: string | null;
};

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("watchlist")
    .select("id, ticker, name, created_at")
    .eq("user_id", userId)
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
  const userId = await getUserId();
  if (!userId) {
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
  // Check duplicate first for this user/ticker
  const { data: existing, error: existingErr } = await supabase
    .from("watchlist")
    .select("id, ticker, name, created_at")
    .eq("user_id", userId)
    .eq("ticker", ticker)
    .maybeSingle();
  if (existingErr) {
    console.error("[watchlist] POST duplicate-check error:", existingErr);
    return NextResponse.json({ error: "Failed to add to watchlist" }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json(
      {
        item: {
          id: existing.id,
          ticker: existing.ticker,
          name: existing.name ?? undefined,
          createdAt: existing.created_at ?? null,
        },
      },
      { status: 200 }
    );
  }

  const { data: inserted, error } = await supabase
    .from("watchlist")
    .insert({
    user_id: userId,
    ticker,
    name: body.name?.trim() || null,
  })
    .select("id, ticker, name, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already in watchlist" }, { status: 409 });
    }
    console.error("[watchlist] POST error:", error);
    return NextResponse.json({ error: "Failed to add to watchlist" }, { status: 500 });
  }

  return NextResponse.json({
    item: {
      id: inserted?.id,
      ticker: inserted?.ticker ?? ticker,
      name: inserted?.name ?? body.name ?? undefined,
      createdAt: inserted?.created_at ?? null,
    },
  });
}

export async function DELETE(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
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
    .eq("user_id", userId)
    .eq("ticker", ticker);

  if (error) {
    console.error("[watchlist] DELETE error:", error);
    return NextResponse.json({ error: "Failed to remove from watchlist" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
