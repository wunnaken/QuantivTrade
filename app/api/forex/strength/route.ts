import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD"] as const;

// Each entry: [oanda_symbol, base, quote]
const PAIRS: [string, string, string][] = [
  ["EUR_USD", "EUR", "USD"], ["GBP_USD", "GBP", "USD"], ["USD_JPY", "USD", "JPY"],
  ["USD_CHF", "USD", "CHF"], ["AUD_USD", "AUD", "USD"], ["USD_CAD", "USD", "CAD"],
  ["NZD_USD", "NZD", "USD"], ["EUR_GBP", "EUR", "GBP"], ["EUR_JPY", "EUR", "JPY"],
  ["EUR_CHF", "EUR", "CHF"], ["EUR_AUD", "EUR", "AUD"], ["EUR_CAD", "EUR", "CAD"],
  ["GBP_JPY", "GBP", "JPY"], ["GBP_CHF", "GBP", "CHF"], ["GBP_AUD", "GBP", "AUD"],
  ["GBP_CAD", "GBP", "CAD"], ["AUD_JPY", "AUD", "JPY"], ["AUD_CAD", "AUD", "CAD"],
  ["AUD_NZD", "AUD", "NZD"], ["CAD_JPY", "CAD", "JPY"], ["NZD_JPY", "NZD", "JPY"],
  ["NZD_CAD", "NZD", "CAD"], ["CHF_JPY", "CHF", "JPY"],
];

async function fetchChangePct(oanda: string, key: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=OANDA:${oanda}&token=${key}`,
      { cache: "no-store", signal: AbortSignal.timeout(8_000) },
    );
    if (!res.ok) return null;
    const d = await res.json() as { dp?: number };
    return typeof d.dp === "number" ? d.dp : null;
  } catch { return null; }
}

export async function GET() {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return NextResponse.json({ error: "FINNHUB_API_KEY not configured" }, { status: 500 });

  const results = await Promise.allSettled(PAIRS.map(([sym]) => fetchChangePct(sym, key)));

  const sums: Record<string, number> = {}, counts: Record<string, number> = {};
  for (const c of CURRENCIES) { sums[c] = 0; counts[c] = 0; }

  for (let i = 0; i < PAIRS.length; i++) {
    const r = results[i];
    if (r?.status !== "fulfilled" || r.value === null) continue;
    const [, base, quote] = PAIRS[i]!;
    const dp = r.value;
    sums[base]!  += dp;  counts[base]!++;
    sums[quote]! -= dp;  counts[quote]!++;
  }

  const raw: Record<string, number> = {};
  for (const c of CURRENCIES) raw[c] = counts[c]! > 0 ? sums[c]! / counts[c]! : 0;

  const vals = Object.values(raw);
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;

  const strength: Record<string, number> = {};
  for (const c of CURRENCIES) strength[c] = Math.round(((raw[c]! - min) / range) * 100);

  return NextResponse.json({ ...strength, lastUpdated: new Date().toISOString() });
}
