import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface ThematicPortfolio {
  id: string;
  name: string;
  description: string;
  color: string;
  tickers: string[];
}

const THEMATIC_PORTFOLIOS: ThematicPortfolio[] = [
  { id: "defense",        name: "War & Defense",       description: "Defense contractors and military technology",       color: "#ef4444", tickers: ["LMT","RTX","NOC","GD","BA","LDOS","HII","CACI"] },
  { id: "nuclear",        name: "Nuclear & Energy",     description: "Nuclear power and uranium mining",                  color: "#f59e0b", tickers: ["CCJ","UEC","VST","CEG","NNE","SMR","OKLO","DNN"] },
  { id: "ai",             name: "AI & Robotics",        description: "Artificial intelligence and automation leaders",    color: "#8b5cf6", tickers: ["NVDA","MSFT","GOOGL","AMD","PLTR","AI","PATH","BBAI"] },
  { id: "space",          name: "Space Economy",        description: "Commercial space and satellite technology",          color: "#06b6d4", tickers: ["RKLB","ASTS","SPCE","BA","LMT","MNTS","LUNR","RDW"] },
  { id: "biotech",        name: "Biotech & Healthcare", description: "Biotechnology and pharmaceutical innovation",       color: "#10b981", tickers: ["MRNA","PFE","ABBV","UNH","ISRG","REGN","VRTX","GILD"] },
  { id: "banks",          name: "Big Banks",            description: "Major financial institutions and investment banks", color: "#3b82f6", tickers: ["JPM","BAC","GS","MS","WFC","C","BLK","SCHW"] },
  { id: "oil",            name: "Oil & Gas",            description: "Energy majors and exploration companies",           color: "#92400e", tickers: ["XOM","CVX","COP","SLB","EOG","PXD","MPC","VLO"] },
  { id: "clean",          name: "Clean Energy",         description: "Renewable energy and sustainability leaders",       color: "#16a34a", tickers: ["NEE","ENPH","FSLR","BE","RUN","ARRY","CWEN","AES"] },
  { id: "crypto",         name: "Crypto Giants",        description: "Top cryptocurrencies by market cap",               color: "#f97316", tickers: ["BTC-USD","ETH-USD","SOL-USD","BNB-USD","XRP-USD","ADA-USD","AVAX-USD","DOT-USD"] },
  { id: "consumer",       name: "Consumer Brands",      description: "Iconic global consumer companies",                 color: "#ec4899", tickers: ["AAPL","AMZN","NKE","MCD","SBUX","KO","PEP","WMT"] },
  { id: "gaming",         name: "Gaming & Metaverse",   description: "Video games and virtual worlds",                   color: "#7c3aed", tickers: ["MSFT","SONY","RBLX","EA","TTWO","U","MTCH","NFLX"] },
  { id: "reits",          name: "Real Estate REITs",    description: "Real estate investment trusts",                    color: "#b45309", tickers: ["O","SPG","AMT","PLD","WELL","EQR","AVB","DLR"] },
  { id: "cyber",          name: "Cybersecurity",        description: "Network security and data protection",             color: "#0891b2", tickers: ["CRWD","PANW","ZS","FTNT","S","OKTA","CYBR","QLYS"] },
  { id: "ev",             name: "EV Revolution",        description: "Electric vehicles and charging infrastructure",    color: "#65a30d", tickers: ["TSLA","RIVN","NIO","LI","LCID","CHPT","BLNK","EVGO"] },
  { id: "genomics",       name: "Genomics",             description: "Gene editing and precision medicine",              color: "#d946ef", tickers: ["ILMN","CRSP","NTLA","BEAM","PACB","RXRX","VERV","EDIT"] },
  { id: "infrastructure", name: "Infrastructure",       description: "Construction and industrial infrastructure",       color: "#78716c", tickers: ["CAT","DE","VMC","MLM","PWR","ACM","J","STRL"] },
  { id: "luxury",         name: "Luxury & Premium",     description: "High-end consumer and luxury goods",              color: "#a16207", tickers: ["CPRI","TPR","RL","PVH","MOV","TIF","COH","LULU"] },
  { id: "emerging",       name: "Emerging Markets",     description: "High-growth developing economy leaders",          color: "#0284c7", tickers: ["BABA","TSM","MELI","SE","GRAB","BIDU","JD","PDD"] },
  { id: "ag",             name: "Agriculture & Food",   description: "Food production and agricultural technology",     color: "#4d7c0f", tickers: ["ADM","BG","DE","MOS","NTR","CTVA","FMC","INGR"] },
  { id: "5g",             name: "5G & Telecom",         description: "Next-generation wireless and telecommunications", color: "#0e7490", tickers: ["TMUS","VZ","T","ERIC","NOK","QCOM","AMT","SBAC"] },
];

// Crypto tickers use Binance pairs on Finnhub quote endpoint
const CRYPTO_QUOTE_MAP: Record<string, string> = {
  "BTC-USD":  "BINANCE:BTCUSDT",
  "ETH-USD":  "BINANCE:ETHUSDT",
  "SOL-USD":  "BINANCE:SOLUSDT",
  "BNB-USD":  "BINANCE:BNBUSDT",
  "XRP-USD":  "BINANCE:XRPUSDT",
  "ADA-USD":  "BINANCE:ADAUSDT",
  "AVAX-USD": "BINANCE:AVAXUSDT",
  "DOT-USD":  "BINANCE:DOTUSDT",
};

function toFinnhubQuoteSymbol(ticker: string): string {
  return CRYPTO_QUOTE_MAP[ticker] ?? ticker;
}

interface FinnhubQuote { c: number; d: number; dp: number; }

async function fetchQuote(
  ticker: string,
  apiKey: string
): Promise<{ ticker: string; price: number; changePercent: number; change: number } | null> {
  try {
    const symbol = toFinnhubQuoteSymbol(ticker);
    const isCrypto = ticker.endsWith("-USD");

    // Use /crypto/candle for crypto via Binance pairs to get change %
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = (await res.json()) as FinnhubQuote;

    // For crypto via Binance pairs, d/dp may be missing; compute from pc
    const price = data.c;
    if (!price || price === 0) return null;

    // dp = day change %; d = change amount
    let cp = data.dp ?? 0;
    let ch = data.d ?? 0;

    // Crypto Binance pairs often have dp=0; fallback to 0 rather than undefined
    if (isCrypto && cp === 0 && ch === 0) {
      // Accept price=0 check already above; just return 0 change
    }

    return { ticker, price, changePercent: cp, change: ch };
  } catch {
    return null;
  }
}

export async function GET() {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      portfolios: THEMATIC_PORTFOLIOS.map((p) => ({ ...p, holdings: [], dayChangePct: null, bestPerformer: null, worstPerformer: null })),
      error: "No API key",
    });
  }

  // Collect all unique tickers
  const allTickers = [...new Set(THEMATIC_PORTFOLIOS.flatMap((p) => p.tickers))];

  // Fetch all in parallel — individual fetches have 60s cache so this won't hammer the API on repeat loads
  const quoteMap = new Map<string, { price: number; changePercent: number; change: number }>();
  const results = await Promise.all(allTickers.map((t) => fetchQuote(t, apiKey)));
  for (const r of results) {
    if (r) quoteMap.set(r.ticker, { price: r.price, changePercent: r.changePercent, change: r.change });
  }

  const portfolios = THEMATIC_PORTFOLIOS.map((portfolio) => {
    const weight = Math.round(100 / portfolio.tickers.length);
    const holdings = portfolio.tickers.map((ticker, i) => {
      const q = quoteMap.get(ticker);
      return {
        ticker,
        rank: i + 1,
        weight,
        price: q?.price ?? null,
        changePercent: q?.changePercent ?? null,
        change: q?.change ?? null,
      };
    });

    const withChange = holdings.filter((h) => h.changePercent !== null && h.changePercent !== 0);
    // Fall back to any non-null value (including 0) if all are 0 change
    const withAny = holdings.filter((h) => h.changePercent !== null);
    const useSet = withChange.length > 0 ? withChange : withAny;

    const dayChangePct =
      useSet.length > 0
        ? useSet.reduce((s, h) => s + h.changePercent!, 0) / useSet.length
        : null;

    const sorted = [...withAny].sort((a, b) => b.changePercent! - a.changePercent!);
    const bestPerformer = sorted[0] ? { ticker: sorted[0].ticker, changePercent: sorted[0].changePercent! } : null;
    const worstPerformer = sorted[sorted.length - 1] ? { ticker: sorted[sorted.length - 1].ticker, changePercent: sorted[sorted.length - 1].changePercent! } : null;

    return { ...portfolio, holdings, dayChangePct, bestPerformer, worstPerformer };
  });

  return NextResponse.json({ portfolios, fetchedAt: new Date().toISOString() });
}
