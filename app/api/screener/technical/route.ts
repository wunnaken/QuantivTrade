import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface TechnicalResult {
  rsi: number | null;
  sma50: number | null;
  sma200: number | null;
  aboveSma50: boolean;
  aboveSma200: boolean;
}

type PriceEngineResponse = {
  closes?: number[];
  close?: number[];
  [key: string]: unknown;
};

function calcRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0,
    losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d;
    else losses -= d;
  }
  let avgGain = gains / period,
    avgLoss = losses / period;
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

async function fetchTechnicals(
  symbol: string,
  engineUrl: string
): Promise<TechnicalResult> {
  const nullResult: TechnicalResult = {
    rsi: null,
    sma50: null,
    sma200: null,
    aboveSma50: false,
    aboveSma200: false,
  };

  try {
    const res = await fetch(
      `${engineUrl}/data/price?ticker=${encodeURIComponent(symbol)}&period=1y`,
      { cache: "no-store" }
    );
    if (!res.ok) return nullResult;

    const data = (await res.json()) as PriceEngineResponse;
    const closes: number[] = Array.isArray(data.closes)
      ? data.closes
      : Array.isArray(data.close)
      ? data.close
      : [];

    if (closes.length === 0) return nullResult;

    const currentPrice = closes[closes.length - 1];
    const rsi = calcRSI(closes);
    const sma50 = calcSMA(closes, 50);
    const sma200 = calcSMA(closes, 200);

    return {
      rsi,
      sma50,
      sma200,
      aboveSma50: sma50 !== null ? currentPrice > sma50 : false,
      aboveSma200: sma200 !== null ? currentPrice > sma200 : false,
    };
  } catch {
    return nullResult;
  }
}

export async function GET(request: NextRequest) {
  const engineUrl = process.env.BACKTEST_ENGINE_URL;
  if (!engineUrl) {
    return NextResponse.json({} as Record<string, TechnicalResult>);
  }

  const tickersParam = request.nextUrl.searchParams.get("tickers") ?? "";
  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  if (tickers.length === 0) {
    return NextResponse.json({} as Record<string, TechnicalResult>);
  }

  const results = await Promise.all(
    tickers.map((symbol) => fetchTechnicals(symbol, engineUrl))
  );

  const output: Record<string, TechnicalResult> = {};
  for (let i = 0; i < tickers.length; i++) {
    output[tickers[i]] = results[i];
  }

  return NextResponse.json(output);
}
