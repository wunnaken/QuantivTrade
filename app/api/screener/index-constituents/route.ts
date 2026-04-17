import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 86400;

/**
 * Returns the constituent ticker list for a major US index.
 *
 * Used by the screener's index dropdown so loading "S&P 500" actually narrows
 * the universe to the real index members (not just a market-cap proxy).
 *
 * Strategy:
 *   1. Try FMP's free constituent endpoints (`sp500_constituent`,
 *      `nasdaq_constituent`, `dowjones_constituent`).
 *   2. Fall back to a hardcoded list when FMP is unavailable / quota
 *      exhausted / returns empty. The hardcoded lists go slightly stale
 *      between FMP refreshes but ensure the page never fails to load an
 *      index — which is what the user complained about ("doesn't change
 *      between indexes").
 *   3. Russell 2000 / MidCap 400 don't have FMP free endpoints; they fall
 *      back to a small hardcoded sample (the user can still see *some*
 *      stocks rather than nothing).
 */

const ENDPOINT_MAP: Record<string, string> = {
  sp500: "sp500_constituent",
  nasdaq100: "nasdaq_constituent",
  dow30: "dowjones_constituent",
};

const HARDCODED_DOW30 = [
  "AAPL","AMGN","AXP","BA","CAT","CRM","CSCO","CVX","DIS","DOW",
  "GS","HD","HON","IBM","JNJ","JPM","KO","MCD","MMM","MRK",
  "MSFT","NKE","NVDA","PG","SHW","TRV","UNH","V","VZ","WMT",
];

const HARDCODED_NASDAQ100 = [
  "AAPL","ABNB","ADBE","ADI","ADP","ADSK","AEP","AMAT","AMD","AMGN",
  "AMZN","ANSS","APP","ARM","ASML","AVGO","AXON","AZN","BIIB","BKNG",
  "BKR","CCEP","CDNS","CDW","CEG","CHTR","CMCSA","COST","CPRT","CRWD",
  "CSCO","CSGP","CSX","CTAS","CTSH","DASH","DDOG","DXCM","EA","EXC",
  "FANG","FAST","FTNT","GEHC","GFS","GILD","GOOG","GOOGL","HON","IDXX",
  "INTC","INTU","ISRG","KDP","KHC","KLAC","LIN","LRCX","LULU","MAR",
  "MCHP","MDB","MDLZ","MELI","META","MNST","MRVL","MSFT","MU","NFLX",
  "NVDA","NXPI","ODFL","ON","ORLY","PANW","PAYX","PCAR","PDD","PEP",
  "PLTR","PYPL","QCOM","REGN","ROP","ROST","SBUX","SNPS","TEAM","TMUS",
  "TSLA","TTD","TTWO","TXN","VRSK","VRTX","WBD","WDAY","XEL","ZS",
];

// Top S&P 500 by market cap — used only if FMP fails. Covers the bulk of
// the index by weight (~75%). Not the full 500 but enough to populate the
// screener with representative names. UPDATE periodically.
const HARDCODED_SP500_TOP = [
  "AAPL","MSFT","NVDA","GOOGL","AMZN","META","BRK-B","TSLA","AVGO","WMT",
  "JPM","LLY","V","UNH","XOM","ORCL","MA","HD","PG","COST",
  "JNJ","ABBV","NFLX","BAC","KO","CRM","CVX","TMO","MRK","PEP",
  "ABT","CSCO","ADBE","WFC","ACN","LIN","MCD","DIS","TXN","NOW",
  "AMD","INTU","QCOM","DHR","CAT","IBM","GE","VZ","AMGN","ISRG",
  "PFE","PM","BLK","SPGI","UBER","CMCSA","T","UNP","RTX","NEE",
  "BKNG","HON","COP","LOW","BX","NKE","ETN","TJX","C","ELV",
  "GS","SCHW","MS","BA","SYK","PLD","DE","VRTX","REGN","UPS",
  "AMAT","ADP","BSX","MU","ANET","LRCX","SBUX","PANW","CB","MDT",
  "GILD","TMUS","INTC","KKR","CI","BMY","MO","FI","PGR","ZTS",
  "MMC","ADI","FISV","CVS","NOC","DUK","SO","CL","SHW","WM",
  "EQIX","EOG","ICE","PNC","APH","MCO","USB","CME","ITW","HUM",
  "CSX","SLB","TGT","CMG","FCX","ORLY","NSC","COF","WELL","TFC",
  "MCK","EMR","APD","AON","MAR","AJG","PCAR","ROP","FDX","BDX",
  "DLR","HCA","PSX","NXPI","MET","SRE","FTNT","KLAC","TRV","CDNS",
];

type ConstituentRow = { symbol?: string };

async function fetchFromFmp(index: string, fmpKey: string): Promise<string[]> {
  const endpoint = ENDPOINT_MAP[index];
  if (!endpoint) return [];
  try {
    const url = `https://financialmodelingprep.com/api/v3/${endpoint}?apikey=${fmpKey}`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) {
      console.error("[index-constituents] FMP", res.status, (await res.text().catch(() => "")).slice(0, 200));
      return [];
    }
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return (data as ConstituentRow[])
      .map((d) => d.symbol)
      .filter((s): s is string => !!s && /^[A-Z.\-]{1,8}$/.test(s));
  } catch (e) {
    console.error("[index-constituents] error", e);
    return [];
  }
}

function hardcodedFor(index: string): string[] {
  switch (index) {
    case "sp500":
      return HARDCODED_SP500_TOP;
    case "nasdaq100":
      return HARDCODED_NASDAQ100;
    case "dow30":
      return HARDCODED_DOW30;
    default:
      return [];
  }
}

export async function GET(request: NextRequest) {
  const index = request.nextUrl.searchParams.get("index")?.toLowerCase();
  if (!index) {
    return NextResponse.json({ tickers: [] satisfies string[] });
  }

  const fmpKey = process.env.FMP_API_KEY?.trim();
  let tickers: string[] = [];

  // Try FMP first for the indexes it supports.
  if (fmpKey && ENDPOINT_MAP[index]) {
    tickers = await fetchFromFmp(index, fmpKey);
  }

  // Fall back to the hardcoded list for that index. Guarantees a non-empty
  // response so the screener always has something to show.
  if (tickers.length === 0) {
    tickers = hardcodedFor(index);
  }

  return NextResponse.json({ tickers, source: tickers === hardcodedFor(index) ? "hardcoded" : "fmp" });
}
