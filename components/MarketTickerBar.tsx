"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// ─── Market Status ────────────────────────────────────────────────────────────

type MarketStatus = "open" | "pre" | "after" | "closed";

function getUSMarketStatus(): MarketStatus {
  const etString = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const et = new Date(etString);
  const day = et.getDay();
  const t = et.getHours() * 60 + et.getMinutes();
  if (day === 0 || day === 6) return "closed";
  if (t < 240) return "closed";   // before 4:00 AM
  if (t < 570) return "pre";      // 4:00–9:30 AM
  if (t < 960) return "open";     // 9:30 AM–4:00 PM
  if (t < 1200) return "after";   // 4:00–8:00 PM
  return "closed";
}

const FOREX_SYMBOLS = new Set(["EURUSD", "DXY", "GBPUSD", "USDJPY", "USDCAD", "AUDUSD"]);

function MarketStatusIcon({ status }: { status: "pre" | "after" | "closed" }) {
  if (status === "pre") {
    return (
      <span title="Pre-Market" aria-label="Pre-Market" className="text-amber-400 flex items-center">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 2v2M12 12a5 5 0 0 1-5-5" />
          <path d="M5.636 5.636 4.222 4.222M2 12h2M20 12h2M18.364 5.636l1.414-1.414" />
          <line x1="3" y1="19" x2="21" y2="19" />
          <path d="M7 19a5 5 0 0 1 10 0" />
        </svg>
      </span>
    );
  }
  if (status === "after") {
    return (
      <span title="After Hours" aria-label="After Hours" className="text-indigo-400 flex items-center">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </span>
    );
  }
  return null;
}
import Link from "next/link";
import { useLivePrices } from "../lib/hooks/useLivePrice";
import { PriceDisplay } from "./PriceDisplay";
import {
  DEFAULT_TICKERS,
  clearLegacyHeaderTickers,
  fetchTickerBarConfig,
  getLocalTickerConfig,
  saveTickerBarConfig,
  type TickerBarConfig,
} from "../lib/ticker-bar-api";
import { fetchWatchlistWithStatus } from "../lib/watchlist-api";

const MAX_TICKERS = 15;

const SYMBOL_NAMES: Record<string, string> = {
  SPY: "S&P 500",
  QQQ: "Nasdaq",
  AAPL: "Apple",
  BTC: "Bitcoin",
  ETH: "Ethereum",
  GLD: "Gold",
  OIL: "Oil",
  USO: "Oil",
  DXY: "Dollar Index",
  EURUSD: "EUR/USD",
};

const CRYPTO_SYMBOLS = new Set(["BTC", "ETH"]);

const LOADING_DATA = { price: null, change: null, changePercent: null, isLoading: true } as const;

const TickerItem = memo(function TickerItem({
  symbol,
  name,
  data,
  marketStatus,
}: {
  symbol: string;
  name: string;
  data: { price: number | null; change: number | null; changePercent: number | null; isLoading: boolean };
  marketStatus: MarketStatus;
}) {
  const isPositive = data.changePercent != null && data.changePercent >= 0;
  const isZero = data.changePercent != null && data.changePercent === 0;
  const dotColor = data.isLoading ? "bg-white/20" : isZero ? "bg-zinc-500" : isPositive ? "bg-emerald-400" : "bg-red-400";
  const isCrypto = CRYPTO_SYMBOLS.has(symbol);
  const isForex = FOREX_SYMBOLS.has(symbol);
  const showStatus = !isCrypto && !isForex && (marketStatus === "pre" || marketStatus === "after");
  const changeLabel = isCrypto ? "24h change (CoinGecko); may differ from TradingView day change" : undefined;
  return (
    <Link
      href={`/search/${encodeURIComponent(symbol)}`}
      className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded px-3 py-1 text-xs transition hover:bg-white/5"
      title={changeLabel}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor} ${data.isLoading ? "animate-pulse" : ""}`} aria-hidden />
      <span className="font-medium text-zinc-200">{name}</span>
      {data.price != null ? (
        <PriceDisplay
          price={data.price}
          change={data.change}
          changePercent={data.changePercent}
          symbol={symbol}
          format="compact"
          showChange={true}
        />
      ) : (
        <span className="text-zinc-500">—</span>
      )}
      {showStatus && <MarketStatusIcon status={marketStatus} />}
    </Link>
  );
});

function TickerSkeleton() {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden px-4" aria-label="Market tickers loading">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="flex shrink-0 items-center gap-2 rounded px-3 py-1">
          <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/20 animate-pulse" />
          <div className="h-3 w-16 rounded bg-white/10 animate-pulse" />
          <div className="h-3 w-10 rounded bg-white/10 animate-pulse" />
          <div className="h-3 w-8 rounded bg-white/10 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function MarketTickerBar() {
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_TICKERS);
  const [config, setConfig] = useState<TickerBarConfig>({
    tickers: DEFAULT_TICKERS,
    useWatchlist: false,
  });
  const [marketStatus, setMarketStatus] = useState<MarketStatus>(getUSMarketStatus);

  useEffect(() => {
    const id = setInterval(() => setMarketStatus(getUSMarketStatus()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const load = async () => {
      const local = getLocalTickerConfig();
      if (local) setConfig(local);

      const migrationSource = local?.tickers?.length ? local : null;
      const result = await fetchTickerBarConfig();
      setConfig(result.config);
      if (migrationSource && migrationSource.tickers.length > 0) {
        await saveTickerBarConfig(migrationSource);
        clearLegacyHeaderTickers();
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const onHeaderChanged = () => {
      const local = getLocalTickerConfig();
      if (!local) return;
      setConfig((prev) => {
        const prevKey = `${prev.useWatchlist}:${prev.tickers.join(",")}`;
        const nextKey = `${local.useWatchlist}:${local.tickers.join(",")}`;
        return prevKey === nextKey ? prev : local;
      });
    };
    window.addEventListener("quantivtrade-header-tickers-changed", onHeaderChanged);
    return () => window.removeEventListener("quantivtrade-header-tickers-changed", onHeaderChanged);
  }, []);

  useEffect(() => {
    if (!config.useWatchlist) {
      setSymbols(config.tickers.length ? config.tickers : DEFAULT_TICKERS);
      return;
    }
    const loadWatchlist = async () => {
      const result = await fetchWatchlistWithStatus();
      const next = [...new Set(result.items.map((x) => x.ticker.trim().toUpperCase()).filter(Boolean))].slice(0, MAX_TICKERS);
      setSymbols(next.length > 0 ? next : DEFAULT_TICKERS);
    };
    void loadWatchlist();
    const onChanged = () => void loadWatchlist();
    window.addEventListener("quantivtrade-watchlist-changed", onChanged);
    return () => window.removeEventListener("quantivtrade-watchlist-changed", onChanged);
  }, [config.useWatchlist, config.tickers]);

  const list = useMemo(
    () =>
      (symbols.length > 0 ? symbols : DEFAULT_TICKERS)
        .map((s) => (typeof s === "string" ? s.toUpperCase() : s))
        .slice(0, MAX_TICKERS),
    [symbols]
  );
  const prices = useLivePrices(list.length > 0 ? list : DEFAULT_TICKERS);

  // Hooks must be declared before any early returns
  const trackRef = useRef<HTMLDivElement>(null);

  // Measure single-copy width once per symbol list change and pin the animation distance.
  // Also disables animation entirely when all tickers fit without scrolling.
  // Direct DOM mutation (no state) so re-renders from price updates never restart the animation.
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      if (!el) return;
      const halfWidth = el.scrollWidth / 2;
      const containerWidth = el.parentElement?.clientWidth ?? 0;
      if (halfWidth > 0 && halfWidth > containerWidth) {
        el.style.animation = "";
        el.style.setProperty("--ticker-half-width", `-${halfWidth}px`);
      } else {
        // All tickers visible at once — no scrolling needed
        el.style.animation = "none";
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [list]);

  if (list.length === 0) {
    return <TickerSkeleton />;
  }

  const allLoading = list.every((s) => prices[s]?.isLoading);
  if (allLoading && list.length > 0 && !list.some((s) => prices[s]?.price != null)) {
    return <TickerSkeleton />;
  }

  return (
    <div
      className="relative min-w-0 flex-1 overflow-hidden px-4"
      aria-label="Market tickers"
      aria-live="polite"
      role="region"
    >
      <div ref={trackRef} className="ticker-marquee-track flex gap-8" style={{ width: "max-content" }}>
        {[...list, ...list].map((symbol, i) => (
          <TickerItem
            key={`${symbol}-${i}`}
            symbol={symbol}
            name={SYMBOL_NAMES[symbol] ?? symbol}
            data={prices[symbol] ?? LOADING_DATA}
            marketStatus={marketStatus}
          />
        ))}
      </div>
    </div>
  );
}
