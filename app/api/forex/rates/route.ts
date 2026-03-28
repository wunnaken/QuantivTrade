import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ForexPair = {
  symbol: string;
  base: string;
  quote: string;
  rate: number;
  bid: number;
  ask: number;
  spread: number;     // in pips
  change: number;
  changePct: number;
  high24h: number;
  low24h: number;
  baseFlag: string;
  quoteFlag: string;
};

// ─── Pair definitions ─────────────────────────────────────────────────────────

const FLAGS: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵", CHF: "🇨🇭",
  AUD: "🇦🇺", CAD: "🇨🇦", NZD: "🇳🇿", CNY: "🇨🇳", TRY: "🇹🇷",
  ZAR: "🇿🇦", MXN: "🇲🇽", BRL: "🇧🇷", THB: "🇹🇭", SGD: "🇸🇬",
  HKD: "🇭🇰", NOK: "🇳🇴", SEK: "🇸🇪", DKK: "🇩🇰", PLN: "🇵🇱",
  HUF: "🇭🇺", CZK: "🇨🇿", ILS: "🇮🇱",
  XAU: "🥇", XAG: "🥈", XPT: "⬜", XPD: "⬛",
};

// Typical retail spreads in pips
const SPREADS: Record<string, number> = {
  "EUR/USD": 1.0, "GBP/USD": 1.5, "USD/JPY": 1.0, "USD/CHF": 2.0,
  "AUD/USD": 1.5, "USD/CAD": 2.0, "NZD/USD": 2.0, "USD/CNY": 8.0,
  "EUR/GBP": 2.0, "EUR/JPY": 2.5, "EUR/CHF": 3.0, "EUR/AUD": 3.0,
  "EUR/CAD": 3.0, "GBP/JPY": 3.0, "GBP/CHF": 4.0, "AUD/JPY": 3.0,
  "AUD/NZD": 3.0, "CAD/JPY": 3.5, "CHF/JPY": 3.0, "NZD/JPY": 3.5,
  "USD/TRY": 20.0, "USD/ZAR": 25.0, "USD/MXN": 8.0, "USD/BRL": 30.0,
  "USD/THB": 15.0, "USD/SGD": 5.0, "USD/HKD": 5.0, "USD/NOK": 8.0,
  "USD/SEK": 8.0, "USD/DKK": 8.0, "USD/PLN": 12.0, "USD/HUF": 18.0,
  "USD/CZK": 12.0, "USD/ILS": 12.0,
  "XAU/USD": 35.0, "XAG/USD": 3.0, "XPT/USD": 150.0, "XPD/USD": 300.0,
};

type PairDef = { symbol: string; base: string; quote: string; oanda?: string };

const MAJOR_PAIRS: PairDef[] = [
  { symbol: "EUR/USD", base: "EUR", quote: "USD", oanda: "EUR_USD" },
  { symbol: "GBP/USD", base: "GBP", quote: "USD", oanda: "GBP_USD" },
  { symbol: "USD/JPY", base: "USD", quote: "JPY", oanda: "USD_JPY" },
  { symbol: "USD/CHF", base: "USD", quote: "CHF", oanda: "USD_CHF" },
  { symbol: "AUD/USD", base: "AUD", quote: "USD", oanda: "AUD_USD" },
  { symbol: "USD/CAD", base: "USD", quote: "CAD", oanda: "USD_CAD" },
  { symbol: "NZD/USD", base: "NZD", quote: "USD", oanda: "NZD_USD" },
  { symbol: "USD/CNY", base: "USD", quote: "CNY", oanda: "USD_CNY" },
];

const MINOR_PAIRS: PairDef[] = [
  { symbol: "EUR/GBP", base: "EUR", quote: "GBP", oanda: "EUR_GBP" },
  { symbol: "EUR/JPY", base: "EUR", quote: "JPY", oanda: "EUR_JPY" },
  { symbol: "EUR/CHF", base: "EUR", quote: "CHF", oanda: "EUR_CHF" },
  { symbol: "EUR/AUD", base: "EUR", quote: "AUD", oanda: "EUR_AUD" },
  { symbol: "EUR/CAD", base: "EUR", quote: "CAD", oanda: "EUR_CAD" },
  { symbol: "GBP/JPY", base: "GBP", quote: "JPY", oanda: "GBP_JPY" },
  { symbol: "GBP/CHF", base: "GBP", quote: "CHF", oanda: "GBP_CHF" },
  { symbol: "AUD/JPY", base: "AUD", quote: "JPY", oanda: "AUD_JPY" },
  { symbol: "AUD/NZD", base: "AUD", quote: "NZD", oanda: "AUD_NZD" },
  { symbol: "CAD/JPY", base: "CAD", quote: "JPY", oanda: "CAD_JPY" },
  { symbol: "CHF/JPY", base: "CHF", quote: "JPY", oanda: "CHF_JPY" },
  { symbol: "NZD/JPY", base: "NZD", quote: "JPY", oanda: "NZD_JPY" },
];

const EXOTIC_PAIRS: PairDef[] = [
  { symbol: "USD/TRY", base: "USD", quote: "TRY", oanda: "USD_TRY" },
  { symbol: "USD/ZAR", base: "USD", quote: "ZAR", oanda: "USD_ZAR" },
  { symbol: "USD/MXN", base: "USD", quote: "MXN", oanda: "USD_MXN" },
  { symbol: "USD/BRL", base: "USD", quote: "BRL" },
  { symbol: "USD/THB", base: "USD", quote: "THB" },
  { symbol: "USD/SGD", base: "USD", quote: "SGD", oanda: "USD_SGD" },
  { symbol: "USD/HKD", base: "USD", quote: "HKD", oanda: "USD_HKD" },
  { symbol: "USD/NOK", base: "USD", quote: "NOK", oanda: "USD_NOK" },
  { symbol: "USD/SEK", base: "USD", quote: "SEK", oanda: "USD_SEK" },
  { symbol: "USD/DKK", base: "USD", quote: "DKK", oanda: "USD_DKK" },
  { symbol: "USD/PLN", base: "USD", quote: "PLN" },
  { symbol: "USD/HUF", base: "USD", quote: "HUF" },
  { symbol: "USD/CZK", base: "USD", quote: "CZK" },
  { symbol: "USD/ILS", base: "USD", quote: "ILS" },
];

const COMMODITY_PAIRS: PairDef[] = [
  { symbol: "XAU/USD", base: "XAU", quote: "USD", oanda: "XAU_USD" },
  { symbol: "XAG/USD", base: "XAG", quote: "USD", oanda: "XAG_USD" },
  { symbol: "XPT/USD", base: "XPT", quote: "USD", oanda: "XPT_USD" },
  { symbol: "XPD/USD", base: "XPD", quote: "USD", oanda: "XPD_USD" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pipMultiplier(pair: PairDef): number {
  if (["XAU", "XAG", "XPT", "XPD"].includes(pair.base)) return 10;
  return pair.base === "JPY" || pair.quote === "JPY" ? 100 : 10000;
}

function calcRate(rates: Record<string, number>, base: string, quote: string): number | null {
  if (base === "USD") return rates[quote] ?? null;
  if (quote === "USD") return rates[base] ? 1 / rates[base] : null;
  const rBase = rates[base], rQuote = rates[quote];
  if (!rBase || !rQuote) return null;
  return rQuote / rBase;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function finnhub<T>(path: string, key: string): Promise<T | null> {
  try {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`https://finnhub.io/api/v1${path}${sep}token=${key}`, {
      cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? (res.json() as Promise<T>) : null;
  } catch { return null; }
}

async function fetchDXY(): Promise<{ value: number; change: number; changePct: number; history: { date: string; value: number }[] } | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const p1 = now - 95 * 86400;
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=1d&period1=${p1}&period2=${now}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10_000), cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = await res.json() as { chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: (number | null)[] }> } }> } };
    const r = json?.chart?.result?.[0];
    if (!r) return null;
    const ts = r.timestamp ?? [], cs = r.indicators?.quote?.[0]?.close ?? [];
    const pts: { date: string; value: number }[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = cs[i]; if (c == null || !isFinite(c)) continue;
      pts.push({ date: new Date(ts[i]! * 1000).toISOString().slice(0, 10), value: Math.round(c * 100) / 100 });
    }
    if (pts.length < 2) return null;
    const last = pts[pts.length - 1]!.value, prev = pts[pts.length - 2]!.value;
    return { value: last, change: Math.round((last - prev) * 1000) / 1000, changePct: Math.round((last - prev) / prev * 10000) / 100, history: pts.slice(-90) };
  } catch { return null; }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET() {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return NextResponse.json({ error: "FINNHUB_API_KEY not configured" }, { status: 500 });

  // Parallel: base rates + DXY
  const [ratesResp, dxy] = await Promise.all([
    finnhub<{ quote?: Record<string, number> }>("/forex/rates?base=USD", key),
    fetchDXY(),
  ]);
  const rates: Record<string, number> = ratesResp?.quote ?? {};

  // Fetch OANDA quotes for majors + minors (for change/high/low)
  const quotable = [...MAJOR_PAIRS, ...MINOR_PAIRS, ...COMMODITY_PAIRS].filter((p) => p.oanda);
  const quoteResults = await Promise.allSettled(
    quotable.map((p) => finnhub<{ c: number; d: number; dp: number; h: number; l: number }>(`/quote?symbol=OANDA:${p.oanda}`, key)),
  );
  const quoteMap: Record<string, { c: number; d: number; dp: number; h: number; l: number }> = {};
  for (let i = 0; i < quotable.length; i++) {
    const r = quoteResults[i];
    if (r?.status === "fulfilled" && r.value?.c && r.value.c > 0) quoteMap[quotable[i]!.symbol] = r.value;
  }

  function buildPair(def: PairDef): ForexPair | null {
    const q = quoteMap[def.symbol];
    const rawRate = q?.c ?? calcRate(rates, def.base, def.quote);
    if (!rawRate || !isFinite(rawRate) || rawRate <= 0) return null;
    const pm = pipMultiplier(def);
    const sp = SPREADS[def.symbol] ?? 5;
    const half = sp / pm / 2;
    const rate  = Math.round(rawRate * 100000) / 100000;
    return {
      symbol: def.symbol, base: def.base, quote: def.quote,
      rate,
      bid:       Math.round((rate - half) * 100000) / 100000,
      ask:       Math.round((rate + half) * 100000) / 100000,
      spread:    sp,
      change:    q ? Math.round(q.d * 100000) / 100000 : 0,
      changePct: q ? Math.round(q.dp * 100) / 100 : 0,
      high24h:   q?.h ? Math.round(q.h * 100000) / 100000 : Math.round(rate * 1.005 * 100000) / 100000,
      low24h:    q?.l ? Math.round(q.l * 100000) / 100000 : Math.round(rate * 0.995 * 100000) / 100000,
      baseFlag:  FLAGS[def.base]  ?? "🏳",
      quoteFlag: FLAGS[def.quote] ?? "🏳",
    };
  }

  return NextResponse.json({
    majors:     MAJOR_PAIRS.map(buildPair).filter(Boolean),
    minors:     MINOR_PAIRS.map(buildPair).filter(Boolean),
    exotics:    EXOTIC_PAIRS.map(buildPair).filter(Boolean),
    commodities:COMMODITY_PAIRS.map(buildPair).filter(Boolean),
    dxy,
    lastUpdated: new Date().toISOString(),
  });
}
