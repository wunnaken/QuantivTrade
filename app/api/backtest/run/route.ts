import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const engineUrl = process.env.BACKTEST_ENGINE_URL;
  if (!engineUrl) {
    return NextResponse.json({ error: "BACKTEST_ENGINE_URL not configured" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const res = await fetch(`${engineUrl}/backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: `Engine unreachable: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 502 }
    );
  }
}
