import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface TechnicalResult {
  rsi: number | null;
  sma50: number | null;
  sma200: number | null;
  aboveSma50: boolean;
  aboveSma200: boolean;
  /** % distance from current price to SMA50 / SMA200, signed.
   *  Positive = price above the average. */
  vsSma50Pct: number | null;
  vsSma200Pct: number | null;
  /** Trailing % returns vs the latest close. */
  weekChangePct: number | null;
  monthChangePct: number | null;
  ytdChangePct: number | null;
  yearChangePct: number | null;
  /** % distance from current to the 52-week high / low. Negative for high
   *  (you are below the high), positive for low (you are above the low). */
  vs52wkHighPct: number | null;
  vs52wkLowPct: number | null;
}

const NULL_RESULT: TechnicalResult = {
  rsi: null,
  sma50: null,
  sma200: null,
  aboveSma50: false,
  aboveSma200: false,
  vsSma50Pct: null,
  vsSma200Pct: null,
  weekChangePct: null,
  monthChangePct: null,
  ytdChangePct: null,
  yearChangePct: null,
  vs52wkHighPct: null,
  vs52wkLowPct: null,
};

type PriceEngineResponse = {
  closes?: number[];
  close?: number[];
  dates?: string[];
  [key: string]: unknown;
};

function calcRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d;
    else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(2));
}

function calcSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(closes.length - period);
  return slice.reduce((sum, v) => sum + v, 0) / period;
}

function pctChange(current: number, prior: number): number | null {
  if (!prior || prior <= 0) return null;
  return parseFloat((((current - prior) / prior) * 100).toFixed(2));
}

/** Builds the full technical snapshot from a closes[] series (oldest → newest)
 *  and matching dates[] (or null). Used by both data sources. */
function computeFromCloses(closes: number[], dates: string[] | null): TechnicalResult {
  if (closes.length === 0) return NULL_RESULT;
  const current = closes[closes.length - 1];
  const sma50 = calcSMA(closes, 50);
  const sma200 = calcSMA(closes, 200);

  // Trailing-period look-backs: ~5 sessions = 1 week, ~21 = 1 month,
  // ~252 = 1 year. We index relative to the latest sample.
  const back = (n: number) => closes[Math.max(0, closes.length - 1 - n)];
  const weekChangePct = closes.length > 5 ? pctChange(current, back(5)) : null;
  const monthChangePct = closes.length > 21 ? pctChange(current, back(21)) : null;
  const yearChangePct = closes.length > 251 ? pctChange(current, back(251)) : null;

  // YTD: find the last close on/before Jan 1 of the current year. Falls back
  // to the earliest close if our window doesn't reach the year boundary.
  let ytdChangePct: number | null = null;
  if (dates && dates.length === closes.length) {
    const year = new Date().getFullYear();
    const yearStart = `${year}-01-01`;
    let anchorIdx = -1;
    for (let i = 0; i < dates.length; i++) {
      if (dates[i] >= yearStart) {
        anchorIdx = i === 0 ? 0 : i - 1;
        break;
      }
    }
    if (anchorIdx >= 0) ytdChangePct = pctChange(current, closes[anchorIdx]);
  }

  // 52-week high / low across the available window (capped at last 252 sessions
  // when we have more).
  const window = closes.slice(Math.max(0, closes.length - 252));
  const wkHigh = Math.max(...window);
  const wkLow = Math.min(...window);

  return {
    rsi: calcRSI(closes),
    sma50,
    sma200,
    aboveSma50: sma50 != null ? current > sma50 : false,
    aboveSma200: sma200 != null ? current > sma200 : false,
    vsSma50Pct: sma50 != null ? pctChange(current, sma50) : null,
    vsSma200Pct: sma200 != null ? pctChange(current, sma200) : null,
    weekChangePct,
    monthChangePct,
    ytdChangePct,
    yearChangePct,
    vs52wkHighPct: pctChange(current, wkHigh),
    vs52wkLowPct: pctChange(current, wkLow),
  };
}

async function fetchFromEngine(symbol: string, engineUrl: string): Promise<TechnicalResult | null> {
  try {
    const res = await fetch(
      `${engineUrl}/data/price?ticker=${encodeURIComponent(symbol)}&period=1y`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as PriceEngineResponse;
    const closes: number[] = Array.isArray(data.closes)
      ? data.closes
      : Array.isArray(data.close)
      ? data.close
      : [];
    const dates: string[] | null = Array.isArray(data.dates) ? data.dates : null;
    if (closes.length === 0) return null;
    return computeFromCloses(closes, dates);
  } catch {
    return null;
  }
}

async function fetchFromFMP(symbol: string, fmpKey: string): Promise<TechnicalResult | null> {
  try {
    // 1-year daily history (light series). FMP's `serietype=line` keeps the
    // payload small (just date + close).
    const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${encodeURIComponent(symbol)}?serietype=line&timeseries=260&apikey=${fmpKey}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { historical?: Array<{ date: string; close: number }> };
    const arr = data.historical ?? [];
    if (arr.length === 0) return null;
    // FMP returns descending — flip to ascending for our calculator.
    const sorted = [...arr].sort((a, b) => a.date.localeCompare(b.date));
    const closes = sorted.map((r) => r.close);
    const dates = sorted.map((r) => r.date);
    return computeFromCloses(closes, dates);
  } catch {
    return null;
  }
}

async function fetchFromFinnhub(symbol: string, finnhubKey: string): Promise<TechnicalResult | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const oneYearAgo = now - 365 * 86400;
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${oneYearAgo}&to=${now}&token=${finnhubKey}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { c?: number[]; t?: number[]; s?: string };
    if (data.s === "no_data" || !Array.isArray(data.c) || data.c.length === 0) return null;
    const dates = Array.isArray(data.t)
      ? data.t.map((ts) => new Date(ts * 1000).toISOString().slice(0, 10))
      : null;
    return computeFromCloses(data.c, dates);
  } catch {
    return null;
  }
}

async function fetchTechnicals(
  symbol: string,
  engineUrl: string | undefined,
  fmpKey: string | undefined
): Promise<TechnicalResult> {
  const finnhubKey = process.env.FINNHUB_API_KEY?.trim();
  // Try engine first (fast, internal), then FMP, then Finnhub candles.
  if (engineUrl) {
    const r = await fetchFromEngine(symbol, engineUrl);
    if (r) return r;
  }
  if (fmpKey) {
    const r = await fetchFromFMP(symbol, fmpKey);
    if (r) return r;
  }
  if (finnhubKey) {
    const r = await fetchFromFinnhub(symbol, finnhubKey);
    if (r) return r;
  }
  return NULL_RESULT;
}

export async function GET(request: NextRequest) {
  const engineUrl = process.env.BACKTEST_ENGINE_URL?.trim();
  const fmpKey = process.env.FMP_API_KEY?.trim();

  const tickersParam = request.nextUrl.searchParams.get("tickers") ?? "";
  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  if (tickers.length === 0) {
    return NextResponse.json({} as Record<string, TechnicalResult>);
  }

  // Batch 10 at a time to stay within Finnhub's 60 req/min free-tier limit.
  // 100 parallel calls would blast the rate limit and silently fail.
  const BATCH = 10;
  const output: Record<string, TechnicalResult> = {};
  for (let i = 0; i < tickers.length; i += BATCH) {
    const batch = tickers.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map((symbol) => fetchTechnicals(symbol, engineUrl, fmpKey))
    );
    for (let j = 0; j < batch.length; j++) {
      output[batch[j]] = results[j];
    }
  }

  return NextResponse.json(output);
}
