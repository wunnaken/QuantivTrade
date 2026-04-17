import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

/**
 * Per-month SPY summary for the year view bar chart.
 *
 * Returns one row per month with the factors that diagnose monthly market activity:
 *   - return%       : (close_last - close_first) / close_first × 100
 *   - avgVolume     : daily average shares traded
 *   - rangePct      : avg daily (high - low) / open × 100   — volatility proxy
 *   - tradingDays   : how many SPY daily candles fell in this month
 *   - isCurrent     : true for the in-progress month
 *   - isComplete    : true if the month has fully ended
 *
 * SPY is the data source because it's the standard liquid US-equity benchmark
 * — gives a consistent monthly read on direction, volume, and vol regardless
 * of what idiosyncratic moves happened in single names.
 */

type FmpHistoryRow = {
  symbol?: string;
  date: string;        // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type MonthSummary = {
  month: number;
  monthName: string;
  return: number | null;
  avgVolume: number | null;
  rangePct: number | null;
  tradingDays: number;
  highImpactEvents: number;
  isCurrent: boolean;
  isComplete: boolean;
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function GET(request: NextRequest) {
  const yearStr = request.nextUrl.searchParams.get("year");
  const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();
  if (Number.isNaN(year) || year < 1990 || year > 2100) {
    return NextResponse.json({ error: "invalid year" }, { status: 400 });
  }

  const fmpKey = process.env.FMP_API_KEY?.trim();
  if (!fmpKey) {
    return NextResponse.json({ months: emptyMonths(year), error: "FMP_API_KEY not set" });
  }

  const today = new Date();
  const fromStr = `${year}-01-01`;
  // Don't ask FMP for future days — it just returns nothing and wastes a call.
  const toDate = year < today.getFullYear() ? new Date(year, 11, 31) : today;
  const toStr = toDate.toISOString().slice(0, 10);

  try {
    // Use FMP's `stable` EOD endpoint — works on free tier, returns full OHLCV.
    // The legacy /api/v3/historical-price-full/SPY is paid-tier only.
    const url = `https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=SPY&from=${fromStr}&to=${toStr}&apikey=${fmpKey}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[year-market-summary] FMP", res.status, body.slice(0, 200));
      return NextResponse.json({ months: emptyMonths(year), error: `FMP ${res.status}` });
    }
    // Stable endpoint returns either an array directly or { historical: [...] }
    // depending on plan/version. Handle both.
    const raw = await res.json();
    const arr: FmpHistoryRow[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.historical)
      ? raw.historical
      : [];
    const rows = arr.slice().sort((a, b) => a.date.localeCompare(b.date));
    return NextResponse.json({ months: aggregateByMonth(rows, year, today) });
  } catch (e) {
    console.error("[year-market-summary]", e);
    return NextResponse.json({
      months: emptyMonths(year),
      error: e instanceof Error ? e.message : "Failed to load market summary",
    });
  }
}

function emptyMonths(year: number): MonthSummary[] {
  const today = new Date();
  return MONTH_NAMES.map((name, i) => ({
    month: i + 1,
    monthName: name,
    return: null,
    avgVolume: null,
    rangePct: null,
    tradingDays: 0,
    highImpactEvents: 0,
    isCurrent: year === today.getFullYear() && today.getMonth() === i,
    isComplete: year < today.getFullYear() || (year === today.getFullYear() && today.getMonth() > i),
  }));
}

function aggregateByMonth(rows: FmpHistoryRow[], year: number, today: Date): MonthSummary[] {
  const buckets: FmpHistoryRow[][] = Array.from({ length: 12 }, () => []);
  for (const r of rows) {
    const m = parseInt(r.date.slice(5, 7), 10);
    if (!Number.isFinite(m) || m < 1 || m > 12) continue;
    buckets[m - 1].push(r);
  }

  return buckets.map((bucket, i) => {
    const month = i + 1;
    const isCurrent = year === today.getFullYear() && today.getMonth() === i;
    const isComplete =
      year < today.getFullYear() || (year === today.getFullYear() && today.getMonth() > i);

    if (bucket.length === 0) {
      return {
        month,
        monthName: MONTH_NAMES[i],
        return: null,
        avgVolume: null,
        rangePct: null,
        tradingDays: 0,
        highImpactEvents: 0,
        isCurrent,
        isComplete,
      };
    }

    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    const monthReturn = first.close > 0 ? ((last.close - first.close) / first.close) * 100 : null;
    const avgVolume = bucket.reduce((s, r) => s + r.volume, 0) / bucket.length;
    const avgRange =
      bucket.reduce((s, r) => {
        if (r.open <= 0) return s;
        return s + ((r.high - r.low) / r.open) * 100;
      }, 0) / bucket.length;

    return {
      month,
      monthName: MONTH_NAMES[i],
      return: monthReturn,
      avgVolume,
      rangePct: avgRange,
      tradingDays: bucket.length,
      highImpactEvents: 0, // reserved for future enrichment; bar uses SPY data only
      isCurrent,
      isComplete,
    };
  });
}
