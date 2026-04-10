export interface PrebuiltTerm {
  slug: string;
  title: string;
  category: string;
  tags: string[];
}

export const ARCHIVE_CATEGORIES = [
  { id: "Technical Analysis",   icon: "trending-up",   color: "#6366f1" },
  { id: "Trading Strategies",   icon: "activity",      color: "#8b5cf6" },
  { id: "Fundamental Analysis", icon: "dollar-sign",   color: "#22c55e" },
  { id: "Brokers",              icon: "landmark",      color: "#3b82f6" },
  { id: "Order Types",          icon: "list",          color: "#06b6d4" },
  { id: "Options",              icon: "layers",        color: "#f59e0b" },
  { id: "Crypto/DeFi",          icon: "circle-dollar", color: "#f97316" },
  { id: "Economic Indicators",  icon: "bar-chart-2",   color: "#ec4899" },
  { id: "Risk Management",      icon: "shield",        color: "#14b8a6" },
  { id: "Regulatory",           icon: "scale",         color: "#a78bfa" },
] as const;

export const PREBUILT_TERMS: PrebuiltTerm[] = [
  // Technical Analysis
  { slug: "rsi-indicator", title: "RSI (Relative Strength Index)", category: "Technical Analysis", tags: ["indicator", "momentum", "oscillator"] },
  { slug: "macd", title: "MACD (Moving Average Convergence Divergence)", category: "Technical Analysis", tags: ["indicator", "momentum", "trend"] },
  { slug: "bollinger-bands", title: "Bollinger Bands", category: "Technical Analysis", tags: ["volatility", "bands", "indicator"] },
  { slug: "moving-averages", title: "Moving Averages (SMA, EMA, WMA)", category: "Technical Analysis", tags: ["trend", "indicator", "average"] },
  { slug: "fibonacci-retracement", title: "Fibonacci Retracement", category: "Technical Analysis", tags: ["fibonacci", "support", "resistance"] },
  { slug: "support-resistance", title: "Support and Resistance Levels", category: "Technical Analysis", tags: ["levels", "price action", "trading"] },
  { slug: "candlestick-patterns", title: "Candlestick Patterns Complete Guide", category: "Technical Analysis", tags: ["candlestick", "patterns", "price action"] },
  { slug: "volume-analysis", title: "Volume Analysis", category: "Technical Analysis", tags: ["volume", "confirmation", "indicator"] },
  { slug: "stochastic-oscillator", title: "Stochastic Oscillator", category: "Technical Analysis", tags: ["oscillator", "momentum", "overbought"] },
  { slug: "atr-indicator", title: "ATR (Average True Range)", category: "Technical Analysis", tags: ["volatility", "stop loss", "indicator"] },
  { slug: "ichimoku-cloud", title: "Ichimoku Cloud", category: "Technical Analysis", tags: ["trend", "japanese", "cloud"] },
  { slug: "vwap", title: "VWAP (Volume Weighted Average Price)", category: "Technical Analysis", tags: ["vwap", "institutional", "day trading"] },
  { slug: "adx-indicator", title: "ADX (Average Directional Index)", category: "Technical Analysis", tags: ["trend strength", "directional", "indicator"] },
  { slug: "parabolic-sar", title: "Parabolic SAR", category: "Technical Analysis", tags: ["trend following", "stop loss", "reversal"] },
  { slug: "pivot-points", title: "Pivot Points", category: "Technical Analysis", tags: ["levels", "day trading", "support resistance"] },
  // Trading Strategies
  { slug: "breakout-trading", title: "Breakout Trading Strategy", category: "Trading Strategies", tags: ["breakout", "momentum", "strategy"] },
  { slug: "trend-following", title: "Trend Following Strategy", category: "Trading Strategies", tags: ["trend", "momentum", "strategy"] },
  { slug: "mean-reversion", title: "Mean Reversion Strategy", category: "Trading Strategies", tags: ["mean reversion", "statistical", "strategy"] },
  { slug: "momentum-trading", title: "Momentum Trading", category: "Trading Strategies", tags: ["momentum", "strategy", "short term"] },
  { slug: "scalping", title: "Scalping Strategy", category: "Trading Strategies", tags: ["scalping", "day trading", "short term"] },
  { slug: "swing-trading", title: "Swing Trading", category: "Trading Strategies", tags: ["swing", "medium term", "strategy"] },
  { slug: "position-trading", title: "Position Trading", category: "Trading Strategies", tags: ["position", "long term", "strategy"] },
  { slug: "pairs-trading", title: "Pairs Trading (Statistical Arbitrage)", category: "Trading Strategies", tags: ["pairs", "arbitrage", "statistical"] },
  { slug: "gap-trading", title: "Gap Trading Strategy", category: "Trading Strategies", tags: ["gap", "opening", "strategy"] },
  { slug: "earnings-trading", title: "Earnings Season Trading", category: "Trading Strategies", tags: ["earnings", "catalyst", "strategy"] },
  // Fundamental Analysis
  { slug: "pe-ratio", title: "P/E Ratio (Price to Earnings)", category: "Fundamental Analysis", tags: ["valuation", "ratio", "fundamental"] },
  { slug: "eps-earnings", title: "EPS (Earnings Per Share)", category: "Fundamental Analysis", tags: ["earnings", "profitability", "fundamental"] },
  { slug: "dcf-valuation", title: "DCF (Discounted Cash Flow) Valuation", category: "Fundamental Analysis", tags: ["valuation", "dcf", "intrinsic value"] },
  { slug: "revenue-growth", title: "Revenue Growth Analysis", category: "Fundamental Analysis", tags: ["revenue", "growth", "fundamental"] },
  { slug: "debt-to-equity", title: "Debt-to-Equity Ratio", category: "Fundamental Analysis", tags: ["debt", "leverage", "ratio"] },
  { slug: "free-cash-flow", title: "Free Cash Flow Analysis", category: "Fundamental Analysis", tags: ["cash flow", "fcf", "fundamental"] },
  { slug: "return-on-equity", title: "Return on Equity (ROE)", category: "Fundamental Analysis", tags: ["roe", "profitability", "ratio"] },
  { slug: "gross-margin", title: "Gross Margin Analysis", category: "Fundamental Analysis", tags: ["margin", "profitability", "fundamental"] },
  // Order Types
  { slug: "market-order", title: "Market Order", category: "Order Types", tags: ["order", "execution", "basic"] },
  { slug: "limit-order", title: "Limit Order", category: "Order Types", tags: ["order", "limit", "price control"] },
  { slug: "stop-loss-order", title: "Stop Loss Order", category: "Order Types", tags: ["stop loss", "risk management", "order"] },
  { slug: "stop-limit-order", title: "Stop-Limit Order", category: "Order Types", tags: ["stop limit", "order", "advanced"] },
  { slug: "trailing-stop", title: "Trailing Stop Order", category: "Order Types", tags: ["trailing stop", "dynamic", "order"] },
  { slug: "bracket-order", title: "Bracket Order (OCO)", category: "Order Types", tags: ["bracket", "oco", "advanced order"] },
  { slug: "good-till-cancelled", title: "GTC (Good Till Cancelled) Order", category: "Order Types", tags: ["gtc", "duration", "order"] },
  // Options
  { slug: "call-options", title: "Call Options Explained", category: "Options", tags: ["calls", "options", "derivatives"] },
  { slug: "put-options", title: "Put Options Explained", category: "Options", tags: ["puts", "options", "derivatives"] },
  { slug: "options-greeks", title: "Options Greeks (Delta, Gamma, Theta, Vega)", category: "Options", tags: ["greeks", "delta", "theta", "options"] },
  { slug: "covered-call", title: "Covered Call Strategy", category: "Options", tags: ["covered call", "income", "strategy"] },
  { slug: "cash-secured-put", title: "Cash-Secured Put Strategy", category: "Options", tags: ["csp", "put selling", "income"] },
  { slug: "iron-condor", title: "Iron Condor Strategy", category: "Options", tags: ["iron condor", "neutral", "advanced"] },
  { slug: "implied-volatility", title: "Implied Volatility (IV)", category: "Options", tags: ["iv", "volatility", "options pricing"] },
  { slug: "options-expiration", title: "Options Expiration and Assignment", category: "Options", tags: ["expiration", "assignment", "options"] },
  { slug: "black-scholes", title: "Black-Scholes Options Pricing Model", category: "Options", tags: ["black scholes", "pricing", "model"] },
  // Crypto/DeFi
  { slug: "bitcoin-explained", title: "Bitcoin: Complete Guide", category: "Crypto/DeFi", tags: ["bitcoin", "btc", "crypto"] },
  { slug: "ethereum-explained", title: "Ethereum and Smart Contracts", category: "Crypto/DeFi", tags: ["ethereum", "smart contracts", "defi"] },
  { slug: "defi-explained", title: "DeFi (Decentralized Finance) Explained", category: "Crypto/DeFi", tags: ["defi", "decentralized", "protocol"] },
  { slug: "crypto-wallets", title: "Crypto Wallets: Hot vs Cold Storage", category: "Crypto/DeFi", tags: ["wallet", "storage", "security"] },
  { slug: "staking-yield", title: "Crypto Staking and Yield Farming", category: "Crypto/DeFi", tags: ["staking", "yield", "passive income"] },
  { slug: "nft-explained", title: "NFTs (Non-Fungible Tokens) Explained", category: "Crypto/DeFi", tags: ["nft", "token", "digital asset"] },
  { slug: "crypto-halving", title: "Bitcoin Halving: What It Means for Price", category: "Crypto/DeFi", tags: ["halving", "supply", "bitcoin"] },
  // Economic Indicators
  { slug: "cpi-inflation", title: "CPI and Inflation Explained", category: "Economic Indicators", tags: ["cpi", "inflation", "macro"] },
  { slug: "federal-reserve-fed", title: "The Federal Reserve and Interest Rates", category: "Economic Indicators", tags: ["fed", "interest rates", "monetary policy"] },
  { slug: "gdp-explained", title: "GDP (Gross Domestic Product) Explained", category: "Economic Indicators", tags: ["gdp", "economic growth", "macro"] },
  { slug: "nonfarm-payrolls", title: "Non-Farm Payrolls (NFP) Report", category: "Economic Indicators", tags: ["nfp", "jobs", "employment"] },
  { slug: "yield-curve-explained", title: "Yield Curve and Recession Signals", category: "Economic Indicators", tags: ["yield curve", "recession", "bonds"] },
  { slug: "pmi-explained", title: "PMI (Purchasing Managers Index)", category: "Economic Indicators", tags: ["pmi", "manufacturing", "leading indicator"] },
  // Risk Management
  { slug: "position-sizing", title: "Position Sizing Strategies", category: "Risk Management", tags: ["position sizing", "risk", "management"] },
  { slug: "risk-reward-ratio", title: "Risk-Reward Ratio", category: "Risk Management", tags: ["risk reward", "ratio", "management"] },
  { slug: "kelly-criterion", title: "Kelly Criterion for Position Sizing", category: "Risk Management", tags: ["kelly", "mathematical", "sizing"] },
  { slug: "diversification", title: "Portfolio Diversification", category: "Risk Management", tags: ["diversification", "portfolio", "risk"] },
  { slug: "drawdown-management", title: "Drawdown and Recovery Analysis", category: "Risk Management", tags: ["drawdown", "recovery", "risk"] },
  { slug: "sharpe-ratio-explained", title: "Sharpe Ratio Explained", category: "Risk Management", tags: ["sharpe", "risk adjusted", "performance"] },
  // Brokers
  { slug: "robinhood-review", title: "Robinhood: Fees, Features, and Review", category: "Brokers", tags: ["robinhood", "broker", "review"] },
  { slug: "td-ameritrade-review", title: "TD Ameritrade/Schwab: Complete Review", category: "Brokers", tags: ["td ameritrade", "schwab", "broker"] },
  { slug: "interactive-brokers-review", title: "Interactive Brokers: Professional Trading Review", category: "Brokers", tags: ["ibkr", "interactive brokers", "professional"] },
  { slug: "tastytrade-review", title: "tastytrade: Options Trading Review", category: "Brokers", tags: ["tastytrade", "options", "broker"] },
  { slug: "broker-comparison", title: "US Broker Comparison 2025", category: "Brokers", tags: ["comparison", "brokers", "fees"] },
  // Regulatory
  { slug: "pattern-day-trader-rule", title: "Pattern Day Trader (PDT) Rule Explained", category: "Regulatory", tags: ["pdt", "day trading", "regulation"] },
  { slug: "sec-explained", title: "SEC (Securities and Exchange Commission)", category: "Regulatory", tags: ["sec", "regulation", "government"] },
  { slug: "finra-explained", title: "FINRA: What Traders Need to Know", category: "Regulatory", tags: ["finra", "regulation", "broker"] },
  { slug: "wash-sale-rule", title: "Wash Sale Rule for Traders", category: "Regulatory", tags: ["wash sale", "tax", "regulation"] },
  { slug: "short-selling-rules", title: "Short Selling Rules and Regulations", category: "Regulatory", tags: ["short selling", "regulation", "rules"] },
  { slug: "margin-trading-rules", title: "Margin Trading: Rules and Requirements", category: "Regulatory", tags: ["margin", "leverage", "regulation"] },
];

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function guessCategory(term: string): string {
  const t = term.toLowerCase();
  if (/rsi|macd|bollinger|fibonacci|candlestick|vwap|ichimoku|stochastic|moving average|ema|sma|pivot|atr|adx|parabolic|support|resistance|volume/.test(t)) return "Technical Analysis";
  if (/broker|robinhood|schwab|ibkr|interactive|tastytrade|webull|fidelity/.test(t)) return "Brokers";
  if (/option|call|put|greek|delta|gamma|theta|vega|iron condor|strangle|straddle|covered|black.scholes|implied vol/.test(t)) return "Options";
  if (/bitcoin|btc|ethereum|eth|defi|nft|crypto|blockchain|staking|wallet|halving/.test(t)) return "Crypto/DeFi";
  if (/p\/e|pe ratio|eps|dcf|revenue|cash flow|earnings per share|roe|gross margin|ebitda|free cash/.test(t)) return "Fundamental Analysis";
  if (/cpi|inflation|gdp|federal reserve|fed|nfp|payroll|yield curve|pmi|recession/.test(t)) return "Economic Indicators";
  if (/position sizing|kelly|sharpe|drawdown|diversif|risk.reward|stop loss|risk management/.test(t)) return "Risk Management";
  if (/sec|finra|pdt|pattern day|wash sale|short selling|margin|regulation|regulatory/.test(t)) return "Regulatory";
  if (/order|limit|market order|stop|gtc|bracket|oco|trailing/.test(t)) return "Order Types";
  if (/breakout|trend follow|mean reversion|momentum|scalp|swing|position trading|gap trading|pairs|earnings/.test(t)) return "Trading Strategies";
  return "Trading Strategies";
}
