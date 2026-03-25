const LOCAL_KEY_NEW = "quantivtrade-ticker-config";
const LOCAL_KEY_OLD = "quantivtrade-header-tickers";

export const DEFAULT_TICKERS = [
  "SPY",
  "QQQ",
  "AAPL",
  "BTC",
  "ETH",
  "GLD",
  "EURUSD",
  "DXY",
  "NVDA",
  "TSLA",
];

export type TickerBarConfig = {
  tickers: string[];
  useWatchlist: boolean;
};

function normalizeTickers(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const list = input
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 15);
  return [...new Set(list)];
}

export function getLocalTickerConfig(): TickerBarConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const rawNew = localStorage.getItem(LOCAL_KEY_NEW);
    if (rawNew) {
      const parsed = JSON.parse(rawNew) as { tickers?: unknown; useWatchlist?: unknown };
      return { tickers: normalizeTickers(parsed?.tickers), useWatchlist: Boolean(parsed?.useWatchlist) };
    }
    const rawOld = localStorage.getItem(LOCAL_KEY_OLD);
    if (!rawOld) return null;
    const parsed = JSON.parse(rawOld) as unknown;
    return { tickers: normalizeTickers(parsed), useWatchlist: false };
  } catch {
    return null;
  }
}

export function setLocalTickerConfig(config: TickerBarConfig): void {
  if (typeof window === "undefined") return;
  const payload: TickerBarConfig = {
    tickers: normalizeTickers(config.tickers),
    useWatchlist: Boolean(config.useWatchlist),
  };
  localStorage.setItem(LOCAL_KEY_NEW, JSON.stringify(payload));
  // keep old key for compatibility with pages still reading old key
  localStorage.setItem(LOCAL_KEY_OLD, JSON.stringify(payload.tickers));
  window.dispatchEvent(new Event("quantivtrade-header-tickers-changed"));
}

export function clearLocalTickerConfig(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LOCAL_KEY_NEW);
  localStorage.removeItem(LOCAL_KEY_OLD);
}

export function clearLegacyHeaderTickers(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LOCAL_KEY_OLD);
}

export async function fetchTickerBarConfig(): Promise<{ config: TickerBarConfig; syncIssue: boolean }> {
  try {
    const res = await fetch("/api/ticker-bar", { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error("api failed");
    const data = (await res.json()) as { tickers?: unknown; useWatchlist?: unknown };
    const config: TickerBarConfig = {
      tickers: normalizeTickers(data?.tickers),
      useWatchlist: Boolean(data?.useWatchlist),
    };
    const out = { tickers: config.tickers.length > 0 ? config.tickers : DEFAULT_TICKERS, useWatchlist: config.useWatchlist };
    return { config: out, syncIssue: false };
  } catch {
    const local = getLocalTickerConfig();
    return { config: local ?? { tickers: DEFAULT_TICKERS, useWatchlist: false }, syncIssue: true };
  }
}

export async function saveTickerBarConfig(config: TickerBarConfig): Promise<{ syncIssue: boolean }> {
  const normalized: TickerBarConfig = {
    tickers: normalizeTickers(config.tickers),
    useWatchlist: Boolean(config.useWatchlist),
  };
  setLocalTickerConfig(normalized);
  try {
    const res = await fetch("/api/ticker-bar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(normalized),
    });
    return { syncIssue: !res.ok };
  } catch {
    return { syncIssue: true };
  }
}

