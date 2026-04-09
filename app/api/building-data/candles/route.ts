export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

const CHART_STOCKS = [
  { symbol: "ITB", name: "Home Construction ETF", group: "Homebuilders" },
  { symbol: "XHB", name: "Homebuilders ETF", group: "Homebuilders" },
  { symbol: "DHI", name: "D.R. Horton", group: "Homebuilders" },
  { symbol: "HD", name: "Home Depot", group: "Home Improvement" },
  { symbol: "LOW", name: "Lowe's", group: "Home Improvement" },
  { symbol: "BLDR", name: "Builders FirstSource", group: "Home Improvement" },
  { symbol: "XLB", name: "Materials SPDR ETF", group: "Materials" },
  { symbol: "MLM", name: "Martin Marietta", group: "Materials" },
  { symbol: "NUE", name: "Nucor Steel", group: "Materials" },
];

const GROUP_COLORS: Record<string, string> = {
  Homebuilders: "#00c896",
  "Home Improvement": "#60a5fa",
  Materials: "#f59e0b",
};

/** Yahoo Finance chart API — free, no key required. */
async function fetchYahooCandles(
  symbol: string,
  period1: number,
  period2: number,
  interval: string,
): Promise<{ date: string; pct: number }[]> {
  try {
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
      `?period1=${period1}&period2=${period2}&interval=${interval}&includePrePost=false`;

    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://finance.yahoo.com/",
      },
    });
    if (!res.ok) return [];

    const json = (await res.json()) as {
      chart?: {
        result?: {
          timestamp?: number[];
          indicators?: { quote?: { close?: (number | null)[] }[] };
        }[];
      };
    };

    const result = json?.chart?.result?.[0];
    if (!result?.timestamp || !result.indicators?.quote?.[0]?.close) return [];

    const timestamps = result.timestamp;
    const closes = result.indicators.quote[0].close ?? [];

    const firstValid = closes.find((c) => c != null && c > 0) ?? null;
    if (!firstValid) return [];

    return timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().split("T")[0],
        pct:
          closes[i] != null
            ? parseFloat(((closes[i]! / firstValid - 1) * 100).toFixed(2))
            : null,
      }))
      .filter((p): p is { date: string; pct: number } => p.pct !== null);
  } catch {
    return [];
  }
}

/** Finnhub candle — paid-tier feature, used as first attempt. */
async function fetchFinnhubCandles(
  symbol: string,
  from: number,
  to: number,
  resolution: string,
  token: string,
): Promise<{ date: string; pct: number }[]> {
  try {
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${token}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { s: string; t?: number[]; c?: number[] };
    if (data.s !== "ok" || !data.t || !data.c || data.c.length === 0) return [];

    const firstClose = data.c[0];
    if (!firstClose || firstClose <= 0) return [];

    return data.t.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().split("T")[0],
      pct: parseFloat(((data.c![i] / firstClose - 1) * 100).toFixed(2)),
    }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const token = process.env.FINNHUB_API_KEY?.trim() ?? "";

  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") ?? "1M";

  const now = Math.floor(Date.now() / 1000);
  const day = 86400;
  let from: number;
  let resolution = "D";
  let yahooInterval = "1d";

  switch (range) {
    case "1W":
      from = now - 7 * day;
      resolution = "60";
      yahooInterval = "1h";
      break;
    case "1M":
      from = now - 30 * day;
      break;
    case "3M":
      from = now - 90 * day;
      break;
    case "YTD": {
      const y = new Date().getFullYear();
      from = Math.floor(new Date(y, 0, 1).getTime() / 1000);
      break;
    }
    case "1Y":
      from = now - 365 * day;
      yahooInterval = "1wk";
      break;
    default:
      from = now - 30 * day;
  }

  const stockData = await Promise.all(
    CHART_STOCKS.map(async ({ symbol, name, group }) => {
      // Try Finnhub first (works on paid plans), fall back to Yahoo Finance
      let points: { date: string; pct: number }[] = [];

      if (token) {
        points = await fetchFinnhubCandles(symbol, from, now, resolution, token);
      }
      if (points.length === 0) {
        points = await fetchYahooCandles(symbol, from, now, yahooInterval);
      }

      return { symbol, name, group, color: GROUP_COLORS[group] ?? "#94a3b8", points };
    }),
  );

  // Build group-averaged series
  const groups = [...new Set(CHART_STOCKS.map((s) => s.group))];
  const groupSeries = groups.map((groupName) => {
    const members = stockData.filter((s) => s.group === groupName && s.points.length > 0);
    if (members.length === 0) {
      return { group: groupName, color: GROUP_COLORS[groupName] ?? "#94a3b8", points: [] };
    }

    const allDates = [...new Set(members.flatMap((m) => m.points.map((p) => p.date)))].sort();
    const memberMaps = members.map((m) =>
      Object.fromEntries(m.points.map((p) => [p.date, p.pct])),
    );

    const points = allDates.map((date) => {
      const vals = memberMaps
        .map((mm) => mm[date])
        .filter((v): v is number => v !== undefined && v !== null);
      const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      return { date, pct: avg !== null ? parseFloat(avg.toFixed(2)) : null };
    });

    return { group: groupName, color: GROUP_COLORS[groupName] ?? "#94a3b8", points };
  });

  const hasData = groupSeries.some((g) => g.points.length > 0);
  return NextResponse.json({ range, stocks: stockData, groups: groupSeries, hasData });
}
