/**
 * XP / Karma: localStorage cache + Supabase sync via /api/engagement.
 */

import { getRankTitle, XP_GAIN } from "./constants";

const STORAGE_KEY = "quantivtrade-xp";

export interface XPData {
  total: number;
  fromTrades: number;
  fromStreakDays: number;
  fromPosts: number;
  fromReactions: number;
}

const DEFAULT: XPData = {
  total: 0,
  fromTrades: 0,
  fromStreakDays: 0,
  fromPosts: 0,
  fromReactions: 0,
};

export function loadXP(): XPData {
  if (typeof window === "undefined") return { ...DEFAULT };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<XPData>;
    const data = { ...DEFAULT, ...parsed };
    data.total = (data.fromTrades ?? 0) + (data.fromStreakDays ?? 0) + (data.fromPosts ?? 0) + (data.fromReactions ?? 0);
    return data;
  } catch {
    return { ...DEFAULT };
  }
}

function saveXP(data: XPData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

function pushXPToDB(data: XPData): void {
  fetch("/api/engagement", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      xp_from_trades: data.fromTrades,
      xp_from_streak_days: data.fromStreakDays,
      xp_from_posts: data.fromPosts,
      xp_from_reactions: data.fromReactions,
    }),
  }).catch(() => {});
}

export function addXPFromTrade(): void {
  const prev = loadXP();
  const next: XPData = { ...prev, fromTrades: prev.fromTrades + XP_GAIN.tradeLogged, total: prev.total + XP_GAIN.tradeLogged };
  saveXP(next);
  pushXPToDB(next);
}

export function addXPFromStreakDay(): void {
  const prev = loadXP();
  const next: XPData = { ...prev, fromStreakDays: prev.fromStreakDays + XP_GAIN.streakDay, total: prev.total + XP_GAIN.streakDay };
  saveXP(next);
  pushXPToDB(next);
}

export function addXPFromPost(): void {
  const prev = loadXP();
  const next: XPData = { ...prev, fromPosts: prev.fromPosts + XP_GAIN.post, total: prev.total + XP_GAIN.post };
  saveXP(next);
  pushXPToDB(next);
}

export function addXPFromReaction(): void {
  const prev = loadXP();
  const next: XPData = { ...prev, fromReactions: prev.fromReactions + XP_GAIN.reaction, total: prev.total + XP_GAIN.reaction };
  saveXP(next);
  pushXPToDB(next);
}

/** On login, load XP from DB and update local cache. Returns updated data. */
export async function loadXPFromDB(): Promise<XPData> {
  try {
    const res = await fetch("/api/engagement", { credentials: "include" });
    if (!res.ok) return loadXP();
    const data = (await res.json()) as { engagement?: Record<string, number> | null };
    const e = data.engagement;
    if (!e) return loadXP();
    const xp: XPData = {
      fromTrades: e.xp_from_trades ?? 0,
      fromStreakDays: e.xp_from_streak_days ?? 0,
      fromPosts: e.xp_from_posts ?? 0,
      fromReactions: e.xp_from_reactions ?? 0,
      total: 0,
    };
    xp.total = xp.fromTrades + xp.fromStreakDays + xp.fromPosts + xp.fromReactions;
    saveXP(xp);
    return xp;
  } catch {
    return loadXP();
  }
}

export { getRankTitle };
