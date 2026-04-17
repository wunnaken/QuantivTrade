import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const RISK_FREE_RATE = 0.045;
const YF_HEADERS = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };

// ─── Math helpers ────────────────────────────────────────────────────────────

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * ax);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 0.5 * (1.0 + sign * y);
}

function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function bsGreeks(S: number, K: number, T: number, r: number, sigma: number, type: "call" | "put") {
  if (T <= 0.0001 || sigma <= 0.0001 || S <= 0 || K <= 0)
    return { delta: type === "call" ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gamma: 0, theta: 0, vega: 0, rho: 0 };
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const nd1 = normalCDF(d1);
  const nd2 = normalCDF(d2);
  const pd1 = normalPDF(d1);
  const eRT = Math.exp(-r * T);
  if (type === "call") {
    return {
      delta: round4(nd1),
      gamma: round4(pd1 / (S * sigma * sqrtT)),
      theta: round4((-(S * pd1 * sigma) / (2 * sqrtT) - r * K * eRT * nd2) / 365),
      vega: round4(S * pd1 * sqrtT / 100),
      rho: round4(K * T * eRT * nd2 / 100),
    };
  }
  return {
    delta: round4(nd1 - 1),
    gamma: round4(pd1 / (S * sigma * sqrtT)),
    theta: round4((-(S * pd1 * sigma) / (2 * sqrtT) + r * K * eRT * normalCDF(-d2)) / 365),
    vega: round4(S * pd1 * sqrtT / 100),
    rho: round4(-K * T * eRT * normalCDF(-d2) / 100),
  };
}

function round4(v: number): number { return Math.round(v * 10000) / 10000; }
function round2(v: number): number { return Math.round(v * 100) / 100; }

// ─── Yahoo Finance fetchers ─────────────────────────────────────────────────

type YFOption = {
  strike: number; lastPrice: number; bid: number; ask: number;
  volume: number; openInterest: number; impliedVolatility: number; inTheMoney: boolean;
};

type YFOptionsResult = {
  underlyingSymbol?: string;
  expirationDates?: number[];
  strikes?: number[];
  quote?: { regularMarketPrice?: number; regularMarketChange?: number; regularMarketChangePercent?: number; regularMarketVolume?: number };
  options?: Array<{ expirationDate: number; calls?: YFOption[]; puts?: YFOption[] }>;
};

// Yahoo v7 options requires a crumb + cookies. Cache for 5 minutes.
let cachedCrumb: { crumb: string; cookie: string; ts: number } | null = null;

async function getYFCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  if (cachedCrumb && Date.now() - cachedCrumb.ts < 5 * 60 * 1000) return cachedCrumb;
  try {
    // Step 1: hit fc.yahoo.com to get consent cookies
    const initRes = await fetch("https://fc.yahoo.com", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    });
    // getSetCookie() is the modern API; fall back to raw header parsing
    const setCookies = initRes.headers.getSetCookie?.()
      ?? (initRes.headers.get("set-cookie") ?? "").split(/,(?=\s*\w+=)/).filter(Boolean);
    const cookieStr = setCookies.map((c) => c.split(";")[0]!.trim()).filter(Boolean).join("; ");

    // Step 2: fetch the crumb using the cookies
    const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", Cookie: cookieStr },
      signal: AbortSignal.timeout(8_000),
    });
    if (!crumbRes.ok) return null;
    const crumb = await crumbRes.text();
    if (!crumb || crumb.includes("{")) return null;
    cachedCrumb = { crumb, cookie: cookieStr, ts: Date.now() };
    return cachedCrumb;
  } catch { return null; }
}

async function fetchOptionsChain(ticker: string, expiration?: number): Promise<YFOptionsResult | null> {
  const auth = await getYFCrumb();
  if (!auth) return null;
  const params = new URLSearchParams({ crumb: auth.crumb });
  if (expiration) params.set("date", String(expiration));
  const url = `https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(ticker)}?${params}`;
  try {
    const res = await fetch(url, {
      headers: { ...YF_HEADERS, Cookie: auth.cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) { cachedCrumb = null; return null; }
    const json = await res.json() as { optionChain?: { result?: YFOptionsResult[] } };
    return json?.optionChain?.result?.[0] ?? null;
  } catch { return null; }
}

async function fetchPriceHistory(ticker: string, days: number): Promise<number[]> {
  const now = Math.floor(Date.now() / 1000);
  const period1 = now - (days + 10) * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&period1=${period1}&period2=${now}&includePrePost=false`;
  try {
    const res = await fetch(url, { headers: YF_HEADERS, cache: "no-store", signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return [];
    const json = await res.json() as { chart?: { result?: Array<{ indicators?: { quote?: Array<{ close?: (number | null)[] }> } }> } };
    const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    return closes.filter((c): c is number => c != null && isFinite(c));
  } catch { return []; }
}

// ─── Computed analytics ──────────────────────────────────────────────────────

type ChainEntry = {
  strike: number; lastPrice: number; bid: number; ask: number;
  volume: number; oi: number; iv: number;
  delta: number; gamma: number; theta: number; vega: number; rho: number;
  itm: boolean;
};

function buildChain(raw: YFOption[], spot: number, T: number, type: "call" | "put"): ChainEntry[] {
  return raw.map((o) => {
    const iv = o.impliedVolatility ?? 0;
    const greeks = iv > 0.001 ? bsGreeks(spot, o.strike, T, RISK_FREE_RATE, iv, type) : { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
    return {
      strike: o.strike, lastPrice: o.lastPrice ?? 0, bid: o.bid ?? 0, ask: o.ask ?? 0,
      volume: o.volume ?? 0, oi: o.openInterest ?? 0, iv: round4(iv),
      ...greeks, itm: o.inTheMoney ?? false,
    };
  });
}

function computeMaxPain(calls: ChainEntry[], puts: ChainEntry[]): number {
  const strikes = [...new Set([...calls.map((c) => c.strike), ...puts.map((p) => p.strike)])].sort((a, b) => a - b);
  let minPain = Infinity, maxPainStrike = strikes[0] ?? 0;
  for (const price of strikes) {
    let pain = 0;
    for (const c of calls) { if (price > c.strike) pain += (price - c.strike) * c.oi; }
    for (const p of puts) { if (price < p.strike) pain += (p.strike - price) * p.oi; }
    if (pain < minPain) { minPain = pain; maxPainStrike = price; }
  }
  return maxPainStrike;
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
  return round4(Math.sqrt(variance * 252));
}

// ─── Main handler ────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ticker = (searchParams.get("ticker") ?? "SPY").toUpperCase();
  const expParam = searchParams.get("expiration");

  // 1. Fetch main options chain
  const data = await fetchOptionsChain(ticker, expParam ? parseInt(expParam, 10) : undefined);
  if (!data || !data.options?.length) {
    return NextResponse.json({ error: `No options data available for ${ticker}` }, { status: 404 });
  }

  const spot = data.quote?.regularMarketPrice ?? 0;
  const expirations = data.expirationDates ?? [];
  const selectedExp = data.options[0]!.expirationDate;
  const daysToExpiry = Math.max(1, Math.round((selectedExp - Date.now() / 1000) / 86400));
  const T = daysToExpiry / 365;

  const rawCalls = data.options[0]!.calls ?? [];
  const rawPuts = data.options[0]!.puts ?? [];

  // 2. Build chain with greeks
  const calls = buildChain(rawCalls, spot, T, "call");
  const puts = buildChain(rawPuts, spot, T, "put");

  // 3. Max pain + P/C ratio
  const maxPain = computeMaxPain(calls, puts);
  const totalCallOI = calls.reduce((s, c) => s + c.oi, 0);
  const totalPutOI = puts.reduce((s, p) => s + p.oi, 0);
  const totalCallVol = calls.reduce((s, c) => s + c.volume, 0);
  const totalPutVol = puts.reduce((s, p) => s + p.volume, 0);

  // 4. GEX / DEX per strike
  const strikeMap = new Map<number, { callGamma: number; putGamma: number; callDelta: number; putDelta: number; callOI: number; putOI: number }>();
  for (const c of calls) {
    const e = strikeMap.get(c.strike) ?? { callGamma: 0, putGamma: 0, callDelta: 0, putDelta: 0, callOI: 0, putOI: 0 };
    e.callGamma = c.gamma * c.oi * 100;
    e.callDelta = c.delta * c.oi * 100;
    e.callOI = c.oi;
    strikeMap.set(c.strike, e);
  }
  for (const p of puts) {
    const e = strikeMap.get(p.strike) ?? { callGamma: 0, putGamma: 0, callDelta: 0, putDelta: 0, callOI: 0, putOI: 0 };
    e.putGamma = p.gamma * p.oi * 100;
    e.putDelta = p.delta * p.oi * 100;
    e.putOI = p.oi;
    strikeMap.set(p.strike, e);
  }

  // Filter strikes to ±30% of spot for charts
  const minStrike = spot * 0.7, maxStrike = spot * 1.3;
  const filteredStrikes = [...strikeMap.keys()].filter((k) => k >= minStrike && k <= maxStrike).sort((a, b) => a - b);

  const gex = filteredStrikes.map((strike) => {
    const e = strikeMap.get(strike)!;
    // GEX: calls contribute positive gamma, puts contribute negative (dealer hedging convention)
    return { strike, value: round2((e.callGamma - e.putGamma) * spot * 0.01) };
  });

  const dex = filteredStrikes.map((strike) => {
    const e = strikeMap.get(strike)!;
    return { strike, value: round2(e.callDelta + e.putDelta) };
  });

  const oiByStrike = filteredStrikes.map((strike) => {
    const e = strikeMap.get(strike)!;
    return { strike, callOI: e.callOI, putOI: e.putOI };
  });

  // 5. IV skew (IV across strikes for this expiration)
  const callIVMap = new Map(calls.map((c) => [c.strike, c.iv]));
  const putIVMap = new Map(puts.map((p) => [p.strike, p.iv]));
  const ivSkew = filteredStrikes.map((strike) => ({
    strike,
    callIV: callIVMap.get(strike) ?? null,
    putIV: putIVMap.get(strike) ?? null,
  }));

  // 6. ATM IV (nearest strike to spot)
  const atmStrike = filteredStrikes.reduce((best, s) => Math.abs(s - spot) < Math.abs(best - spot) ? s : best, filteredStrikes[0] ?? spot);
  const atmCallIV = callIVMap.get(atmStrike) ?? 0;
  const atmPutIV = putIVMap.get(atmStrike) ?? 0;
  const atmIV = round4((atmCallIV + atmPutIV) / 2 || atmCallIV || atmPutIV);

  // 7. Fetch price history + additional expirations in parallel
  const termExpCount = Math.min(8, expirations.length);
  const termExps = expirations.slice(0, termExpCount);
  const [closes, ...termResults] = await Promise.all([
    fetchPriceHistory(ticker, 120),
    ...termExps
      .filter((exp) => exp !== selectedExp)
      .map((exp) => fetchOptionsChain(ticker, exp)),
  ]);

  // 8. HV
  const hv30 = computeHV(closes, 30);
  const hv60 = computeHV(closes, 60);
  const hv90 = computeHV(closes, 90);

  // 9. Term structure (ATM IV at each expiration)
  const termStructure: Array<{ date: string; daysOut: number; iv: number }> = [];
  // Add current expiration
  if (atmIV > 0) {
    termStructure.push({ date: new Date(selectedExp * 1000).toISOString().slice(0, 10), daysOut: daysToExpiry, iv: round4(atmIV) });
  }
  // Add other expirations
  for (const result of termResults) {
    if (!result || !result.options?.length) continue;
    const exp = result.options[0]!.expirationDate;
    const dte = Math.max(1, Math.round((exp - Date.now() / 1000) / 86400));
    const rCalls = result.options[0]!.calls ?? [];
    const rPuts = result.options[0]!.puts ?? [];
    // Find ATM
    const allStrikes = [...new Set([...rCalls.map((c) => c.strike), ...rPuts.map((p) => p.strike)])];
    const nearAtm = allStrikes.reduce((best, s) => Math.abs(s - spot) < Math.abs(best - spot) ? s : best, allStrikes[0] ?? spot);
    const cIV = rCalls.find((c) => c.strike === nearAtm)?.impliedVolatility ?? 0;
    const pIV = rPuts.find((p) => p.strike === nearAtm)?.impliedVolatility ?? 0;
    const avgIV = (cIV + pIV) / 2 || cIV || pIV;
    if (avgIV > 0) {
      termStructure.push({ date: new Date(exp * 1000).toISOString().slice(0, 10), daysOut: dte, iv: round4(avgIV) });
    }
  }
  termStructure.sort((a, b) => a.daysOut - b.daysOut);

  // 10. Vol surface (IV across strikes for multiple expirations)
  const volSurface: Array<{ date: string; daysOut: number; data: Array<{ strike: number; callIV: number | null; putIV: number | null }> }> = [];
  // Current expiration
  volSurface.push({ date: new Date(selectedExp * 1000).toISOString().slice(0, 10), daysOut: daysToExpiry, data: ivSkew });
  // Other expirations
  for (const result of termResults) {
    if (!result || !result.options?.length) continue;
    const exp = result.options[0]!.expirationDate;
    const dte = Math.max(1, Math.round((exp - Date.now() / 1000) / 86400));
    const rCalls = result.options[0]!.calls ?? [];
    const rPuts = result.options[0]!.puts ?? [];
    const cMap = new Map(rCalls.filter((c) => c.strike >= minStrike && c.strike <= maxStrike).map((c) => [c.strike, round4(c.impliedVolatility ?? 0)]));
    const pMap = new Map(rPuts.filter((p) => p.strike >= minStrike && p.strike <= maxStrike).map((p) => [p.strike, round4(p.impliedVolatility ?? 0)]));
    const surfStrikes = [...new Set([...cMap.keys(), ...pMap.keys()])].sort((a, b) => a - b);
    volSurface.push({
      date: new Date(exp * 1000).toISOString().slice(0, 10),
      daysOut: dte,
      data: surfStrikes.map((s) => ({ strike: s, callIV: cMap.get(s) ?? null, putIV: pMap.get(s) ?? null })),
    });
  }
  volSurface.sort((a, b) => a.daysOut - b.daysOut);

  // Find GEX flip point (where GEX crosses zero)
  let gexFlip: number | null = null;
  for (let i = 1; i < gex.length; i++) {
    if ((gex[i - 1]!.value < 0 && gex[i]!.value >= 0) || (gex[i - 1]!.value >= 0 && gex[i]!.value < 0)) {
      gexFlip = gex[i]!.strike;
      break;
    }
  }

  return NextResponse.json({
    ticker,
    spot: round2(spot),
    quote: {
      price: round2(spot),
      change: round2(data.quote?.regularMarketChange ?? 0),
      changePct: round2(data.quote?.regularMarketChangePercent ?? 0),
      volume: data.quote?.regularMarketVolume ?? 0,
    },
    expirations,
    selectedExpiration: selectedExp,
    daysToExpiry,
    chain: { calls, puts },
    maxPain,
    putCallRatio: {
      byOI: totalCallOI > 0 ? round4(totalPutOI / totalCallOI) : 0,
      byVolume: totalCallVol > 0 ? round4(totalPutVol / totalCallVol) : 0,
    },
    gex, dex, oiByStrike, ivSkew, termStructure, volSurface,
    hv: { hv30, hv60, hv90 },
    atmIV,
    gexFlip,
    totalCallOI, totalPutOI, totalCallVol, totalPutVol,
  });
}
