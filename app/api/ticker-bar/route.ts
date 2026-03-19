import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const DEFAULT_TICKERS = [
  "SPY",
  "QQQ",
  "AAPL",
  "BTC",
  "ETH",
  "GLD",
  "EURUSD",
  "DXY",
  "NVDA",
  "TSLA",
];

type TickerBarConfig = {
  tickers: string[];
  useWatchlist?: boolean;
};

function normalizeTickers(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const normalized = input
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 15);
  return [...new Set(normalized)];
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("ticker_bar_config")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rawCfg = (data?.ticker_bar_config ?? null) as TickerBarConfig | null;
  const tickers = normalizeTickers(rawCfg?.tickers);
  return NextResponse.json({
    tickers: tickers.length > 0 ? tickers : DEFAULT_TICKERS,
    useWatchlist: Boolean(rawCfg?.useWatchlist),
  });
}

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { tickers?: unknown; useWatchlist?: unknown }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const tickers = normalizeTickers(body.tickers);
  const useWatchlist = Boolean(body.useWatchlist);
  const config: TickerBarConfig = { tickers, useWatchlist };

  const supabase = createServerClient();
  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: userId, ticker_bar_config: config }, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tickers, useWatchlist });
}

