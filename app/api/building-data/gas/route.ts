import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GRADES = [
  { id: "GASREGCOVW", label: "Regular",  color: "#4f9cf9" },
  { id: "GASMIDCOVW", label: "Midgrade", color: "#a78bfa" },
  { id: "GASPRMCOVW", label: "Premium",  color: "#f59e0b" },
  { id: "GASDESW",    label: "Diesel",   color: "#f97316" },
];

// Regional regular gas prices — EIA API series
const EIA_BASE = "https://api.eia.gov/v2/petroleum/pri/gnd/data/";
const REGIONS = [
  { id: "R10", label: "East Coast",     color: "#60a5fa" },
  { id: "R20", label: "Midwest",        color: "#22c55e" },
  { id: "R30", label: "Gulf Coast",     color: "#f59e0b" },
  { id: "R40", label: "Rocky Mountain", color: "#a78bfa" },
  { id: "R50", label: "West Coast",     color: "#ef4444" },
];

async function fetchFred(seriesId: string, key: string, limit = 208) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&limit=${limit}&sort_order=desc`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`FRED ${res.status} for ${seriesId}`);
  const json = await res.json() as { observations?: Array<{ date: string; value: string }> };
  return (json.observations ?? [])
    .filter((o) => o.value !== "." && o.value !== "")
    .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
    .filter((o) => isFinite(o.value))
    .reverse();
}

export async function GET() {
  const key = process.env.FRED_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "FRED_API_KEY not configured" }, { status: 503 });

  try {
    const [gradeResults, crudeResult] = await Promise.allSettled([
      Promise.allSettled(GRADES.map((g) => fetchFred(g.id, key, 208))),
      fetchFred("DCOILWTICO", key, 1200),
    ]);

    const gradeData = gradeResults.status === "fulfilled" ? gradeResults.value : [];
    const crudeRaw  = crudeResult.status === "fulfilled"  ? crudeResult.value  : [];

    // Downsample crude to weekly (take last value per week, matching gas price cadence)
    // Use UTC arithmetic throughout to avoid timezone-induced day-of-week errors.
    const crudeByWeek = new Map<string, number>();
    for (const pt of crudeRaw) {
      const [y, mo, d] = pt.date.split("-").map(Number);
      const dow = new Date(Date.UTC(y!, mo! - 1, d!)).getUTCDay(); // 0=Sun…6=Sat
      const daysBack = dow === 0 ? 6 : dow - 1; // days to subtract to reach Monday
      const monMs = Date.UTC(y!, mo! - 1, d! - daysBack);
      const key2 = new Date(monMs).toISOString().slice(0, 10);
      crudeByWeek.set(key2, pt.value); // last observation in the week wins
    }

    const grades = GRADES.map((g, i) => {
      const rows = gradeData[i]?.status === "fulfilled" ? gradeData[i].value : [];
      const current = rows[rows.length - 1] ?? null;
      const prev    = rows[rows.length - 2] ?? null;
      const yearAgo = rows.length >= 52 ? rows[rows.length - 52] : null;
      const hi52 = rows.length > 0 ? Math.max(...rows.slice(-52).map((r) => r.value)) : null;
      const lo52 = rows.length > 0 ? Math.min(...rows.slice(-52).map((r) => r.value)) : null;
      return {
        id: g.id, label: g.label, color: g.color,
        current: current?.value ?? null,
        asOf: current?.date ?? null,
        wowChange: current && prev ? Math.round((current.value - prev.value) * 1000) / 1000 : null,
        yoyChange: current && yearAgo ? Math.round((current.value - yearAgo.value) * 1000) / 1000 : null,
        yoyPct:    current && yearAgo ? Math.round(((current.value - yearAgo.value) / yearAgo.value) * 10000) / 100 : null,
        hi52, lo52,
        history: rows, // full history for chart
      };
    });

    // Combined chart: all grades + crude (converted $/barrel → $/gal equivalent ÷42)
    const regular = grades[0]!;
    const allDates = new Set(regular.history.map((h) => h.date));
    const gradeMaps = grades.map((g) => new Map(g.history.map((h) => [h.date, h.value])));

    const allGradesHistory = [...allDates].sort().map((date) => ({
      date,
      regular:  gradeMaps[0]?.get(date) ?? null,
      midgrade: gradeMaps[1]?.get(date) ?? null,
      premium:  gradeMaps[2]?.get(date) ?? null,
      diesel:   gradeMaps[3]?.get(date) ?? null,
      crude:    crudeByWeek.has(date) ? Math.round((crudeByWeek.get(date)! / 42) * 1000) / 1000 : null,
    }));

    // Crude-to-pump spread (latest week)
    const latestCrudePerGal = regular.asOf && crudeByWeek.has(regular.asOf!)
      ? crudeByWeek.get(regular.asOf!) ! / 42 : null;
    const pumpSpread = regular.current !== null && latestCrudePerGal !== null
      ? Math.round((regular.current - latestCrudePerGal) * 1000) / 1000 : null;

    // Regional gas prices via EIA API
    const eiaKey = process.env.EIA_API_KEY?.trim();
    let regions: Array<{ id: string; label: string; color: string; current: number | null; asOf: string | null; wowChange: number | null; history: Array<{ date: string; value: number }> }> = [];

    if (eiaKey) {
      try {
        // Fetch all PADD regions for regular gasoline, weekly frequency
        const eiaUrl = `${EIA_BASE}?api_key=${eiaKey}&frequency=weekly&data[0]=value&facets[product][]=EPM0&facets[duoarea][]=R10&facets[duoarea][]=R20&facets[duoarea][]=R30&facets[duoarea][]=R40&facets[duoarea][]=R50&sort[0][column]=period&sort[0][direction]=desc&length=150`;
        const eiaRes = await fetch(eiaUrl, { cache: "no-store", signal: AbortSignal.timeout(10000) });
        if (eiaRes.ok) {
          const eiaJson = await eiaRes.json() as { response?: { data?: Array<{ period: string; duoarea: string; value: number }> } };
          const eiaData = eiaJson.response?.data ?? [];

          regions = REGIONS.map((r) => {
            const rows = eiaData
              .filter((d) => d.duoarea === r.id && d.value != null)
              .map((d) => ({ date: d.period, value: Number(d.value) }))
              .filter((d) => Number.isFinite(d.value))
              .reverse(); // oldest first
            const current = rows[rows.length - 1] ?? null;
            const prev = rows.length >= 2 ? rows[rows.length - 2] : null;
            return {
              id: r.id, label: r.label, color: r.color,
              current: current?.value ?? null,
              asOf: current?.date ?? null,
              wowChange: current && prev ? Math.round((current.value - prev.value) * 1000) / 1000 : null,
              history: rows.slice(-26),
            };
          });
        }
      } catch { /* EIA unavailable, skip regional */ }
    }

    // Add US average from FRED as the first entry
    const usAvg = grades[0]; // regular grade = US average
    if (usAvg) {
      const usCurrent = usAvg.history[usAvg.history.length - 1] ?? null;
      const usPrev = usAvg.history.length >= 2 ? usAvg.history[usAvg.history.length - 2] : null;
      regions.unshift({
        id: "US", label: "US Average", color: "#4f9cf9",
        current: usCurrent?.value ?? null,
        asOf: usCurrent?.date ?? null,
        wowChange: usCurrent && usPrev ? Math.round((usCurrent.value - usPrev.value) * 1000) / 1000 : null,
        history: usAvg.history.slice(-26),
      });
    }

    return NextResponse.json({
      grades,
      allGradesHistory,
      regions,
      latestCrudePerGal: latestCrudePerGal !== null ? Math.round(latestCrudePerGal * 1000) / 1000 : null,
      pumpSpread,
      updateSchedule: "Updated weekly",
    });
  } catch (e) {
    console.error("[market-rates/gas]", e);
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
