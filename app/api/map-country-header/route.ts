import { NextRequest, NextResponse } from "next/server";
import { countryToFlag, countryToPanelIndex } from "../../../lib/country-mapping";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function fetchFinnhubQuote(symbol: string, token: string): Promise<{ price: number; changePercent: number } | null> {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`,
      { next: { revalidate: 0 } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { c?: number; dp?: number };
    if (data.c == null || data.dp == null) return null;
    return { price: data.c, changePercent: data.dp };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const country = request.nextUrl.searchParams.get("country")?.trim();
  if (!country) {
    return NextResponse.json({ error: "Missing country" }, { status: 400 });
  }
  const flag = countryToFlag(country);
  const indexSymbol = countryToPanelIndex(country);
  const finnhubKey = process.env.FINNHUB_API_KEY?.trim();

  if (!indexSymbol || !finnhubKey) {
    return NextResponse.json({
      countryName: country,
      flag,
      indexLabel: indexSymbol ?? null,
      indexSymbol: indexSymbol ?? null,
      price: null,
      changePercent: null,
    });
  }

  const quote = await fetchFinnhubQuote(indexSymbol, finnhubKey);
  const indexLabel = indexSymbol; // display same as symbol (SPY, GDAXI, etc.)
  return NextResponse.json({
    countryName: country,
    flag,
    indexLabel,
    indexSymbol,
    price: quote?.price ?? null,
    changePercent: quote?.changePercent ?? null,
  });
}
