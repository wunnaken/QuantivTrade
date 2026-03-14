import { NextRequest, NextResponse } from "next/server";
import { countryToIso3 } from "../../../lib/country-mapping";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

/** IMF uses uppercase 3-letter codes (e.g. USA, GBR). */
function toImfCode(iso3: string): string {
  return iso3.toLowerCase().slice(0, 3).toUpperCase();
}

async function fetchImfIndicator(
  countryCode: string,
  indicator: string,
  years: string
): Promise<Record<string, number | null>> {
  try {
    const url = `https://www.imf.org/external/datamapper/api/v1/${indicator}/${countryCode}?periods=${years}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return {};
    const data = (await res.json()) as {
      values?: Record<string, Record<string, Record<string, number>>>;
    };
    const indicatorData = data.values?.[indicator]?.[countryCode];
    if (!indicatorData || typeof indicatorData !== "object") return {};
    const out: Record<string, number | null> = {};
    for (const [year, val] of Object.entries(indicatorData)) {
      out[year] = typeof val === "number" ? val : null;
    }
    return out;
  } catch {
    return {};
  }
}

export async function GET(request: NextRequest) {
  const country = request.nextUrl.searchParams.get("country")?.trim();
  if (!country) {
    return NextResponse.json({ error: "Missing country" }, { status: 400 });
  }
  const iso3 = countryToIso3(country);
  if (!iso3) {
    return NextResponse.json({ gdpGrowth2025: null, gdpGrowth2026: null, inflation2025: null, inflation2026: null });
  }
  const code = toImfCode(iso3);
  const years = "2025,2026";
  const [gdpSeries, inflationSeries] = await Promise.all([
    fetchImfIndicator(code, "NGDP_RPCH", years),
    fetchImfIndicator(code, "PCPIPCH", years),
  ]);
  return NextResponse.json({
    gdpGrowth2025: gdpSeries["2025"] ?? null,
    gdpGrowth2026: gdpSeries["2026"] ?? null,
    inflation2025: inflationSeries["2025"] ?? null,
    inflation2026: inflationSeries["2026"] ?? null,
  });
}
