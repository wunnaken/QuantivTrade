import { NextRequest, NextResponse } from "next/server";

export const revalidate = 0;

// ─── ticker classification ────────────────────────────────────────────────────

const CRYPTO_TICKERS = new Set(["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX"]);

const COINGECKO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
};

// FMP uses USD-quoted pairs for crypto
const FMP_CRYPTO_SYMBOL: Record<string, string> = {
  BTC: "BTCUSD",
  ETH: "ETHUSD",
  SOL: "SOLUSD",
  BNB: "BNBUSD",
  XRP: "XRPUSD",
  ADA: "ADAUSD",
  DOGE: "DOGEUSD",
  AVAX: "AVAXUSD",
};

// ─── timeframe config ─────────────────────────────────────────────────────────

type Timeframe = "1D" | "1W" | "1M" | "1Y";

const TIMEFRAME: Record<Timeframe, { fromOffsetSec: number; cgDays: number; finnhubResolution: string }> = {
  "1D": { fromOffsetSec:       24 * 60 * 60, cgDays:   1, finnhubResolution: "5"  },
  "1W": { fromOffsetSec:   7 * 24 * 60 * 60, cgDays:   7, finnhubResolution: "60" },
  "1M": { fromOffsetSec:  30 * 24 * 60 * 60, cgDays:  30, finnhubResolution: "D"  },
  "1Y": { fromOffsetSec: 365 * 24 * 60 * 60, cgDays: 365, finnhubResolution: "W"  },
};

const LOOKBACK_SEC = 21 * 24 * 60 * 60;

// ─── types ────────────────────────────────────────────────────────────────────

type PctPoint = { t: number; pct: number };

// ─── shared utils ─────────────────────────────────────────────────────────────

function toDateStr(sec: number): string {
  return new Date(sec * 1000).toISOString().slice(0, 10);
}

function formatChartDate(tSec: number, tf: Timeframe): string {
  const d = new Date(tSec * 1000);
  if (tf === "1D" || tf === "1W") return d.toISOString().slice(0, 16);
  return d.toISOString().slice(0, 10);
}

function pctPointsFromAnchor(times: number[], closes: number[], periodFromSec: number): PctPoint[] {
  const n = Math.min(times.length, closes.length);
  if (n === 0) return [];
  let baseIdx = -1;
  for (let i = 0; i < n; i++) {
    if (times[i]! <= periodFromSec) baseIdx = i;
    else break;
  }
  if (baseIdx < 0) baseIdx = 0;
  const base = closes[baseIdx]!;
  if (!base || !Number.isFinite(base) || base === 0) return [];
  const out: PctPoint[] = [];
  for (let i = baseIdx; i < n; i++) {
    const t = times[i]!;
    const p = closes[i]!;
    if (!p || !Number.isFinite(p)) continue;
    if (t < periodFromSec && i !== baseIdx) continue;
    out.push({ t, pct: ((p - base) / base) * 100 });
  }
  return out;
}

// ─── data sources ─────────────────────────────────────────────────────────────

/** FMP stable EOD — works for both stocks and crypto (BTCUSD etc). Used for 1M / 1Y. */
async function fetchFmpEod(fmpSymbol: string, fromSec: number, toSec: number, apiKey: string): Promise<PctPoint[]> {
  const fromStr = toDateStr(fromSec - LOOKBACK_SEC);
  const toStr   = toDateStr(toSec);
  try {
    const url = `https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=${fmpSymbol}&from=${fromStr}&to=${toStr}&apikey=${apiKey}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { date: string; close: number }[];
    if (!Array.isArray(data) || data.length === 0) return [];
    // FMP returns descending — sort ascending
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    const times  = sorted.map((h) => Math.floor(new Date(`${h.date}T12:00:00Z`).getTime() / 1000));
    const closes = sorted.map((h) => h.close);
    return pctPointsFromAnchor(times, closes, fromSec);
  } catch {
    return [];
  }
}

/** CoinGecko market_chart — free tier, use ONLY sequentially to avoid rate-limits. Used for crypto 1D / 1W. */
async function fetchCoinGeckoIntraday(ticker: string, cgDays: number, fromSec: number): Promise<PctPoint[]> {
  const id = COINGECKO_ID[ticker];
  if (!id) return [];
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${cgDays}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { prices?: [number, number][] };
    const prices = data?.prices;
    if (!Array.isArray(prices) || prices.length === 0) return [];
    const times  = prices.map(([ms]) => Math.floor(ms / 1000));
    const closes = prices.map(([, px]) => px);
    return pctPointsFromAnchor(times, closes, fromSec);
  } catch {
    return [];
  }
}

/** Finnhub candles with resolution fallbacks — used for stock intraday (1D / 1W). */
function finnhubFallbacks(primary: string): string[] {
  if (primary === "5")  return ["5", "60", "D"];
  if (primary === "60") return ["60", "D"];
  return [primary, "D"];
}

async function fetchFinnhubCandles(
  ticker: string,
  resolution: string,
  fromSec: number,
  toSec: number,
  token: string,
): Promise<PctPoint[]> {
  const fromApi = fromSec - LOOKBACK_SEC;
  for (const res of [...new Set(finnhubFallbacks(resolution))]) {
    try {
      const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(ticker)}&resolution=${res}&from=${fromApi}&to=${toSec}&token=${token}`;
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) continue;
      const d = (await r.json()) as { t?: number[]; c?: number[]; s?: string };
      if (d?.s === "no_data" || !Array.isArray(d.t) || !d.t.length) continue;
      const pts = pctPointsFromAnchor(d.t, d.c!, fromSec);
      if (pts.length > 0) return pts;
    } catch {
      continue;
    }
  }
  return [];
}

// ─── merge / average ──────────────────────────────────────────────────────────

function bucketId(tSec: number, tf: Timeframe): string {
  const d = new Date(tSec * 1000);
  if (tf === "1D" || tf === "1W") return d.toISOString().slice(0, 13);
  return d.toISOString().slice(0, 10);
}

function parseBucketIdToUnix(b: string): number {
  if (b.includes("T")) {
    const iso = b.length === 13 ? `${b}:00:00.000Z` : `${b}Z`;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
  }
  const ms = new Date(`${b}T12:00:00.000Z`).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function seriesByBucket(pts: PctPoint[], tf: Timeframe): Map<string, PctPoint> {
  const m = new Map<string, PctPoint>();
  for (const p of pts) {
    const id = bucketId(p.t, tf);
    const prev = m.get(id);
    if (!prev || p.t >= prev.t) m.set(id, p);
  }
  return m;
}

function mergeSeriesAligned(tickers: string[], byTicker: Record<string, PctPoint[]>, tf: Timeframe) {
  const perTicker = new Map<string, Map<string, PctPoint>>();
  const bucketSet = new Set<string>();
  for (const tk of tickers) {
    const m = seriesByBucket(byTicker[tk] ?? [], tf);
    perTicker.set(tk, m);
    for (const id of m.keys()) bucketSet.add(id);
  }
  const buckets = [...bucketSet].sort();
  if (buckets.length === 0) return { dates: [] as string[], series: { average: [] as (number | null)[] } };

  const lastPct: Record<string, number | null> = Object.fromEntries(tickers.map((tk) => [tk, null]));
  const dates: string[] = [];
  const series: Record<string, (number | null)[]> = { average: [] };
  for (const tk of tickers) series[tk] = [];

  for (const b of buckets) {
    let tLabel = 0;
    for (const tk of tickers) {
      const p = perTicker.get(tk)?.get(b);
      if (p && p.t > tLabel) tLabel = p.t;
    }
    if (tLabel === 0) tLabel = parseBucketIdToUnix(b);
    dates.push(formatChartDate(tLabel, tf));

    const atBucket: number[] = [];
    for (const tk of tickers) {
      const pt = perTicker.get(tk)?.get(b);
      if (pt != null && Number.isFinite(pt.pct)) lastPct[tk] = pt.pct;
      const v = lastPct[tk];
      if (v != null && Number.isFinite(v)) atBucket.push(v);
      series[tk].push(lastPct[tk]);
    }
    series.average.push(
      atBucket.length === 0 ? null : atBucket.reduce((a, x) => a + x, 0) / atBucket.length,
    );
  }
  return { dates, series };
}

// ─── route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const tickersParam = request.nextUrl.searchParams.get("tickers")?.trim();
  const timeframe = (request.nextUrl.searchParams.get("timeframe")?.toUpperCase() ?? "1M") as Timeframe;

  if (!tickersParam) return NextResponse.json({ error: "Missing tickers", dates: [], series: {} }, { status: 400 });
  if (!TIMEFRAME[timeframe]) return NextResponse.json({ error: "Invalid timeframe", dates: [], series: {} }, { status: 400 });

  const tickers = [...new Set(tickersParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (tickers.length === 0) return NextResponse.json({ dates: [], series: {} });

  const cfg = TIMEFRAME[timeframe];
  const toSec   = Math.floor(Date.now() / 1000);
  const fromSec = toSec - cfg.fromOffsetSec;

  const fmpKey     = process.env.FMP_API_KEY?.trim() ?? "";
  const finnhubKey = process.env.FINNHUB_API_KEY?.trim() ?? "";
  const useDaily   = timeframe === "1M" || timeframe === "1Y";

  const byTicker: Record<string, PctPoint[]> = {};

  if (useDaily) {
    // ── 1M / 1Y: FMP EOD for everything (stocks + crypto) — reliable, no rate issues ──
    await Promise.all(
      tickers.map(async (tk) => {
        const fmpSymbol = CRYPTO_TICKERS.has(tk) ? (FMP_CRYPTO_SYMBOL[tk] ?? null) : tk;
        byTicker[tk] = fmpSymbol && fmpKey ? await fetchFmpEod(fmpSymbol, fromSec, toSec, fmpKey) : [];
      }),
    );
  } else {
    // ── 1D / 1W: CoinGecko (crypto, sequential) + Finnhub (stocks) ──
    // Falls back to FMP daily for any ticker that returns no intraday data.
    const cryptoTickers = tickers.filter((t) => CRYPTO_TICKERS.has(t));
    const equityTickers = tickers.filter((t) => !CRYPTO_TICKERS.has(t));

    // Sequential to avoid CoinGecko free-tier rate limiting
    for (const tk of cryptoTickers) {
      byTicker[tk] = await fetchCoinGeckoIntraday(tk, cfg.cgDays, fromSec);
      if (cryptoTickers.length > 1) await new Promise((r) => setTimeout(r, 400));
    }

    await Promise.all(
      equityTickers.map(async (tk) => {
        byTicker[tk] = finnhubKey
          ? await fetchFinnhubCandles(tk, cfg.finnhubResolution, fromSec, toSec, finnhubKey)
          : [];
      }),
    );

    // Fallback: any ticker still empty → use FMP daily (5–7 data points for 1W, recent close for 1D)
    if (fmpKey) {
      await Promise.all(
        tickers
          .filter((tk) => (byTicker[tk] ?? []).length === 0)
          .map(async (tk) => {
            const fmpSymbol = CRYPTO_TICKERS.has(tk) ? (FMP_CRYPTO_SYMBOL[tk] ?? null) : tk;
            if (fmpSymbol) byTicker[tk] = await fetchFmpEod(fmpSymbol, fromSec, toSec, fmpKey);
          }),
      );
    }
  }

  const { dates, series } = mergeSeriesAligned(tickers, byTicker, timeframe);
  return NextResponse.json({ dates, series });
}
