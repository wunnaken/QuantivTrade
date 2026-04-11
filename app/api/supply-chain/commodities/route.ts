import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const COMMODITY_META: Record<string, { unit: string; category: string; note: string }> = {
  COPPER: {
    unit: "dollars per pound",
    category: "Metals",
    note: "Often called 'Dr. Copper' — rising price signals economic expansion and manufacturing demand",
  },
  ALUMINUM: {
    unit: "dollars per metric ton",
    category: "Metals",
    note: "Key input for automotive, aerospace, and packaging supply chains",
  },
  WHEAT: {
    unit: "dollars per bushel",
    category: "Agricultural",
    note: "Global food supply chain bellwether — affected by weather, conflict, and export restrictions",
  },
  CORN: {
    unit: "dollars per bushel",
    category: "Agricultural",
    note: "Dual-use commodity — food supply and ethanol production (energy link)",
  },
  COTTON: {
    unit: "cents per pound",
    category: "Agricultural",
    note: "Global textile and apparel supply chain indicator",
  },
  COFFEE: {
    unit: "dollars per pound",
    category: "Agricultural",
    note: "Consumer goods supply chain — sensitive to Brazil/Vietnam weather and logistics costs",
  },
  WTI: {
    unit: "dollars per barrel",
    category: "Energy",
    note: "West Texas Intermediate crude — backup to EIA weekly data",
  },
  NATURAL_GAS: {
    unit: "dollars per million BTU",
    category: "Energy",
    note: "Industrial energy cost — backup to EIA weekly storage data",
  },
};

async function fetchCommodity(fn: string, key: string) {
  const url = `https://www.alphavantage.co/query?function=${fn}&interval=monthly&apikey=${key}`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`AV ${fn} failed: ${res.status}`);
  const json = (await res.json()) as {
    name?: string;
    unit?: string;
    data?: { date: string; value: string }[];
    Information?: string;
    Note?: string;
  };
  if (json.Information || json.Note)
    throw new Error(`Rate limited: ${json.Information ?? json.Note}`);
  const data = (json.data ?? [])
    .filter((d) => d.value && d.value !== "." && !isNaN(parseFloat(d.value)))
    .map((d) => ({ date: d.date, value: parseFloat(d.value) }))
    .slice(-24);
  return {
    name: json.name ?? fn,
    unit: json.unit ?? "",
    history: data,
    latest: data[data.length - 1] ?? null,
  };
}

export async function GET() {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "ALPHA_VANTAGE_API_KEY is not configured" },
      { status: 503 }
    );
  }

  const commodityKeys = [
    "COPPER",
    "ALUMINUM",
    "WHEAT",
    "CORN",
    "COTTON",
    "COFFEE",
    "WTI",
    "NATURAL_GAS",
  ];

  // Alpha Vantage free tier: 1 req/sec — fetch sequentially with delay
  const results: PromiseSettledResult<Awaited<ReturnType<typeof fetchCommodity>>>[] = [];
  for (const fn of commodityKeys) {
    try {
      const data = await fetchCommodity(fn, key);
      results.push({ status: "fulfilled", value: data });
    } catch (e) {
      results.push({ status: "rejected", reason: e });
    }
    await new Promise((r) => setTimeout(r, 1100));
  }

  const parsed: Record<
    string,
    {
      name: string;
      unit: string;
      history: { date: string; value: number }[];
      latest: { date: string; value: number } | null;
      available: boolean;
      category: string;
      note: string;
      error?: string;
    }
  > = {};

  results.forEach((result, i) => {
    const fn = commodityKeys[i];
    const meta = COMMODITY_META[fn];
    if (result.status === "fulfilled") {
      const { name, unit, history, latest } = result.value;
      parsed[fn] = {
        name,
        unit,
        history,
        latest,
        available: history.length > 0,
        category: meta.category,
        note: meta.note,
      };
    } else {
      parsed[fn] = {
        available: false,
        error: String(result.reason),
        name: fn,
        unit: meta.unit,
        history: [],
        latest: null,
        category: meta.category,
        note: meta.note,
      };
    }
  });

  const metals = {
    COPPER: parsed["COPPER"],
    ALUMINUM: parsed["ALUMINUM"],
  };

  const agricultural = {
    WHEAT: parsed["WHEAT"],
    CORN: parsed["CORN"],
    COTTON: parsed["COTTON"],
    COFFEE: parsed["COFFEE"],
  };

  const energy = {
    WTI: parsed["WTI"],
    NATURAL_GAS: parsed["NATURAL_GAS"],
  };

  return NextResponse.json({
    metals,
    agricultural,
    energy,
    source: "Alpha Vantage Commodities API",
    schedule: "Monthly data — cached 24h",
    rateNote:
      "Alpha Vantage free tier: 25 requests/day. Data cached for 24 hours.",
  });
}
