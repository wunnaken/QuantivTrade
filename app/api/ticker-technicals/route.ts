import { NextRequest, NextResponse } from "next/server";
import { sma, ema, rsi, macd, bollingerBands } from "@/lib/backtest/indicators";

export const revalidate = 3600;

function toFinnhubSymbol(ticker: string): string {
  const u = ticker.toUpperCase();
  if (u === "BTC") return "BINANCE:BTCUSDT";
  if (u === "ETH") return "BINANCE:ETHUSDT";
  return u;
}

async function fetchCandles(symbol: string, token: string, days = 365) {
  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 86400;
  const isCrypto = symbol.startsWith("BINANCE:");
  const base = isCrypto
    ? "https://finnhub.io/api/v1/crypto/candle"
    : "https://finnhub.io/api/v1/stock/candle";
  const url = `${base}?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${token}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const d = await res.json();
  if (d?.s === "no_data" || !Array.isArray(d?.t) || d.t.length < 10) return null;
  return {
    closes: d.c as number[],
    highs: d.h as number[],
    lows: d.l as number[],
    opens: d.o as number[],
    times: d.t as number[],
  };
}

function stochastic(closes: number[], highs: number[], lows: number[], period = 14, smoothK = 3, smoothD = 3) {
  const n = closes.length;
  const rawK: (number | null)[] = new Array(n).fill(null);
  for (let i = period - 1; i < n; i++) {
    const slice_h = highs.slice(i - period + 1, i + 1);
    const slice_l = lows.slice(i - period + 1, i + 1);
    const hh = Math.max(...slice_h);
    const ll = Math.min(...slice_l);
    rawK[i] = hh === ll ? 0 : ((closes[i] - ll) / (hh - ll)) * 100;
  }
  // Smooth %K
  const smoothedK: (number | null)[] = new Array(n).fill(null);
  for (let i = period - 1 + smoothK - 1; i < n; i++) {
    const vals = rawK.slice(i - smoothK + 1, i + 1).filter((v) => v !== null) as number[];
    if (vals.length === smoothK) smoothedK[i] = vals.reduce((a, b) => a + b, 0) / smoothK;
  }
  // %D = SMA of smoothed %K
  const smoothedD: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const vals = smoothedK.slice(Math.max(0, i - smoothD + 1), i + 1).filter((v) => v !== null) as number[];
    if (vals.length === smoothD) smoothedD[i] = vals.reduce((a, b) => a + b, 0) / smoothD;
  }
  return { k: smoothedK[n - 1], d: smoothedD[n - 1] };
}

function cci(closes: number[], highs: number[], lows: number[], period = 20) {
  const n = closes.length;
  if (n < period) return null;
  const tps = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const slice = tps.slice(n - period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const mad = slice.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
  if (mad === 0) return 0;
  return (tps[n - 1] - mean) / (0.015 * mad);
}

function pearsonCorrelation(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  if (n < 10) return null;
  const xs = a.slice(a.length - n);
  const ys = b.slice(b.length - n);
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? null : num / den;
}

function dailyReturns(closes: number[]) {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  return returns;
}

function stddev(arr: number[]) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length);
}

function sharpe(returns: number[], riskFree = 0.0525) {
  if (returns.length < 20) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const sd = stddev(returns);
  if (sd === 0) return null;
  return ((mean * 252 - riskFree) / (sd * Math.sqrt(252)));
}

function sortino(returns: number[], riskFree = 0.0525) {
  if (returns.length < 20) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const negReturns = returns.filter((r) => r < 0);
  if (negReturns.length === 0) return null;
  const downDev = Math.sqrt(negReturns.reduce((a, b) => a + b ** 2, 0) / negReturns.length);
  if (downDev === 0) return null;
  return ((mean * 252 - riskFree) / (downDev * Math.sqrt(252)));
}

function maxDrawdown(closes: number[]) {
  let peak = closes[0];
  let maxDD = 0;
  for (const c of closes) {
    if (c > peak) peak = c;
    const dd = (c - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }
  return maxDD; // negative number
}

function var95(returns: number[], price: number) {
  if (returns.length < 20) return null;
  const sorted = [...returns].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.05);
  return Math.abs(sorted[idx] * price);
}

function findSupportResistance(closes: number[], highs: number[], lows: number[], lookback = 90) {
  const n = Math.min(closes.length, lookback);
  const recentLows = lows.slice(-n);
  const recentHighs = highs.slice(-n);
  const supports: number[] = [];
  const resistances: number[] = [];
  // Local minima/maxima with window 5
  for (let i = 2; i < recentLows.length - 2; i++) {
    if (recentLows[i] <= recentLows[i - 1] && recentLows[i] <= recentLows[i - 2] &&
        recentLows[i] <= recentLows[i + 1] && recentLows[i] <= recentLows[i + 2]) {
      supports.push(recentLows[i]);
    }
    if (recentHighs[i] >= recentHighs[i - 1] && recentHighs[i] >= recentHighs[i - 2] &&
        recentHighs[i] >= recentHighs[i + 1] && recentHighs[i] >= recentHighs[i + 2]) {
      resistances.push(recentHighs[i]);
    }
  }
  // Return top 3 each, deduplicated (rounded to 2dp)
  const uniqueSupports = [...new Set(supports.map((v) => Math.round(v * 100) / 100))].sort((a, b) => b - a).slice(0, 3);
  const uniqueRes = [...new Set(resistances.map((v) => Math.round(v * 100) / 100))].sort((a, b) => a - b).slice(0, 3);
  return { supports: uniqueSupports, resistances: uniqueRes };
}

function pivotPoints(high: number, low: number, close: number) {
  const p = (high + low + close) / 3;
  return {
    p: Math.round(p * 100) / 100,
    r1: Math.round((2 * p - low) * 100) / 100,
    r2: Math.round((p + high - low) * 100) / 100,
    s1: Math.round((2 * p - high) * 100) / 100,
    s2: Math.round((p - high + low) * 100) / 100,
  };
}

function gaugeScore(rsiVal: number | null, macdHist: number | null, stochK: number | null, price: number, ma10: number | null, ma20: number | null, ma50: number | null, ma200: number | null) {
  let score = 0;
  // RSI
  if (rsiVal != null) {
    if (rsiVal < 30) score += 2;
    else if (rsiVal < 50) score += 1;
    else if (rsiVal > 70) score -= 2;
    else score -= 1;
  }
  // MACD histogram
  if (macdHist != null) score += macdHist > 0 ? 1 : -1;
  // Stochastic
  if (stochK != null) {
    if (stochK < 20) score += 2;
    else if (stochK > 80) score -= 2;
  }
  // MAs
  const mas = [ma10, ma20, ma50, ma200];
  for (const ma of mas) {
    if (ma != null) score += price > ma ? 1 : -1;
  }
  return Math.max(-8, Math.min(8, score));
}

function gaugeLabel(score: number) {
  if (score >= 5) return "Strong Buy";
  if (score >= 2) return "Buy";
  if (score >= -1) return "Neutral";
  if (score >= -4) return "Sell";
  return "Strong Sell";
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.trim().toUpperCase();
  if (!ticker) return NextResponse.json({ error: "Missing ticker" }, { status: 400 });

  const token = process.env.FINNHUB_API_KEY;
  if (!token) return NextResponse.json({ error: "No API key" }, { status: 500 });

  const sym = toFinnhubSymbol(ticker);

  // Fetch ticker + SPY + QQQ in parallel for correlation
  const [tickerCandles, spyCandles, qqqCandles] = await Promise.all([
    fetchCandles(sym, token, 365),
    fetchCandles("SPY", token, 365),
    fetchCandles("QQQ", token, 365),
  ]);

  if (!tickerCandles) {
    return NextResponse.json({ error: "No price data" }, { status: 404 });
  }

  const closes = tickerCandles.closes;
  const highs = tickerCandles.highs;
  const lows = tickerCandles.lows;
  const price = closes[closes.length - 1];

  // Indicators
  const rsiVals = rsi(closes);
  const macdVals = macd(closes);
  const bbVals = bollingerBands(closes);
  const sma10Vals = sma(closes, 10);
  const sma20Vals = sma(closes, 20);
  const sma50Vals = sma(closes, 50);
  const sma200Vals = sma(closes, 200);
  const ema10Vals = ema(closes, 10);
  const ema20Vals = ema(closes, 20);
  const ema50Vals = ema(closes, 50);
  const ema200Vals = ema(closes, 200);

  const last = closes.length - 1;
  const rsiVal = rsiVals[last];
  const macdVal = macdVals[last];
  const bbVal = bbVals[last];
  const sma10 = sma10Vals[last];
  const sma20 = sma20Vals[last];
  const sma50 = sma50Vals[last];
  const sma200 = sma200Vals[last];
  const ema10 = ema10Vals[last];
  const ema20 = ema20Vals[last];
  const ema50 = ema50Vals[last];
  const ema200 = ema200Vals[last];

  const stoch = stochastic(closes, highs, lows);
  const cciVal = cci(closes, highs, lows);

  // Risk metrics
  const returns = dailyReturns(closes);
  const sharpeVal = sharpe(returns);
  const sortinoVal = sortino(returns);
  const maxDD = maxDrawdown(closes);
  const varVal = var95(returns, price);

  // Support / resistance
  const { supports, resistances } = findSupportResistance(closes, highs, lows);

  // Pivots (use last 3 candles: yesterday's H/L/C)
  const pivotIdx = Math.max(0, last - 1);
  const pivots = pivotPoints(highs[pivotIdx], lows[pivotIdx], closes[pivotIdx]);

  // Correlation
  let correlationSPY: number | null = null;
  let correlationQQQ: number | null = null;
  let betaSPY: number | null = null;

  if (spyCandles && spyCandles.closes.length >= 20) {
    const spyReturns = dailyReturns(spyCandles.closes);
    const tickerReturns = dailyReturns(closes);
    const minLen = Math.min(tickerReturns.length, spyReturns.length);
    const tr = tickerReturns.slice(-minLen);
    const sr = spyReturns.slice(-minLen);
    correlationSPY = pearsonCorrelation(tr, sr);
    // Beta = cov(r_ticker, r_spy) / var(r_spy)
    if (correlationSPY != null) {
      const sdTicker = stddev(tr);
      const sdSpy = stddev(sr);
      betaSPY = sdSpy === 0 ? null : correlationSPY * sdTicker / sdSpy;
    }
  }

  if (qqqCandles && qqqCandles.closes.length >= 20) {
    const qqqReturns = dailyReturns(qqqCandles.closes);
    const tickerReturns = dailyReturns(closes);
    const minLen = Math.min(tickerReturns.length, qqqReturns.length);
    correlationQQQ = pearsonCorrelation(tickerReturns.slice(-minLen), qqqReturns.slice(-minLen));
  }

  // Expected move (approx from ATR)
  let expectedMove: number | null = null;
  if (closes.length >= 15) {
    const atrSlice = closes.slice(-15);
    const atrSD = stddev(atrSlice);
    const approxIV = (atrSD / price) * Math.sqrt(252);
    expectedMove = Math.round(price * approxIV * Math.sqrt(30 / 252) * 100) / 100; // ~30 day expected move
  }

  const score = gaugeScore(
    rsiVal,
    macdVal?.histogram,
    stoch.k,
    price,
    sma10,
    sma20,
    sma50,
    sma200,
  );

  return NextResponse.json({
    price,
    rsi: rsiVal != null ? Math.round(rsiVal * 100) / 100 : null,
    macd: macdVal
      ? {
          macd: macdVal.macd != null ? Math.round(macdVal.macd * 10000) / 10000 : null,
          signal: macdVal.signal != null ? Math.round(macdVal.signal * 10000) / 10000 : null,
          histogram: macdVal.histogram != null ? Math.round(macdVal.histogram * 10000) / 10000 : null,
        }
      : null,
    stoch: { k: stoch.k != null ? Math.round(stoch.k * 100) / 100 : null, d: stoch.d != null ? Math.round(stoch.d * 100) / 100 : null },
    cci: cciVal != null ? Math.round(cciVal * 100) / 100 : null,
    sma10, sma20, sma50, sma200,
    ema10, ema20, ema50, ema200,
    bollingerBands: bbVal ? { upper: bbVal.upper, middle: bbVal.middle, lower: bbVal.lower } : null,
    sharpe: sharpeVal != null ? Math.round(sharpeVal * 1000) / 1000 : null,
    sortino: sortinoVal != null ? Math.round(sortinoVal * 1000) / 1000 : null,
    maxDrawdown: Math.round(maxDD * 10000) / 100, // as percentage
    var95: varVal != null ? Math.round(varVal * 100) / 100 : null,
    supports,
    resistances,
    pivotPoints: pivots,
    correlationSPY: correlationSPY != null ? Math.round(correlationSPY * 1000) / 1000 : null,
    correlationQQQ: correlationQQQ != null ? Math.round(correlationQQQ * 1000) / 1000 : null,
    beta: betaSPY != null ? Math.round(betaSPY * 1000) / 1000 : null,
    expectedMove,
    gaugeScore: score,
    gaugeLabel: gaugeLabel(score),
  });
}
