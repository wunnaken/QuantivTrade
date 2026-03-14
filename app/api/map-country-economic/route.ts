import { NextRequest, NextResponse } from "next/server";
import { countryToIso3 } from "../../../lib/country-mapping";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const WB_INDICATORS = {
  gdpGrowth: "NY.GDP.MKTP.KD.ZG",
  inflation: "FP.CPI.TOTL.ZG",
  unemployment: "SL.UEM.TOTL.ZS",
  gdpPerCapita: "NY.GDP.PCAP.CD",
} as const;

async function fetchWorldBankIndicator(
  iso3: string,
  indicator: string
): Promise<{ year: string; value: number | null } | null> {
  try {
    const url = `https://api.worldbank.org/v2/country/${iso3}/indicator/${indicator}?format=json&per_page=1&mrv=1`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length < 2) return null;
    const series = data[1] as Array<{ date: string; value: number | null }>;
    const latest = series?.find((d) => d.value != null);
    if (!latest) return null;
    return { year: latest.date, value: latest.value };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const country = request.nextUrl.searchParams.get("country")?.trim();
  if (!country) {
    return NextResponse.json({ error: "Missing country" }, { status: 400 });
  }
  const iso3 = countryToIso3(country);
  if (!iso3) {
    return NextResponse.json({
      gdpGrowth: null,
      inflation: null,
      unemployment: null,
      gdpPerCapita: null,
    });
  }

  const [gdpGrowth, inflation, unemployment, gdpPerCapita] = await Promise.all([
    fetchWorldBankIndicator(iso3, WB_INDICATORS.gdpGrowth),
    fetchWorldBankIndicator(iso3, WB_INDICATORS.inflation),
    fetchWorldBankIndicator(iso3, WB_INDICATORS.unemployment),
    fetchWorldBankIndicator(iso3, WB_INDICATORS.gdpPerCapita),
  ]);

  return NextResponse.json({
    gdpGrowth,
    inflation,
    unemployment,
    gdpPerCapita,
  });
}
