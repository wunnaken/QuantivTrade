import { NextRequest, NextResponse } from "next/server";
import type { EconomicItem } from "@/lib/calendar/types";
import { getCachedEconomic, setCachedEconomic } from "@/lib/calendar/economic-cache";
import { fetchFOMCDates, isFOMCRelated } from "@/lib/calendar/fomc-dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type { EconomicItem };

/**
 * Economic events for a given date window.
 *
 * Source of truth is FMP `economic_calendar`. We tried FRED's
 * `releases/dates` listing but it returns release-CHANGE timestamps (often one
 * per day FRED touches a release's metadata), so for active releases like
 * Initial Jobless Claims, Chicago Fed Index, FOMC Press Release we'd see one
 * entry per weekday — duplicates. FMP's calendar is the actual published
 * schedule with prev / estimate / actual values.
 *
 * Year-long requests are chunked into ≤90-day windows because FMP free-tier
 * silently truncates very long ranges.
 *
 * On top of FMP we apply FOMC quality control:
 *   - drop any FOMC-named entry whose date isn't a real meeting day
 *     (some FMP rows mislabel daily federal-funds-rate updates)
 *   - backfill any actual FOMC date in the requested window that FMP missed,
 *     so the calendar always shows the meeting card.
 *
 * The hardcoded FOMC schedule lives in lib/calendar/fomc-dates.ts.
 */

type FmpEconEvent = {
  event?: string;
  date?: string; // "YYYY-MM-DD HH:MM:SS"
  country?: string;
  currency?: string;
  previous?: number | null;
  estimate?: number | null;
  actual?: number | null;
  impact?: string;
  unit?: string;
};

function fmtFmpNumber(val: number, unit?: string): string {
  const suffix = unit ? ` ${unit}` : "";
  if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M${suffix}`;
  if (Math.abs(val) >= 1_000 && unit !== "%") return `${(val / 1_000).toFixed(1)}K${suffix}`;
  return `${val.toFixed(2)}${suffix}`;
}

/** Loose name normalization for dedup — strips whitespace, punctuation, and
 *  parenthetical labels like " (NFP)". */
function normalizeEventName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Map FMP event names to a canonical key so duplicate variants of the same
 *  release ("Nonfarm Payrolls" / "Non Farm Payrolls" / "Nonfarm Payrolls (NFP)")
 *  collapse into one entry. */
const CANONICAL_NAME_HINTS: Array<{ contains: string; canonical: string }> = [
  { contains: "nonfarm",         canonical: "nfp" },
  { contains: "payroll",         canonical: "nfp" },
  { contains: "consumerprice",   canonical: "cpi" },
  { contains: "cpi",             canonical: "cpi" },
  { contains: "producerprice",   canonical: "ppi" },
  { contains: "ppi",             canonical: "ppi" },
  { contains: "fomc",            canonical: "fomc" },
  { contains: "ratedecision",    canonical: "fomc" },
  { contains: "interestrate",    canonical: "fomc" },
  { contains: "federalreserve",  canonical: "fomc" },
  { contains: "federalfunds",    canonical: "fomc" },
  { contains: "fedinterest",     canonical: "fomc" },
  { contains: "grossdomestic",   canonical: "gdp" },
  { contains: "gdp",             canonical: "gdp" },
  { contains: "joblessclaims",   canonical: "jobless" },
  { contains: "initialclaims",   canonical: "jobless" },
  { contains: "retailsales",     canonical: "retail" },
  { contains: "retailtrade",     canonical: "retail" },
  { contains: "industrialproduction", canonical: "industrial" },
  { contains: "consumersentiment",    canonical: "sentiment" },
  { contains: "consumerconfidence",   canonical: "sentiment" },
  { contains: "housingstarts",   canonical: "housing" },
  { contains: "newresidential",  canonical: "housing" },
  { contains: "existinghome",    canonical: "homesales" },
  { contains: "durablegoods",    canonical: "durable" },
  { contains: "tradebalance",    canonical: "trade" },
  { contains: "ismmanufacturing", canonical: "ismmfg" },
  { contains: "ismservices",     canonical: "ismsvc" },
  { contains: "ismnonmanufacturing", canonical: "ismsvc" },
  { contains: "personalincome",  canonical: "pce" },
  { contains: "personalspending", canonical: "pce" },
  { contains: "pce",             canonical: "pce" },
  { contains: "chicagofed",      canonical: "chicagofed" },
  { contains: "philadelphiafed", canonical: "philfed" },
  { contains: "empirestate",     canonical: "empirefed" },
];

function canonicalEventKey(name: string): string {
  const norm = normalizeEventName(name);
  for (const { contains, canonical } of CANONICAL_NAME_HINTS) {
    if (norm.includes(contains)) return canonical;
  }
  return norm;
}

/** Fetch FMP economic_calendar in ≤90-day chunks (free tier truncates large
 *  windows). Chunks fan out in parallel. */
async function fetchFromFMP(fromStr: string, toStr: string): Promise<EconomicItem[]> {
  const fmpKey = process.env.FMP_API_KEY?.trim();
  if (!fmpKey) return [];

  const chunks: Array<{ from: string; to: string }> = [];
  const start = new Date(`${fromStr}T00:00:00Z`);
  const end = new Date(`${toStr}T00:00:00Z`);
  let cursor = new Date(start);
  while (cursor <= end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + 90);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
    chunks.push({
      from: cursor.toISOString().slice(0, 10),
      to: chunkEnd.toISOString().slice(0, 10),
    });
    cursor = new Date(chunkEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const fetchChunk = async (range: { from: string; to: string }): Promise<FmpEconEvent[]> => {
    try {
      const url = `https://financialmodelingprep.com/api/v3/economic_calendar?from=${range.from}&to=${range.to}&apikey=${fmpKey}`;
      const res = await fetch(url, { next: { revalidate: 300 } });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? (data as FmpEconEvent[]) : [];
    } catch {
      return [];
    }
  };

  const chunkResults = await Promise.all(chunks.map(fetchChunk));
  const all: FmpEconEvent[] = chunkResults.flat();

  const items: EconomicItem[] = [];
  for (const e of all) {
    if (!e.event || !e.date) continue;
    const country = (e.country ?? "").toLowerCase().trim();
    if (country !== "us" && country !== "united states" && country !== "usa") continue;
    const datePart = e.date.split(" ")[0];
    const timePart = e.date.split(" ")[1]?.slice(0, 5);
    const impactRaw = (e.impact ?? "").toLowerCase();
    const impact: "HIGH" | "MEDIUM" | "LOW" =
      impactRaw === "high" ? "HIGH" : impactRaw === "medium" ? "MEDIUM" : "LOW";
    items.push({
      id: `fmp-${e.event.replace(/\s+/g, "_")}-${datePart}`,
      name: e.event,
      date: datePart,
      dateTimeET: timePart ? `${timePart} ET` : datePart,
      impact,
      country: "US",
      previous: e.previous != null ? fmtFmpNumber(e.previous, e.unit) : undefined,
      estimate: e.estimate != null ? fmtFmpNumber(e.estimate, e.unit) : undefined,
      actual: e.actual != null ? fmtFmpNumber(e.actual, e.unit) : undefined,
      unit: e.unit,
    });
  }
  return items;
}

type FinnhubEconEvent = {
  actual?: number | null;
  country?: string;
  estimate?: number | null;
  event?: string;
  impact?: string;
  prev?: number | null;
  time?: string; // "YYYY-MM-DD HH:MM:SS"
  unit?: string;
};

/** Fetch Finnhub `/calendar/economic` — primary source for scheduled US events.
 *  Free tier covers it and has reliable forward-looking data, including the
 *  full BLS / BEA / Fed schedule months in advance. */
async function fetchFromFinnhub(fromStr: string, toStr: string): Promise<EconomicItem[]> {
  const token = process.env.FINNHUB_API_KEY?.trim();
  if (!token) return [];
  try {
    const url = `https://finnhub.io/api/v1/calendar/economic?from=${fromStr}&to=${toStr}&token=${token}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[economic/finnhub]", res.status, body.slice(0, 200));
      return [];
    }
    const data = await res.json();
    const events = data?.economicCalendar;
    if (!Array.isArray(events)) return [];

    const items: EconomicItem[] = [];
    for (const e of events as FinnhubEconEvent[]) {
      if (!e.event || !e.time) continue;
      const country = (e.country ?? "").toLowerCase().trim();
      if (country !== "us" && country !== "united states" && country !== "usa") continue;
      const datePart = e.time.split(" ")[0];
      const timePart = e.time.split(" ")[1]?.slice(0, 5);
      const impactRaw = (e.impact ?? "").toLowerCase();
      const impact: "HIGH" | "MEDIUM" | "LOW" =
        impactRaw === "high" ? "HIGH" : impactRaw === "medium" ? "MEDIUM" : "LOW";
      items.push({
        id: `fnh-${e.event.replace(/\s+/g, "_")}-${datePart}`,
        name: e.event,
        date: datePart,
        dateTimeET: timePart ? `${timePart} ET` : datePart,
        impact,
        country: "US",
        previous: e.prev != null ? fmtFmpNumber(e.prev, e.unit) : undefined,
        estimate: e.estimate != null ? fmtFmpNumber(e.estimate, e.unit) : undefined,
        actual: e.actual != null ? fmtFmpNumber(e.actual, e.unit) : undefined,
        unit: e.unit,
      });
    }
    return items;
  } catch (e) {
    console.error("[economic/finnhub]", e);
    return [];
  }
}

/** Cross-source dedup: collapse same release across Finnhub + FMP using the
 *  canonical event key + date. Keeps the entry with the most populated data
 *  (prev/estimate/actual filled). */
function mergeAndDedupe(...sources: EconomicItem[][]): EconomicItem[] {
  const byKey = new Map<string, EconomicItem>();
  for (const list of sources) {
    for (const item of list) {
      const key = `${canonicalEventKey(item.name)}::${item.date}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, item);
        continue;
      }
      // Keep whichever has more populated fields
      const score = (it: EconomicItem) =>
        (it.previous ? 1 : 0) + (it.estimate ? 1 : 0) + (it.actual ? 1 : 0);
      if (score(item) > score(existing)) byKey.set(key, item);
    }
  }
  return Array.from(byKey.values());
}

export async function fetchEconomicEvents(
  fromStr: string,
  toStr: string,
  opts: { skipObservations?: boolean } = {}
): Promise<{ economic: EconomicItem[]; dataSource: string; error?: string }> {
  // skipObservations is a vestigial flag from the old FRED enrichment path.
  // Keep accepting it for caller compatibility; LRU keys it separately so old
  // cached responses don't bleed across.
  const cacheKey = opts.skipObservations
    ? `${fromStr}__${toStr}__noobs__v4`
    : `${fromStr}__${toStr}__v4`;
  const cached = getCachedEconomic(cacheKey);
  if (cached) return cached;

  try {
    // Pull both providers in parallel and merge — Finnhub is primary (free
    // tier has reliable forward-looking US events), FMP fills any gaps.
    const [finnItems, fmpItems] = await Promise.all([
      fetchFromFinnhub(fromStr, toStr),
      fetchFromFMP(fromStr, toStr),
    ]);
    let items = mergeAndDedupe(finnItems, fmpItems);

    // FOMC quality control via the hardcoded schedule.
    const yearsToFetch = new Set<number>();
    yearsToFetch.add(parseInt(fromStr.slice(0, 4), 10));
    yearsToFetch.add(parseInt(toStr.slice(0, 4), 10));
    const fomcYearLists = await Promise.all(
      Array.from(yearsToFetch).map((y) => fetchFOMCDates(y))
    );
    const fomcDateSet = new Set<string>(fomcYearLists.flat());

    if (fomcDateSet.size > 0) {
      // Drop FOMC-named items that don't sit on an actual scheduled meeting day
      items = items.filter((item) => !isFOMCRelated(item.name) || fomcDateSet.has(item.date));
      // Backfill any meeting day in the requested window that's missing
      const haveDates = new Set(items.filter((m) => isFOMCRelated(m.name)).map((m) => m.date));
      for (const date of fomcDateSet) {
        if (date < fromStr || date > toStr) continue;
        if (haveDates.has(date)) continue;
        items.push({
          id: `fomc-${date}`,
          name: "FOMC Rate Decision",
          date,
          dateTimeET: date,
          impact: "HIGH",
          country: "US",
        });
      }
    }

    // Sort by date then impact
    const impactOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    items.sort((a, b) => {
      const dateDiff = a.date.localeCompare(b.date);
      if (dateDiff !== 0) return dateDiff;
      return (impactOrder[a.impact] ?? 9) - (impactOrder[b.impact] ?? 9);
    });

    const dataSource =
      finnItems.length > 0 && fmpItems.length > 0
        ? "Finnhub + FMP"
        : finnItems.length > 0
        ? "Finnhub"
        : fmpItems.length > 0
        ? "Financial Modeling Prep"
        : "";
    const result = { economic: items, dataSource };
    setCachedEconomic(cacheKey, result);
    return result;
  } catch (e) {
    return {
      economic: [],
      dataSource: "",
      error: e instanceof Error ? e.message : "Failed to load economic events",
    };
  }
}

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const today = new Date();
  const fromStr = from ?? today.toISOString().split("T")[0];
  const toDate = to
    ? new Date(to)
    : new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const toStr = to ?? toDate.toISOString().split("T")[0];

  const result = await fetchEconomicEvents(fromStr, toStr);
  return NextResponse.json({
    economic: result.economic,
    dataSource: result.dataSource,
    ...(result.error && { error: result.error }),
  });
}
