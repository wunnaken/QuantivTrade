export const revalidate = 300;

import { NextResponse } from "next/server";

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

interface FredObs {
  date: string;
  value: string;
}

interface StockQuote {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  prevClose: number | null;
}

/** Fetch all FRED observations from a start date (ascending). */
async function fredFrom(
  seriesId: string,
  key: string,
  startDate: string,
): Promise<{ date: string; value: number | null }[]> {
  try {
    const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${key}&file_type=json&observation_start=${startDate}&sort_order=asc`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const json = (await res.json()) as { observations?: FredObs[] };
    return (json.observations ?? []).map((o) => ({
      date: o.date,
      value: o.value === "." ? null : parseFloat(o.value),
    }));
  } catch {
    return [];
  }
}

/** Fetch last N FRED observations (descending, then reversed to ascending). */
async function fredLast(
  seriesId: string,
  key: string,
  limit: number,
): Promise<{ date: string; value: number | null }[]> {
  try {
    const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${key}&file_type=json&limit=${limit}&sort_order=desc`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const json = (await res.json()) as { observations?: FredObs[] };
    return (json.observations ?? [])
      .map((o) => ({ date: o.date, value: o.value === "." ? null : parseFloat(o.value) }))
      .reverse();
  } catch {
    return [];
  }
}

/**
 * Try all series IDs in parallel and return the one whose last valid observation
 * is most recent — handles discontinued series gracefully.
 */
async function fredWithFallbacks(
  seriesIds: string[],
  key: string,
  startDate: string,
): Promise<{ date: string; value: number | null }[]> {
  const allResults = await Promise.all(seriesIds.map((id) => fredFrom(id, key, startDate)));
  let bestData: { date: string; value: number | null }[] = [];
  let bestLastDate = "";
  for (const data of allResults) {
    const valid = data.filter((d) => d.value !== null);
    if (valid.length < 3) continue;
    const lastDate = valid[valid.length - 1].date;
    if (lastDate > bestLastDate) {
      bestLastDate = lastDate;
      bestData = data;
    }
  }
  return bestData;
}

async function fetchFinnhubQuote(
  symbol: string,
  name: string,
  token: string,
): Promise<StockQuote> {
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${token}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error("bad response");
    const q = (await res.json()) as { c?: number; d?: number; dp?: number; pc?: number };
    // Treat price=0 as unavailable (Finnhub returns 0 for unsupported symbols)
    const price = q.c && q.c > 0 ? q.c : null;
    return {
      symbol,
      name,
      price,
      change: price !== null && q.d !== undefined ? q.d : null,
      changePercent: price !== null && q.dp !== undefined ? q.dp : null,
      prevClose: price !== null && q.pc !== undefined ? q.pc : null,
    };
  } catch {
    return { symbol, name, price: null, change: null, changePercent: null, prevClose: null };
  }
}

/** Merge weekly mortgage history with monthly FEDFUNDS (carry-forward). */
function buildMortgageHistory(
  mort30: { date: string; value: number | null }[],
  mort15: { date: string; value: number | null }[],
  mort5: { date: string; value: number | null }[],
  fedFunds: { date: string; value: number | null }[],
) {
  const allDates = [
    ...new Set([...mort30.map((d) => d.date), ...mort15.map((d) => d.date), ...mort5.map((d) => d.date)]),
  ].sort();

  const m30 = Object.fromEntries(mort30.map((d) => [d.date, d.value]));
  const m15 = Object.fromEntries(mort15.map((d) => [d.date, d.value]));
  const m5 = Object.fromEntries(mort5.map((d) => [d.date, d.value]));

  // Walk fedFunds in parallel, carrying forward the last known value
  let ffIdx = 0;
  let currentFF: number | null = null;

  return allDates.map((date) => {
    while (ffIdx < fedFunds.length && fedFunds[ffIdx].date <= date) {
      if (fedFunds[ffIdx].value !== null) currentFF = fedFunds[ffIdx].value;
      ffIdx++;
    }
    return {
      date,
      r30: m30[date] ?? null,
      r15: m15[date] ?? null,
      r5: m5[date] ?? null,
      ff: currentFF,
    };
  });
}

function buildPpiSeries(raw: { date: string; value: number | null }[]) {
  const valid = raw.filter((d) => d.value !== null);
  const current = valid[valid.length - 1] ?? null;
  const prev = valid[valid.length - 2] ?? null;
  const momChange =
    current?.value && prev?.value
      ? parseFloat(((current.value / prev.value - 1) * 100).toFixed(2))
      : null;
  const yoyIdx = valid.length >= 13 ? valid[valid.length - 13] : null;
  const yoyChange =
    current?.value && yoyIdx?.value
      ? parseFloat(((current.value / yoyIdx.value - 1) * 100).toFixed(2))
      : null;
  return {
    current: current?.value ?? null,
    asOf: current?.date ?? null,
    momChange,
    yoyChange,
    history: valid.map((d) => ({ date: d.date, value: d.value as number })),
  };
}

// ─── Stock lists ──────────────────────────────────────────────────────────────

const HOMEBUILDERS = [
  { symbol: "DHI", name: "D.R. Horton" },
  { symbol: "LEN", name: "Lennar" },
  { symbol: "PHM", name: "PulteGroup" },
  { symbol: "TOL", name: "Toll Brothers" },
  { symbol: "KBH", name: "KB Home" },
  { symbol: "NVR", name: "NVR Inc." },
];

const HOME_IMPROVEMENT = [
  { symbol: "HD", name: "Home Depot" },
  { symbol: "LOW", name: "Lowe's" },
  { symbol: "BLDR", name: "Builders FirstSource" },
  { symbol: "CARR", name: "Carrier Global" },
];

const MATERIALS_STOCKS = [
  { symbol: "MLM", name: "Martin Marietta" },
  { symbol: "VMC", name: "Vulcan Materials" },
  { symbol: "NUE", name: "Nucor Steel" },
  { symbol: "STLD", name: "Steel Dynamics" },
  { symbol: "MAS", name: "Masco Corp" },
  { symbol: "URI", name: "United Rentals" },
];

export async function GET() {
  const fredKey = process.env.FRED_API_KEY?.trim();
  const finnhubKey = process.env.FINNHUB_API_KEY?.trim();

  if (!fredKey) {
    return NextResponse.json({ error: "Missing FRED_API_KEY" }, { status: 500 });
  }

  // Fetch all data in parallel
  const [mort30, mort15, mort5, fedFundsHist, primeHist, lumberRaw, steelRaw, copperRaw] =
    await Promise.all([
      // Mortgage series from 2020 so all three series share a common date range.
      // NOTE: MORTGAGE5US was discontinued by Freddie Mac in Nov 2022.
      fredFrom("MORTGAGE30US", fredKey, "2020-01-01"),
      fredFrom("MORTGAGE15US", fredKey, "2020-01-01"),
      fredFrom("MORTGAGE5US", fredKey, "2020-01-01"),
      // FEDFUNDS monthly from 2020 (to overlay on mortgage chart)
      fredFrom("FEDFUNDS", fredKey, "2020-01-01"),
      // Prime rate — last 5 values is enough for current reading
      fredLast("DPRIME", fredKey, 5),
      // PPI series from 2019 (6 years for timeframe toggle in UI)
      // Lumber: WPS0811 was discontinued; fall through to NAICS-based Sawmills series
      fredWithFallbacks(["WPS0811", "PCU321113321113", "PCU3219--3219--"], fredKey, "2019-01-01"),
      // Steel: primary WPS1013, fallback to PCU331110331110 (NAICS Steel Mills)
      fredWithFallbacks(["WPS1013", "PCU331110331110", "PCU3312--3312--"], fredKey, "2019-01-01"),
      // Copper: primary WPS1322, fallback to PCU331420331420 (NAICS Copper Rolling/Drawing)
      fredWithFallbacks(["WPS1322", "PCU331420331420", "PCU3314--3314--"], fredKey, "2019-01-01"),
    ]);

  const mortgageHistory = buildMortgageHistory(mort30, mort15, mort5, fedFundsHist);

  const latestMort30 = mort30.findLast((d) => d.value !== null);
  const latestMort15 = mort15.findLast((d) => d.value !== null);
  const latestMort5 = mort5.findLast((d) => d.value !== null);
  const latestFedFunds = fedFundsHist.findLast((d) => d.value !== null);
  const latestPrime = primeHist.findLast((d) => d.value !== null);

  // Stock quotes
  let stocks: {
    homebuilders: StockQuote[];
    homeImprovement: StockQuote[];
    materials: StockQuote[];
  } = { homebuilders: [], homeImprovement: [], materials: [] };

  if (finnhubKey) {
    const [hbQ, hiQ, matQ] = await Promise.all([
      Promise.all(HOMEBUILDERS.map((s) => fetchFinnhubQuote(s.symbol, s.name, finnhubKey))),
      Promise.all(HOME_IMPROVEMENT.map((s) => fetchFinnhubQuote(s.symbol, s.name, finnhubKey))),
      Promise.all(MATERIALS_STOCKS.map((s) => fetchFinnhubQuote(s.symbol, s.name, finnhubKey))),
    ]);
    stocks = { homebuilders: hbQ, homeImprovement: hiQ, materials: matQ };
  }

  return NextResponse.json({
    mortgageRates: {
      current: {
        rate30: latestMort30?.value ?? null,
        rate15: latestMort15?.value ?? null,
        rate5arm: latestMort5?.value ?? null,
        asOf: latestMort30?.date ?? null,
        asOf5arm: latestMort5?.date ?? null,
      },
      history: mortgageHistory,
    },
    keyRates: {
      fedFunds: { value: latestFedFunds?.value ?? null, asOf: latestFedFunds?.date ?? null },
      prime: { value: latestPrime?.value ?? null, asOf: latestPrime?.date ?? null },
    },
    ppi: {
      lumber: buildPpiSeries(lumberRaw),
      steel: buildPpiSeries(steelRaw),
      copper: buildPpiSeries(copperRaw),
    },
    stocks,
  });
}
