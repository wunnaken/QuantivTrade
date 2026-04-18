import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 2) {
    return NextResponse.json({ coins: [] });
  }

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) throw new Error("Search fetch failed");
    const json = await res.json();

    const coins = (json.coins ?? []).slice(0, 20).map(
      (c: { id: string; name: string; symbol: string; thumb: string; market_cap_rank: number | null }) => ({
        id: c.id,
        name: c.name,
        symbol: c.symbol,
        thumb: c.thumb,
        market_cap_rank: c.market_cap_rank,
      })
    );

    return NextResponse.json({ coins });
  } catch (e) {
    console.error("Crypto search error:", e);
    return NextResponse.json({ coins: [] }, { status: 500 });
  }
}
