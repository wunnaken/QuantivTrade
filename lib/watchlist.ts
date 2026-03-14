const WATCHLIST_KEY = "xchange-watchlist";

export type WatchlistItem = {
  ticker: string;
  name?: string;
  price?: string;
  change?: number;
};

export function getWatchlist(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addToWatchlist(item: WatchlistItem): void {
  const list = getWatchlist();
  if (list.some((i) => i.ticker.toUpperCase() === item.ticker.toUpperCase())) return;
  list.push({ ...item, ticker: item.ticker.toUpperCase() });
  try {
    window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function removeFromWatchlist(ticker: string): void {
  const list = getWatchlist().filter((i) => i.ticker.toUpperCase() !== ticker.toUpperCase());
  try {
    window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function isInWatchlist(ticker: string): boolean {
  return getWatchlist().some((i) => i.ticker.toUpperCase() === ticker.toUpperCase());
}
