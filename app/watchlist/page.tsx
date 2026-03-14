"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  fetchWatchlist,
  removeFromWatchlistApi,
  type WatchlistItem,
} from "../../lib/watchlist-api";

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-zinc-100">My Watchlist</h1>
      {items.length === 0 ? (
        <p className="mt-4 text-zinc-400">
          No assets added yet. Search for a stock or crypto to add to your watchlist.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.ticker}>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:border-white/15">
                <Link
                  href={`/search/${encodeURIComponent(item.ticker)}`}
                  className="min-w-0 flex-1 flex items-center justify-between gap-2"
                >
                  <span className="font-medium text-zinc-200">{item.ticker}</span>
                  <span className="text-sm text-zinc-500">—</span>
                </Link>
                <button
                  type="button"
                  onClick={(e) => handleRemove(item.ticker, e)}
                  className="shrink-0 rounded px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                  aria-label={`Remove ${item.ticker} from watchlist`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
