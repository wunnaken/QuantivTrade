import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // always re-run so we don't cache empty Finnhub responses
// Individual Finnhub fetches use { next: { revalidate: 300 } } — each stock's candles are cached 5 min

// Mirror the working pattern from /api/ticker-chart: always resolution=D, use days offset
const TF_DAYS: Record<string, number> = {
  "1d":  5,    // need 5 days buffer so we catch the last trading day
  "1w":  14,
  "1m":  35,
  "3m":  95,
  "ytd": 0,    // computed dynamically
  "1y":  370,
};

// Tickers that Finnhub can't price — skip for chart
const SKIP_TICKERS = new Set([
  "BTC-USD","ETH-USD","SOL-USD","BNB-USD","XRP-USD","ADA-USD","AVAX-USD","DOT-USD", // use crypto candle endpoint separately
  "ATVI",  // acquired by MSFT, delisted
  "LVMUY","HESAY","PPRUY",  // OTC ADRs — often unavailable on free tier
]);

interface FinnhubCandle {
  c: number[];
  t: number[];
  s: string;
}

async function fetchCandles(symbol: string, days: number, apiKey: string): Promise<{ t: number[]; c: number[] } | null> {
  if (SKIP_TICKERS.has(symbol)) return null;
  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 86400;
  try {
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const d = (await res.json()) as FinnhubCandle;
    if (d.s !== "ok" || !d.t?.length || !d.c?.length) return null;
    return { t: d.t, c: d.c };
  } catch {
    return null;
  }
}

function normalizePercent(closes: number[]): number[] {
  const base = closes[0];
  if (!base) return closes.map(() => 0);
  return closes.map((c) => Math.round(((c - base) / base) * 10000) / 100);
}

// For each timestamp union, average normalized returns across all series
function mergeAndAverage(series: Array<{ t: number[]; c: number[] }>): Array<{ t: number; value: number }> {
  if (!series.length) return [];

  // Normalize each series to % return
  const normalized = series.map((s) => ({
    t: s.t,
    pct: normalizePercent(s.c),
  }));

  // Collect all unique timestamps, sorted
  const allTs = [...new Set(series.flatMap((s) => s.t))].sort((a, b) => a - b);

  return allTs.map((ts) => {
    let sum = 0;
    let count = 0;
    for (const n of normalized) {
      const idx = n.t.indexOf(ts);
      if (idx !== -1) {
        sum += n.pct[idx];
        count++;
      }
    }
    return { t: ts, value: count > 0 ? Math.round((sum / count) * 100) / 100 : 0 };
  });
}

const THEMATIC_TICKERS: Record<string, string[]> = {
  defense:        ["LMT","RTX","NOC","GD","BA","LDOS","HII","CACI"],
  nuclear:        ["CCJ","UEC","VST","CEG","NNE","SMR","OKLO","DNN"],
  ai:             ["NVDA","MSFT","GOOGL","AMD","PLTR","AI","PATH","BBAI"],
  space:          ["RKLB","ASTS","IRDM","BA","LMT","LUNR","RDW","KTOS"],
  biotech:        ["MRNA","PFE","ABBV","UNH","ISRG","REGN","VRTX","GILD"],
  banks:          ["JPM","BAC","GS","MS","WFC","C","BLK","SCHW"],
  oil:            ["XOM","CVX","COP","SLB","EOG","PXD","MPC","VLO"],
  clean:          ["NEE","ENPH","FSLR","BE","RUN","ARRY","CWEN","AES"],
  consumer:       ["AAPL","AMZN","NKE","MCD","SBUX","KO","PEP","WMT"],
  gaming:         ["MSFT","SONY","RBLX","EA","TTWO","U"],
  reits:          ["O","SPG","AMT","PLD","WELL","EQR","AVB","DLR"],
  cyber:          ["CRWD","PANW","ZS","FTNT","S","OKTA","CYBR","QLYS"],
  ev:             ["TSLA","RIVN","NIO","LI","LCID","CHPT"],
  genomics:       ["ILMN","CRSP","NTLA","BEAM","PACB","RXRX","VERV","EDIT"],
  infrastructure: ["CAT","DE","VMC","MLM","PWR","ACM","J","STRL"],
  luxury:         ["CPRI","TPR","RL","PVH","MOV"],
  emerging:       ["BABA","TSM","MELI","SE","BIDU","JD","PDD"],
  ag:             ["ADM","BG","DE","MOS","NTR","CTVA","FMC","INGR"],
  "5g":           ["TMUS","VZ","T","ERIC","NOK","QCOM","AMT","SBAC"],
  crypto:         [], // skip — no candles via stock endpoint
};

export async function GET(req: NextRequest) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return NextResponse.json({ points: [], benchmark: [] });

  const id = req.nextUrl.searchParams.get("id") ?? "ai";
  const tf = req.nextUrl.searchParams.get("tf") ?? "ytd";

  // Support custom comma-separated tickers (for famous investor portfolios)
  const customTickers = req.nextUrl.searchParams.get("tickers");

  let tickers: string[];
  if (customTickers) {
    tickers = customTickers.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8);
  } else {
    tickers = (THEMATIC_TICKERS[id] ?? THEMATIC_TICKERS["ai"]).filter((t) => !SKIP_TICKERS.has(t)).slice(0, 6);
  }

  // Compute days
  let days: number;
  if (tf === "ytd") {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    days = Math.ceil((now.getTime() - startOfYear.getTime()) / 86400000) + 5;
  } else {
    days = TF_DAYS[tf] ?? 370;
  }

  // Fetch candles in batches of 2 to stay well under Finnhub's 60 req/min limit.
  // SPY fetched first so the most important series isn't delayed.
  const spyCandles = await fetchCandles("SPY", days, apiKey);
  const candleResults: Array<{ t: number[]; c: number[] } | null> = [];
  for (let i = 0; i < tickers.length; i += 2) {
    const batch = tickers.slice(i, i + 2);
    const batchResults = await Promise.all(batch.map((t) => fetchCandles(t, days, apiKey)));
    candleResults.push(...batchResults);
  }

  // Compute per-ticker normalized % return (last point relative to first)
  const tickerPerf: Record<string, number> = {};
  for (let i = 0; i < tickers.length; i++) {
    const series = candleResults[i];
    if (series) {
      const norm = normalizePercent(series.c);
      if (norm.length) tickerPerf[tickers[i]] = norm[norm.length - 1];
    }
  }

  const validSeries = candleResults.filter((c): c is { t: number[]; c: number[] } => c !== null);

  const benchmark = spyCandles
    ? normalizePercent(spyCandles.c).map((v, i) => ({ t: spyCandles!.t[i], value: v }))
    : [];

  if (!validSeries.length) {
    return NextResponse.json({ points: [], benchmark, tickers, tf, tickerPerf });
  }

  const points = mergeAndAverage(validSeries);
  return NextResponse.json({ points, benchmark, tickers, tf, tickerPerf });
}
