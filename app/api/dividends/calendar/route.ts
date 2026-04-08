import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // 1 hour

export async function GET() {
  const apiKey = process.env.FMP_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ entries: [] }, { status: 200 });
  }

  const today = new Date();
  const future = new Date(today);
  future.setDate(future.getDate() + 90);

  const fmt = (d: Date) => d.toISOString().split("T")[0];

  try {
    const res = await fetch(
      `https://financialmodelingprep.com/api/v3/stock_dividend_calendar?from=${fmt(today)}&to=${fmt(future)}&apikey=${apiKey}`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) return NextResponse.json({ entries: [] });

    type FmpEntry = {
      symbol: string;
      date: string;
      paymentDate?: string;
      adjDividend?: number;
      dividend?: number;
    };

    const raw: FmpEntry[] = await res.json();

    const entries = raw
      .filter((e) => e.symbol && e.date && (e.adjDividend || e.dividend))
      .map((e) => {
        const exDate = new Date(e.date);
        const daysAway = Math.round((exDate.getTime() - today.getTime()) / 86400000);
        const amount = e.adjDividend ?? e.dividend ?? 0;
        return {
          symbol: e.symbol,
          company: e.symbol,
          exDiv: exDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          payDate: e.paymentDate
            ? new Date(e.paymentDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : "—",
          amount: `$${amount.toFixed(4).replace(/\.?0+$/, "")}`,
          yield: "—",
          freq: "Quarterly",
          daysAway,
        };
      })
      .filter((e) => e.daysAway >= 0)
      .sort((a, b) => a.daysAway - b.daysAway)
      .slice(0, 50);

    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ entries: [] });
  }
}
