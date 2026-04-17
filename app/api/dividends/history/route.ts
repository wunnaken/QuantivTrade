import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.toUpperCase().trim();

  if (!symbol || !/^[A-Z0-9.\-]{1,10}$/.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  const apiKey = process.env.FMP_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ history: [], annual: [], currentPrice: null });
  }

  try {
    type FmpHistEntry = { date: string; adjDividend?: number; dividend?: number };
    type FmpQuote = { price?: number; priceAvg50?: number };

    // Fetch dividend history — try the "stable" tier first (works on free
    // plans), then fall back to legacy v3. The v3 path returns 403 on many
    // free-tier keys.
    let divEntries: FmpHistEntry[] = [];
    for (const base of [
      `https://financialmodelingprep.com/stable/historical-dividends-full/${encodeURIComponent(symbol)}?apikey=${apiKey}`,
      `https://financialmodelingprep.com/api/v3/historical-price-full/stock_dividend/${encodeURIComponent(symbol)}?apikey=${apiKey}`,
    ]) {
      try {
        const res = await fetch(base, { next: { revalidate: 86400 } });
        if (!res.ok) continue;
        const raw = await res.json();
        const arr: FmpHistEntry[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.historical)
          ? raw.historical
          : [];
        if (arr.length > 0) { divEntries = arr; break; }
      } catch { continue; }
    }

    // Live quote (for current price / yield calc). Stable endpoint works
    // when v3 doesn't; try both.
    let currentPrice: number | null = null;
    for (const base of [
      `https://financialmodelingprep.com/stable/profile/${encodeURIComponent(symbol)}?apikey=${apiKey}`,
      `https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(symbol)}?apikey=${apiKey}`,
    ]) {
      try {
        const res = await fetch(base, { next: { revalidate: 60 } });
        if (!res.ok) continue;
        const raw = await res.json();
        const arr: FmpQuote[] = Array.isArray(raw) ? raw : raw?.price ? [raw] : [];
        if (arr[0]?.price) { currentPrice = arr[0].price; break; }
      } catch { continue; }
    }
    const raw = divEntries
      .filter((e) => e.date && (e.adjDividend || e.dividend))
      .map((e) => ({
        date: e.date.slice(0, 7), // YYYY-MM
        amount: +(e.adjDividend ?? e.dividend ?? 0).toFixed(4),
      }))
      .reverse() // oldest first
      .slice(-48); // ~12 years quarterly

    // Annual totals
    const annualMap: Record<string, number> = {};
    raw.forEach(({ date, amount }) => {
      const year = date.slice(0, 4);
      annualMap[year] = +((annualMap[year] ?? 0) + amount).toFixed(4);
    });
    const annual = Object.entries(annualMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, total]) => ({ year, total }));

    return NextResponse.json({ history: raw, annual, currentPrice });
  } catch {
    return NextResponse.json({ history: [], annual: [], currentPrice: null });
  }
}
