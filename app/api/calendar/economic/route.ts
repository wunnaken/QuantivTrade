import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

const COUNTRY_ORDER: Record<string, number> = {
  US: 0,
  EU: 1,
  UK: 2,
  CN: 3,
  JP: 4,
  China: 5,
  Japan: 6,
};

function countryRank(country: string): number {
  const c = (country || "").toUpperCase().slice(0, 2);
  return COUNTRY_ORDER[c] ?? COUNTRY_ORDER[country ?? ""] ?? 99;
}

function mapImpact(impact: string): "HIGH" | "MEDIUM" | "LOW" {
  const s = (impact || "").toLowerCase();
  if (s === "high") return "HIGH";
  if (s === "low") return "LOW";
  return "MEDIUM";
}

type FMPEvent = {
  event?: string;
  date?: string;
  country?: string;
  actual?: string | number;
  previous?: string | number;
  estimate?: string | number;
  impact?: string;
};

function getFmpApiKey(): string | undefined {
  return (
    process.env.FMP_API_KEY ??
    process.env.FINANCIAL_MODELING_PREP_API_KEY
  );
}

export async function fetchEconomicEvents(
  fromStr: string,
  toStr: string
): Promise<{ economic: EconomicItem[]; dataSource: string; error?: string }> {
  const apiKey = getFmpApiKey();
  if (!apiKey || apiKey.trim() === "") {
    return { economic: [], dataSource: "", error: "FMP API key not set. Add FMP_API_KEY to .env.local and restart the dev server." };
  }

  try {
    const url = `https://financialmodelingprep.com/api/v4/economic_calendar?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&apikey=${encodeURIComponent(apiKey.trim())}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      if (!res.ok) {
        return { economic: [], dataSource: "", error: `FMP API error (${res.status}): ${text.slice(0, 200)}` };
      }
      return { economic: [], dataSource: "", error: "Invalid JSON from FMP API" };
    }

    if (!res.ok) {
      const errMsg = data && typeof data === "object" && "Error Message" in data
        ? String((data as { "Error Message"?: string })["Error Message"])
        : text.slice(0, 200);
      return { economic: [], dataSource: "", error: errMsg || `FMP API ${res.status}` };
    }

    if (data && typeof data === "object" && "Error Message" in data) {
      return { economic: [], dataSource: "", error: String((data as { "Error Message"?: string })["Error Message"]) };
    }

    let rawList: unknown[] = [];
    if (Array.isArray(data)) {
      rawList = data;
    } else if (data && typeof data === "object" && "economicCalendar" in data && Array.isArray((data as { economicCalendar: unknown[] }).economicCalendar)) {
      rawList = (data as { economicCalendar: unknown[] }).economicCalendar;
    } else if (data && typeof data === "object" && "data" in data && Array.isArray((data as { data: unknown[] }).data)) {
      rawList = (data as { data: unknown[] }).data;
    }
    const mapped: EconomicItem[] = rawList.map((e: FMPEvent, i: number) => {
      const dateIso = (e.date ?? "").toString().trim();
      const datePart = dateIso.slice(0, 10);
      const timePart = dateIso.includes("T") ? dateIso.split("T")[1]?.slice(0, 5) ?? "" : "";
      if (!datePart || datePart.length < 10) return null;
      return {
        id: `fmp-${i}-${datePart}-${(e.event ?? "").replace(/\s/g, "-")}`,
        name: (e.event ?? "Event").toString(),
        date: datePart,
        dateTimeET: timePart ? `${datePart} ${timePart}` : datePart,
        impact: mapImpact(e.impact ?? ""),
        country: (e.country ?? "").toString(),
        previous: e.previous != null ? String(e.previous) : undefined,
        estimate: e.estimate != null ? String(e.estimate) : undefined,
        actual: e.actual != null ? String(e.actual) : undefined,
      };
    }).filter((x): x is EconomicItem => x != null);

    const byDate = new Map<string, EconomicItem[]>();
    for (const item of mapped) {
      if (!item.date) continue;
      const list = byDate.get(item.date) ?? [];
      list.push(item);
      byDate.set(item.date, list);
    }

    const filtered: EconomicItem[] = [];
    for (const [, dayEvents] of byDate) {
      const hasHighOrMedium = dayEvents.some((e) => e.impact === "HIGH" || e.impact === "MEDIUM");
      const toInclude = hasHighOrMedium
        ? dayEvents.filter((e) => e.impact !== "LOW")
        : dayEvents;
      toInclude.sort((a, b) => countryRank(a.country) - countryRank(b.country));
      filtered.push(...toInclude);
    }

    filtered.sort((a, b) => (a.date + (a.dateTimeET ?? "")).localeCompare(b.date + (b.dateTimeET ?? "")));

    return {
      economic: filtered,
      dataSource: "Financial Modeling Prep",
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed";
    return { economic: [], dataSource: "", error: message };
  }
}

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  const today = new Date();
  const fromStr = from ?? today.toISOString().split("T")[0];
  const toDate = to
    ? new Date(to)
    : new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const toStr = to ?? toDate.toISOString().split("T")[0];

  const result = await fetchEconomicEvents(fromStr, toStr);
  return NextResponse.json({
    economic: result.economic,
    dataSource: result.dataSource,
    ...(result.error && { error: result.error }),
  });
}
