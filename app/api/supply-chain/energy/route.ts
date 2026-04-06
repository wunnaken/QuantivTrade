import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function fetchEIA(path: string, key: string) {
  const url = `https://api.eia.gov${path}&api_key=${key}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`EIA fetch failed: ${res.status}`);
  return res.json();
}

export async function GET() {
  const key = process.env.EIA_API_KEY?.trim();

  if (!key) {
    return NextResponse.json(
      {
        error: "EIA_API_KEY not configured",
        message:
          "To enable energy supply chain data, add a free EIA API key. Get one at https://www.eia.gov/opendata/register.php — it is completely free and takes about 5 minutes to set up. Set the environment variable EIA_API_KEY in your .env.local file.",
      },
      { status: 503 }
    );
  }

  try {
    const [crudoRes, natGasRes, refineryRes] = await Promise.allSettled([
      fetchEIA(
        "/v2/petroleum/stoc/wstk/data/?frequency=weekly&data[0]=value&sort[0][column]=period&sort[0][direction]=desc&length=52",
        key
      ),
      fetchEIA(
        "/v2/natural-gas/stor/wkly/data/?frequency=weekly&data[0]=value&sort[0][column]=period&sort[0][direction]=desc&length=52",
        key
      ),
      fetchEIA(
        "/v2/petroleum/pnp/wiup/data/?frequency=weekly&data[0]=value&sort[0][column]=period&sort[0][direction]=desc&length=12",
        key
      ),
    ]);

    const parseObservations = (result: PromiseSettledResult<unknown>) => {
      if (result.status === "rejected") return null;
      const data = result.value as { response?: { data?: Array<{ period: string; value: string | number }> } };
      return (data?.response?.data ?? [])
        .filter((d) => d.value !== null && d.value !== "")
        .map((d) => ({ date: d.period, value: typeof d.value === "string" ? parseFloat(d.value) : d.value }))
        .reverse();
    };

    const crudeOil = parseObservations(crudoRes);
    const natGas = parseObservations(natGasRes);
    const refinery = parseObservations(refineryRes);

    const last = <T extends { value: number }>(arr: T[] | null) => arr?.[arr.length - 1] ?? null;
    const avg5yr = (arr: { value: number }[] | null) => {
      if (!arr || arr.length < 2) return null;
      const slice = arr.slice(-260); // ~5 years of weekly data
      return slice.reduce((s, d) => s + d.value, 0) / slice.length;
    };

    const crudeLatest = last(crudeOil);
    const crudeAvg = avg5yr(crudeOil);
    const natGasLatest = last(natGas);
    const natGasAvg = avg5yr(natGas);
    const refineryLatest = last(refinery);

    return NextResponse.json({
      source: "EIA (U.S. Energy Information Administration)",
      updateFrequency: "Weekly",
      crudeOil: {
        history: crudeOil,
        latest: crudeLatest,
        fiveYearAvg: crudeAvg ? Math.round(crudeAvg) : null,
        signal:
          crudeLatest && crudeAvg
            ? crudeLatest.value > crudeAvg
              ? "bearish"
              : "bullish"
            : "neutral",
        label: "US Crude Oil Inventory",
        unit: "thousand barrels",
        reportLabel: "EIA Weekly Petroleum Status Report",
        updateSchedule: "Every Wednesday 10:30 AM ET",
      },
      natGas: {
        history: natGas,
        latest: natGasLatest,
        fiveYearAvg: natGasAvg ? Math.round(natGasAvg) : null,
        signal:
          natGasLatest && natGasAvg
            ? natGasLatest.value > natGasAvg
              ? "bearish"
              : "bullish"
            : "neutral",
        label: "Natural Gas Storage",
        unit: "billion cubic feet",
        reportLabel: "EIA Natural Gas Storage Report",
        updateSchedule: "Every Thursday 10:30 AM ET",
      },
      refinery: {
        history: refinery,
        latest: refineryLatest,
        label: "Refinery Utilization Rate",
        unit: "percent of operable capacity",
        reportLabel: "EIA Weekly Petroleum Status Report",
        updateSchedule: "Weekly — delayed 1 week",
      },
    });
  } catch (e) {
    console.error("[supply-chain/energy]", e);
    return NextResponse.json(
      {
        error: "Failed to fetch EIA energy data",
        message: String(e instanceof Error ? e.message : e),
      },
      { status: 500 }
    );
  }
}
