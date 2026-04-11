import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Broad watchlist — mega-cap, mid-cap, and sector leaders across all major industries
const WATCHLIST = [
  // Mega-cap tech
  "AAPL", "MSFT", "NVDA", "GOOGL", "GOOG", "META", "AMZN", "TSLA", "AMD", "ORCL", "CRM", "INTC", "AVGO", "QCOM",
  // Software & SaaS
  "ADBE", "NOW", "INTU", "SNOW", "PLTR", "UBER", "LYFT", "SHOP", "SPOT", "RBLX",
  // Finance — banks, brokers, payments
  "JPM", "BAC", "GS", "MS", "WFC", "C", "USB", "TFC", "V", "MA", "AXP", "PYPL", "SQ", "COF",
  // Insurance & Asset Management
  "BRK-B", "BLK", "SCHW", "MET", "PRU", "AIG",
  // Healthcare — pharma, biotech, devices
  "JNJ", "UNH", "PFE", "ABBV", "MRK", "LLY", "BMY", "AMGN", "GILD", "REGN", "BIIB", "MDT", "ABT", "TMO", "DHR",
  // Energy — oil, gas, renewables
  "XOM", "CVX", "COP", "EOG", "SLB", "HAL", "OXY", "PSX", "VLO", "MPC", "NEE", "ENPH", "FSLR",
  // Consumer discretionary
  "WMT", "HD", "COST", "MCD", "NKE", "SBUX", "TGT", "LOW", "TJX", "BKNG", "CMG", "ROST",
  // Consumer staples
  "PG", "KO", "PEP", "PM", "MO", "CL", "KHC", "GIS", "K",
  // Industrials & Aerospace
  "CAT", "BA", "GE", "HON", "RTX", "LMT", "NOC", "DE", "EMR", "ETN", "MMM", "UPS", "FDX",
  // Telecom & Media
  "T", "VZ", "CMCSA", "NFLX", "DIS", "PARA", "WBD", "CHTR",
  // Semiconductors
  "TSM", "MU", "LRCX", "AMAT", "KLAC", "MRVL", "TXN", "ADI", "ON",
  // Real estate (REITs)
  "PLD", "AMT", "CCI", "EQIX", "O", "SPG", "VICI",
  // Materials & Mining
  "FCX", "NEM", "GOLD", "AA", "NUE", "CF",
  // Airlines & Travel
  "DAL", "UAL", "AAL", "LUV", "MAR", "HLT", "CCL",
  // Autos
  "GM", "F", "RIVN", "NIO",
  // Biotech
  "MRNA", "BNTX", "VRTX", "ILMN", "DXCM",
];

type FinnhubTx = {
  change: number;
  currency: string;
  filingDate: string;
  id: string;
  isDerivative: boolean;
  name: string;
  share: number;
  source: string;
  symbol: string;
  transactionCode: string;
  transactionDate: string;
  transactionPrice: number;
};

async function fetchInsiderTransactions(symbol: string, key: string): Promise<FinnhubTx[]> {
  const url = `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${symbol}&token=${key}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Finnhub ${symbol}: ${res.status}`);
  const data = await res.json() as { data?: FinnhubTx[] };
  return (data.data ?? []).filter(
    (t) => !t.isDerivative && (t.transactionCode === "P" || t.transactionCode === "S")
  );
}

export async function GET() {
  const key = process.env.FINNHUB_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { error: "FINNHUB_API_KEY not configured", trades: [] },
      { status: 503 }
    );
  }

  // Deduplicate watchlist
  const tickers = [...new Set(WATCHLIST)];

  // Fetch in parallel groups of 10 — well within Finnhub's 60 req/min free limit
  const allRaw: (FinnhubTx & { fetchedSymbol: string })[] = [];
  const CHUNK = 10;
  for (let i = 0; i < tickers.length; i += CHUNK) {
    const chunk = tickers.slice(i, i + CHUNK);
    const results = await Promise.allSettled(
      chunk.map((sym) => fetchInsiderTransactions(sym, key))
    );
    results.forEach((r, j) => {
      if (r.status === "fulfilled") {
        r.value.forEach((t) => allRaw.push({ ...t, fetchedSymbol: chunk[j] }));
      }
    });
  }

  // Filter to last 90 days, purchases and sales only
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const trades = allRaw
    .filter((t) => t.transactionDate && new Date(t.transactionDate) >= cutoff)
    .sort(
      (a, b) =>
        new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
    )
    .slice(0, 250)
    .map((t, i) => ({
      id: `corp-${i}-${t.id}`,
      ticker: t.fetchedSymbol,
      insider: t.name,
      transactionType: t.transactionCode === "P" ? "Purchase" : "Sale",
      transactionCode: t.transactionCode,
      shares: Math.abs(t.change),
      price: t.transactionPrice ?? 0,
      value: Math.abs(t.change) * (t.transactionPrice ?? 0),
      transactionDate: t.transactionDate,
      filingDate: t.filingDate,
    }));

  return NextResponse.json({
    trades,
    source: "SEC Form 4 via Finnhub",
    watchlistSize: tickers.length,
    updateFrequency: "Hourly",
    note: "Open-market purchases and sales only (excludes grants, awards, exercises). SEC requires disclosure within 2 business days of the trade.",
  });
}
