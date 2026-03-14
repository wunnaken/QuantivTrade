import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Returns overall API status: "ok" | "delayed" | "error" for footer indicator. */
export async function GET() {
  let finnhubOk = false;
  let newsOk = false;
  const finnhubKey = process.env.FINNHUB_API_KEY;
  const newsKey = process.env.NEWS_API_KEY;

  if (finnhubKey) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=SPY&token=${finnhubKey}`,
        { next: { revalidate: 0 }, signal: AbortSignal.timeout(5000) }
      );
      finnhubOk = res.ok;
      if (res.status === 429) finnhubOk = false;
    } catch {
      finnhubOk = false;
    }
  }

  if (newsKey) {
    try {
      const res = await fetch(
        `https://newsapi.org/v2/top-headlines?country=us&pageSize=1&apiKey=${newsKey}`,
        { next: { revalidate: 0 }, signal: AbortSignal.timeout(5000) }
      );
      newsOk = res.ok;
      if (res.status === 429) newsOk = false;
    } catch {
      newsOk = false;
    }
  }

  const status = finnhubOk && newsOk ? "ok" : finnhubOk || newsOk ? "delayed" : "error";
  const label = status === "ok" ? "All systems live" : status === "delayed" ? "Some data delayed" : "Data issues — we're on it";
  return NextResponse.json({ status, label });
}
