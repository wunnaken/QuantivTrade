import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type EconomicItem = {
  id: string;
  name: string;
  date: string;
  dateTimeET: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  country: string;
  previous?: string;
  estimate?: string;
  actual?: string;
  unit?: string;
};

/** Known important FRED releases and their metadata.
 *  `match` is checked against lowercased release_name.
 *  `startsWith` (default false) uses startsWith instead of includes to avoid false positives. */
const IMPORTANT_RELEASES: Array<{
  match: string;
  startsWith?: boolean;
  impact: "HIGH" | "MEDIUM" | "LOW";
  displayName?: string;
  fredSeries?: string;
  unit?: string;
}> = [
  // HIGH impact
  { match: "employment situation",          startsWith: true,  impact: "HIGH",   displayName: "Nonfarm Payrolls (NFP)",       fredSeries: "PAYEMS",          unit: "K" },
  { match: "consumer price index",          startsWith: true,  impact: "HIGH",   displayName: "Consumer Price Index (CPI)",   fredSeries: "CPILFESL",        unit: "Index" },
  { match: "fomc press release",            impact: "HIGH",   displayName: "FOMC Rate Decision",           fredSeries: "FEDFUNDS",        unit: "%" },
  { match: "fomc minutes",                  impact: "HIGH",   displayName: "FOMC Minutes" },
  { match: "gross domestic product",        startsWith: true,  impact: "HIGH",   displayName: "GDP",                          fredSeries: "A191RL1Q225SBEA", unit: "% chg" },
  { match: "personal income and outlay",    startsWith: true,  impact: "HIGH",   displayName: "PCE / Personal Income",        fredSeries: "PCEPILFE",        unit: "Index" },
  { match: "producer price index",          startsWith: true,  impact: "HIGH",   displayName: "Producer Price Index (PPI)",   fredSeries: "PPIACO",          unit: "Index" },
  { match: "retail trade",                  startsWith: true,  impact: "HIGH",   displayName: "Retail Sales",                 fredSeries: "RSXFS",           unit: "$M" },
  // MEDIUM impact
  { match: "unemployment insurance weekly", impact: "MEDIUM", displayName: "Initial Jobless Claims",       fredSeries: "ICSA",            unit: "K" },
  { match: "industrial production",         startsWith: true,  impact: "MEDIUM", displayName: "Industrial Production",        fredSeries: "INDPRO",          unit: "Index" },
  { match: "international trade in goods",  startsWith: true,  impact: "MEDIUM", displayName: "Trade Balance" },
  { match: "new residential construction",  startsWith: true,  impact: "MEDIUM", displayName: "Housing Starts",               fredSeries: "HOUST",           unit: "K" },
  { match: "durable goods",                 startsWith: true,  impact: "MEDIUM", displayName: "Durable Goods Orders" },
  { match: "advance economic indicators",   startsWith: true,  impact: "MEDIUM", displayName: "Advance Trade & Inventories" },
  { match: "consumer confidence",           impact: "MEDIUM", displayName: "Consumer Confidence",          fredSeries: "UMCSENT",         unit: "Index" },
  { match: "consumer sentiment",            impact: "MEDIUM", displayName: "Consumer Sentiment",           fredSeries: "UMCSENT",         unit: "Index" },
  { match: "empire state manufacturing",    impact: "MEDIUM", displayName: "Empire State Mfg. Survey" },
  { match: "philadelphia fed",              impact: "MEDIUM", displayName: "Philadelphia Fed Survey" },
  { match: "chicago fed",                   impact: "MEDIUM", displayName: "Chicago Fed Index" },
  { match: "existing home sales",           impact: "MEDIUM", displayName: "Existing Home Sales" },
  { match: "ism manufacturing",             impact: "HIGH",   displayName: "ISM Manufacturing PMI" },
  { match: "ism non-manufacturing",         impact: "HIGH",   displayName: "ISM Services PMI" },
  { match: "ism service",                   impact: "HIGH",   displayName: "ISM Services PMI" },
  // LOW
  { match: "consumer credit",               startsWith: true,  impact: "LOW",    displayName: "Consumer Credit" },
  { match: "money stock measures",           startsWith: true,  impact: "LOW",    displayName: "Money Supply (M2)" },
];

function matchRelease(releaseName: string): typeof IMPORTANT_RELEASES[number] | null {
  const lower = releaseName.toLowerCase();
  for (const r of IMPORTANT_RELEASES) {
    const hit = r.startsWith ? lower.startsWith(r.match) : lower.includes(r.match);
    if (hit) return r;
  }
  return null;
}

type FredObservation = { date: string; value: string };

async function fetchLatestObs(
  seriesId: string,
  apiKey: string
): Promise<{ latest?: FredObservation; prev?: FredObservation }> {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&sort_order=desc&limit=2&file_type=json`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return {};
    const data = (await res.json()) as { observations?: FredObservation[] };
    const obs = data.observations ?? [];
    return { latest: obs[0], prev: obs[1] };
  } catch {
    return {};
  }
}

function fmtObs(obs: FredObservation | undefined, unit?: string): string | undefined {
  if (!obs || obs.value === "." || obs.value === "") return undefined;
  const val = parseFloat(obs.value);
  if (isNaN(val)) return undefined;
  const suffix = unit ? ` ${unit}` : "";
  // Format large numbers
  if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M${suffix}`;
  if (Math.abs(val) >= 1_000 && unit !== "%") return `${(val / 1_000).toFixed(1)}K${suffix}`;
  return `${val.toFixed(2)}${suffix}`;
}

export async function fetchEconomicEvents(
  fromStr: string,
  toStr: string
): Promise<{ economic: EconomicItem[]; dataSource: string; error?: string }> {
  const fredKey = process.env.FRED_API_KEY;
  if (!fredKey) {
    return { economic: [], dataSource: "", error: "FRED_API_KEY not set." };
  }

  try {
    const url =
      `https://api.stlouisfed.org/fred/releases/dates` +
      `?api_key=${fredKey}` +
      `&realtime_start=${fromStr}&realtime_end=${toStr}` +
      `&include_release_dates_with_no_data=true` +
      `&file_type=json&order_by=release_date&sort_order=asc&limit=500`;

    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) {
      return { economic: [], dataSource: "", error: `FRED API error (${res.status})` };
    }

    const data = (await res.json()) as {
      release_dates?: Array<{
        release_id: number;
        release_name: string;
        date: string;
        release_last_updated?: string | null;
      }>;
    };

    const releaseDates = data.release_dates ?? [];
    const today = new Date().toISOString().slice(0, 10);

    // Deduplicate by release_id — one entry per release per weekly window
    // (e.g. FOMC Press Release may appear on multiple days as FRED updates; we only want it once)
    const seenKey = new Set<number>();
    type Candidate = {
      releaseId: number;
      name: string;
      displayName: string;
      date: string;
      impact: "HIGH" | "MEDIUM" | "LOW";
      fredSeries?: string;
      unit?: string;
    };
    const candidates: Candidate[] = [];

    for (const rd of releaseDates) {
      if (seenKey.has(rd.release_id)) continue;
      const matched = matchRelease(rd.release_name);
      if (!matched) continue;
      seenKey.add(rd.release_id);
      // Prefer release_last_updated date (actual public release) over FRED's internal schedule date
      const releaseDate = rd.release_last_updated
        ? rd.release_last_updated.slice(0, 10)
        : rd.date;
      candidates.push({
        releaseId: rd.release_id,
        name: rd.release_name,
        displayName: matched.displayName ?? rd.release_name,
        date: releaseDate,
        impact: matched.impact,
        fredSeries: matched.fredSeries,
        unit: matched.unit,
      });
    }

    // For past/today events with a known FRED series, fetch actual+prev in parallel
    const obsPromises = candidates.map((c) => {
      if (c.fredSeries && c.date <= today) {
        return fetchLatestObs(c.fredSeries, fredKey);
      }
      return Promise.resolve({});
    });
    const obsResults = await Promise.all(obsPromises);

    const items: EconomicItem[] = candidates.map((c, i) => {
      const { latest, prev } = obsResults[i] as { latest?: FredObservation; prev?: FredObservation };
      return {
        id: `fred-${c.releaseId}-${c.date}`,
        name: c.displayName,
        date: c.date,
        dateTimeET: c.date, // FRED doesn't provide release times
        impact: c.impact,
        country: "US",
        previous: fmtObs(prev, c.unit),
        actual: fmtObs(latest, c.unit),
        unit: c.unit,
      };
    });

    // Sort by date then impact
    const impactOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    items.sort((a, b) => {
      const dateDiff = a.date.localeCompare(b.date);
      if (dateDiff !== 0) return dateDiff;
      return (impactOrder[a.impact] ?? 9) - (impactOrder[b.impact] ?? 9);
    });

    return { economic: items, dataSource: "FRED" };
  } catch (e) {
    return {
      economic: [],
      dataSource: "",
      error: e instanceof Error ? e.message : "Request failed",
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
