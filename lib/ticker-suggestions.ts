export type TickerSuggestion = { symbol: string; name: string };

export const POPULAR_TICKERS: TickerSuggestion[] = [
  // Crypto
  { symbol: "BTC-USD", name: "Bitcoin" },
  { symbol: "ETH-USD", name: "Ethereum" },
  { symbol: "SOL-USD", name: "Solana" },
  { symbol: "BNB-USD", name: "BNB" },
  { symbol: "XRP-USD", name: "XRP Ripple" },
  { symbol: "ADA-USD", name: "Cardano" },
  { symbol: "DOGE-USD", name: "Dogecoin" },
  { symbol: "AVAX-USD", name: "Avalanche" },
  { symbol: "DOT-USD", name: "Polkadot" },
  { symbol: "LINK-USD", name: "Chainlink" },
  { symbol: "LTC-USD", name: "Litecoin" },
  { symbol: "MATIC-USD", name: "Polygon Matic" },
  { symbol: "SHIB-USD", name: "Shiba Inu" },
  { symbol: "UNI-USD", name: "Uniswap" },
  { symbol: "ATOM-USD", name: "Cosmos" },
  // Stocks
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "GOOGL", name: "Alphabet Google" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "NVDA", name: "Nvidia" },
  { symbol: "META", name: "Meta Facebook" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "NFLX", name: "Netflix" },
  { symbol: "AMD", name: "Advanced Micro Devices AMD" },
  { symbol: "INTC", name: "Intel" },
  { symbol: "ORCL", name: "Oracle" },
  { symbol: "CRM", name: "Salesforce" },
  { symbol: "UBER", name: "Uber" },
  { symbol: "LYFT", name: "Lyft" },
  { symbol: "SNAP", name: "Snapchat Snap" },
  { symbol: "COIN", name: "Coinbase" },
  { symbol: "HOOD", name: "Robinhood" },
  { symbol: "SQ", name: "Block Square" },
  { symbol: "PYPL", name: "PayPal" },
  { symbol: "V", name: "Visa" },
  { symbol: "MA", name: "Mastercard" },
  { symbol: "JPM", name: "JPMorgan Chase" },
  { symbol: "BAC", name: "Bank of America" },
  { symbol: "GS", name: "Goldman Sachs" },
  { symbol: "WMT", name: "Walmart" },
  { symbol: "PFE", name: "Pfizer" },
  { symbol: "JNJ", name: "Johnson Johnson" },
  { symbol: "DIS", name: "Disney" },
  { symbol: "BA", name: "Boeing" },
  { symbol: "GE", name: "General Electric" },
  { symbol: "F", name: "Ford" },
  { symbol: "GM", name: "General Motors" },
  { symbol: "PLTR", name: "Palantir" },
  { symbol: "RBLX", name: "Roblox" },
  { symbol: "SHOP", name: "Shopify" },
  { symbol: "SPOT", name: "Spotify" },
  { symbol: "ABNB", name: "Airbnb" },
  // ETFs & indices
  { symbol: "SPY", name: "S&P 500 ETF" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF" },
  { symbol: "VTI", name: "Total Stock Market ETF" },
  { symbol: "GLD", name: "Gold ETF" },
  { symbol: "TLT", name: "Treasury Bond ETF" },
  { symbol: "^GSPC", name: "S&P 500" },
  { symbol: "^DJI", name: "Dow Jones" },
  { symbol: "^IXIC", name: "Nasdaq Composite" },
  { symbol: "^VIX", name: "VIX Volatility Index" },
  { symbol: "^RUT", name: "Russell 2000" },
];

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

export function getFuzzyTickerSuggestions(query: string, max = 3): TickerSuggestion[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  const threshold = q.length <= 4 ? 1 : q.length <= 7 ? 2 : 3;

  const scored: { ticker: TickerSuggestion; score: number }[] = [];

  for (const ticker of POPULAR_TICKERS) {
    const nameLower = ticker.name.toLowerCase();
    const symbolLower = ticker.symbol.toLowerCase().replace(/-usd$/, "").replace(/^\^/, "");

    // Exact prefix match on name or symbol
    if (nameLower.startsWith(q) || symbolLower.startsWith(q)) {
      scored.push({ ticker, score: 0 });
      continue;
    }

    // Substring match
    if (nameLower.includes(q) || symbolLower.includes(q)) {
      scored.push({ ticker, score: 1 });
      continue;
    }

    // Fuzzy match against each word in the name and the bare symbol
    let best = Infinity;
    for (const word of [...nameLower.split(" "), symbolLower]) {
      if (word.length < 3) continue;
      // Compare against a window the same length as the query to keep distances small
      const candidate = word.slice(0, q.length + 2);
      const dist = levenshtein(q, candidate);
      if (dist < best) best = dist;
    }
    if (best <= threshold) {
      scored.push({ ticker, score: best + 2 });
    }
  }

  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, max)
    .map((r) => r.ticker);
}
