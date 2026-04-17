/**
 * In-memory LRU for FRED economic-events results, keyed by `${from}-${to}`.
 *
 * Why: fetchEconomicEvents makes one FRED `releases/dates` call plus N
 * per-series `series/observations` calls. Even with Next's per-route
 * revalidate, the cold path is ~500ms-1s. This LRU sits in front so repeat
 * lookups (e.g. user paging back to a week they already viewed, or a second
 * tab) hit warm memory in <1ms.
 *
 * Server-only (single-process). For multi-instance Vercel, each lambda
 * instance has its own copy — this is fine for our scale and intentional
 * (no shared cache to invalidate).
 */

import type { EconomicItem } from "./types";

type Entry = {
  data: { economic: EconomicItem[]; dataSource: string; error?: string };
  at: number;
};

const MAX_ENTRIES = 64;
const TTL_MS = 5 * 60 * 1000; // 5 minutes — matches the FRED revalidate window

const cache = new Map<string, Entry>();

export function getCachedEconomic(key: string): Entry["data"] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > TTL_MS) {
    cache.delete(key);
    return null;
  }
  // LRU bump: re-insert to mark as most recently used
  cache.delete(key);
  cache.set(key, entry);
  return entry.data;
}

export function setCachedEconomic(key: string, data: Entry["data"]): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, { data, at: Date.now() });
  if (cache.size > MAX_ENTRIES) {
    // Evict oldest (first inserted)
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}
