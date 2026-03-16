"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  fetchWatchlist,
  removeFromWatchlistApi,
  type WatchlistItem,
} from "../../lib/watchlist-api";

const HEADER_TICKERS_KEY = "xchange-header-tickers";
const MAX_HEADER_TICKERS = 12;

function getHeaderTickerSymbols(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HEADER_TICKERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string").slice(0, MAX_HEADER_TICKERS) : [];
  } catch {
    return [];
  }
}

function setHeaderTickerSymbols(symbols: string[]) {
  const list = [...new Set(symbols)].slice(0, MAX_HEADER_TICKERS);
  localStorage.setItem(HEADER_TICKERS_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("xchange-header-tickers-changed"));
}

function useDefaultHeaderTickers() {
  localStorage.removeItem(HEADER_TICKERS_KEY);
  window.dispatchEvent(new Event("xchange-header-tickers-changed"));
}

type Quote = { price: number; changePercent: number };

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [headerSymbols, setHeaderSymbols] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    try {
      const list = await fetchWatchlist();
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setHeaderSymbols(getHeaderTickerSymbols());
  }, []);

  const tickerList = items.map((i) => i.ticker).sort().join(",");
  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;
    const next: Record<string, Quote> = {};
    Promise.all(
      items.map((item) =>
        fetch(`/api/ticker-quote?ticker=${encodeURIComponent(item.ticker)}`, { cache: "no-store" })
          .then((r) => r.json())
          .then((d) => {
            if (!cancelled && d?.price != null) next[item.ticker] = { price: d.price, changePercent: d.changePercent ?? 0 };
          })
          .catch(() => {})
      )
    ).then(() => {
      if (!cancelled) setQuotes((prev) => ({ ...prev, ...next }));
    });
    return () => { cancelled = true; };
  }, [tickerList, items.length]);

  const addTickerToHeader = (ticker: string) => {
    const sym = ticker.toUpperCase().trim();
    if (!sym) return;
    setHeaderSymbols((prev) => {
      if (prev.includes(sym)) return prev;
      const next = [...prev, sym].slice(0, MAX_HEADER_TICKERS);
      setHeaderTickerSymbols(next);
      return next;
    });
  };

  const removeTickerFromHeader = (ticker: string) => {
    const sym = ticker.toUpperCase();
    setHeaderSymbols((prev) => {
      const next = prev.filter((s) => s !== sym);
      setHeaderTickerSymbols(next);
      return next;
    });
  };

  const toggleHeaderTicker = (ticker: string) => {
    const sym = ticker.toUpperCase();
    setHeaderSymbols((prev) => {
      const next = prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym].slice(0, MAX_HEADER_TICKERS);
      setHeaderTickerSymbols(next);
      return next;
    });
  };

  const useDefault = () => {
    useDefaultHeaderTickers();
    setHeaderSymbols([]);
  };

  const handleRemove = async (ticker: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await removeFromWatchlistApi(ticker);
      setItems((prev) => prev.filter((i) => i.ticker.toUpperCase() !== ticker.toUpperCase()));
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-zinc-100">My Watchlist</h1>
        <p className="mt-4 text-zinc-500">Loading…</p>
      </div>
    );
  }

  const isInHeader = (ticker: string) => headerSymbols.includes(ticker.toUpperCase());

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-zinc-100">My Watchlist</h1>

      {/* Header bar section: default vs custom, remove any ticker */}
      <section className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold text-zinc-200">Header bar tickers</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Tickers shown in the top rotating bar. Use the icon on each watchlist card to add. Remove any below with ×. Default = SPY, QQQ, BTC, etc.
        </p>
        {headerSymbols.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">Using default tickers (SPY, QQQ, BTC, ETH, GLD, OIL, DXY, EUR/USD).</p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {headerSymbols.map((sym) => (
              <span
                key={sym}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-sm text-zinc-200"
              >
                {sym}
                <button
                  type="button"
                  onClick={() => removeTickerFromHeader(sym)}
                  className="rounded-full p-0.5 text-zinc-400 hover:bg-red-500/20 hover:text-red-400"
                  aria-label={`Remove ${sym} from header bar`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={useDefault}
          className="mt-3 text-xs font-medium text-[var(--accent-color)] hover:underline"
        >
          Use default tickers
        </button>
      </section>

      {/* Watchlist: each card has add-to-header icon in the rectangle */}
      {items.length === 0 ? (
        <p className="mt-6 text-zinc-400">
          No assets in watchlist yet. Search for a stock or crypto to add.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {items.map((item) => {
            const q = quotes[item.ticker];
            const priceStr = q?.price != null ? (q.price >= 1 ? `$${q.price.toFixed(2)}` : `$${q.price.toFixed(4)}`) : null;
            const ch = q?.changePercent;
            const inHeader = isInHeader(item.ticker);
            return (
              <li key={item.ticker}>
                <div className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-4 py-3 transition-colors hover:bg-white/10">
                  <Link
                    href={`/search/${encodeURIComponent(item.ticker)}`}
                    className="min-w-0 flex-1 flex items-center justify-between gap-3"
                  >
                    <span className="font-medium text-zinc-200">{item.ticker}</span>
                    <div className="flex shrink-0 items-center gap-4 text-sm">
                      {priceStr && <span className="text-zinc-400">{priceStr}</span>}
                      {ch != null && (
                        <span className={ch >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {ch >= 0 ? "+" : ""}{ch.toFixed(2)}%
                        </span>
                      )}
                      {!priceStr && ch == null && <span className="text-zinc-500">—</span>}
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleHeaderTicker(item.ticker); }}
                      className={`rounded p-2 transition-colors ${
                        inHeader ? "text-[var(--accent-color)]" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-300"
                      }`}
                      title={inHeader ? "Remove from header bar" : "Add to header bar"}
                      aria-label={inHeader ? "Remove from header bar" : "Add to header bar"}
                    >
                      {inHeader ? (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleRemove(item.ticker, e)}
                      className="rounded px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                      aria-label={`Remove ${item.ticker} from watchlist`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
