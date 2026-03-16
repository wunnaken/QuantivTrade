import { NextRequest, NextResponse } from "next/server";
import { fetchEconomicEvents } from "./economic/route";

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

  let dataSource = "";
  let economicError: string | undefined;
  if (type !== "earnings") {
    try {
      const result = await fetchEconomicEvents(fromStr, toStr);
      result.economic.forEach((e) => economic.push(e));
      dataSource = result.dataSource ?? "";
      if (result.error) economicError = result.error;
    } catch (e) {
      economicError = e instanceof Error ? e.message : "Failed to load economic events";
    }
  }

  return NextResponse.json({
    earnings,
    economic,
    dataSource,
    ...(economicError && { economicError }),
  });
}
