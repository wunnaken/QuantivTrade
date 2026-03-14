/**
 * Morning briefing: when to show, cache key, and cached content.
 */

export const WELCOMED_KEY = "xchange-welcomed";
export const BRIEFING_DATE_KEY = "xchange-briefing-date";
export const BRIEFING_CACHE_KEY = "xchange-briefing-cache";

export function getBriefingDate(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(BRIEFING_DATE_KEY);
}

export function setBriefingSeen(): void {
  if (typeof window === "undefined") return;
  const today = new Date().toISOString().slice(0, 10);
  window.localStorage.setItem(BRIEFING_DATE_KEY, today);
}

/** True if the user has already seen the first-time welcome animation. */
export function hasBeenWelcomed(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.localStorage.getItem(WELCOMED_KEY);
}

/** True if we should show the briefing: first visit of the day after 6 AM local, and only for users who have been welcomed. */
export function shouldShowBriefing(): boolean {
  if (typeof window === "undefined") return false;
  if (!hasBeenWelcomed()) return false;
  const now = new Date();
  const hour = now.getHours();
  if (hour < 6) return false;
  const today = now.toISOString().slice(0, 10);
  const last = window.localStorage.getItem(BRIEFING_DATE_KEY);
  return last !== today;
}

export type CachedBriefing = {
  date: string;
  fetchedAt: string;
  data: unknown;
};

export function getCachedBriefing(): CachedBriefing | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BRIEFING_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBriefing;
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date !== today) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setCachedBriefing(data: unknown): void {
  if (typeof window === "undefined") return;
  const today = new Date().toISOString().slice(0, 10);
  const payload: CachedBriefing = {
    date: today,
    fetchedAt: new Date().toISOString(),
    data,
  };
  window.localStorage.setItem(BRIEFING_CACHE_KEY, JSON.stringify(payload));
}

export function clearCachedBriefing(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(BRIEFING_CACHE_KEY);
}
