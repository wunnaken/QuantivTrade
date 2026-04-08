import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // 1 hour

const ETF_SYMBOLS = ["SCHD", "VYM", "DVY", "HDV", "VIG", "NOBL", "JEPI", "JEPQ"];

export async function GET() {
  const apiKey = process.env.FMP_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ etfs: [] });
  }

  try {
    const symbols = ETF_SYMBOLS.join(",");
    const [profileRes, quoteRes] = await Promise.all([
      fetch(
        `https://financialmodelingprep.com/api/v3/profile/${encodeURIComponent(symbols)}?apikey=${apiKey}`,
        { next: { revalidate: 3600 } }
      ),
      fetch(
        `https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(symbols)}?apikey=${apiKey}`,
        { next: { revalidate: 3600 } }
      ),
    ]);

    type FmpProfile = {
      symbol: string;
      mktCap?: number;
      lastDiv?: number;
      price?: number;
    };
    type FmpQuote = {
      symbol: string;
      price?: number;
      yearHigh?: number;
      yearLow?: number;
      priceAvg200?: number;
    };

    const profiles: FmpProfile[] = profileRes.ok ? await profileRes.json() : [];
    const quotes: FmpQuote[] = quoteRes.ok ? await quoteRes.json() : [];

    const quoteMap: Record<string, FmpQuote> = {};
    quotes.forEach((q) => { quoteMap[q.symbol] = q; });

    const etfs = profiles
      .filter((p) => ETF_SYMBOLS.includes(p.symbol))
      .map((p) => {
        const q = quoteMap[p.symbol];
        const price = q?.price ?? p.price ?? null;
        const lastDiv = p.lastDiv ?? null;
        // ETF distributions: lastDiv is typically quarterly for equity ETFs, monthly for covered-call ETFs
        const isMonthly = ["JEPI", "JEPQ"].includes(p.symbol);
        const annualDiv = lastDiv != null ? lastDiv * (isMonthly ? 12 : 4) : null;
        const yieldPct = annualDiv != null && price ? +((annualDiv / price) * 100).toFixed(2) : null;
        const aumBillions = p.mktCap ? +(p.mktCap / 1e9).toFixed(1) : null;

        return {
          symbol: p.symbol,
          price: price ? +price.toFixed(2) : null,
          yield: yieldPct,
          aum: aumBillions,
        };
      });

    return NextResponse.json({ etfs });
  } catch {
    return NextResponse.json({ etfs: [] });
  }
}
