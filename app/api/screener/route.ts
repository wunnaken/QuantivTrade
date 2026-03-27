import { NextResponse } from "next/server";

// force-dynamic so Finnhub live quotes are always fresh.
// Individual fetchInfo calls use next:{revalidate:3600} so fundamentals are still cached per-symbol.
export const dynamic = "force-dynamic";

// ~280 S&P 500 + Nasdaq 100 + popular stocks
const STOCK_UNIVERSE = [
  // Mega cap tech
  "AAPL","MSFT","NVDA","GOOGL","GOOG","AMZN","META","TSLA","AVGO","ORCL",
  // Finance
  "JPM","V","MA","BAC","WFC","GS","MS","BLK","SCHW","AXP","C","USB","PNC","TFC","COF",
  // Healthcare
  "UNH","JNJ","LLY","ABBV","MRK","TMO","ABT","DHR","BMY","AMGN","GILD","CVS","CI","HUM","ELV",
  // Consumer
  "HD","AMZN","MCD","NKE","SBUX","TGT","COST","WMT","PG","KO","PEP","PM","MO","CL","GIS","K","CPB",
  // Industrials
  "CAT","DE","HON","UPS","FDX","BA","GE","MMM","LMT","RTX","NOC","GD","ETN","EMR","PH","ROK","CMI","PCAR",
  // Energy
  "XOM","CVX","COP","EOG","SLB","PXD","OXY","MPC","PSX","VLO","HAL","BKR","DVN","FANG",
  // Materials
  "LIN","APD","SHW","FCX","NEM","NUE","STLD","VMC","MLM","ALB","CF","MOS",
  // Real Estate
  "AMT","PLD","CCI","EQIX","SPG","O","WELL","DLR","PSA","AVB","EQR","VTR","ARE",
  // Utilities
  "NEE","SO","DUK","D","AEP","EXC","XEL","SRE","WEC","ES",
  // Communication
  "GOOGL","META","NFLX","DIS","CMCSA","T","VZ","TMUS","CHTR","EA","TTWO","ATVI",
  // Semis & Tech hardware
  "AMD","INTC","QCOM","TXN","MU","AMAT","LRCX","KLAC","MRVL","ON","MCHP","ADI","NXPI","STX","WDC",
  // Software
  "MSFT","CRM","ADBE","NOW","INTU","WDAY","TEAM","PANW","CRWD","ZS","SNOW","DDOG","NET","MDB","HubSpot",
  // Biotech / pharma
  "MRNA","BIIB","REGN","VRTX","ILMN","ISRG","EW","ZBH","BSX","BDX","BAX","ZTS","IDXX",
  // Consumer Discretionary
  "TSLA","AMZN","HD","MCD","NKE","LOW","TJX","BKNG","ABNB","EBAY","ETSY","ROST","DG","DLTR","BBY",
  // Banks & Insurance
  "BRK-B","WFC","TRV","ALL","CB","AON","MMC","MET","PRU","AFL","UNM","LNC",
  // Popular individual names
  "PLTR","RBLX","COIN","HOOD","SOFI","UPST","AFRM","SHOP","SQ","PYPL","UBER","LYFT","ABNB","DASH","RIVN","LCID",
  // ETFs excluded — this is all equities
  // Extra large caps
  "BRK-A","ASML","TSM","SAP","TM","SONY","NVO","NESN","RHHBY","UL","BP","SHEL",
];

// Deduplicate
const UNIVERSE = [...new Set(STOCK_UNIVERSE)];

const FINNHUB_BASE = "https://finnhub.io/api/v1";

interface EngineInfo {
  symbol?: string;
  shortName?: string;
  longName?: string;
  sector?: string;
  industry?: string;
  country?: string;
  exchange?: string;
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  priceToBook?: number;
  dividendYield?: number;
  trailingAnnualDividendYield?: number;
  beta?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  currentPrice?: number;
  regularMarketPrice?: number;
  totalDebt?: number;
  totalCash?: number;
  sharesOutstanding?: number;
  volume?: number;
  fiftyDayAverage?: number;
  twoHundredDayAverage?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  [key: string]: unknown;
}

interface ScreenerStock {
  symbol: string;
  companyName: string;
  marketCap: number | null;
  sector: string | null;
  industry: string | null;
  beta: number | null;
  price: number | null;
  lastAnnualDividend: number | null;
  volume: number | null;
  exchange: string | null;
  country: string | null;
  isEtf: boolean;
  isActivelyTrading: boolean;
  pe: number | null;
  eps: number | null;
  priceToBook: number | null;
  dividendYield: number | null;
  debtToEquity: number | null;
  revenueGrowth: number | null;
  image: string | null;
  dayChange: number | null;
  dayChangePct: number | null;
  vsMA50: number | null;
  vsMA200: number | null;
  vs52wkHigh: number | null;
  vs52wkLow: number | null;
}

async function fetchInfo(symbol: string, engineUrl: string): Promise<ScreenerStock | null> {
  try {
    const res = await fetch(`${engineUrl}/data/info?ticker=${encodeURIComponent(symbol)}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const d = (await res.json()) as EngineInfo;
    if (!d || typeof d !== "object") return null;
    const price = typeof d.currentPrice === "number" ? d.currentPrice
      : typeof d.regularMarketPrice === "number" ? d.regularMarketPrice : null;
    if (!price) return null; // skip symbols with no price (delisted/missing)
    const dividendYield = typeof d.dividendYield === "number" ? d.dividendYield
      : typeof d.trailingAnnualDividendYield === "number" ? d.trailingAnnualDividendYield : null;
    return {
      symbol,
      companyName: d.longName ?? d.shortName ?? symbol,
      marketCap: typeof d.marketCap === "number" ? d.marketCap : null,
      sector: d.sector ?? null,
      industry: d.industry ?? null,
      beta: typeof d.beta === "number" ? d.beta : null,
      price,
      lastAnnualDividend: null,
      volume: typeof d.volume === "number" ? d.volume : null,
      exchange: d.exchange ?? null,
      country: d.country ?? null,
      isEtf: false,
      isActivelyTrading: true,
      pe: typeof d.trailingPE === "number" ? d.trailingPE : null,
      eps: null,
      priceToBook: typeof d.priceToBook === "number" ? d.priceToBook : null,
      dividendYield,
      debtToEquity: null,
      revenueGrowth: typeof d.revenueGrowth === "number" ? d.revenueGrowth : null,
      image: `https://financialmodelingprep.com/image-stock/${symbol}.png`,
      dayChange: null,
      dayChangePct: null,
      vsMA50: typeof d.fiftyDayAverage === "number" && d.fiftyDayAverage > 0
        ? ((price - d.fiftyDayAverage) / d.fiftyDayAverage) * 100 : null,
      vsMA200: typeof d.twoHundredDayAverage === "number" && d.twoHundredDayAverage > 0
        ? ((price - d.twoHundredDayAverage) / d.twoHundredDayAverage) * 100 : null,
      vs52wkHigh: typeof d.fiftyTwoWeekHigh === "number" && d.fiftyTwoWeekHigh > 0
        ? ((price - d.fiftyTwoWeekHigh) / d.fiftyTwoWeekHigh) * 100 : null,
      vs52wkLow: typeof d.fiftyTwoWeekLow === "number" && d.fiftyTwoWeekLow > 0
        ? ((price - d.fiftyTwoWeekLow) / d.fiftyTwoWeekLow) * 100 : null,
    };
  } catch {
    return null;
  }
}

async function enrichWithFinnhub(stocks: ScreenerStock[], finnhubKey: string): Promise<ScreenerStock[]> {
  const result = [...stocks];
  const BATCH = 30;
  for (let i = 0; i < result.length; i += BATCH) {
    const batch = result.slice(i, i + BATCH);
    const quotes = await Promise.all(
      batch.map(async (s) => {
        try {
          const res = await fetch(
            `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(s.symbol)}&token=${finnhubKey}`,
            { cache: "no-store" }
          );
          if (!res.ok) return null;
          return (await res.json()) as { c?: number; d?: number; dp?: number };
        } catch { return null; }
      })
    );
    quotes.forEach((q, j) => {
      if (!q) return;
      const idx = i + j;
      if (typeof q.c === "number" && q.c > 0) result[idx].price = q.c;
      if (typeof q.d === "number") result[idx].dayChange = q.d;
      if (typeof q.dp === "number") result[idx].dayChangePct = q.dp;
    });
  }
  return result;
}

export async function GET() {
  const engineUrl = process.env.BACKTEST_ENGINE_URL;
  const finnhubKey = process.env.FINNHUB_API_KEY;

  if (!engineUrl) {
    return NextResponse.json([] as ScreenerStock[]);
  }

  // Fetch all fundamentals in parallel batches of 30
  const BATCH = 30;
  const allStocks: ScreenerStock[] = [];
  for (let i = 0; i < UNIVERSE.length; i += BATCH) {
    const batch = UNIVERSE.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((sym) => fetchInfo(sym, engineUrl)));
    for (const s of results) {
      if (s) allStocks.push(s);
    }
  }

  // Enrich with live Finnhub quotes
  const stocks = finnhubKey ? await enrichWithFinnhub(allStocks, finnhubKey) : allStocks;

  return NextResponse.json(stocks);
}
