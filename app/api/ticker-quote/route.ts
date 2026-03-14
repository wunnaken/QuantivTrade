import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type TickerQuote = {
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  high: number | null;
  low: number | null;
  open: number | null;
  previousClose: number | null;
};

async function fetchFinnhubQuote(symbol: string, token: string): Promise<TickerQuote | null> {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`,
      { next: { revalidate: 0 } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { c?: number; d?: number; dp?: number; h?: number; l?: number; o?: number; pc?: number; v?: number };
    if (data.c == null) return null;
    return {
      price: data.c,
      change: data.d ?? null,
      changePercent: data.dp ?? null,
      volume: data.v ?? null,
      high: data.h ?? null,
      low: data.l ?? null,
      open: data.o ?? null,
      previousClose: data.pc ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchCryptoQuote(ticker: string): Promise<TickerQuote | null> {
  const id = ticker === "BTC" ? "bitcoin" : ticker === "ETH" ? "ethereum" : null;
  if (!id) return null;
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true`,
      { next: { revalidate: 0 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const c = data?.[id];
    if (c?.usd == null) return null;
    const changePercent = c.usd_24h_change ?? 0;
    return {
      price: c.usd,
      change: (c.usd * changePercent) / 100,
      changePercent,
      volume: c.usd_24h_vol ?? null,
      high: null,
      low: null,
      open: null,
      previousClose: null,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker")?.trim().toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: "Missing ticker" }, { status: 400 });
  }
  const key = process.env.FINNHUB_API_KEY;
  if (key) {
    const quote = await fetchFinnhubQuote(ticker, key);
    if (quote) return NextResponse.json(quote);
    if (ticker === "BTC" || ticker === "ETH") {
      const crypto = await fetchCryptoQuote(ticker);
      if (crypto) return NextResponse.json(crypto);
    }
  }
  const empty: TickerQuote = { price: null, change: null, changePercent: null, volume: null, high: null, low: null, open: null, previousClose: null };
  return NextResponse.json(empty);
}
