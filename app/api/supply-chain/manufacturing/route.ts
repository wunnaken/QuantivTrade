import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FRED_SERIES = [
  { id: "MANEMP", label: "Manufacturing Employment", unit: "thousands of persons" },
  { id: "AMTMNO", label: "Manufacturers New Orders (Total)", unit: "millions of dollars" },
  { id: "AMDMVS", label: "Manufacturers Shipments (Durable Goods)", unit: "millions of dollars" },
  { id: "AMDMUO", label: "Manufacturers Unfilled Orders (Durable Goods)", unit: "millions of dollars" },
  { id: "ISRATIO", label: "Inventory to Sales Ratio", unit: "ratio" },
  { id: "DGORDER", label: "Durable Goods Orders", unit: "millions of dollars" },
  { id: "NAPMNOI", label: "ISM Manufacturing New Orders Index", unit: "index" },
  { id: "NAPMPI", label: "ISM Manufacturing Production Index", unit: "index" },
  { id: "NAPMEI", label: "ISM Manufacturing Employment Index", unit: "index" },
  { id: "NAPMPRI", label: "ISM Manufacturing Prices Paid Index", unit: "index" },
  { id: "NAPM", label: "ISM Manufacturing PMI Composite", unit: "index" },
  { id: "A035RC1Q027SBEA", label: "Core Capex (Nondefense Aircraft ex-defense)", unit: "billions of dollars" },
];

async function fetchFREDSeries(seriesId: string, key: string, limit = 24) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&sort_order=desc&limit=${limit}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`FRED series ${seriesId} failed: ${res.status}`);
  const json = await res.json() as { observations?: Array<{ date: string; value: string }> };
  return (json.observations ?? [])
    .filter((o) => o.value !== ".")
    .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
    .reverse();
}

export async function GET() {
  const key = process.env.FRED_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      {
        error: "FRED_API_KEY not configured",
        message: "FRED API key is required for manufacturing data. Get a free key at https://fred.stlouisfed.org/docs/api/api_key.html",
      },
      { status: 503 }
    );
  }

  const seriesResults = await Promise.allSettled(
    FRED_SERIES.map(async (s) => ({ ...s, history: await fetchFREDSeries(s.id, key) }))
  );

  const series: Record<string, unknown> = {};
  FRED_SERIES.forEach((s, i) => {
    const r = seriesResults[i];
    if (r.status === "fulfilled") {
      series[s.id] = {
        label: s.label,
        unit: s.unit,
        history: r.value.history,
        latest: r.value.history[r.value.history.length - 1] ?? null,
      };
    } else {
      series[s.id] = { label: s.label, error: String(r.reason) };
    }
  });

  // Regional Fed surveys — attempt NY Fed Empire State
  let empireFed: { value: number; date: string } | null = null;
  try {
    const empireRes = await fetchFREDSeries("GAFDISA066MSFRBNY", key, 12);
    empireFed = empireRes[empireRes.length - 1] ?? null;
  } catch {}

  let phillyFed: { value: number; date: string } | null = null;
  try {
    const phillyRes = await fetchFREDSeries("BPHI", key, 12);
    phillyFed = phillyRes[phillyRes.length - 1] ?? null;
  } catch {}

  let kansasFed: { value: number; date: string } | null = null;
  try {
    const kcRes = await fetchFREDSeries("BSCMFRBKC", key, 12);
    kansasFed = kcRes[kcRes.length - 1] ?? null;
  } catch {}

  return NextResponse.json({
    source: "Federal Reserve (FRED) / U.S. Census Bureau",
    updateFrequency: "Monthly",
    series,
    regionalSurveys: {
      empireFed: {
        value: empireFed?.value ?? null,
        date: empireFed?.date ?? null,
        label: "NY Fed Empire State Manufacturing Index",
        source: "Federal Reserve Bank of New York via FRED",
        note: "Released ~15th of each month — early PMI signal",
      },
      phillyFed: {
        value: phillyFed?.value ?? null,
        date: phillyFed?.date ?? null,
        label: "Philadelphia Fed Manufacturing Business Outlook",
        source: "Federal Reserve Bank of Philadelphia via FRED",
        note: "Released 3rd Thursday of each month — early PMI signal",
      },
      kansasFed: {
        value: kansasFed?.value ?? null,
        date: kansasFed?.date ?? null,
        label: "Kansas City Fed Manufacturing Composite",
        source: "Federal Reserve Bank of Kansas City via FRED",
        note: "Released last Thursday of each month",
      },
    },
    labels: {
      pmiNote: "PMI above 50 = expansion; below 50 = contraction",
      isratioNote: "Rising inventory-to-sales ratio = inventory buildup = potential production slowdown ahead",
      newOrdersNote: "New orders diverging above shipments = backlog building = bullish for future production",
      capexNote: "Core capex (ex-aircraft, ex-defense) = business investment signal — leading indicator for corporate earnings",
    },
  });
}
