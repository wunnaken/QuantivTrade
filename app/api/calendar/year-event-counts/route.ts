import { NextRequest, NextResponse } from "next/server";
import { fetchEconomicEvents } from "../economic/route";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

/**
 * Per-month aggregated event counts for the year view bar graph.
 *
 * Returns just the totals (not the full event list) so the year tab can show
 * monthly high/medium impact counts without shipping ~500 event objects.
 *
 * Fed-meeting count was removed from the year chart, so we no longer return
 * it — only high and medium per month.
 */

type Counts = { high: number; medium: number };

export async function GET(request: NextRequest) {
  const yearStr = request.nextUrl.searchParams.get("year");
  const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();
  if (Number.isNaN(year) || year < 1990 || year > 2100) {
    return NextResponse.json({ error: "invalid year" }, { status: 400 });
  }

  const fromStr = `${year}-01-01`;
  const toStr = `${year}-12-31`;
  const monthly: Counts[] = Array.from({ length: 12 }, () => ({ high: 0, medium: 0 }));

  try {
    const result = await fetchEconomicEvents(fromStr, toStr, { skipObservations: true });
    for (const ev of result.economic) {
      const m = parseInt(ev.date.slice(5, 7), 10) - 1;
      if (m < 0 || m > 11) continue;
      if (ev.impact === "HIGH") monthly[m].high += 1;
      else if (ev.impact === "MEDIUM") monthly[m].medium += 1;
    }
    const total = monthly.reduce(
      (a, c) => ({ high: a.high + c.high, medium: a.medium + c.medium }),
      { high: 0, medium: 0 }
    );
    return NextResponse.json({ monthly, total });
  } catch (e) {
    console.error("[year-event-counts]", e);
    return NextResponse.json({
      monthly,
      total: { high: 0, medium: 0 },
      error: e instanceof Error ? e.message : "Failed to load",
    });
  }
}
