import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type EarningsItem = {
  id: string;
  ticker: string;
  name: string;
  date: string;
  epsEstimate: number | null;
  revenueEstimate: number | null;
  epsActual: number | null;
  revenueActual: number | null;
  bmoAmc: "BMO" | "AMC" | null;
};

export type EconomicItem = {
  id: string;
  name: string;
  date: string;
  dateTimeET: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  country: string;
  previous?: string;
  estimate?: string;
  actual?: string;
};

const FALLBACK_ECONOMIC: Omit<EconomicItem, "date">[] = [
  { id: "cpi", name: "Core CPI (MoM)", dateTimeET: "Tue 8:30 AM ET", impact: "HIGH", country: "US", previous: "0.2%", estimate: "0.2%" },
  { id: "ppi", name: "PPI", dateTimeET: "Tue 8:30 AM ET", impact: "MEDIUM", country: "US", previous: "0.3%", estimate: "0.1%" },
  { id: "fomc", name: "FOMC Minutes", dateTimeET: "Wed 2:00 PM ET", impact: "HIGH", country: "US" },
  { id: "retail", name: "Retail Sales", dateTimeET: "Wed 8:30 AM ET", impact: "MEDIUM", country: "US", previous: "0.6%", estimate: "0.3%" },
  { id: "claims", name: "Initial Jobless Claims", dateTimeET: "Thu 8:30 AM ET", impact: "MEDIUM", country: "US", previous: "242K", estimate: "235K" },
  { id: "philly", name: "Philadelphia Fed", dateTimeET: "Thu 8:30 AM ET", impact: "LOW", country: "US", previous: "4.5", estimate: "5.0" },
  { id: "sentiment", name: "Consumer Sentiment", dateTimeET: "Fri 10:00 AM ET", impact: "MEDIUM", country: "US", previous: "68.1", estimate: "69.0" },
];

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type"); // "earnings" | "economic"
  const from = request.nextUrl.searchParams.get("from"); // YYYY-MM-DD
  const to = request.nextUrl.searchParams.get("to"); // YYYY-MM-DD
  const token = process.env.FINNHUB_API_KEY;
  if (!token) {
    return NextResponse.json(
      { earnings: [], economic: [], error: "FINNHUB_API_KEY not set" },
      { status: 200 }
    );
  }
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from ? new Date(from) : new Date();
  if (!from) fromDate.setDate(fromDate.getDate());
  if (!to) toDate.setDate(toDate.getDate() + 7);
  const fromStr = dateStr(fromDate);
  const toStr = dateStr(toDate);

  const earnings: EarningsItem[] = [];
  const economic: EconomicItem[] = [];

  if (type !== "economic") {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/calendar/earnings?from=${fromStr}&to=${toStr}&token=${token}`,
        { next: { revalidate: 0 } }
      );
      if (res.ok) {
        const data = (await res.json()) as { earningsCalendar?: Array<{
          date?: string;
          symbol?: string;
          epsActual?: number | null;
          epsEstimate?: number | null;
          revenueActual?: number | null;
          revenueEstimate?: number | null;
          quarter?: number;
          year?: number;
          hour?: string;
        }> };
        const list = (data?.earningsCalendar ?? []) as Array<{
          date?: string;
          symbol?: string;
          epsActual?: number | null;
          epsEstimate?: number | null;
          revenueActual?: number | null;
          revenueEstimate?: number | null;
          hour?: string;
        }>;
        const withRev = list.map((e, i) => ({
          item: {
            id: `earn-${e.symbol ?? i}-${e.date ?? ""}`,
            ticker: e.symbol ?? "",
            name: e.symbol ?? "",
            date: e.date ?? "",
            epsEstimate: e.epsEstimate ?? null,
            revenueEstimate: e.revenueEstimate ?? null,
            epsActual: e.epsActual ?? null,
            revenueActual: e.revenueActual ?? null,
            bmoAmc: (e.hour === "bmo" ? "BMO" : e.hour === "amc" ? "AMC" : null) as "BMO" | "AMC" | null,
          },
          rev: e.revenueEstimate ?? 0,
        }));
        withRev
          .sort((a, b) => b.rev - a.rev)
          .slice(0, 20)
          .forEach(({ item }) => earnings.push(item));
      }
    } catch (e) {
      console.error("[calendar earnings]", e);
    }
  }

  if (type !== "earnings") {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/calendar/economic?from=${fromStr}&to=${toStr}&token=${token}`,
        { next: { revalidate: 0 } }
      );
      if (res.ok) {
        const data = (await res.json()) as { economicCalendar?: Array<{
          date?: string;
          time?: string;
          country?: string;
          event?: string;
          currency?: string;
          previous?: string;
          estimate?: string;
          actual?: string;
          impact?: string;
        }> };
        const list = data?.economicCalendar ?? [];
        list.forEach((e, i) => {
          const impact = (e.impact?.toUpperCase() === "HIGH" ? "HIGH" : e.impact?.toUpperCase() === "LOW" ? "LOW" : "MEDIUM") as "HIGH" | "MEDIUM" | "LOW";
          economic.push({
            id: `econ-${i}-${e.date ?? ""}-${e.event ?? ""}`,
            name: e.event ?? "Event",
            date: e.date ?? "",
            dateTimeET: e.time ? `${e.date} ${e.time}` : (e.date ?? ""),
            impact,
            country: e.country ?? "",
            previous: e.previous,
            estimate: e.estimate,
            actual: e.actual,
          });
        });
      }
    } catch (e) {
      console.error("[calendar economic]", e);
    }
  }

  if (economic.length === 0) {
    const monday = new Date(fromStr + "T12:00:00Z");
    FALLBACK_ECONOMIC.forEach((e, i) => {
      const d = new Date(monday);
      d.setUTCDate(monday.getUTCDate() + (i % 5));
      economic.push({ ...e, date: d.toISOString().slice(0, 10) });
    });
  }

  return NextResponse.json({ earnings, economic });
}
