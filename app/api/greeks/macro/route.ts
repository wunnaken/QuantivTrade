import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const YF_HEADERS = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };

type PricePoint = { date: string; close: number };

async function fetchChart(ticker: string, days: number): Promise<PricePoint[]> {
  const now = Math.floor(Date.now() / 1000);
  const period1 = now - (days + 10) * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&period1=${period1}&period2=${now}&includePrePost=false`;
  try {
    const res = await fetch(url, { headers: YF_HEADERS, cache: "no-store", signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return [];
    const json = await res.json() as { chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: (number | null)[] }> } }> } };
    const result = json?.chart?.result?.[0];
    if (!result) return [];
    const timestamps = result.timestamp ?? [];
    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const out: PricePoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const c = closes[i];
      if (c != null && isFinite(c)) out.push({ date: new Date(timestamps[i]! * 1000).toISOString().slice(0, 10), close: c });
    }
    return out;
  } catch { return []; }
}

function computeHV(closes: number[], window: number): number {
  if (closes.length < window + 1) return 0;
  const recent = closes.slice(-window - 1);
  const returns: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    if (recent[i - 1]! > 0) returns.push(Math.log(recent[i]! / recent[i - 1]!));
  }
  if (returns.length < 5) return 0;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.round(Math.sqrt(variance * 252) * 10000) / 10000;
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
  return den === 0 ? null : Math.round(Math.max(-1, Math.min(1, num / den)) * 10000) / 10000;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function GET() {
  // Fetch everything in parallel
  const TICKERS = {
    vix: "^VIX", vix9d: "^VIX9D", vix3m: "^VIX3M", vix6m: "^VIX6M", vix1y: "^VIX1Y",
    spy: "SPY", qqq: "QQQ", iwm: "IWM", dia: "DIA",
    gld: "GLD", tlt: "TLT", uup: "UUP",
    ovx: "^OVX", gvz: "^GVZ", tyvix: "^TYVIX",
    vvix: "^VVIX",
    skew: "^SKEW",
  };

  const entries = Object.entries(TICKERS);
  const results = await Promise.allSettled(entries.map(([, t]) => fetchChart(t, 180)));
  const dataMap: Record<string, PricePoint[]> = {};
  entries.forEach(([key], i) => {
    const r = results[i];
    dataMap[key] = r?.status === "fulfilled" ? r.value : [];
  });

  const last = (key: string) => {
    const pts = dataMap[key];
    return pts && pts.length > 0 ? pts[pts.length - 1]!.close : null;
  };
  const prev = (key: string) => {
    const pts = dataMap[key];
    return pts && pts.length > 1 ? pts[pts.length - 2]!.close : null;
  };
  const change = (key: string) => {
    const l = last(key), p = prev(key);
    return l != null && p != null && p !== 0 ? Math.round((l / p - 1) * 10000) / 100 : null;
  };

  // VIX term structure
  const vixTermStructure = [
    { label: "VIX9D", days: 9, value: last("vix9d") },
    { label: "VIX", days: 30, value: last("vix") },
    { label: "VIX3M", days: 90, value: last("vix3m") },
    { label: "VIX6M", days: 180, value: last("vix6m") },
    { label: "VIX1Y", days: 365, value: last("vix1y") },
  ].filter((d) => d.value != null) as Array<{ label: string; days: number; value: number }>;

  // Contango/backwardation detection
  const vix30 = last("vix"), vix3m = last("vix3m");
  const vixStructure = vix30 != null && vix3m != null
    ? vix30 > vix3m ? "Backwardation" : "Contango"
    : "Unknown";

  // VIX vs SPY time series (last 90 days)
  const vixSeries = dataMap["vix"]?.slice(-90) ?? [];
  const spySeries = dataMap["spy"]?.slice(-90) ?? [];
  const vixSpyChart: Array<{ date: string; vix: number; spy: number }> = [];
  const spyMap = new Map(spySeries.map((p) => [p.date, p.close]));
  for (const p of vixSeries) {
    const s = spyMap.get(p.date);
    if (s != null) vixSpyChart.push({ date: p.date, vix: p.close, spy: s });
  }

  // Rolling 30-day correlation VIX vs SPY
  const vixReturns: number[] = [], spyReturns: number[] = [];
  for (let i = 1; i < vixSpyChart.length; i++) {
    vixReturns.push(vixSpyChart[i]!.vix / vixSpyChart[i - 1]!.vix - 1);
    spyReturns.push(vixSpyChart[i]!.spy / vixSpyChart[i - 1]!.spy - 1);
  }
  const vixSpyCorr30 = pearson(vixReturns.slice(-30), spyReturns.slice(-30));

  // Cross-asset volatility dashboard
  const crossAssetVol = [
    { label: "S&P 500", ticker: "SPY", hv30: computeHV(dataMap["spy"]?.map((p) => p.close) ?? [], 30), iv: last("vix") ? last("vix")! / 100 : null },
    { label: "Nasdaq 100", ticker: "QQQ", hv30: computeHV(dataMap["qqq"]?.map((p) => p.close) ?? [], 30), iv: null },
    { label: "Russell 2000", ticker: "IWM", hv30: computeHV(dataMap["iwm"]?.map((p) => p.close) ?? [], 30), iv: null },
    { label: "Dow Jones", ticker: "DIA", hv30: computeHV(dataMap["dia"]?.map((p) => p.close) ?? [], 30), iv: null },
    { label: "Gold", ticker: "GLD", hv30: computeHV(dataMap["gld"]?.map((p) => p.close) ?? [], 30), iv: last("gvz") ? last("gvz")! / 100 : null },
    { label: "Treasuries", ticker: "TLT", hv30: computeHV(dataMap["tlt"]?.map((p) => p.close) ?? [], 30), iv: last("tyvix") ? last("tyvix")! / 100 : null },
    { label: "US Dollar", ticker: "UUP", hv30: computeHV(dataMap["uup"]?.map((p) => p.close) ?? [], 30), iv: null },
  ];

  // SKEW index (tail risk)
  const skewVal = last("skew");
  const skewChange = change("skew");
  const skewSeries = (dataMap["skew"] ?? []).slice(-60).map((p) => ({ date: p.date, value: p.close }));

  // VVIX (vol of vol)
  const vvixVal = last("vvix");
  const vvixChange = change("vvix");
  const vvixSeries = (dataMap["vvix"] ?? []).slice(-60).map((p) => ({ date: p.date, value: p.close }));

  // VIX history for sparkline
  const vixHistory = (dataMap["vix"] ?? []).slice(-60).map((p) => ({ date: p.date, value: p.close }));

  return NextResponse.json({
    vix: { value: last("vix"), change: change("vix"), history: vixHistory },
    vvix: { value: vvixVal, change: vvixChange, history: vvixSeries },
    skew: { value: skewVal, change: skewChange, history: skewSeries },
    vixTermStructure,
    vixStructure,
    vixSpyChart,
    vixSpyCorr30,
    crossAssetVol,
    ovx: { value: last("ovx"), change: change("ovx") },
    gvz: { value: last("gvz"), change: change("gvz") },
    tyvix: { value: last("tyvix"), change: change("tyvix") },
  });
}
