import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FINNHUB = process.env.FINNHUB_API_KEY ?? "";

let sentimentCache: { data: unknown; fetchedAt: number } | null = null;
const CACHE_MS = 5 * 60 * 1000;

// ─── News sentiment helpers ──────────────────────────────────────────────────

const POS_WORDS = new Set(["surge","rally","gain","rise","jump","boom","growth","profit","beat","record","bullish","upgrade","strong","soar","advance","positive","outperform","robust","recovery","expand","high","win","optimism","rebound"]);
const NEG_WORDS = new Set(["crash","drop","fall","decline","slump","loss","miss","bearish","downgrade","weak","plunge","tumble","retreat","fear","sell","negative","recession","deficit","risk","warning","cut","layoff","default","concern","tariff","crisis"]);

function scoreHeadlines(headlines: string[]): number {
  if (headlines.length === 0) return 50;
  let total = 0;
  for (const h of headlines) {
    const words = h.toLowerCase().split(/\W+/);
    let s = 0;
    for (const w of words) {
      if (POS_WORDS.has(w)) s++;
      if (NEG_WORDS.has(w)) s--;
    }
    total += s;
  }
  // Normalize: each headline contributes roughly ±3 points to a 50-centered score
  return Math.max(10, Math.min(90, 50 + (total / headlines.length) * 8));
}

async function fetchNewsForSymbol(symbol: string): Promise<string[]> {
  if (!FINNHUB) return [];
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const from = weekAgo.toISOString().slice(0, 10);
    const to = now.toISOString().slice(0, 10);
    const r = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${FINNHUB}`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return [];
    const news = await r.json() as Array<{ headline?: string }>;
    return (news ?? []).slice(0, 20).map(n => n.headline ?? "").filter(Boolean);
  } catch { return []; }
}

// ─── Finnhub helpers ──────────────────────────────────────────────────────────

async function fQuote(symbol: string): Promise<{ c: number; d: number; dp: number; pc: number } | null> {
  if (!FINNHUB) return null;
  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB}`,
      { cache: "no-store" }
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
      { cache: "no-store" }
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

/** Continuous score: blends distance from SMA20 (40%), SMA50 (30%), and day % change (30%) */
function continuousScore(price: number, sma20Val: number, sma50Val: number | null, dayPctChange: number): number {
  // SMA20 component: how far price is from 20-day MA, scaled to 0-100
  const pctFrom20 = ((price - sma20Val) / sma20Val) * 100;
  const sma20Score = 50 + pctFrom20 * 5; // ±2% from SMA20 = ±10 points

  // SMA50 component
  const sma50Score = sma50Val
    ? 50 + ((price - sma50Val) / sma50Val) * 100 * 4
    : sma20Score;

  // Day change component: ±2% daily move = ±20 points
  const dayScore = 50 + dayPctChange * 10;

  const raw = sma20Score * 0.4 + sma50Score * 0.3 + dayScore * 0.3;
  return Math.max(5, Math.min(95, Math.round(raw)));
}

async function scoreETF(symbol: string, label: string): Promise<ScoreResult> {
  const [quote, candles, headlines] = await Promise.all([fQuote(symbol), fCandles(symbol, 65), fetchNewsForSymbol(symbol)]);

  if (!quote) return { score: 50, detail: `${label} data unavailable`, hist: [50, 50] };

  const dp = quote.dp;

  if (candles && candles.c.length >= 20) {
    const closes = candles.c;
    const n = closes.length;
    const current = closes[n - 1];

    const sma20 = sma(closes, 20)!;
    const sma50 = sma(closes, Math.min(50, n));

    const technicalScore = continuousScore(current, sma20, sma50, dp);
    // Blend: 70% technical + 30% news sentiment
    const newsScore = scoreHeadlines(headlines);
    const score = Math.round(technicalScore * 0.7 + newsScore * 0.3);

    // Week ago: reconstruct score at ~5 trading days back
    const wIdx = Math.max(0, n - 6);
    const weekClose = closes[wIdx];
    const wSma20 = wIdx >= 20 ? sma(closes.slice(0, wIdx + 1), 20)! : sma20;
    const wSma50 = wIdx >= 50 ? sma(closes.slice(0, wIdx + 1), 50) : null;
    const wDayDp = wIdx > 0 ? ((weekClose - closes[wIdx - 1]) / closes[wIdx - 1]) * 100 : 0;
    const weekScore = continuousScore(weekClose, wSma20, wSma50, wDayDp);

    // Month ago: reconstruct score at ~21 trading days back
    const mIdx = Math.max(0, n - 22);
    const monthClose = closes[mIdx];
    const mSma20 = mIdx >= 20 ? sma(closes.slice(0, mIdx + 1), 20)! : sma20;
    const mSma50 = mIdx >= 50 ? sma(closes.slice(0, mIdx + 1), 50) : null;
    const mDayDp = mIdx > 0 ? ((monthClose - closes[mIdx - 1]) / closes[mIdx - 1]) * 100 : 0;
    const monthScore = continuousScore(monthClose, mSma20, mSma50, mDayDp);

    const dir = dp >= 0 ? "+" : "";
    const tone = score > 65 ? "strong uptrend" : score > 50 ? "mild positive bias" : score > 35 ? "mild weakness" : "downtrend";
    return {
      score,
      detail: `${label} ${dir}${dp.toFixed(2)}% today — ${tone}`,
      hist: [weekScore, monthScore],
    };
  }

  // Fallback: day change only
  const score = continuousScore(quote.c, quote.c * 0.99, null, dp);
  const dir = dp >= 0 ? "+" : "";
  return {
    score,
    detail: `${label} ${dir}${dp.toFixed(2)}% today`,
    hist: [score - 3, score - 6], // slight decay for fallback
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
  if (sentimentCache && Date.now() - sentimentCache.fetchedAt < CACHE_MS) {
    return NextResponse.json(sentimentCache.data);
  }

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

  const responseData = {
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
  };
  sentimentCache = { data: responseData, fetchedAt: Date.now() };
  return NextResponse.json(responseData);
}
