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
    const fredKey = process.env.FRED_API_KEY?.trim();

    const [crudoRes, natGasRes, refineryRes, gasolineRes, distillateRes] = await Promise.allSettled([
      // U.S. total crude oil ending stocks (WCESTUS1 equivalent)
      fetchEIA(
        "/v2/petroleum/stoc/wstk/data/?frequency=weekly&data[0]=value&facets[duoarea][]=NUS&facets[product][]=EPC0&sort[0][column]=period&sort[0][direction]=desc&length=52",
        key
      ),
      // U.S. total natural gas in underground storage (no region facet — deduplicate below)
      fetchEIA(
        "/v2/natural-gas/stor/wkly/data/?frequency=weekly&data[0]=value&sort[0][column]=period&sort[0][direction]=desc&length=52",
        key
      ),
      // WCRFPUS2 — Weekly U.S. Percent Utilization of Refinery Operable Capacity (FRED)
      fredKey
        ? fetch(
            `https://api.stlouisfed.org/fred/series/observations?series_id=WCRFPUS2&api_key=${fredKey}&file_type=json&sort_order=desc&limit=520`,
            { next: { revalidate: 3600 } }
          ).then((r) => { if (!r.ok) throw new Error(`FRED WCRFPUS2 failed: ${r.status}`); return r.json(); })
        : Promise.reject(new Error("No FRED key")),
      // Weekly U.S. regular gasoline retail prices ($/gallon)
      fetchEIA(
        "/v2/petroleum/pri/gnd/data/?frequency=weekly&data[0]=value&facets[duoarea][]=NUS&facets[product][]=EPM0&sort[0][column]=period&sort[0][direction]=desc&length=52",
        key
      ),
      // Weekly U.S. distillate fuel oil stocks (thousand barrels)
      fetchEIA(
        "/v2/petroleum/stoc/wstk/data/?frequency=weekly&data[0]=value&facets[duoarea][]=NUS&facets[product][]=EPD0&sort[0][column]=period&sort[0][direction]=desc&length=52",
        key
      ),
    ]);

    // EIA parser — period field, descending order, deduplicate keeping national-total row
    const parseEIA = (result: PromiseSettledResult<unknown>) => {
      if (result.status === "rejected") return null;
      const data = result.value as { response?: { data?: Array<{ period: string; value: string | number }> } };
      const seen = new Set<string>();
      const deduped = (data?.response?.data ?? [])
        .filter((d) => d.value !== null && d.value !== "")
        .filter((d) => { if (seen.has(d.period)) return false; seen.add(d.period); return true; })
        .map((d) => ({ date: d.period, value: typeof d.value === "string" ? parseFloat(d.value) : d.value }));
      return deduped.reverse();
    };

    // FRED parser — observations array, already have date field
    const parseFRED = (result: PromiseSettledResult<unknown>) => {
      if (result.status === "rejected") return null;
      const data = result.value as { observations?: Array<{ date: string; value: string }> };
      return (data.observations ?? [])
        .filter((o) => o.value !== ".")
        .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
        .reverse();
    };

    const crudeOil = parseEIA(crudoRes);
    const natGas = parseEIA(natGasRes);
    const refinery = parseFRED(refineryRes);
    const gasoline = parseEIA(gasolineRes);
    const distillate = parseEIA(distillateRes);

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
      gasoline: {
        history: gasoline,
        latest: last(gasoline),
        label: "US Regular Gasoline Retail Price",
        unit: "dollars per gallon",
        reportLabel: "EIA Weekly Retail Gasoline and Diesel Prices",
        updateSchedule: "Every Monday",
        note: "Retail regular gasoline price — key consumer cost signal and inflation input. Tracks closely with crude oil but includes refining margin and taxes.",
      },
      distillate: {
        history: distillate,
        latest: last(distillate),
        fiveYearAvg: avg5yr(distillate) ? Math.round(avg5yr(distillate)!) : null,
        label: "Distillate Fuel Oil Stocks",
        unit: "thousand barrels",
        reportLabel: "EIA Weekly Petroleum Status Report",
        updateSchedule: "Every Wednesday 10:30 AM ET",
        note: "Distillate stocks (diesel + heating oil). Low distillate inventories drive diesel price spikes, directly impacting trucking and heating costs.",
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
