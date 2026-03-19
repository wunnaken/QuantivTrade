/**
 * Client-side helpers for watchlist API (Supabase-backed when authenticated).
 * Falls back to localStorage when API returns 401 or fails (e.g. demo auth without Supabase).
 */

const WATCHLIST_LOCAL_KEY = "xchange-watchlist";

export type WatchlistItem = {
  ticker: string;
  name?: string;
  price?: string | number;
  change?: number;
};

export type WatchlistFetchResult = {
  items: WatchlistItem[];
  source: "api" | "local";
  syncIssue: boolean;
};

let lastSyncIssue = false;

function setSyncIssue(v: boolean) {
  lastSyncIssue = v;
}

export function getWatchlistSyncIssue(): boolean {
  return lastSyncIssue;
}

function emitWatchlistChanged(syncIssue: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("xchange-watchlist-changed", { detail: { syncIssue } })
  );
}

function getLocalWatchlist(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WATCHLIST_LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((i) => i && typeof i.ticker === "string") : [];
  } catch {
    return [];
  }
}

function setLocalWatchlist(items: WatchlistItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WATCHLIST_LOCAL_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export async function fetchWatchlistWithStatus(): Promise<WatchlistFetchResult> {
  try {
    const res = await fetch("/api/watchlist", { credentials: "include" });
    if (res.status === 401) {
      const local = getLocalWatchlist();
      setSyncIssue(true);
      return { items: local, source: "local", syncIssue: true };
    }
    if (!res.ok) throw new Error("Failed to load watchlist");
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    // Mirror latest server state locally so fallback never loses data.
    setLocalWatchlist(items);
    setSyncIssue(false);
    return { items, source: "api", syncIssue: false };
  } catch {
    const local = getLocalWatchlist();
    setSyncIssue(true);
    return { items: local, source: "local", syncIssue: true };
  }
}

export async function fetchWatchlist(): Promise<WatchlistItem[]> {
  const { items } = await fetchWatchlistWithStatus();
  return items;
}

export async function migrateLocalWatchlistToApi(): Promise<{
  attempted: number;
  migrated: number;
  syncIssue: boolean;
}> {
  const local = getLocalWatchlist();
  if (local.length === 0) return { attempted: 0, migrated: 0, syncIssue: false };
  let migrated = 0;
  for (const item of local) {
    const ticker = String(item?.ticker ?? "").trim().toUpperCase();
    if (!ticker) continue;
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ticker, name: item.name }),
      });
      if (res.ok || res.status === 409) migrated += 1;
    } catch {
      // keep going, retain local backup if migration incomplete
    }
  }
  const allMigrated = migrated >= local.length;
  if (allMigrated) {
    setLocalWatchlist([]);
    setSyncIssue(false);
    emitWatchlistChanged(false);
  } else {
    setSyncIssue(true);
  }
  return { attempted: local.length, migrated, syncIssue: !allMigrated };
}

function addToLocalWatchlist(ticker: string, name?: string): void {
  const list = getLocalWatchlist();
  if (list.some((i) => i.ticker.toUpperCase() === ticker.toUpperCase())) return;
  setLocalWatchlist([...list, { ticker: ticker.toUpperCase(), name: name ?? ticker }]);
}

export async function addToWatchlistApi(item: WatchlistItem): Promise<{ syncIssue: boolean }> {
  const ticker = String(item.ticker || "").trim().toUpperCase();
  if (!ticker) throw new Error("ticker is required");
  try {
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ticker, name: item.name }),
    });
    if (res.status === 409 || res.ok) {
      // Keep local backup in sync with server success.
      addToLocalWatchlist(ticker, item.name);
      setSyncIssue(false);
      emitWatchlistChanged(false);
      return { syncIssue: false };
    }
    if (res.status === 401 || res.status === 500) {
      addToLocalWatchlist(ticker, item.name);
      setSyncIssue(true);
      emitWatchlistChanged(true);
      return { syncIssue: true };
    }
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Failed to add to watchlist");
  } catch (e) {
    if (e instanceof TypeError || (e instanceof Error && e.message.includes("fetch"))) {
      addToLocalWatchlist(ticker, item.name);
      setSyncIssue(true);
      emitWatchlistChanged(true);
      return { syncIssue: true };
    }
    throw e;
  }
}

export async function removeFromWatchlistApi(ticker: string): Promise<{ syncIssue: boolean }> {
  const upper = ticker.trim().toUpperCase();
  try {
    const res = await fetch(`/api/watchlist?ticker=${encodeURIComponent(ticker)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      const list = getLocalWatchlist().filter((i) => i.ticker.toUpperCase() !== upper);
      setLocalWatchlist(list);
      setSyncIssue(false);
      emitWatchlistChanged(false);
      return { syncIssue: false };
    }
    if (res.status === 401 || res.status === 500) {
      const list = getLocalWatchlist().filter((i) => i.ticker.toUpperCase() !== upper);
      setLocalWatchlist(list);
      setSyncIssue(true);
      emitWatchlistChanged(true);
      return { syncIssue: true };
    }
    throw new Error("Failed to remove from watchlist");
  } catch (e) {
    if (e instanceof TypeError) {
      const list = getLocalWatchlist().filter((i) => i.ticker.toUpperCase() !== upper);
      setLocalWatchlist(list);
      setSyncIssue(true);
      emitWatchlistChanged(true);
      return { syncIssue: true };
    }
    throw e;
  }
}

export function isTickerInWatchlist(items: WatchlistItem[], ticker: string): boolean {
  const upper = ticker.toUpperCase();
  return items.some((i) => i.ticker.toUpperCase() === upper);
}
