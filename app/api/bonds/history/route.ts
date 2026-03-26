import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

const MATURITIES = [
  { label: "2Y",  seriesId: "DGS2" },
  { label: "5Y",  seriesId: "DGS5" },
  { label: "10Y", seriesId: "DGS10" },
  { label: "30Y", seriesId: "DGS30" },
];

export async function GET() {
  const fredKey = process.env.FRED_API_KEY?.trim();
  if (!fredKey) {
    return NextResponse.json({ history: [] });
  }

  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 35);
  const fromStr = monthAgo.toISOString().slice(0, 10);
  const toStr = today.toISOString().slice(0, 10);

  const results = await Promise.allSettled(
    MATURITIES.map(async ({ label, seriesId }) => {
      const url =
        `${FRED_BASE}?series_id=${seriesId}&api_key=${fredKey}` +
        `&observation_start=${fromStr}&observation_end=${toStr}&file_type=json&sort_order=asc`;
      const res = await fetch(url, { next: { revalidate: 300 } });
      if (!res.ok) return { label, data: [] as { date: string; value: number }[] };
      const json = (await res.json()) as { observations?: { date: string; value: string }[] };
      const data = (json.observations ?? [])
        .filter((o) => o.value !== "." && o.value !== "")
        .map((o) => ({ date: o.date, value: parseFloat(o.value) }));
      return { label, data };
    })
  );

  const history = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<{ label: string; data: { date: string; value: number }[] }>).value);

  return NextResponse.json({ history });
}
