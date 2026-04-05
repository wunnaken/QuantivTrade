import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY ?? "";

export async function GET() {
  try {
    const to = new Date();
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const url = `https://finnhub.io/api/v1/news?category=crypto&from=${fmt(from)}&to=${fmt(to)}&token=${FINNHUB_KEY}`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) throw new Error("Finnhub news failed");
    const json = await res.json();

    const articles = Array.isArray(json)
      ? json.slice(0, 30).map((a: { id: number; headline: string; summary: string; source: string; url: string; datetime: number; image: string }) => ({
          id: a.id,
          headline: a.headline,
          summary: a.summary,
          source: a.source,
          url: a.url,
          datetime: a.datetime,
          image: a.image,
        }))
      : [];

    return NextResponse.json({ articles });
  } catch (e) {
    console.error("Crypto news error:", e);
    return NextResponse.json({ articles: [] }, { status: 500 });
  }
}
