import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function fetchFRED(id: string, key: string, limit = 36) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${key}&file_type=json&sort_order=desc&limit=${limit}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`FRED ${id} failed: ${res.status}`);
  const json = (await res.json()) as {
    observations?: Array<{ date: string; value: string }>;
  };
  return (json.observations ?? [])
    .filter((o) => o.value !== "." && o.value !== "")
    .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
    .reverse();
}

export async function GET() {
  const key = process.env.FRED_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "FRED_API_KEY is not configured" },
      { status: 503 }
    );
  }

  const [
    joblessResult,
    cpiResult,
    ppiFinalResult,
    ppiAllResult,
    yieldResult,
    unemploymentResult,
  ] = await Promise.allSettled([
    fetchFRED("ICSA", key, 52),
    fetchFRED("CPIAUCSL", key, 36),
    fetchFRED("PPIFIS", key, 36),
    fetchFRED("PPIACO", key, 36),
    fetchFRED("T10Y2Y", key, 36),
    fetchFRED("UNRATE", key, 36),
  ]);

  function buildResult(
    result: PromiseSettledResult<{ date: string; value: number }[]>
  ) {
    if (result.status === "fulfilled") {
      const history = result.value;
      return {
        history,
        latest: history[history.length - 1] ?? null,
        available: history.length > 0,
      };
    }
    return {
      history: [] as { date: string; value: number }[],
      latest: null,
      available: false,
      error: String(result.reason),
    };
  }

  return NextResponse.json({
    joblessClaims: {
      ...buildResult(joblessResult),
      label: "Initial Jobless Claims",
      unit: "thousands of persons",
      source: "US Department of Labor via FRED (ICSA)",
      schedule: "Weekly — released every Thursday",
      note: "Weekly initial unemployment insurance claims. Rising trend signals labor market weakening and often precedes broader economic slowdown by 2–4 months.",
    },
    cpi: {
      ...buildResult(cpiResult),
      label: "Consumer Price Index (CPI)",
      unit: "index (1982-84=100)",
      source: "BLS via FRED (CPIAUCSL)",
      schedule: "Monthly — released ~2 weeks after month end",
      note: "CPI measures inflation across goods and services. Rising CPI increases input costs across supply chains and pressures corporate margins.",
    },
    ppiFinal: {
      ...buildResult(ppiFinalResult),
      label: "PPI Final Demand",
      unit: "index (Nov 2009=100)",
      source: "BLS via FRED (PPIFIS)",
      schedule: "Monthly — released ~2 weeks after month end",
      note: "Producer Price Index for final demand. Measures price changes at the producer level before they reach consumers — a leading indicator of consumer inflation.",
    },
    ppiAll: {
      ...buildResult(ppiAllResult),
      label: "PPI All Commodities",
      unit: "index (1982=100)",
      source: "BLS via FRED (PPIACO)",
      schedule: "Monthly",
      note: "Broad commodity input cost index — rising trend signals cost pressure building throughout supply chains before it appears in consumer prices.",
    },
    yieldCurve: {
      ...buildResult(yieldResult),
      label: "10yr-2yr Treasury Yield Spread",
      unit: "percent",
      source: "Federal Reserve via FRED (T10Y2Y)",
      schedule: "Daily (monthly data shown)",
      note: "Negative spread (inverted curve) has preceded every US recession since 1955. Re-steepening after inversion often signals recession has begun. Critical signal for credit availability across supply chains.",
    },
    unemployment: {
      ...buildResult(unemploymentResult),
      label: "Unemployment Rate",
      unit: "percent",
      source: "BLS via FRED (UNRATE)",
      schedule: "Monthly — released first Friday of month",
      note: "The headline labor market indicator. Rising unemployment leads to reduced consumer demand and lower inventory requirements across most supply chains.",
    },
  });
}
