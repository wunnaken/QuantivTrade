import { NextRequest, NextResponse } from "next/server";

export const revalidate = 900;

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.trim().toUpperCase();
  if (!ticker) return NextResponse.json({ error: "Missing ticker" }, { status: 400 });

  const token = process.env.FINNHUB_API_KEY;
  if (!token) return NextResponse.json({ news: [] });

  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(ticker)}&from=${from}&to=${to}&token=${token}`;

  try {
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return NextResponse.json({ news: [] });
    const data = await res.json();
    const items = Array.isArray(data) ? data.slice(0, 10) : [];
    const news = items.map((n: Record<string, unknown>) => ({
      headline: n.headline as string,
      summary: n.summary as string,
      url: n.url as string,
      datetime: n.datetime as number,
      source: n.source as string,
      sentiment: n.sentiment as string | undefined,
    }));
    return NextResponse.json({ news });
  } catch {
    return NextResponse.json({ news: [] });
  }
}
