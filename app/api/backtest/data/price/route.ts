import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const engineUrl = process.env.BACKTEST_ENGINE_URL;
  if (!engineUrl) {
    return NextResponse.json({ error: "BACKTEST_ENGINE_URL not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker") ?? "";
  const period = searchParams.get("period") ?? "5d";
  const interval = searchParams.get("interval") ?? "1d";

  try {
    const res = await fetch(
      `${engineUrl}/data/price?ticker=${encodeURIComponent(ticker)}&period=${period}&interval=${interval}`
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: `Engine unreachable: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 502 }
    );
  }
}
