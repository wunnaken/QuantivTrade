import { NextRequest, NextResponse } from "next/server";

export const revalidate = 1800;

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.trim().toUpperCase();
  if (!ticker) return NextResponse.json({ error: "Missing ticker" }, { status: 400 });

  const token = process.env.FINNHUB_API_KEY;
  if (!token) return NextResponse.json({ reddit: null, twitter: null });

  const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/social-sentiment?symbol=${encodeURIComponent(ticker)}&from=${from}&token=${token}`,
      { next: { revalidate: 1800 } }
    );
    if (!res.ok) return NextResponse.json({ reddit: null, twitter: null, unavailable: true });
    const data = await res.json();

    const reddit = Array.isArray(data?.reddit) ? data.reddit.slice(-30) : null;
    const twitter = Array.isArray(data?.twitter) ? data.twitter.slice(-30) : null;

    return NextResponse.json({ reddit, twitter });
  } catch {
    return NextResponse.json({ reddit: null, twitter: null, unavailable: true });
  }
}
