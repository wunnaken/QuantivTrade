import { NextRequest, NextResponse } from "next/server";
import { getFredSeriesId } from "@/lib/calendar/fred-series";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const seriesId = request.nextUrl.searchParams.get("series_id");
  const start = request.nextUrl.searchParams.get("observation_start");
  const end = request.nextUrl.searchParams.get("observation_end");
  const eventName = request.nextUrl.searchParams.get("event_name");

  const key = process.env.FRED_API_KEY?.trim();
  const sid = seriesId || (eventName ? getFredSeriesId(eventName) : null);
  if (!sid) {
    return NextResponse.json({ observations: [], series_id: null }, { status: 200 });
  }

  const endDate = end ? new Date(end) : new Date();
  const startDate = start ? new Date(start) : (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 10);
    return d;
  })();

  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);

  if (!key) {
    return NextResponse.json({ observations: [], series_id: sid }, { status: 200 });
  }

  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(sid)}&api_key=${key}&file_type=json&observation_start=${startStr}&observation_end=${endStr}&sort_order=asc`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) throw new Error("FRED request failed");
    const data = (await res.json()) as { observations?: Array<{ date: string; value: string }> };
    const observations = (data.observations ?? [])
      .filter((o) => o.value !== ".")
      .map((o) => ({ date: o.date, value: parseFloat(o.value) }));
    return NextResponse.json({ observations, series_id: sid });
  } catch (e) {
    console.error("[calendar/fred]", e);
    return NextResponse.json({ observations: [], series_id: sid }, { status: 200 });
  }
}
