"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

// ── Site pages — update this list whenever a new page is added ────────────────
const SITE_PAGES = [
  // Community
  { label: "Home Feed",         path: "/feed",            description: "Your personalized activity feed",              keywords: ["home", "feed", "activity"] },
  { label: "Social Feed",       path: "/social-feed",     description: "Posts and discussions from the community",      keywords: ["social", "posts", "community", "discussions"] },
  { label: "Communities",       path: "/communities",     description: "Topic-specific trading communities",            keywords: ["groups", "communities", "forums"] },
  { label: "Trade Rooms",       path: "/trade-rooms",     description: "Live collaborative trading rooms",              keywords: ["rooms", "live", "trading", "chat"] },
  { label: "Messages",          path: "/messages",        description: "Direct messages with other traders",            keywords: ["dm", "inbox", "messages", "chat"] },
  { label: "People",            path: "/people",          description: "Discover and follow other traders",             keywords: ["people", "traders", "follow", "discover"] },
  { label: "Leaderboard",       path: "/leaderboard",     description: "Top trade rooms ranked by activity",            keywords: ["leaderboard", "ranking", "top", "best"] },
  // Markets
  { label: "News",              path: "/news",            description: "Curated financial news",                        keywords: ["news", "articles", "headlines"] },
  { label: "Global Map",        path: "/map",             description: "Interactive economic map with country data",    keywords: ["map", "global", "countries", "economic"] },
  { label: "Bonds",             path: "/bonds",           description: "Bond markets and yield curves",                 keywords: ["bonds", "yields", "fixed income", "rates"] },
  { label: "Forex",             path: "/forex",           description: "Foreign exchange rates and currency pairs",     keywords: ["forex", "fx", "currency", "currencies"] },
  { label: "Futures",           path: "/futures",         description: "Futures markets across asset classes",          keywords: ["futures", "commodities", "contracts"] },
  { label: "Crypto",            path: "/crypto",          description: "Cryptocurrency prices and market data",         keywords: ["crypto", "bitcoin", "ethereum", "digital assets"] },
  { label: "Market Relations",  path: "/market-relations",description: "Correlations and sector connections",           keywords: ["correlations", "relations", "sectors", "connections"] },
  { label: "Sentiment Radar",   path: "/sentiment",       description: "Aggregated market sentiment",                   keywords: ["sentiment", "radar", "fear", "greed"] },
  { label: "Insider Trades",    path: "/insider-trades",  description: "Insider trading filings and activity",          keywords: ["insider", "trades", "filings", "executives"] },
  { label: "FiscalWatch",       path: "/fiscalwatch",     description: "Fiscal policy and government spending",         keywords: ["fiscal", "government", "spending", "policy"] },
  // Analytics
  { label: "Portfolios",        path: "/portfolios",      description: "Build and analyze your portfolios",             keywords: ["portfolio", "holdings", "positions"] },
  { label: "CEOs",              path: "/ceos",            description: "CEO profiles, news, and credibility",           keywords: ["ceo", "executives", "leaders", "management"] },
  { label: "Calendar",          path: "/calendar",        description: "Economic events, earnings, central banks",      keywords: ["calendar", "events", "earnings", "economic"] },
  { label: "Screener",          path: "/screener",        description: "Filter stocks by custom criteria",              keywords: ["screener", "filter", "scan", "stocks"] },
  { label: "Supply Chain",      path: "/supply-chain",    description: "Supply chain risk and dependency analysis",     keywords: ["supply chain", "risk", "dependencies"] },
  { label: "DataHub",           path: "/datahub",         description: "Raw economic and market datasets",              keywords: ["data", "datasets", "hub", "raw"] },
  { label: "Backtest",          path: "/backtest",        description: "Backtest trading strategies",                   keywords: ["backtest", "strategy", "historical", "test"] },
  // Personal
  { label: "Journal",           path: "/journal",         description: "Your private trading journal",                  keywords: ["journal", "notes", "diary", "trades"] },
  { label: "Prediction Markets",path: "/predict",         description: "Make and track market forecasts",               keywords: ["predict", "forecast", "prediction", "markets"] },
  { label: "Watchlist",         path: "/watchlist",       description: "Your saved assets",                             keywords: ["watchlist", "saved", "favorites", "watch"] },
  { label: "Workspace",         path: "/workspace",       description: "Personal workspace and notes",                  keywords: ["workspace", "notes", "work"] },
  { label: "Whiteboard",        path: "/whiteboard",      description: "Collaborative real-time drawing canvas",        keywords: ["whiteboard", "draw", "chart", "canvas", "excalidraw"] },
  { label: "Profile",           path: "/profile",         description: "Your public profile",                           keywords: ["profile", "account", "me", "bio"] },
  { label: "Settings",          path: "/settings",        description: "Account, security, and preferences",            keywords: ["settings", "account", "2fa", "security", "theme", "password"] },
  // Platform
  { label: "Plans & Pricing",   path: "/pricing",         description: "Subscription plans and features",               keywords: ["plans", "pricing", "subscription", "upgrade", "pro"] },
  { label: "Archive",           path: "/archive",         description: "Research archive and trending articles",        keywords: ["archive", "research", "articles"] },
  { label: "Marketplace",       path: "/marketplace",     description: "Strategies and ideas marketplace",              keywords: ["marketplace", "strategies", "ideas", "buy", "sell"] },
  { label: "Feedback",          path: "/feedback",        description: "Send us your suggestions or report an issue",   keywords: ["feedback", "suggestions", "contact", "report", "bug"] },
  { label: "Chat Assistant",    path: "/ai",              description: "Chat for market research and analysis",         keywords: ["ai", "chat", "assistant", "research", "analysis"] },
] as const;

// ── Tickers — add new popular symbols here as the platform grows ──────────────
const TICKERS = [
  { symbol: "AAPL",   label: "Apple Inc.",         type: "Stock" },
  { symbol: "TSLA",   label: "Tesla Inc.",          type: "Stock" },
  { symbol: "NVDA",   label: "NVIDIA Corp.",        type: "Stock" },
  { symbol: "MSFT",   label: "Microsoft Corp.",     type: "Stock" },
  { symbol: "GOOGL",  label: "Alphabet Inc.",       type: "Stock" },
  { symbol: "AMZN",   label: "Amazon.com Inc.",     type: "Stock" },
  { symbol: "META",   label: "Meta Platforms",      type: "Stock" },
  { symbol: "SPY",    label: "S&P 500 ETF",         type: "ETF" },
  { symbol: "QQQ",    label: "Nasdaq 100 ETF",      type: "ETF" },
  { symbol: "BTC",    label: "Bitcoin",             type: "Crypto" },
  { symbol: "ETH",    label: "Ethereum",            type: "Crypto" },
  { symbol: "EURUSD", label: "EUR / USD",           type: "Forex" },
  { symbol: "GOLD",   label: "Gold",                type: "Commodity" },
  { symbol: "OIL",    label: "Crude Oil",           type: "Commodity" },
];

const TYPE_STYLES: Record<string, string> = {
  Stock:     "bg-blue-500/15 text-blue-400",
  ETF:       "bg-purple-500/15 text-purple-400",
  Crypto:    "bg-amber-500/15 text-amber-400",
  Forex:     "bg-emerald-500/15 text-emerald-400",
  Commodity: "bg-orange-500/15 text-orange-400",
};

const QUICK_PAGES = [
  { label: "News",        path: "/news" },
  { label: "Watchlist",   path: "/watchlist" },
  { label: "Calendar",    path: "/calendar" },
  { label: "Screener",    path: "/screener" },
  { label: "Portfolios",  path: "/portfolios" },
  { label: "Trade Rooms", path: "/trade-rooms" },
];

type PageResult = (typeof SITE_PAGES)[number];
type TickerResult = (typeof TICKERS)[number];

function matchPages(query: string): PageResult[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return SITE_PAGES.filter(
    (p) =>
      p.label.toLowerCase().includes(q) ||
      p.path.toLowerCase().includes(q) ||
      p.keywords.some((k) => k.includes(q))
  ).slice(0, 4) as unknown as PageResult[];
}

function matchTickers(query: string): TickerResult[] {
  const q = query.trim().toUpperCase();
  if (!q) return TICKERS.slice(0, 6);
  return TICKERS.filter(
    (t) => t.symbol.includes(q) || t.label.toUpperCase().includes(q)
  ).slice(0, 6);
}

function PageIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10M4 18h6" />
    </svg>
  );
}

function TickerIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

export default function SearchPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const pageResults = matchPages(query);
  const tickerResults = matchTickers(query);
  const showDropdown = focused;
  const wasFocusedRef = useRef(false);


  const goToTicker = useCallback(
    (symbol: string) => {
      setFocused(false);
      router.push(`/search/${encodeURIComponent(symbol.toUpperCase())}`);
    },
    [router]
  );

  const goToPage = useCallback(
    (path: string) => {
      setFocused(false);
      router.push(path);
    },
    [router]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (pageResults.length > 0 && tickerResults.length === 0) {
        goToPage(pageResults[0].path);
      } else if (tickerResults.length > 0) {
        goToTicker(tickerResults[0].symbol);
      }
    }
    if (e.key === "Escape") {
      setFocused(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-100">Search</h1>
      <p className="mb-6 text-sm text-zinc-500">Find markets, assets, and any page on QuantivTrade.</p>

      {/* Search input */}
      <div className="relative">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onMouseDown={() => { wasFocusedRef.current = focused; }}
            onFocus={() => setFocused(true)}
            onClick={() => {
              if (wasFocusedRef.current) {
                setFocused(false);
                inputRef.current?.blur();
              }
            }}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={handleKeyDown}
            placeholder="Search tickers, pages, features…"
            className="w-full rounded-2xl border border-white/10 bg-[#0F1520] py-4 pl-11 pr-10 text-zinc-100 placeholder:text-zinc-500 outline-none transition-colors focus:border-[var(--accent-color)]/50 focus:bg-[#111926]"
            autoComplete="off"
            aria-label="Search"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); inputRef.current?.focus(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-300"
              aria-label="Clear"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#0F1520] shadow-2xl">

            {/* Page results */}
            {pageResults.length > 0 && (
              <div>
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Pages</p>
                {pageResults.map((page) => (
                  <button
                    key={page.path}
                    type="button"
                    onClick={() => goToPage(page.path)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/8 text-zinc-400">
                      <PageIcon />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-200">{page.label}</p>
                      <p className="truncate text-[11px] text-zinc-500">{page.description}</p>
                    </div>
                    <span className="ml-auto shrink-0 text-[11px] text-zinc-600">{page.path}</span>
                  </button>
                ))}
              </div>
            )}

            {pageResults.length > 0 && tickerResults.length > 0 && (
              <div className="mx-4 border-t border-white/5" />
            )}

            {/* Ticker results */}
            {tickerResults.length > 0 && (
              <div>
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                  {query ? "Markets" : "Popular Markets"}
                </p>
                {tickerResults.map((t) => (
                  <button
                    key={t.symbol}
                    type="button"
                    onClick={() => goToTicker(t.symbol)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-color)]/10 text-[var(--accent-color)]">
                      <TickerIcon />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-200">{t.symbol}</p>
                      <p className="text-[11px] text-zinc-500">{t.label}</p>
                    </div>
                    <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_STYLES[t.type] ?? "bg-white/10 text-zinc-400"}`}>
                      {t.type}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* No results */}
            {query.trim() && pageResults.length === 0 && tickerResults.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-zinc-400">No results for <span className="text-zinc-200">&ldquo;{query}&rdquo;</span></p>
                <p className="mt-1 text-xs text-zinc-600">Try a ticker like AAPL, or a page name like &ldquo;news&rdquo;</p>
              </div>
            )}

            <div className="border-t border-white/5 px-4 py-2">
              <p className="text-[10px] text-zinc-600">
                Press <kbd className="rounded border border-white/10 px-1 text-[10px]">Enter</kbd> to go · <kbd className="rounded border border-white/10 px-1 text-[10px]">Esc</kbd> to close
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Default state — quick access + popular tickers */}
      {!focused && !query && (
        <div className="mt-8 space-y-6">
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-600">Quick Access</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {QUICK_PAGES.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => router.push(item.path)}
                  className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-left text-sm text-zinc-300 transition-colors hover:border-[var(--accent-color)]/30 hover:bg-[var(--accent-color)]/5 hover:text-white"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-600">Popular Tickers</p>
            <div className="flex flex-wrap gap-2">
              {TICKERS.slice(0, 8).map((t) => (
                <button
                  key={t.symbol}
                  type="button"
                  onClick={() => goToTicker(t.symbol)}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-sm transition-colors hover:border-[var(--accent-color)]/40 hover:text-white"
                >
                  <span className="font-medium text-zinc-200">{t.symbol}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${TYPE_STYLES[t.type] ?? ""}`}>{t.type}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
