"use client";

import { memo, useEffect, useMemo, useState } from "react";
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
const SEARCH_OPTIONS = ["SPY", "QQQ", "AAPL", "BTC", "ETH", "GLD", "EURUSD", "DXY", "NVDA", "TSLA", "MSFT", "AMZN", "META", "GOOGL"];

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
}: {
  symbol: string;
  name: string;
  data: { price: number | null; change: number | null; changePercent: number | null; isLoading: boolean };
}) {
  const isPositive = data.changePercent != null && data.changePercent >= 0;
  const isZero = data.changePercent != null && data.changePercent === 0;
  const dotColor = data.isLoading ? "bg-white/20" : isZero ? "bg-zinc-500" : isPositive ? "bg-emerald-400" : "bg-red-400";
  const isCrypto = CRYPTO_SYMBOLS.has(symbol);
  const changeLabel = isCrypto ? "24h change (CoinGecko); may differ from TradingView day change" : undefined;
  return (
    <Link
      href="/news"
      className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded px-3 py-1 text-xs transition hover:bg-white/5"
      title={changeLabel}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor} ${data.isLoading ? "animate-pulse" : ""}`} aria-hidden />
      <span className="font-medium text-zinc-200">{name}</span>
      {data.price != null ? (
        <>
          <PriceDisplay
            price={data.price}
            change={data.change}
            changePercent={data.changePercent}
            symbol={symbol}
            format="compact"
            showChange={true}
          />
        </>
      ) : (
        <span className="text-zinc-500">—</span>
      )}
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
  const [config, setConfig] = useState<TickerBarConfig>({ tickers: DEFAULT_TICKERS, useWatchlist: false });
  const [showSettings, setShowSettings] = useState(false);
  const [search, setSearch] = useState("");
  const [savedText, setSavedText] = useState("");

  const persistConfig = async (next: TickerBarConfig) => {
    setConfig(next);
    const result = await saveTickerBarConfig(next);
    setSavedText(result.syncIssue ? "Saved locally" : "Saved");
    setTimeout(() => setSavedText(""), 1500);
  };

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
    window.addEventListener("xchange-header-tickers-changed", onHeaderChanged);
    return () => window.removeEventListener("xchange-header-tickers-changed", onHeaderChanged);
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
    window.addEventListener("xchange-watchlist-changed", onChanged);
    return () => window.removeEventListener("xchange-watchlist-changed", onChanged);
  }, [config.useWatchlist, config.tickers]);

  const list = useMemo(
    () =>
      (symbols.length > 0 ? symbols : DEFAULT_TICKERS)
        .map((s) => (typeof s === "string" ? s.toUpperCase() : s))
        .slice(0, MAX_TICKERS),
    [symbols]
  );
  const prices = useLivePrices(list.length > 0 ? list : DEFAULT_TICKERS);

  if (list.length === 0) {
    return <TickerSkeleton />;
  }

  const allLoading = list.every((s) => prices[s]?.isLoading);
  if (allLoading && list.length > 0 && !list.some((s) => prices[s]?.price != null)) {
    return <TickerSkeleton />;
  }
  const filteredOptions = SEARCH_OPTIONS.filter((s) => s.includes(search.toUpperCase())).slice(0, 8);

  return (
    <>
      <div
        className="relative min-w-0 flex-1 overflow-hidden px-4"
        aria-label="Market tickers"
        aria-live="polite"
        role="region"
      >
        <div className="absolute right-1 top-1 z-10 flex items-center gap-2">
          {savedText ? <span className="text-[10px] text-emerald-400">{savedText}</span> : null}
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="rounded-full border border-white/10 bg-black/35 p-1.5 text-zinc-300 hover:bg-white/10"
            aria-label="Customize ticker bar"
            title="Customize ticker bar"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.983 5.5A2.5 2.5 0 109.5 8M11.983 5.5V3m0 2.5h7.5M11.983 18.5A2.5 2.5 0 1014.5 16m-2.517 2.5V21m0-2.5H4.5M6.5 10a2.5 2.5 0 102.5 2.5M6.5 10V7.5m0 2.5h13m-13 5h13" /></svg>
          </button>
        </div>
        <div className="ticker-marquee-track flex gap-8" style={{ width: "max-content" }} key="ticker-track">
          {[...list, ...list].map((symbol, i) => (
            <TickerItem
              key={`${symbol}-${i}`}
              symbol={symbol}
              name={SYMBOL_NAMES[symbol] ?? symbol}
              data={prices[symbol] ?? LOADING_DATA}
            />
          ))}
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowSettings(false)} aria-hidden />
          <div className="relative w-full max-w-lg rounded-xl border border-white/10 bg-[#0F1520] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100">Customize Ticker Bar</h3>
              <button type="button" onClick={() => setShowSettings(false)} className="text-zinc-400 hover:text-zinc-200">✕</button>
            </div>
            <label className="mb-3 flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={config.useWatchlist}
                onChange={async (e) => {
                  const next = { ...config, useWatchlist: e.target.checked };
                  await persistConfig(next);
                }}
              />
              Use my watchlist
            </label>

            {!config.useWatchlist && (
              <>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value.toUpperCase())}
                  placeholder="Search ticker"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {filteredOptions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        if (config.tickers.includes(s) || config.tickers.length >= MAX_TICKERS) return;
                        void persistConfig({ ...config, tickers: [...config.tickers, s] });
                      }}
                      className="rounded-full border border-white/10 px-2 py-1 text-xs text-zinc-300 hover:bg-white/10"
                    >
                      Add {s}
                    </button>
                  ))}
                </div>
                <ul className="mt-3 space-y-1">
                  {config.tickers.map((t, idx) => (
                    <li
                      key={`${t}-${idx}`}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(idx))}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        const from = Number(e.dataTransfer.getData("text/plain"));
                        if (!Number.isFinite(from) || from === idx) return;
                        const next = [...config.tickers];
                        const [moved] = next.splice(from, 1);
                        next.splice(idx, 0, moved);
                        void persistConfig({ ...config, tickers: next });
                      }}
                      className="flex items-center justify-between rounded border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-zinc-200"
                    >
                      <span className="cursor-move">{t}</span>
                      <button
                        type="button"
                        onClick={() => void persistConfig({ ...config, tickers: config.tickers.filter((x) => x !== t) })}
                        className="text-zinc-400 hover:text-red-400"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => void persistConfig({ tickers: DEFAULT_TICKERS, useWatchlist: false })}
                className="text-xs text-[var(--accent-color)] hover:underline"
              >
                Reset to default
              </button>
              <button
                type="button"
                onClick={async () => {
                  await persistConfig(config);
                  setShowSettings(false);
                }}
                className="rounded-full bg-[var(--accent-color)] px-4 py-1.5 text-sm font-semibold text-[#020308]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
