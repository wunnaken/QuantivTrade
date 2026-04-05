import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/global/market_cap_chart?vs_currency=usd&days=30",
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) throw new Error("Dominance fetch failed");
    const json = await res.json();

    // market_cap_chart.market_cap = [[timestamp_ms, value], ...]
    const rawMcap: [number, number][] = json.market_cap_chart?.market_cap ?? [];
    const history = rawMcap.map(([ts, value]) => ({
      date: new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value,
    }));

    return NextResponse.json({ history });
  } catch (e) {
    console.error("Dominance error:", e);
    return NextResponse.json({ history: [] }, { status: 500 });
  }
}
