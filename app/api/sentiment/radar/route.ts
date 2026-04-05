import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FINNHUB = process.env.FINNHUB_API_KEY ?? "";

// ─── Finnhub helpers ──────────────────────────────────────────────────────────

async function fQuote(symbol: string): Promise<{ c: number; d: number; dp: number; pc: number } | null> {
  if (!FINNHUB) return null;
  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB}`,
      { next: { revalidate: 300 } }
    );
    if (!r.ok) return null;
    const d = await r.json() as { c?: number; d?: number; dp?: number; pc?: number };
    if (!d.c) return null;
    return { c: d.c, d: d.d ?? 0, dp: d.dp ?? 0, pc: d.pc ?? d.c };
  } catch { return null; }
}

async function fCandles(symbol: string, days: number): Promise<{ t: number[]; c: number[] } | null> {
  if (!FINNHUB) return null;
  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 86400;
  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${FINNHUB}`,
      { next: { revalidate: 300 } }
    );
    if (!r.ok) return null;
    const d = await r.json() as { t?: number[]; c?: number[]; s?: string };
    if (d.s !== "ok" || !d.t?.length) return null;
    return { t: d.t, c: d.c! };
  } catch { return null; }
}

function sma(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  return closes.slice(-period).reduce((a, b) => a + b, 0) / period;
}

// ─── Generic ETF scorer ───────────────────────────────────────────────────────

interface ScoreResult {
  score: number;
  detail: string;
  hist: [number, number]; // [weekAgo, monthAgo]
}

async function scoreETF(symbol: string, label: string): Promise<ScoreResult> {
  const [quote, candles] = await Promise.all([fQuote(symbol), fCandles(symbol, 65)]);

  if (!quote) return { score: 50, detail: `${label} data unavailable`, hist: [50, 50] };

  const dp = quote.dp;

  if (candles && candles.c.length >= 20) {
    const closes = candles.c;
    const n = closes.length;
    const current = closes[n - 1];

    const sma20 = sma(closes, 20)!;
    const sma50 = sma(closes, Math.min(50, n));

    const above20 = current > sma20;
    const above50 = sma50 ? current > sma50 : true;

    const posScore = above20 && above50 ? 70 : above20 ? 58 : above50 ? 44 : 28;
    const dayAdj = dp > 2 ? 14 : dp > 1 ? 7 : dp > 0 ? 3 : dp > -1 ? -3 : dp > -2 ? -7 : -14;
    const score = Math.max(10, Math.min(90, posScore + dayAdj));

    // Week ago: price ~5 trading days back
    const weekClose = n >= 6 ? closes[n - 6] : current;
    const wSma20 = n >= 25 ? sma(closes.slice(0, n - 5), 20)! : sma20;
    const wAbove20 = weekClose > wSma20;
    const weekScore = Math.max(10, Math.min(90, (wAbove20 ? 65 : 35) + (weekClose < current ? 5 : -5)));

    // Month ago: ~21 trading days back
    const monthClose = n >= 22 ? closes[n - 22] : current;
    const mSma20Arr = closes.slice(0, Math.max(0, n - 21));
    const mSma20 = mSma20Arr.length >= 20 ? sma(mSma20Arr, 20)! : sma20;
    const mAbove20 = monthClose > mSma20;
    const monthScore = Math.max(10, Math.min(90, (mAbove20 ? 65 : 35) + (monthClose < current ? 5 : -5)));

    const dir = dp >= 0 ? "+" : "";
    const tone = score > 65 ? "strong uptrend" : score > 50 ? "mild positive bias" : score > 35 ? "mild weakness" : "downtrend";
    return {
      score,
      detail: `${label} ${dir}${dp.toFixed(2)}% today — ${tone}`,
      hist: [weekScore, monthScore],
    };
  }

  // Fallback: day change only
  const score = dp > 2 ? 80 : dp > 1 ? 68 : dp > 0.2 ? 56 : dp > -0.2 ? 46 : dp > -1 ? 34 : dp > -2 ? 22 : 12;
  const dir = dp >= 0 ? "+" : "";
  return {
    score,
    detail: `${label} ${dir}${dp.toFixed(2)}% today`,
    hist: [score, score],
  };
}

function scoreToLabel(score: number): string {
  if (score >= 80) return "Extreme Greed";
  if (score >= 60) return "Greed";
  if (score >= 40) return "Neutral";
  if (score >= 20) return "Fear";
  return "Extreme Fear";
}

export async function GET() {
  const [
    tech, realEstate, energy, healthcare, finance, consumer, industrials, materials,
    usa, europe, china, japan, uk, emerging,
  ] = await Promise.all([
    scoreETF("XLK",  "Tech"),
    scoreETF("XLRE", "Real Estate"),
    scoreETF("XLE",  "Energy"),
    scoreETF("XLV",  "Healthcare"),
    scoreETF("XLF",  "Finance"),
    scoreETF("XLY",  "Consumer"),
    scoreETF("XLI",  "Industrials"),
    scoreETF("XLB",  "Materials"),
    scoreETF("SPY",  "USA"),
    scoreETF("VGK",  "Europe"),
    scoreETF("FXI",  "China"),
    scoreETF("EWJ",  "Japan"),
    scoreETF("EWU",  "UK"),
    scoreETF("VWO",  "Emerging"),
  ]);

  const sectors = [tech, realEstate, energy, healthcare, finance, consumer, industrials, materials];

  const current = {
    tech: tech.score, realEstate: realEstate.score, energy: energy.score,
    healthcare: healthcare.score, finance: finance.score, consumer: consumer.score,
    industrials: industrials.score, materials: materials.score,
  };
  const weekAgo = {
    tech: tech.hist[0], realEstate: realEstate.hist[0], energy: energy.hist[0],
    healthcare: healthcare.hist[0], finance: finance.hist[0], consumer: consumer.hist[0],
    industrials: industrials.hist[0], materials: materials.hist[0],
  };
  const monthAgo = {
    tech: tech.hist[1], realEstate: realEstate.hist[1], energy: energy.hist[1],
    healthcare: healthcare.hist[1], finance: finance.hist[1], consumer: consumer.hist[1],
    industrials: industrials.hist[1], materials: materials.hist[1],
  };

  const overallScore = Math.round(sectors.reduce((s, d) => s + d.score, 0) / sectors.length);

  return NextResponse.json({
    current,
    weekAgo,
    monthAgo,
    overallScore,
    label: scoreToLabel(overallScore),
    interpretations: {
      tech:        tech.detail,
      realEstate:  realEstate.detail,
      energy:      energy.detail,
      healthcare:  healthcare.detail,
      finance:     finance.detail,
      consumer:    consumer.detail,
      industrials: industrials.detail,
      materials:   materials.detail,
    },
    countries: {
      usa:      { score: usa.score,      weekAgo: usa.hist[0],      monthAgo: usa.hist[1],      detail: usa.detail },
      europe:   { score: europe.score,   weekAgo: europe.hist[0],   monthAgo: europe.hist[1],   detail: europe.detail },
      china:    { score: china.score,    weekAgo: china.hist[0],    monthAgo: china.hist[1],    detail: china.detail },
      japan:    { score: japan.score,    weekAgo: japan.hist[0],    monthAgo: japan.hist[1],    detail: japan.detail },
      uk:       { score: uk.score,       weekAgo: uk.hist[0],       monthAgo: uk.hist[1],       detail: uk.detail },
      emerging: { score: emerging.score, weekAgo: emerging.hist[0], monthAgo: emerging.hist[1], detail: emerging.detail },
    },
    lastUpdated: new Date().toISOString(),
  });
}
