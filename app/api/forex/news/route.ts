import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PAIR_KEYWORDS: Record<string, string[]> = {
  "EUR/USD": ["eur", "euro", "ecb", "eurozone", "european central bank"],
  "GBP/USD": ["gbp", "pound", "sterling", "boe", "bank of england"],
  "USD/JPY": ["jpy", "yen", "boj", "bank of japan"],
  "USD/CHF": ["chf", "franc", "snb", "swiss"],
  "AUD/USD": ["aud", "aussie", "rba", "reserve bank of australia"],
  "USD/CAD": ["cad", "loonie", "boc", "bank of canada"],
  "NZD/USD": ["nzd", "kiwi", "rbnz"],
  "XAU/USD": ["gold", "xau"],
};

function detectPairs(text: string): string[] {
  const lower = text.toLowerCase();
  return Object.entries(PAIR_KEYWORDS)
    .filter(([, kws]) => kws.some((k) => lower.includes(k)))
    .map(([pair]) => pair)
    .slice(0, 3);
}

export async function GET() {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return NextResponse.json({ error: "FINNHUB_API_KEY not configured" }, { status: 500 });

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/news?category=forex&token=${key}`,
      { cache: "no-store", signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json() as Array<{
      headline: string; source: string; url: string; datetime: number; summary?: string;
    }>;

    const articles = data.slice(0, 10).map((item) => ({
      title:        item.headline,
      source:       item.source,
      url:          item.url,
      publishedAt:  new Date(item.datetime * 1000).toISOString(),
      summary:      (item.summary ?? "").slice(0, 200),
      relatedPairs: detectPairs(`${item.headline} ${item.summary ?? ""}`),
    }));

    return NextResponse.json({ articles, lastUpdated: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ articles: [], error: String(err), lastUpdated: new Date().toISOString() });
  }
}
