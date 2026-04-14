import { NextRequest, NextResponse } from "next/server";

export const revalidate = 300;

// This route attempts Finnhub options data but returns a structured unavailable response
// because options flow, dark pool, and short interest require premium data providers.
export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.trim().toUpperCase();
  if (!ticker) return NextResponse.json({ error: "Missing ticker" }, { status: 400 });

  const token = process.env.FINNHUB_API_KEY;

  // Attempt basic option chain (Finnhub premium only)
  let optionChain = null;
  if (token) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(
        `https://finnhub.io/api/v1/stock/option-chain?symbol=${encodeURIComponent(ticker)}&expirationDate=${today}&token=${token}`,
        { next: { revalidate: 300 } }
      );
      if (res.ok) {
        const data = await res.json();
        optionChain = data?.data ? data : null;
      }
    } catch {
      // premium endpoint unavailable
    }
  }

  return NextResponse.json({
    optionChain,
    putCallRatio: null,
    shortInterest: null,
    darkPoolVolume: null,
    unusualFlow: null,
    borrowRate: null,
    unavailable: !optionChain,
    unavailableItems: [
      {
        label: "Options flow & unusual activity",
        reason: "Subscription required: Unusual Whales (~$50/mo) — real-time options flow, sweeps, and block trades.",
        provider: "unusualwhales.com",
      },
      {
        label: "Dark pool volume %",
        reason: "Subscription required: Unusual Whales (~$50/mo) covers dark pool prints. Free alternative: FINRA ATS data (delayed).",
        provider: "unusualwhales.com",
      },
      {
        label: "Short interest % float & days to cover",
        reason: "Subscription required: Ortex (~$49/mo) or S3 Partners for real-time short interest. FINRA REGSHO is free but bi-weekly delayed.",
        provider: "ortex.com",
      },
      {
        label: "Borrow rate (cost to short)",
        reason: "Subscription required: Ortex (~$49/mo) or Interactive Brokers API (free with IB brokerage account).",
        provider: "ortex.com",
      },
      {
        label: "IV rank / IV percentile",
        reason: "Subscription required: Tradier brokerage API (free with account) or Polygon.io Options add-on (~$79/mo).",
        provider: "polygon.io",
      },
      {
        label: "Put/call ratio over time",
        reason: "Subscription required: CBOE DataShop or Polygon.io Options add-on (~$79/mo). Put/call ratio by ticker requires full chain data.",
        provider: "polygon.io",
      },
    ],
  });
}
