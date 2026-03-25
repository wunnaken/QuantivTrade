import { NextRequest, NextResponse } from "next/server";
import { fetchEconomicEvents } from "../economic/route";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function GET(request: NextRequest) {
  const year =
    request.nextUrl.searchParams.get("year") ??
    String(new Date().getFullYear());

  const fromStr = `${year}-01-01`;
  const toStr = `${year}-12-31`;

  const result = await fetchEconomicEvents(fromStr, toStr);

  return NextResponse.json({
    events: result.economic.map((e) => ({
      date: e.date,
      name: e.name,
      impact: e.impact,
    })),
    ...(result.error && { error: result.error }),
  });
}
