/**
 * Client-side helpers for watchlist API (Supabase-backed). Use when user is logged in.
 */

export type WatchlistItem = {
  ticker: string;
  name?: string;
  price?: string | number;
  change?: number;
};

export async function fetchWatchlist(): Promise<WatchlistItem[]> {
  const res = await fetch("/api/watchlist", { credentials: "include" });
  if (res.status === 401) return [];
  if (!res.ok) throw new Error("Failed to load watchlist");
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

export async function addToWatchlistApi(item: WatchlistItem): Promise<void> {
  const res = await fetch("/api/watchlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ticker: item.ticker, name: item.name }),
  });
  if (res.status === 409) return; // already in list
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Failed to add to watchlist");
  }
}

export async function removeFromWatchlistApi(ticker: string): Promise<void> {
  const res = await fetch(`/api/watchlist?ticker=${encodeURIComponent(ticker)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to remove from watchlist");
}

export function isTickerInWatchlist(items: WatchlistItem[], ticker: string): boolean {
  const upper = ticker.toUpperCase();
  return items.some((i) => i.ticker.toUpperCase() === upper);
}
