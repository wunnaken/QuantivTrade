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
        reason: "Requires Unusual Whales API (~$50/mo)",
        provider: "unusualwhales.com",
      },
      {
        label: "Dark pool volume %",
        reason: "Requires Unusual Whales or FINRA ATS data",
        provider: "finra.org/finra-data/fintech/ats",
      },
      {
        label: "Short interest % float & days to cover",
        reason: "Requires FINRA REGSHO or a premium data vendor",
        provider: "finra.org",
      },
      {
        label: "Borrow rate",
        reason: "Requires Interactive Brokers API or similar prime brokerage data",
        provider: "interactivebrokers.com",
      },
      {
        label: "IV rank / IV percentile",
        reason: "Requires full options chain data (CBOE DataShop or Tradier)",
        provider: "cboe.com",
      },
      {
        label: "Put/call ratio over time",
        reason: "Requires CBOE options data subscription",
        provider: "cboe.com",
      },
    ],
  });
}
