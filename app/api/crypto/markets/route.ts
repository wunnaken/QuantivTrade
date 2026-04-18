import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CG_API_KEY = process.env.COINGECKO_API_KEY ?? "";
// Pro keys use pro-api.coingecko.com; Demo keys use api.coingecko.com
const CG_BASE = CG_API_KEY
  ? "https://pro-api.coingecko.com/api/v3"
  : "https://api.coingecko.com/api/v3";
const CG_HEADERS: HeadersInit = CG_API_KEY
  ? { "x-cg-pro-api-key": CG_API_KEY }
  : {};

// Free tier: 1 page of 250. Pro: 4 pages of 250 = 1,000 coins.
const PAGES = CG_API_KEY ? 4 : 1;
const PER_PAGE = 250;

function cgFetch(path: string, revalidate = 60) {
  return fetch(`${CG_BASE}${path}`, {
    headers: CG_HEADERS,
    next: { revalidate },
  });
}

export async function GET() {
  try {
    // Fetch global + trending + market pages in parallel
    const marketFetches = Array.from({ length: PAGES }, (_, i) =>
      cgFetch(
        `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${PER_PAGE}&page=${i + 1}&sparkline=true&price_change_percentage=1h,24h,7d`
      )
    );

    const [globalRes, trendingRes, ...marketResponses] = await Promise.all([
      cgFetch("/global"),
      cgFetch("/search/trending", 300),
      ...marketFetches,
    ]);

    const [globalData, trendingData, ...marketPages] = await Promise.all([
      globalRes.ok ? globalRes.json() : null,
      trendingRes.ok ? trendingRes.json() : { coins: [] },
      ...marketResponses.map((r) => (r.ok ? r.json() : [])),
    ]);

    const coins = marketPages.flat();

    return NextResponse.json({
      global: globalData?.data ?? null,
      coins,
      trending: trendingData?.coins?.slice(0, 7) ?? [],
    });
  } catch (e) {
    console.error("Crypto markets error:", e);
    return NextResponse.json({ global: null, coins: [], trending: [] }, { status: 500 });
  }
}
