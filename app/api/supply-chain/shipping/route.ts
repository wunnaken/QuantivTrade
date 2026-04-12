import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function fetchFinnhubQuote(symbol: string, key: string) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Finnhub quote ${symbol} failed: ${res.status}`);
  return res.json() as Promise<{ c: number; d: number; dp: number; h: number; l: number; o: number; pc: number; t: number }>;
}

async function fetchFinnhubCandles(symbol: string, key: string, days = 90) {
  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 86400;
  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${key}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Finnhub candles ${symbol} failed: ${res.status}`);
  const data = await res.json() as { s: string; c?: number[]; t?: number[] };
  if (data.s !== "ok" || !data.c || !data.t) return [];
  return data.t.map((ts, i) => ({
    date: new Date(ts * 1000).toISOString().slice(0, 10),
    value: data.c![i],
  }));
}

async function fetchNewsCount(query: string, key: string) {
  const url = `https://newsdata.io/api/1/news?apikey=${key}&q=${encodeURIComponent(query)}&language=en&category=business`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`NewsData fetch failed: ${res.status}`);
  const data = await res.json() as { totalResults?: number; results?: unknown[] };
  return data.totalResults ?? data.results?.length ?? 0;
}

async function fetchFredSeries(seriesId: string, key: string, limit = 52) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&sort_order=desc&limit=${limit}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`FRED ${seriesId} failed: ${res.status}`);
  const json = await res.json() as { observations?: Array<{ date: string; value: string }> };
  return (json.observations ?? [])
    .filter((o) => o.value !== "." && o.value !== "")
    .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
    .reverse();
}

async function fetchEIADiesel(key: string) {
  // Weekly US on-highway diesel retail prices ($/gallon)
  const url = `https://api.eia.gov/v2/petroleum/pri/gnd/data/?frequency=weekly&data[0]=value&facets[duoarea][]=NUS&facets[product][]=EPD2D&sort[0][column]=period&sort[0][direction]=desc&length=52&api_key=${key}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`EIA diesel failed: ${res.status}`);
  const json = await res.json() as { response?: { data?: Array<{ period: string; value: string | number }> } };
  return (json.response?.data ?? [])
    .filter((d) => d.value !== null && d.value !== "")
    .map((d) => ({ date: d.period, value: typeof d.value === "string" ? parseFloat(d.value) : d.value }))
    .reverse();
}

export async function GET() {
  const finnhubKey = process.env.FINNHUB_API_KEY?.trim();
  const newsKey = process.env.NEWS_API_KEY?.trim();
  const fredKey = process.env.FRED_API_KEY?.trim();
  const eiaKey = process.env.EIA_API_KEY?.trim();

  if (!finnhubKey) {
    return NextResponse.json(
      { error: "FINNHUB_API_KEY not configured", message: "Finnhub API key required for shipping proxy data." },
      { status: 503 }
    );
  }

  // All market proxy tickers (shipping + trucking)
  const allProxies = ["BDRY", "ZIM", "MATX", "SBLK", "JBHT", "WERN", "KNX", "ODFL", "XPO", "CHRW", "R"];
  const quoteResults = await Promise.allSettled(
    allProxies.map(async (sym) => ({ symbol: sym, quote: await fetchFinnhubQuote(sym, finnhubKey) }))
  );

  const quotes: Record<string, unknown> = {};
  quoteResults.forEach((r, i) => {
    const sym = allProxies[i];
    if (r.status === "fulfilled") {
      quotes[sym] = { ...r.value.quote, symbol: sym };
    } else {
      quotes[sym] = { error: String(r.reason) };
    }
  });

  // BDRY candle history for chart
  let bdryHistory: { date: string; value: number }[] = [];
  try {
    bdryHistory = await fetchFinnhubCandles("BDRY", finnhubKey, 90);
  } catch {}

  // Port congestion news proxy
  let congestionCount: number | null = null;
  let congestionDate: string | null = null;
  if (newsKey) {
    try {
      congestionCount = await fetchNewsCount("port congestion delay shipping", newsKey);
      congestionDate = new Date().toISOString().slice(0, 10);
    } catch {}
  }

  // Trucking Services Index (FRED: TSITRK) — monthly, from BTS
  let tsiHistory: { date: string; value: number }[] = [];
  let tsiLatest: { date: string; value: number } | null = null;
  if (fredKey) {
    try {
      tsiHistory = await fetchFredSeries("TSITRK", fredKey, 36);
      tsiLatest = tsiHistory.length > 0 ? tsiHistory[tsiHistory.length - 1] : null;
    } catch {}
  }

  // Weekly diesel prices (EIA)
  let dieselHistory: { date: string; value: number }[] = [];
  let dieselLatest: { date: string; value: number } | null = null;
  if (eiaKey) {
    try {
      dieselHistory = await fetchEIADiesel(eiaKey);
      dieselLatest = dieselHistory.length > 0 ? dieselHistory[dieselHistory.length - 1] : null;
    } catch {}
  }

  return NextResponse.json({
    source: "Finnhub (market proxies) + NewsData.io (congestion proxy)",
    bdi: {
      proxy: "BDRY",
      proxyName: "Breakwave Dry Bulk Shipping ETF",
      quote: quotes["BDRY"],
      history: bdryHistory,
      label: "Baltic Dry Index Proxy",
      disclaimer:
        "BDRY ETF (Breakwave Dry Bulk Shipping ETF) is used as a proxy for the Baltic Dry Index. This is market data, not the actual BDI index. Rising BDRY price historically correlates with increased global dry bulk commodity demand and precedes broader economic activity by 3–6 months.",
      updateFrequency: "Real-time market hours",
    },
    containerShipping: {
      freightos: {
        status: "unavailable",
        message:
          "Freightos Baltic Exchange Index (FBX) data requires a paid Freightos subscription. FBX tracks container shipping rates across 12 major trade lanes. Visit https://fbx.freightos.com for pricing.",
      },
      marketProxies: {
        ZIM: { quote: quotes["ZIM"], label: "ZIM Integrated Shipping — container shipping proxy", type: "market-proxy" },
        MATX: { quote: quotes["MATX"], label: "Matson Inc — Pacific container shipping proxy", type: "market-proxy" },
        SBLK: { quote: quotes["SBLK"], label: "Star Bulk Carriers — dry bulk shipping proxy", type: "market-proxy" },
        disclaimer:
          "These are equity prices of shipping companies — they are market proxies, not direct container shipping rate data. Stock prices reflect investor sentiment and may diverge from actual shipping rates.",
      },
    },
    portCongestion: {
      newsProxy: congestionCount !== null ? congestionCount : null,
      newsDate: congestionDate,
      disclaimer:
        "Port congestion indicator is based on article count from NewsData.io matching 'port congestion delay shipping'. This is a sentiment/news-volume proxy — NOT official port data. Higher article count may indicate more congestion news coverage. MarineTraffic provides real port congestion data but requires a paid API subscription.",
      marineTaffic: {
        status: "unavailable",
        message:
          "MarineTraffic vessel and port data requires a paid API subscription. Visit https://www.marinetraffic.com/en/p/api-services for pricing.",
      },
    },
    trucking: {
      dat: {
        status: "unavailable",
        message:
          "DAT Freight & Analytics trucking spot rates require a paid DAT subscription. DAT is the leading source for truckload spot rates. Visit https://www.dat.com for pricing.",
      },
      tsi: {
        history: tsiHistory,
        latest: tsiLatest,
        available: tsiHistory.length > 0,
        label: "Transportation Services Index — Trucking",
        source: "Bureau of Transportation Statistics via FRED (TSITRK)",
        schedule: "Monthly — released ~60 days after month end",
        note: "The TSI-Trucking measures the output of the for-hire trucking industry. Rising index = more freight volume moving. 2000=100 baseline.",
      },
      diesel: {
        history: dieselHistory,
        latest: dieselLatest,
        available: dieselHistory.length > 0,
        label: "US On-Highway Diesel Retail Price",
        source: "EIA Weekly Retail Gasoline and Diesel Prices",
        schedule: "Weekly — released every Monday",
        note: "Diesel is ~40% of trucking operating costs. Rising diesel prices compress carrier margins and often lead to fuel surcharge increases passed to shippers.",
      },
      // Categorized trucking stocks
      truckloadProxies: {
        JBHT: { quote: quotes["JBHT"], label: "J.B. Hunt Transport", segment: "Intermodal / TL", type: "market-proxy" },
        WERN: { quote: quotes["WERN"], label: "Werner Enterprises", segment: "Truckload (TL)", type: "market-proxy" },
        KNX: { quote: quotes["KNX"], label: "Knight-Swift Transportation", segment: "Truckload (TL)", type: "market-proxy" },
      },
      ltlProxies: {
        ODFL: { quote: quotes["ODFL"], label: "Old Dominion Freight Line", segment: "LTL", type: "market-proxy" },
        XPO: { quote: quotes["XPO"], label: "XPO Inc", segment: "LTL / Logistics", type: "market-proxy" },
      },
      brokerProxies: {
        CHRW: { quote: quotes["CHRW"], label: "C.H. Robinson Worldwide", segment: "Freight Brokerage", type: "market-proxy" },
        R: { quote: quotes["R"], label: "Ryder System", segment: "Fleet Leasing / Logistics", type: "market-proxy" },
      },
    },
  });
}
