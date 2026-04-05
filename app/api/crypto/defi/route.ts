import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [protocolsRes, tvlHistRes] = await Promise.all([
      fetch("https://api.llama.fi/protocols", { next: { revalidate: 300 } }),
      fetch("https://api.llama.fi/v2/historicalChainTvl", { next: { revalidate: 3600 } }),
    ]);

    const [protocols, tvlHist] = await Promise.all([
      protocolsRes.ok ? protocolsRes.json() : [],
      tvlHistRes.ok ? tvlHistRes.json() : [],
    ]);

    const top = Array.isArray(protocols)
      ? protocols
          .sort((a: { tvl: number }, b: { tvl: number }) => (b.tvl ?? 0) - (a.tvl ?? 0))
          .slice(0, 20)
          .map((p: { name: string; tvl: number; change_1d: number; change_7d: number; category: string; chains: string[] }) => ({
            name: p.name,
            tvl: p.tvl,
            change1d: p.change_1d,
            change7d: p.change_7d,
            category: p.category,
            chains: p.chains,
          }))
      : [];

    const history = Array.isArray(tvlHist)
      ? tvlHist.slice(-90).map((d: { date: number; tvl: number }) => ({
          date: d.date,
          tvl: d.tvl,
        }))
      : [];

    return NextResponse.json({ protocols: top, history });
  } catch (e) {
    console.error("DeFi error:", e);
    return NextResponse.json({ protocols: [], history: [] }, { status: 500 });
  }
}
