import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // global/market_cap_chart is a CoinGecko Pro endpoint. Instead, derive
    // total market cap from BTC's market cap history + BTC dominance.
    const [btcChartRes, globalRes] = await Promise.all([
      fetch(
        "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=30",
        { next: { revalidate: 3600 } }
      ),
      fetch("https://api.coingecko.com/api/v3/global", {
        next: { revalidate: 300 },
      }),
    ]);

    const [btcChart, globalData] = await Promise.all([
      btcChartRes.ok ? btcChartRes.json() : { market_caps: [] },
      globalRes.ok ? globalRes.json() : { data: null },
    ]);

    const btcDominance = (globalData?.data?.market_cap_percentage?.btc ?? 60) / 100;
    const rawMcap: [number, number][] = btcChart.market_caps ?? [];

    // Derive total market cap: BTC market cap / BTC dominance fraction
    // Sample down to ~30 points for clean chart
    const step = Math.max(1, Math.floor(rawMcap.length / 30));
    const history = rawMcap
      .filter((_: [number, number], i: number) => i % step === 0 || i === rawMcap.length - 1)
      .map(([ts, btcMcap]: [number, number]) => ({
        date: new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: btcMcap / btcDominance,
      }));

    return NextResponse.json({ history });
  } catch (e) {
    console.error("Dominance error:", e);
    return NextResponse.json({ history: [] }, { status: 500 });
  }
}
