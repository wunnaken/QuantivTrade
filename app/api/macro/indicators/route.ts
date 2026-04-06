import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // 1-hour cache

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

async function fredLast(seriesId: string, key: string, limit = 14) {
  try {
    const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${key}&file_type=json&limit=${limit}&sort_order=desc`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = (await res.json()) as { observations?: { date: string; value: string }[] };
    return (json.observations ?? [])
      .filter((o) => o.value !== ".")
      .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
      .reverse();
  } catch {
    return [];
  }
}

export async function GET() {
  const key = process.env.FRED_API_KEY?.trim();
  if (!key) {
    // Return fallback so widget still renders without FRED key
    return NextResponse.json({ cpiYoy: null, gdpGrowth: null, unempRate: null });
  }

  const [cpiObs, gdpObs, unempObs] = await Promise.all([
    // CPIAUCSL: All Items CPI (monthly). We compute YoY from last 14 months.
    fredLast("CPIAUCSL", key, 14),
    // A191RL1Q225SBEA: Real GDP % change, annualized quarterly
    fredLast("A191RL1Q225SBEA", key, 4),
    // UNRATE: Unemployment rate (monthly)
    fredLast("UNRATE", key, 3),
  ]);

  // CPI YoY: (current / 12-months-ago - 1) * 100
  let cpiYoy: number | null = null;
  if (cpiObs.length >= 13) {
    const current = cpiObs[cpiObs.length - 1].value;
    const yearAgo = cpiObs[cpiObs.length - 13].value;
    cpiYoy = parseFloat(((current / yearAgo - 1) * 100).toFixed(2));
  }

  // GDP growth: most recent quarterly annualized % change
  const gdpGrowth = gdpObs.length > 0 ? gdpObs[gdpObs.length - 1].value : null;

  // Unemployment rate
  const unempRate = unempObs.length > 0 ? unempObs[unempObs.length - 1].value : null;

  return NextResponse.json({ cpiYoy, gdpGrowth, unempRate });
}
