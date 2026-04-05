import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [globalRes, marketsRes, trendingRes] = await Promise.all([
      fetch("https://api.coingecko.com/api/v3/global", {
        next: { revalidate: 60 },
      }),
      fetch(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=1h,24h,7d",
        { next: { revalidate: 60 } }
      ),
      fetch("https://api.coingecko.com/api/v3/search/trending", {
        next: { revalidate: 300 },
      }),
    ]);

    const [globalData, marketsData, trendingData] = await Promise.all([
      globalRes.ok ? globalRes.json() : null,
      marketsRes.ok ? marketsRes.json() : [],
      trendingRes.ok ? trendingRes.json() : { coins: [] },
    ]);

    return NextResponse.json({
      global: globalData?.data ?? null,
      coins: marketsData ?? [],
      trending: trendingData?.coins?.slice(0, 7) ?? [],
    });
  } catch (e) {
    console.error("Crypto markets error:", e);
    return NextResponse.json({ global: null, coins: [], trending: [] }, { status: 500 });
  }
}
