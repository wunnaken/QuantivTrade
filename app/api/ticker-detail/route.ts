import { NextRequest, NextResponse } from "next/server";

export const revalidate = 3600;

function toFinnhubSymbol(ticker: string): string {
  const u = ticker.toUpperCase();
  if (u === "BTC") return "BINANCE:BTCUSDT";
  if (u === "ETH") return "BINANCE:ETHUSDT";
  return u;
}

async function finnhub(path: string, token: string) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`https://finnhub.io/api/v1${path}${sep}token=${token}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json;
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.trim().toUpperCase();
  if (!ticker) return NextResponse.json({ error: "Missing ticker" }, { status: 400 });

  const token = process.env.FINNHUB_API_KEY;
  if (!token) return NextResponse.json({ error: "No API key" }, { status: 500 });

  const sym = toFinnhubSymbol(ticker);
  const isCrypto = sym.startsWith("BINANCE:");

  // For crypto, profile/financials/dividends won't exist — skip those calls
  const [profile, metrics, earnings, dividends] = await Promise.all([
    isCrypto ? null : finnhub(`/stock/profile2?symbol=${sym}`, token),
    isCrypto ? null : finnhub(`/stock/metric?symbol=${sym}&metric=all`, token),
    isCrypto ? null : finnhub(`/stock/earnings?symbol=${sym}&limit=12`, token),
    isCrypto ? null : finnhub(`/stock/dividend2?symbol=${sym}`, token),
  ]);

  // Earnings calendar (next earnings date)
  let nextEarningsDate: string | null = null;
  if (!isCrypto) {
    try {
      const from = new Date().toISOString().slice(0, 10);
      const toDate = new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10);
      const cal = await finnhub(`/calendar/earnings?from=${from}&to=${toDate}&symbol=${ticker}`, token);
      const entries: { date?: string; symbol?: string }[] = cal?.earningsCalendar ?? [];
      const match = entries.find((e) => e.symbol === ticker && e.date);
      nextEarningsDate = match?.date ?? null;
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ profile, metrics, earnings, dividends, nextEarningsDate });
}
