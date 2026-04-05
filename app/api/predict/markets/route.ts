import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface PredictMarket {
  id: string;
  source: "polymarket" | "kalshi" | "manifold" | "predictit";
  question: string;
  probability: number; // 0–100
  volume: number;
  liquidity: number;
  endDate: string | null;
  category: string;
  yesPrice: number; // 0–100
  noPrice: number; // 0–100
  url: string;
}

function detectCategory(question: string, hint = ""): string {
  const q = (question + " " + hint).toLowerCase();
  if (/bitcoin|crypto|ethereum|btc|eth|token|defi|blockchain|solana|xrp/.test(q)) return "crypto";
  if (/president|election|senate|congress|vote|democrat|republican|trump|biden|harris|party|political|governor|ballot/.test(q)) return "political";
  if (/gdp|inflation|fed|rate|recession|unemployment|economy|cpi|pce|jobs|market|stock|nasdaq|s&p/.test(q)) return "economics";
  if (/super bowl|nfl|nba|mlb|nhl|world cup|championship|playoff|soccer|basketball|football|baseball|tennis|golf/.test(q)) return "sports";
  return "other";
}

async function fetchPolymarket(): Promise<PredictMarket[]> {
  const res = await fetch(
    "https://gamma-api.polymarket.com/markets?active=true&limit=50&order=volume24hr&ascending=false",
    { next: { revalidate: 300 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const markets: PredictMarket[] = [];
  for (const m of Array.isArray(data) ? data : []) {
    try {
      let yesPrice = 50;
      if (m.outcomePrices) {
        const prices = typeof m.outcomePrices === "string" ? JSON.parse(m.outcomePrices) : m.outcomePrices;
        yesPrice = Math.round(parseFloat(prices[0]) * 100);
      }
      const tagHint = (m.tags ?? []).map((t: { label?: string }) => t.label ?? "").join(" ");
      markets.push({
        id: `polymarket-${m.id ?? m.slug}`,
        source: "polymarket",
        question: m.question ?? "",
        probability: yesPrice,
        volume: m.volume24hr ?? m.volumeNum ?? 0,
        liquidity: m.liquidityNum ?? m.liquidity ?? 0,
        endDate: m.endDateIso ?? m.endDate ?? null,
        category: detectCategory(m.question ?? "", tagHint),
        yesPrice,
        noPrice: 100 - yesPrice,
        url: `https://polymarket.com/event/${m.slug ?? m.id}`,
      });
    } catch { /* skip malformed */ }
  }
  return markets;
}

async function fetchKalshi(): Promise<PredictMarket[]> {
  const res = await fetch(
    "https://trading-api.kalshi.com/trade-api/v2/markets?limit=50&status=open",
    { next: { revalidate: 300 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const markets: PredictMarket[] = [];
  for (const m of data.markets ?? []) {
    try {
      // Kalshi prices are in cents (1–99)
      const yesPrice = m.last_price ?? m.yes_bid ?? 50;
      markets.push({
        id: `kalshi-${m.ticker}`,
        source: "kalshi",
        question: m.title ?? m.event_title ?? "",
        probability: yesPrice,
        volume: m.volume_24h ?? m.volume ?? 0,
        liquidity: m.open_interest ?? m.liquidity ?? 0,
        endDate: m.close_time ?? m.expected_expiration_time ?? null,
        category: detectCategory(m.title ?? "", m.category ?? ""),
        yesPrice,
        noPrice: 100 - yesPrice,
        url: `https://kalshi.com/markets/${m.event_ticker ?? m.ticker}`,
      });
    } catch { /* skip malformed */ }
  }
  return markets;
}

async function fetchManifold(): Promise<PredictMarket[]> {
  const res = await fetch(
    "https://api.manifold.markets/v0/markets?limit=50&sort=liquidity",
    { next: { revalidate: 300 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const markets: PredictMarket[] = [];
  for (const m of Array.isArray(data) ? data : []) {
    if (m.outcomeType !== "BINARY") continue;
    try {
      const prob = Math.round((m.probability ?? 0.5) * 100);
      markets.push({
        id: `manifold-${m.id}`,
        source: "manifold",
        question: m.question ?? "",
        probability: prob,
        volume: m.volume ?? 0,
        liquidity: m.totalLiquidity ?? m.liquidity ?? 0,
        endDate: m.closeTime ? new Date(m.closeTime).toISOString() : null,
        category: detectCategory(m.question ?? ""),
        yesPrice: prob,
        noPrice: 100 - prob,
        url: m.url ?? `https://manifold.markets/${m.creatorUsername}/${m.slug}`,
      });
    } catch { /* skip malformed */ }
  }
  return markets;
}

async function fetchPredictIt(): Promise<PredictMarket[]> {
  const res = await fetch("https://www.predictit.org/api/marketdata/all/", {
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const markets: PredictMarket[] = [];
  for (const m of data.markets ?? []) {
    try {
      // PredictIt has multiple contracts per market; take the primary Yes contract
      const yesContract = (m.contracts ?? []).find(
        (c: { name: string; lastTradePrice: number }) => c.name === "Yes" || (m.contracts?.length === 1)
      ) ?? m.contracts?.[0];
      if (!yesContract) continue;
      const yesPrice = Math.round((yesContract.lastTradePrice ?? 0) * 100);
      markets.push({
        id: `predictit-${m.id}`,
        source: "predictit",
        question: m.name ?? "",
        probability: yesPrice,
        volume: 0,
        liquidity: 0,
        endDate: m.timeStamp ?? null,
        category: "political",
        yesPrice,
        noPrice: 100 - yesPrice,
        url: m.url ?? `https://www.predictit.org/markets/detail/${m.id}`,
      });
    } catch { /* skip malformed */ }
  }
  return markets.slice(0, 50);
}

async function fetchResolved(): Promise<PredictMarket[]> {
  const res = await fetch(
    "https://api.manifold.markets/v0/markets?limit=10&sort=closeTime&filter=resolved",
    { next: { revalidate: 600 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (Array.isArray(data) ? data : [])
    .filter((m: { outcomeType: string }) => m.outcomeType === "BINARY")
    .slice(0, 10)
    .map((m: { id: string; question: string; resolution: string; probability: number; volume: number; closeTime: number; url: string; creatorUsername: string; slug: string }) => ({
      id: `manifold-resolved-${m.id}`,
      source: "manifold" as const,
      question: m.question ?? "",
      probability: Math.round((m.probability ?? 0.5) * 100),
      volume: m.volume ?? 0,
      liquidity: 0,
      endDate: m.closeTime ? new Date(m.closeTime).toISOString() : null,
      category: detectCategory(m.question ?? ""),
      yesPrice: Math.round((m.probability ?? 0.5) * 100),
      noPrice: 100 - Math.round((m.probability ?? 0.5) * 100),
      url: m.url ?? `https://manifold.markets/${m.creatorUsername}/${m.slug}`,
      resolution: m.resolution,
    }));
}

export async function GET() {
  const [pmResult, kalResult, manResult, piResult, resolvedResult] = await Promise.allSettled([
    fetchPolymarket(),
    fetchKalshi(),
    fetchManifold(),
    fetchPredictIt(),
    fetchResolved(),
  ]);

  const pick = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
    r.status === "fulfilled" ? r.value : fallback;

  const all = [
    ...pick(pmResult, []),
    ...pick(kalResult, []),
    ...pick(manResult, []),
    ...pick(piResult, []),
  ].filter((m) => m.question && m.question.length > 5);

  const categories = [...new Set(all.map((m) => m.category))].sort();
  const topByVolume = [...all].sort((a, b) => b.volume - a.volume).slice(0, 10);
  const topByLiquidity = [...all].sort((a, b) => b.liquidity - a.liquidity).slice(0, 10);
  const recentlyResolved = pick(resolvedResult, []);

  return NextResponse.json({
    markets: all,
    categories,
    topByVolume,
    topByLiquidity,
    recentlyResolved,
    lastUpdated: new Date().toISOString(),
  });
}
