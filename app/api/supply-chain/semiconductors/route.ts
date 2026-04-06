import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function fetchFREDSeries(seriesId: string, key: string, limit = 24) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&sort_order=desc&limit=${limit}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`FRED series ${seriesId} failed: ${res.status}`);
  const json = await res.json() as { observations?: Array<{ date: string; value: string }> };
  return (json.observations ?? [])
    .filter((o) => o.value !== ".")
    .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
    .reverse();
}

async function fetchFinnhubQuote(symbol: string, key: string) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Finnhub ${symbol} failed: ${res.status}`);
  return res.json() as Promise<{ c: number; d: number; dp: number; h: number; l: number; o: number; pc: number; t: number }>;
}

async function fetchFinnhubCandles(symbol: string, key: string, days = 90) {
  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 86400;
  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${key}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Finnhub candles ${symbol} failed`);
  const data = await res.json() as { s: string; c?: number[]; t?: number[] };
  if (data.s !== "ok" || !data.c || !data.t) return [];
  return data.t.map((ts, i) => ({
    date: new Date(ts * 1000).toISOString().slice(0, 10),
    value: data.c![i],
  }));
}

export async function GET() {
  const fredKey = process.env.FRED_API_KEY?.trim();
  const finnhubKey = process.env.FINNHUB_API_KEY?.trim();

  if (!fredKey) {
    return NextResponse.json(
      { error: "FRED_API_KEY not configured", message: "FRED API key required for semiconductor production data." },
      { status: 503 }
    );
  }

  const [prodIndex, ppiSemis] = await Promise.allSettled([
    fetchFREDSeries("IPG3344S", fredKey, 24),
    fetchFREDSeries("PCU334413334413", fredKey, 24),
  ]);

  let soxHistory: { date: string; value: number }[] = [];
  let soxQuote: { c: number; d: number; dp: number } | null = null;
  if (finnhubKey) {
    try {
      // SOX index — Finnhub uses ^SOX or the ETF SOXX
      soxHistory = await fetchFinnhubCandles("SOXX", finnhubKey, 180);
      soxQuote = await fetchFinnhubQuote("SOXX", finnhubKey);
    } catch {}
  }

  return NextResponse.json({
    productionIndex: {
      history: prodIndex.status === "fulfilled" ? prodIndex.value : [],
      latest: prodIndex.status === "fulfilled" ? prodIndex.value[prodIndex.value.length - 1] ?? null : null,
      error: prodIndex.status === "rejected" ? String(prodIndex.reason) : undefined,
      label: "Semiconductor & Electronic Component Manufacturing Production Index",
      seriesId: "IPG3344S",
      source: "Federal Reserve Industrial Production Index (FRED)",
      updateFrequency: "Monthly — released ~17th of following month",
      note: "Index base 2017=100. Rising index signals expanding chip production. Historically leads NVDA, AMD, INTC stock performance by 2–4 quarters.",
    },
    ppi: {
      history: ppiSemis.status === "fulfilled" ? ppiSemis.value : [],
      latest: ppiSemis.status === "fulfilled" ? ppiSemis.value[ppiSemis.value.length - 1] ?? null : null,
      error: ppiSemis.status === "rejected" ? String(ppiSemis.reason) : undefined,
      label: "Semiconductor Producer Price Index",
      seriesId: "PCU334413334413",
      source: "Bureau of Labor Statistics via FRED",
      updateFrequency: "Monthly",
      note: "Rising PPI = pricing power in semiconductor market = bullish signal for chip company margins",
    },
    sox: {
      proxy: "SOXX",
      proxyName: "iShares Semiconductor ETF (SOXX)",
      history: soxHistory,
      quote: soxQuote,
      label: "Philadelphia Semiconductor Index Proxy",
      disclaimer:
        finnhubKey
          ? "SOXX ETF tracks the Philadelphia Semiconductor Index (SOX). This is market sentiment data — it reflects investor expectations about semiconductors, NOT actual supply chain conditions. A rising SOXX can diverge from supply chain reality during sentiment-driven rallies."
          : "FINNHUB_API_KEY not configured — SOX proxy data unavailable.",
      updateFrequency: "Real-time market hours",
    },
    paywalled: {
      title: "Semiconductor supply chain data behind paid subscriptions",
      items: [
        {
          name: "DRAM Spot Prices",
          provider: "TrendForce",
          estimatedCost: "~$500+/month",
          description: "Real-time DRAM contract and spot pricing across DDR4/DDR5 modules. Key leading indicator for MICRON, Samsung earnings.",
        },
        {
          name: "NAND Flash Prices",
          provider: "TrendForce",
          estimatedCost: "~$500+/month",
          description: "NAND flash contract pricing across SSD and mobile NAND segments.",
        },
        {
          name: "Silicon Wafer Prices",
          provider: "SEMI",
          estimatedCost: "Subscription required",
          description: "300mm wafer spot and contract pricing — leading indicator for foundry utilization at TSMC, Samsung.",
        },
        {
          name: "Chip Lead Times",
          provider: "Susquehanna Financial Group",
          estimatedCost: "Research subscription",
          description: "Monthly component lead time survey across 35+ component categories. Widely cited as the gold standard for supply chain tightness.",
        },
      ],
      note: "If you know of free or lower-cost sources for semiconductor supply chain pricing data, please contact us.",
    },
  });
}
