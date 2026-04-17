import { NextRequest, NextResponse } from "next/server";
import { fetchEconomicEvents } from "./economic/route";
import type { EarningsItem, EconomicItem } from "@/lib/calendar/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type { EarningsItem, EconomicItem };

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

  // Run earnings (Finnhub + FMP backfill) and economic (FRED) fetches in parallel.
  const wantEarnings = type !== "economic";
  const wantEconomic = type !== "earnings";
  const fmpKey = process.env.FMP_API_KEY?.trim();

  type FinnhubCalItem = {
    date?: string;
    symbol?: string;
    epsActual?: number | null;
    epsEstimate?: number | null;
    revenueActual?: number | null;
    revenueEstimate?: number | null;
    hour?: string;
  };

  type FmpCalItem = {
    date?: string;
    symbol?: string;
    eps?: number | null;
    epsEstimated?: number | null;
    revenue?: number | null;
    revenueEstimated?: number | null;
    time?: string;
  };

  const finnhubEarningsPromise = wantEarnings
    ? fetch(
        `https://finnhub.io/api/v1/calendar/earnings?from=${fromStr}&to=${toStr}&token=${token}`,
        { next: { revalidate: 60 } }
      )
        .then((r) => (r.ok ? r.json() : { earningsCalendar: [] }))
        .then((d: { earningsCalendar?: FinnhubCalItem[] }) => d.earningsCalendar ?? [])
        .catch(() => [] as FinnhubCalItem[])
    : Promise.resolve([] as FinnhubCalItem[]);

  // FMP earning_calendar fills in actuals that Finnhub free tier sometimes omits
  // for past releases — without this, last-week cards stay grey "no actual yet".
  const fmpEarningsPromise =
    wantEarnings && fmpKey
      ? fetch(
          `https://financialmodelingprep.com/api/v3/earning_calendar?from=${fromStr}&to=${toStr}&apikey=${fmpKey}`,
          { next: { revalidate: 300 } }
        )
          .then((r) => (r.ok ? r.json() : []))
          .then((d) => (Array.isArray(d) ? (d as FmpCalItem[]) : []))
          .catch(() => [] as FmpCalItem[])
      : Promise.resolve([] as FmpCalItem[]);

  const earningsPromise = Promise.all([finnhubEarningsPromise, fmpEarningsPromise]).then(
    ([finnhubList, fmpList]) => {
      // Index FMP by ${symbol}__${date} for O(1) merge.
      const fmpIndex = new Map<string, FmpCalItem>();
      for (const f of fmpList) {
        if (!f.symbol || !f.date) continue;
        fmpIndex.set(`${f.symbol.toUpperCase()}__${f.date}`, f);
      }
      const merged = finnhubList.map((e, i): { item: EarningsItem; rev: number } => {
        const sym = (e.symbol ?? "").toUpperCase();
        const fmp = sym && e.date ? fmpIndex.get(`${sym}__${e.date}`) : undefined;
        // Coalesce: prefer Finnhub when present, fall back to FMP for nulls.
        const epsActual = e.epsActual ?? fmp?.eps ?? null;
        const epsEstimate = e.epsEstimate ?? fmp?.epsEstimated ?? null;
        const revenueActual = e.revenueActual ?? fmp?.revenue ?? null;
        const revenueEstimate = e.revenueEstimate ?? fmp?.revenueEstimated ?? null;
        const hour = e.hour ?? fmp?.time ?? null;
        return {
          item: {
            id: `earn-${e.symbol ?? i}-${e.date ?? ""}`,
            ticker: e.symbol ?? "",
            name: e.symbol ?? "",
            date: e.date ?? "",
            epsEstimate,
            revenueEstimate,
            epsActual,
            revenueActual,
            bmoAmc: (hour === "bmo" ? "BMO" : hour === "amc" ? "AMC" : null) as
              | "BMO"
              | "AMC"
              | null,
          },
          rev: revenueEstimate ?? 0,
        };
      });
      return merged
        .sort((a, b) => b.rev - a.rev)
        .slice(0, 20)
        .map(({ item }) => item) as EarningsItem[];
    }
  );

  const economicPromise = wantEconomic
    ? fetchEconomicEvents(fromStr, toStr).catch((e) => ({
        economic: [] as EconomicItem[],
        dataSource: "",
        error: e instanceof Error ? e.message : "Failed to load economic events",
      }))
    : Promise.resolve({ economic: [] as EconomicItem[], dataSource: "" as string, error: undefined });

  const [earnings, econResult] = await Promise.all([earningsPromise, economicPromise]);
  const economic = econResult.economic;
  const dataSource = econResult.dataSource ?? "";
  const economicError = econResult.error;

  return NextResponse.json({
    earnings,
    economic,
    dataSource,
    ...(economicError && { economicError }),
  });
}
