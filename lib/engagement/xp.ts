/**
 * XP / Karma from localStorage activity: journal, streaks, posts, reactions.
 */

import { getRankTitle, XP_GAIN } from "./constants";

const STORAGE_KEY = "xchange-xp";

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
    data.total =
      (data.fromTrades ?? 0) + (data.fromStreakDays ?? 0) + (data.fromPosts ?? 0) + (data.fromReactions ?? 0);
    return data;
  } catch {
    return { ...DEFAULT };
  }
}

function saveXP(data: XPData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function addXPFromTrade(): void {
  const prev = loadXP();
  const next: XPData = {
    ...prev,
    fromTrades: prev.fromTrades + XP_GAIN.tradeLogged,
    total: prev.total + XP_GAIN.tradeLogged,
  };
  saveXP(next);
}

export function addXPFromStreakDay(): void {
  const prev = loadXP();
  const next: XPData = {
    ...prev,
    fromStreakDays: prev.fromStreakDays + XP_GAIN.streakDay,
    total: prev.total + XP_GAIN.streakDay,
  };
  saveXP(next);
}

export function addXPFromPost(): void {
  const prev = loadXP();
  const next: XPData = {
    ...prev,
    fromPosts: prev.fromPosts + XP_GAIN.post,
    total: prev.total + XP_GAIN.post,
  };
  saveXP(next);
}

export function addXPFromReaction(): void {
  const prev = loadXP();
  const next: XPData = {
    ...prev,
    fromReactions: prev.fromReactions + XP_GAIN.reaction,
    total: prev.total + XP_GAIN.reaction,
  };
  saveXP(next);
}

export { getRankTitle };
