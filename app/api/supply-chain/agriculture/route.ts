import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function fetchUSDANASS(key: string, year: number) {
  // statisticcat_desc=CONDITION covers excellent/good/fair/poor/very poor ratings
  // state_fips_code=99 = US total
  const params = new URLSearchParams({
    key,
    source_desc: "SURVEY",
    sector_desc: "CROPS",
    statisticcat_desc: "CONDITION",
    unit_desc: "PCT EXCELLENT",
    year: String(year),
    state_fips_code: "99",
    format: "JSON",
  });
  const url = `https://quickstats.nass.usda.gov/api/api_GET/?${params.toString()}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  const json = await res.json() as { error?: string[]; data?: unknown[] };
  if (json.error) {
    const msg = json.error.join(", ").toLowerCase();
    if (msg.includes("unauthorized") || res.status === 401) {
      throw new Error(
        "USDA NASS API key rejected (401). The QuickStats API only accepts keys registered specifically at https://quickstats.nass.usda.gov/api — keys from other USDA portals do not work here. If you registered there, the key may still be propagating (can take a few hours)."
      );
    }
    throw new Error(`USDA NASS error: ${json.error.join(", ")}`);
  }
  if (!res.ok) throw new Error(`USDA NASS fetch failed: ${res.status}`);
  return json;
}

async function fetchUSDAFASPSD(
  commodityCode: string,
  marketYear: number,
  fasKey: string
) {
  // USDA FAS OpenData API — requires separate FAS API key in header
  // Use world endpoint (more reliable than specific country codes)
  const url = `https://apps.fas.usda.gov/OpenData/api/psd/commodity/${commodityCode}/world/year/${marketYear}`;
  const res = await fetch(url, {
    headers: { API_KEY: fasKey },
    next: { revalidate: 86400 },
  });
  if (res.status === 500) {
    throw new Error("USDA FAS PSD API returned a server error (500). This is a USDA server-side issue unrelated to your API key. Try again later or check https://apps.fas.usda.gov/opendataweb for service status.");
  }
  if (res.status === 403) {
    throw new Error("USDA FAS API key rejected. Ensure USDA_FAS_API_KEY is the key from https://apps.fas.usda.gov/opendataweb registration.");
  }
  if (!res.ok) throw new Error(`USDA FAS PSD fetch failed: ${res.status}`);
  return res.json();
}

export async function GET() {
  // Accept either env var for the NASS QuickStats key — the UUID-format key
  // from quickstats.nass.usda.gov/api registration may have been saved under either name
  const nassKey = (process.env.USDA_FAS_API_KEY ?? process.env.USDA_API_KEY)?.trim();
  const fasKey = process.env.USDA_FAS_API_KEY?.trim();
  const currentYear = new Date().getFullYear();

  const results: Record<string, unknown> = {
    source: "USDA (U.S. Department of Agriculture)",
    updateFrequency: "Weekly during growing season, monthly otherwise",
  };

  // ── USDA NASS crop condition ─────────────────────────────────────────────
  if (!nassKey) {
    results.cropProgress = {
      error: "USDA_API_KEY not configured",
      message:
        "Set USDA_API_KEY in your .env.local file. Register at https://quickstats.nass.usda.gov/api — free, takes ~5 minutes. You must click the activation email link before the key works.",
    };
  } else {
    try {
      const nassData = await fetchUSDANASS(nassKey, currentYear);
      const items = (nassData?.data ?? []) as Array<{
        commodity_desc: string;
        week_ending: string;
        Value: string;
        short_desc: string;
      }>;

      if (items.length === 0) {
        // Might be off-season — try prior year
        results.cropProgress = {
          data: [],
          label: "USDA NASS Weekly Crop Progress Report",
          updateSchedule: "Every Monday during growing season (April–November)",
          reportDate: null,
          note: `No crop condition data found for ${currentYear} yet — growing season typically begins in late April. Reports resume weekly once planting starts.`,
        };
      } else {
        results.cropProgress = {
          data: items.slice(0, 50).map((d) => ({
            commodity: d.commodity_desc,
            weekEnding: d.week_ending,
            pctExcellent: parseFloat(d.Value) || 0,
            description: d.short_desc,
          })),
          label: "USDA NASS Weekly Crop Progress Report",
          updateSchedule: "Every Monday during growing season (April–November)",
          reportDate: items[0]?.week_ending ?? null,
        };
      }
    } catch (e) {
      results.cropProgress = {
        error: "Failed to fetch USDA NASS data",
        message: String(e instanceof Error ? e.message : e),
      };
    }
  }

  // ── USDA FAS PSD / WASDE ─────────────────────────────────────────────────
  // commodity codes: corn=0440000, soybeans=2222000, wheat=0410000
  const commodities = [
    { code: "0440000", name: "Corn" },
    { code: "2222000", name: "Soybeans" },
    { code: "0410000", name: "Wheat" },
  ];

  if (!fasKey) {
    results.wasde = commodities.map((c) => ({ name: c.name, unavailable: true }));
    results.wasdeUnavailable = {
      message:
        "USDA FAS WASDE/PSD data requires a separate FAS API key. Register free at https://apps.fas.usda.gov/opendataweb/ and set USDA_FAS_API_KEY in your .env.local file.",
    };
  } else {
    const wasdeResults = await Promise.allSettled(
      commodities.map(async (c) => {
        const data = await fetchUSDAFASPSD(c.code, currentYear, fasKey);
        return { name: c.name, data };
      })
    );

    results.wasde = commodities.map((c, i) => {
      const r = wasdeResults[i];
      if (r.status === "rejected") {
        return { name: c.name, error: String(r.reason) };
      }
      const rows = (r.value.data ?? []) as Array<{
        attributeId: number;
        attributeDesc: string;
        value: number;
      }>;
      const find = (desc: string) =>
        rows.find((row) => row.attributeDesc?.toLowerCase().includes(desc.toLowerCase()))?.value ?? null;
      return {
        name: c.name,
        production: find("production"),
        consumption: find("total consumption"),
        endingStocks: find("ending stocks"),
        stocksToUse: find("stocks to use"),
      };
    });
  }

  results.wasdeLabel = {
    label: "USDA World Agricultural Supply and Demand Estimates (WASDE)",
    updateSchedule: "Monthly — released ~10th of each month",
    source: "USDA Foreign Agricultural Service PSD Online",
    keyNote: "Ending stocks / stocks-to-use: lower = tighter supply = bullish price signal",
  };

  return NextResponse.json(results);
}
