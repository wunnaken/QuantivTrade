import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 86400; // 24 hours — cuts don't change minute-to-minute

// Watchlist of companies historically prone to dividend issues
const WATCHLIST = ["INTC", "MPW", "WBA", "PFE", "VFC", "PARA", "DIS", "T", "VZ", "MMM", "MO", "CVS", "F", "NIO", "DISH"];

type HistEntry = { date: string; dividend?: number; adjDividend?: number };
type FmpResponse = { historical?: HistEntry[] };

async function fetchHistory(symbol: string, apiKey: string): Promise<HistEntry[]> {
  try {
    const res = await fetch(
      `https://financialmodelingprep.com/api/v3/historical-price-full/stock_dividend/${encodeURIComponent(symbol)}?apikey=${apiKey}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return [];
    const data: FmpResponse = await res.json();
    return data.historical ?? [];
  } catch {
    return [];
  }
}

function detectCut(symbol: string, history: HistEntry[]): {
  symbol: string;
  before: string;
  after: string;
  changePct: number;
  date: string;
  suspended: boolean;
} | null {
  // Sort newest first (FMP returns newest first already, but sort to be safe)
  const sorted = [...history]
    .filter((e) => e.date && (e.adjDividend || e.dividend))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12); // last 12 payments

  if (sorted.length < 4) return null;

  const recent = sorted.slice(0, 4);
  const prior = sorted.slice(4, 8);

  if (prior.length < 2) return null;

  const avgRecent = recent.reduce((s, e) => s + (e.adjDividend ?? e.dividend ?? 0), 0) / recent.length;
  const avgPrior = prior.reduce((s, e) => s + (e.adjDividend ?? e.dividend ?? 0), 0) / prior.length;

  if (avgPrior === 0) return null;

  const changePct = +((((avgRecent - avgPrior) / avgPrior) * 100)).toFixed(1);

  // Only flag cuts of 10%+ or suspensions
  if (changePct > -10) return null;

  const suspended = avgRecent === 0;
  const latestPayment = recent[0];
  const priorPayment = prior[0];

  const freq = history.length >= 8 ? (
    // detect monthly vs quarterly by gap between payments
    (() => {
      const d1 = new Date(sorted[0].date);
      const d2 = new Date(sorted[1].date);
      const gap = Math.round(Math.abs(d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
      return gap < 40 ? "/mo" : "/q";
    })()
  ) : "/q";

  return {
    symbol,
    before: `$${avgPrior.toFixed(4).replace(/\.?0+$/, "")}${freq}`,
    after: suspended ? "$0.00" : `$${avgRecent.toFixed(4).replace(/\.?0+$/, "")}${freq}`,
    changePct,
    date: latestPayment?.date?.slice(0, 7) ?? "—",
    suspended,
  };
}

export async function GET() {
  const apiKey = process.env.FMP_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ cuts: [] });
  }

  try {
    const results = await Promise.all(
      WATCHLIST.map(async (symbol) => {
        const history = await fetchHistory(symbol, apiKey);
        return detectCut(symbol, history);
      })
    );

    const cuts = results
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => a.changePct - b.changePct); // worst cuts first

    return NextResponse.json({ cuts });
  } catch {
    return NextResponse.json({ cuts: [] });
  }
}
