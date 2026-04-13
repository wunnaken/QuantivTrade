import { NextRequest, NextResponse } from "next/server";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.trim().toUpperCase();
  if (!ticker) return NextResponse.json({ error: "Missing ticker" }, { status: 400 });

  const token = process.env.FINNHUB_API_KEY;
  if (!token) return NextResponse.json({ transactions: [] });

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${encodeURIComponent(ticker)}&from=${ninetyDaysAgo}&token=${token}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return NextResponse.json({ transactions: [] });
    const data = await res.json();
    const txns = Array.isArray(data?.data) ? data.data : [];

    // Filter open-market buys/sells only
    const filtered = txns
      .filter((t: Record<string, unknown>) =>
        t.transactionCode === "P" || t.transactionCode === "S"
      )
      .slice(0, 30)
      .map((t: Record<string, unknown>) => ({
        name: t.name as string,
        type: t.transactionCode === "P" ? "Purchase" : "Sale",
        shares: t.share as number,
        price: t.transactionPrice as number,
        value: ((t.share as number) * (t.transactionPrice as number)),
        date: t.transactionDate as string,
      }));

    const purchases = filtered.filter((t: { type: string }) => t.type === "Purchase");
    const sales = filtered.filter((t: { type: string }) => t.type === "Sale");

    return NextResponse.json({ transactions: filtered, purchases: purchases.length, sales: sales.length });
  } catch {
    return NextResponse.json({ transactions: [] });
  }
}
