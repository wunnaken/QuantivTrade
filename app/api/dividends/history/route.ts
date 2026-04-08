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
    const [divRes, quoteRes] = await Promise.all([
      fetch(
        `https://financialmodelingprep.com/api/v3/historical-price-full/stock_dividend/${encodeURIComponent(symbol)}?apikey=${apiKey}`,
        { next: { revalidate: 86400 } }
      ),
      fetch(
        `https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(symbol)}?apikey=${apiKey}`,
        { next: { revalidate: 3600 } }
      ),
    ]);

    type FmpHistEntry = { date: string; adjDividend?: number; dividend?: number };
    type FmpResponse = { historical?: FmpHistEntry[] };
    type FmpQuote = { price?: number; priceAvg50?: number };

    const divData: FmpResponse = divRes.ok ? await divRes.json() : {};
    const quoteArr: FmpQuote[] = quoteRes.ok ? await quoteRes.json() : [];
    const currentPrice: number | null = quoteArr[0]?.price ?? null;

    const raw = (divData.historical ?? [])
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
