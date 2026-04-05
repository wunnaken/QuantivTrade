import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FUTURES_CONTRACTS = {
  equity: [
    { symbol: "ES=F",  name: "S&P 500 Futures",     exchange: "CME",  ticker: "ES"  },
    { symbol: "NQ=F",  name: "Nasdaq 100 Futures",   exchange: "CME",  ticker: "NQ"  },
    { symbol: "YM=F",  name: "Dow Jones Futures",    exchange: "CBOT", ticker: "YM"  },
    { symbol: "RTY=F", name: "Russell 2000 Futures", exchange: "CME",  ticker: "RTY" },
    { symbol: "VX=F",  name: "VIX Futures",          exchange: "CBOE", ticker: "VX"  },
    { symbol: "NIY=F", name: "Nikkei 225 Futures",   exchange: "CME",  ticker: "NIY" },
  ],
  energy: [
    { symbol: "CL=F", name: "WTI Crude Oil",  exchange: "NYMEX", ticker: "CL" },
    { symbol: "BZ=F", name: "Brent Crude Oil",exchange: "ICE",   ticker: "BZ" },
    { symbol: "NG=F", name: "Natural Gas",    exchange: "NYMEX", ticker: "NG" },
    { symbol: "RB=F", name: "RBOB Gasoline",  exchange: "NYMEX", ticker: "RB" },
    { symbol: "HO=F", name: "Heating Oil",    exchange: "NYMEX", ticker: "HO" },
  ],
  metals: [
    { symbol: "GC=F",  name: "Gold",      exchange: "COMEX", ticker: "GC"  },
    { symbol: "SI=F",  name: "Silver",    exchange: "COMEX", ticker: "SI"  },
    { symbol: "PL=F",  name: "Platinum",  exchange: "NYMEX", ticker: "PL"  },
    { symbol: "PA=F",  name: "Palladium", exchange: "NYMEX", ticker: "PA"  },
    { symbol: "HG=F",  name: "Copper",    exchange: "COMEX", ticker: "HG"  },
  ],
  agriculture: [
    { symbol: "ZW=F", name: "Wheat",        exchange: "CBOT", ticker: "ZW" },
    { symbol: "ZC=F", name: "Corn",         exchange: "CBOT", ticker: "ZC" },
    { symbol: "ZS=F", name: "Soybeans",     exchange: "CBOT", ticker: "ZS" },
    { symbol: "ZM=F", name: "Soybean Meal", exchange: "CBOT", ticker: "ZM" },
    { symbol: "ZL=F", name: "Soybean Oil",  exchange: "CBOT", ticker: "ZL" },
    { symbol: "KC=F", name: "Coffee",       exchange: "ICE",  ticker: "KC" },
    { symbol: "SB=F", name: "Sugar",        exchange: "ICE",  ticker: "SB" },
    { symbol: "CT=F", name: "Cotton",       exchange: "ICE",  ticker: "CT" },
    { symbol: "CC=F", name: "Cocoa",        exchange: "ICE",  ticker: "CC" },
  ],
  bonds: [
    { symbol: "ZB=F", name: "30-Year T-Bond", exchange: "CBOT", ticker: "ZB" },
    { symbol: "ZN=F", name: "10-Year T-Note", exchange: "CBOT", ticker: "ZN" },
    { symbol: "ZF=F", name: "5-Year T-Note",  exchange: "CBOT", ticker: "ZF" },
    { symbol: "ZT=F", name: "2-Year T-Note",  exchange: "CBOT", ticker: "ZT" },
  ],
  forex: [
    { symbol: "6E=F", name: "Euro FX",          exchange: "CME", ticker: "6E" },
    { symbol: "6J=F", name: "Japanese Yen",      exchange: "CME", ticker: "6J" },
    { symbol: "6B=F", name: "British Pound",     exchange: "CME", ticker: "6B" },
    { symbol: "6C=F", name: "Canadian Dollar",   exchange: "CME", ticker: "6C" },
    { symbol: "6A=F", name: "Australian Dollar", exchange: "CME", ticker: "6A" },
    { symbol: "6S=F", name: "Swiss Franc",       exchange: "CME", ticker: "6S" },
    { symbol: "DX=F", name: "US Dollar Index",   exchange: "ICE", ticker: "DX" },
  ],
  crypto: [
    { symbol: "BTC=F", name: "Bitcoin Futures",  exchange: "CME", ticker: "BTC" },
    { symbol: "ETH=F", name: "Ethereum Futures", exchange: "CME", ticker: "ETH" },
    { symbol: "MBT=F", name: "Micro Bitcoin",    exchange: "CME", ticker: "MBT" },
  ],
  livestock: [
    { symbol: "LE=F", name: "Live Cattle",   exchange: "CME", ticker: "LE" },
    { symbol: "GF=F", name: "Feeder Cattle", exchange: "CME", ticker: "GF" },
    { symbol: "HE=F", name: "Lean Hogs",     exchange: "CME", ticker: "HE" },
  ],
} as const;

const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "Accept": "application/json",
  "Accept-Language": "en-US,en;q=0.9",
};

interface YahooQuote {
  symbol: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketPreviousClose?: number;
  regularMarketVolume?: number;
}

async function fetchQuoteBatch(symbols: string[]): Promise<Map<string, YahooQuote>> {
  const map = new Map<string, YahooQuote>();
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(",")}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketOpen,regularMarketDayHigh,regularMarketDayLow,regularMarketPreviousClose,regularMarketVolume`;
    const res = await fetch(url, { headers: YF_HEADERS, next: { revalidate: 30 } });
    if (!res.ok) return map;
    const data = await res.json() as { quoteResponse?: { result?: YahooQuote[] } };
    for (const q of data.quoteResponse?.result ?? []) map.set(q.symbol, q);
  } catch { /* ignore */ }
  return map;
}

async function fetchSparkline(symbol: string): Promise<number[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=8d`;
    const res = await fetch(url, { headers: YF_HEADERS, next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json() as {
      chart?: { result?: Array<{ indicators?: { quote?: Array<{ close?: (number | null)[] }> } }> };
    };
    const closes = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    return closes.filter((c): c is number => c != null && !isNaN(c)).slice(-7);
  } catch { return []; }
}

export async function GET() {
  const allContracts = Object.values(FUTURES_CONTRACTS).flat();
  const allSymbols = allContracts.map((c) => c.symbol);

  // Batch quotes in chunks of 20
  const chunks: string[][] = [];
  for (let i = 0; i < allSymbols.length; i += 20) chunks.push(allSymbols.slice(i, i + 20));
  const quoteMaps = await Promise.all(chunks.map(fetchQuoteBatch));
  const quoteMap = new Map<string, YahooQuote>();
  for (const m of quoteMaps) m.forEach((v, k) => quoteMap.set(k, v));

  // Sparklines in parallel (best-effort)
  const sparkResults = await Promise.allSettled(allSymbols.map(fetchSparkline));
  const sparkMap = new Map<string, number[]>();
  allSymbols.forEach((sym, i) => {
    const r = sparkResults[i];
    if (r.status === "fulfilled") sparkMap.set(sym, r.value);
  });

  const result: Record<string, unknown[]> = {};
  for (const [category, contracts] of Object.entries(FUTURES_CONTRACTS)) {
    result[category] = (contracts as typeof FUTURES_CONTRACTS.equity).map((c) => {
      const q = quoteMap.get(c.symbol);
      return {
        symbol: c.symbol,
        name: c.name,
        exchange: c.exchange,
        ticker: c.ticker,
        price: q?.regularMarketPrice ?? null,
        change: q?.regularMarketChange ?? null,
        changePercent: q?.regularMarketChangePercent ?? null,
        open: q?.regularMarketOpen ?? null,
        high: q?.regularMarketDayHigh ?? null,
        low: q?.regularMarketDayLow ?? null,
        prevClose: q?.regularMarketPreviousClose ?? null,
        volume: q?.regularMarketVolume ?? null,
        sparkline: sparkMap.get(c.symbol) ?? [],
      };
    });
  }

  return NextResponse.json({ ...result, fetchedAt: new Date().toISOString() });
}
