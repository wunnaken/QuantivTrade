import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ─── Asset definitions ────────────────────────────────────────────────────────

const ASSETS: Record<string, string[]> = {
  us_indices:     ["SPY", "QQQ", "DIA", "IWM", "VIX"],
  global_indices: ["EWJ", "FXI", "EWG", "EWU", "EWA", "EWZ", "INDA", "EWY"],
  precious_metals:["GLD", "SLV", "PPLT", "PALL"],
  commodities:    ["USO", "BNO", "UNG", "CPER", "WEAT", "CORN"],
  forex:          ["UUP", "FXE", "FXY", "FXB", "CYB"],
  bonds:          ["TLT", "IEF", "SHY", "HYG", "EMB", "BNDX"],
  crypto:         ["BTC-USD", "ETH-USD"],
  volatility:     ["VIXY"],
};

const TICKER_CLASS: Record<string, string> = {};
for (const [cls, tickers] of Object.entries(ASSETS)) {
  for (const t of tickers) TICKER_CLASS[t] = cls;
}

const CLASS_PAIR_WEIGHTS: Record<string, number> = {
  "bonds|crypto": 2.0,
  "forex|crypto": 2.0,
  "us_indices|forex": 2.0,
  "crypto|precious_metals": 1.9,
  "precious_metals|us_indices": 1.8,
  "bonds|commodities": 1.8,
  "commodities|us_indices": 1.7,
  "commodities|forex": 1.7,
  "bonds|global_indices": 1.7,
  "bonds|volatility": 1.6,
  "bonds|precious_metals": 1.6,
  "bonds|forex": 1.5,
};

function classPairWeight(a: string, b: string): number {
  const key = [a, b].sort().join("|");
  return CLASS_PAIR_WEIGHTS[key] ?? 1.3;
}

// ─── Data fetching ────────────────────────────────────────────────────────────

type PricePoint = { date: string; close: number };

async function fetchCloses(ticker: string, days: number): Promise<PricePoint[]> {
  const now = Math.floor(Date.now() / 1000);
  // Add a small buffer so we reliably get `days` trading days of data
  const period1 = now - (days + 30) * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&period1=${period1}&period2=${now}&includePrePost=false`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const json = await res.json() as {
      chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: (number | null)[] }> } }> };
    };
    const result = json?.chart?.result?.[0];
    if (!result) return [];
    const timestamps = result.timestamp ?? [];
    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const out: PricePoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const c = closes[i];
      if (c != null && isFinite(c)) {
        out.push({ date: new Date(timestamps[i]! * 1000).toISOString().slice(0, 10), close: c });
      }
    }
    return out;
  } catch {
    return [];
  }
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

function dailyReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1]!;
    out.push(prev !== 0 ? (closes[i]! - prev) / prev : 0);
  }
  return out;
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 5) return null;
  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) { sumX += xs[i]!; sumY += ys[i]!; }
  const mX = sumX / n, mY = sumY / n;
  let num = 0, dX = 0, dY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mX, dy = ys[i]! - mY;
    num += dx * dy; dX += dx * dx; dY += dy * dy;
  }
  const den = Math.sqrt(dX * dY);
  if (den === 0) return null;
  return Math.max(-1, Math.min(1, num / den));
}

// Align two return series by matching dates.
// returns[i] = change from dates[i] → dates[i+1], so it "belongs to" dates[i+1] (the TO date).
// We look up each TO-date from A in B's date list (index j), then use returnsB[j-1]
// (the return that also lands on dates[j] in B).  Using returnsB[j] was an off-by-one that
// produced undefined at the last index, poisoning every Pearson call with NaN.
function alignReturns(
  returnsA: number[], datesA: string[],
  returnsB: number[], datesB: string[],
): [number[], number[]] {
  const setB = new Map(datesB.map((d, i) => [d, i]));
  const outA: number[] = [], outB: number[] = [];
  for (let i = 0; i < returnsA.length; i++) {
    const date = datesA[i + 1]; // TO-date for returnsA[i]
    if (!date) continue;
    const j = setB.get(date);
    // j > 0 ensures returnsB[j-1] is in-bounds (j-1 ≥ 0, j-1 ≤ returnsB.length-1)
    if (j !== undefined && j > 0) {
      outA.push(returnsA[i]!);
      outB.push(returnsB[j - 1]!);
    }
  }
  return [outA, outB];
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(1825, Math.max(5, parseInt(searchParams.get("days") ?? "90", 10)));

  const allTickers = Object.values(ASSETS).flat();

  // Fetch all tickers in parallel (batched to avoid overwhelming Yahoo Finance)
  const BATCH = 10;
  const priceMap: Record<string, PricePoint[]> = {};
  for (let i = 0; i < allTickers.length; i += BATCH) {
    const batch = allTickers.slice(i, i + BATCH);
    const settled = await Promise.allSettled(batch.map((t) => fetchCloses(t, days)));
    for (let j = 0; j < batch.length; j++) {
      const result = settled[j];
      priceMap[batch[j]!] = result?.status === "fulfilled" ? result.value : [];
    }
  }

  // Keep tickers with enough data (at least 50% of expected trading days)
  const minPoints = Math.max(5, Math.floor(days * 0.5 * 5 / 7));
  const validTickers = allTickers.filter((t) => (priceMap[t]?.length ?? 0) >= minPoints);

  // Build returns map keyed by ticker
  const returnsMap: Record<string, { returns: number[]; dates: string[] }> = {};
  for (const t of validTickers) {
    const pts = priceMap[t]!;
    returnsMap[t] = {
      returns: dailyReturns(pts.map((p) => p.close)),
      dates: pts.map((p) => p.date),
    };
  }

  // Build full correlation matrix
  const matrix: Record<string, Record<string, number | null>> = {};
  for (const ta of validTickers) {
    matrix[ta] = {};
    for (const tb of validTickers) {
      if (ta === tb) { matrix[ta]![tb] = 1; continue; }
      // Use alignment to handle any missing dates between assets
      const [rA, rB] = alignReturns(
        returnsMap[ta]!.returns, returnsMap[ta]!.dates,
        returnsMap[tb]!.returns, returnsMap[tb]!.dates,
      );
      const c = pearson(rA, rB);
      matrix[ta]![tb] = (c !== null && isFinite(c)) ? Math.round(c * 10000) / 10000 : null;
    }
  }

  // Find notable cross-class pairs (abs(corr) >= 0.55) — captures both strong
  // positive and inverse relationships that most traders wouldn't expect across classes.
  const surprisingPairs: Array<{
    assetA: string; assetB: string; classA: string; classB: string;
    correlation: number; surprise_score: number;
  }> = [];

  for (let i = 0; i < validTickers.length; i++) {
    for (let j = i + 1; j < validTickers.length; j++) {
      const ta = validTickers[i]!;
      const tb = validTickers[j]!;
      const clsA = TICKER_CLASS[ta];
      const clsB = TICKER_CLASS[tb];
      if (!clsA || !clsB || clsA === clsB) continue;
      const corr = matrix[ta]?.[tb];
      if (corr === null || corr === undefined || !isFinite(corr)) continue;
      const absC = Math.abs(corr);
      if (absC < 0.55) continue;
      const w = classPairWeight(clsA, clsB);
      surprisingPairs.push({
        assetA: ta, assetB: tb, classA: clsA, classB: clsB,
        correlation: corr, surprise_score: Math.round(absC * w * 10000) / 10000,
      });
    }
  }
  surprisingPairs.sort((a, b) => b.surprise_score - a.surprise_score);

  // Safe haven scores: 30-day correlation vs SPY
  const safe_havens = ["GLD", "TLT", "UUP", "FXY", "FXB"];
  const safeHavenScores: Record<string, number | null> = {};
  const SPY_RETURNS = returnsMap["SPY"];
  for (const asset of safe_havens) {
    if (!SPY_RETURNS || !returnsMap[asset]) { safeHavenScores[asset] = null; continue; }
    // Use last 30 trading days of aligned returns
    const [rSpy, rAsset] = alignReturns(
      SPY_RETURNS.returns, SPY_RETURNS.dates,
      returnsMap[asset]!.returns, returnsMap[asset]!.dates,
    );
    const len30 = Math.min(30, rSpy.length);
    const c = pearson(rSpy.slice(-len30), rAsset.slice(-len30));
    safeHavenScores[asset] = c !== null ? Math.round(c * 10000) / 10000 : null;
  }

  // Asset class performance: 1D, 1W, 1M returns + current price
  const performance: Record<string, Record<string, {
    price: number | null; "1d": number | null; "1w": number | null; "1m": number | null;
  }>> = {};
  for (const [cls, tickers] of Object.entries(ASSETS)) {
    performance[cls] = {};
    for (const ticker of tickers) {
      const pts = priceMap[ticker];
      if (!pts || pts.length < 2) continue;
      const last = pts[pts.length - 1]!.close;
      const calc = (back: number) =>
        pts.length > back ? Math.round((last / pts[pts.length - 1 - back]!.close - 1) * 10000) / 100 : null;
      performance[cls]![ticker] = {
        price: Math.round(last * 100) / 100,
        "1d": calc(1),
        "1w": calc(5),
        "1m": calc(21),
      };
    }
  }

  // Normalized series — trimmed to exactly the requested window (days calendar days back)
  // We fetched extra data as a buffer for correlation math; strip that buffer here for display.
  const cutoffMs = Date.now() - days * 86_400_000;
  const cutoffDate = new Date(cutoffMs).toISOString().slice(0, 10);

  const normalizedSeries: Record<string, Array<{ date: string; value: number }>> = {};
  for (const ticker of validTickers) {
    const allPts = priceMap[ticker];
    if (!allPts || allPts.length < 2) continue;
    const pts = allPts.filter((p) => p.date >= cutoffDate);
    if (pts.length < 2) continue;
    const first = pts[0]!.close;
    if (first === 0) continue;
    normalizedSeries[ticker] = pts.map((p) => ({
      date: p.date,
      value: Math.round((p.close / first) * 10000) / 100,
    }));
  }

  return NextResponse.json({
    matrix,
    tickers: validTickers,
    surprisingPairs: surprisingPairs.slice(0, 20),
    safeHavenScores,
    performance,
    normalizedSeries,
    days,
  });
}
