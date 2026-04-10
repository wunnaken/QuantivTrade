/**
 * Daily streaks: login, journal, briefing.
 * localStorage cache + Supabase sync via /api/engagement.
 */

const STORAGE_KEY = "quantivtrade-streaks";

export type StreakType = "login" | "journal" | "briefing";

export interface StreakData {
  loginStreak: number;
  journalStreak: number;
  briefingStreak: number;
  lastLogin: string;
  lastJournal: string;
  lastBriefing: string;
  loginHistory: boolean[];
  journalHistory: boolean[];
  briefingHistory: boolean[];
  bestLoginStreak: number;
  bestJournalStreak: number;
  bestBriefingStreak: number;
}

const DEFAULT: StreakData = {
  loginStreak: 0, journalStreak: 0, briefingStreak: 0,
  lastLogin: "", lastJournal: "", lastBriefing: "",
  loginHistory: [false, false, false, false, false, false, false],
  journalHistory: [false, false, false, false, false, false, false],
  briefingHistory: [false, false, false, false, false, false, false],
  bestLoginStreak: 0, bestJournalStreak: 0, bestBriefingStreak: 0,
};

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDate(key: string): Date | null {
  if (!key) return null;
  const d = new Date(key + "T12:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: string, b: string): number {
  const d1 = parseDate(a), d2 = parseDate(b);
  if (!d1 || !d2) return 999;
  return Math.floor(Math.abs(d2.getTime() - d1.getTime()) / (24 * 60 * 60 * 1000));
}

function updateHistory(history: boolean[], markedToday: boolean): boolean[] {
  const out = [...history];
  out[6] = markedToday;
  return out;
}

function getNextStreak(lastDate: string, currentStreak: number, today: string): number {
  if (!lastDate) return 1;
  const days = daysBetween(lastDate, today);
  if (days === 0) return currentStreak;
  if (days === 1) return currentStreak + 1;
  return 1;
}

export function loadStreaks(): StreakData {
  if (typeof window === "undefined") return { ...DEFAULT };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<StreakData>;
    return {
      ...DEFAULT, ...parsed,
      loginHistory: Array.isArray(parsed.loginHistory) ? parsed.loginHistory : DEFAULT.loginHistory,
      journalHistory: Array.isArray(parsed.journalHistory) ? parsed.journalHistory : DEFAULT.journalHistory,
      briefingHistory: Array.isArray(parsed.briefingHistory) ? parsed.briefingHistory : DEFAULT.briefingHistory,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveStreaks(data: StreakData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
  pushStreaksToDB(data);
}

function pushStreaksToDB(data: StreakData): void {
  fetch("/api/engagement", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      login_streak: data.loginStreak,
      journal_streak: data.journalStreak,
      briefing_streak: data.briefingStreak,
      last_login: data.lastLogin,
      last_journal: data.lastJournal,
      last_briefing: data.lastBriefing,
      best_login_streak: data.bestLoginStreak,
      best_journal_streak: data.bestJournalStreak,
      best_briefing_streak: data.bestBriefingStreak,
      login_history: data.loginHistory,
      journal_history: data.journalHistory,
      briefing_history: data.briefingHistory,
    }),
  }).catch(() => {});
}

export function tickLoginStreak(): { data: StreakData; milestone: number | null } {
  const today = todayKey();
  const prev = loadStreaks();
  const newStreak = getNextStreak(prev.lastLogin, prev.loginStreak, today);
  const alreadyToday = prev.lastLogin === today;
  const data: StreakData = {
    ...prev,
    loginStreak: alreadyToday ? prev.loginStreak : newStreak,
    lastLogin: today,
    loginHistory: updateHistory(prev.loginHistory, true),
    bestLoginStreak: Math.max(prev.bestLoginStreak, alreadyToday ? prev.loginStreak : newStreak),
  };
  saveStreaks(data);
  const milestone = [7, 30, 100, 365].includes(data.loginStreak) ? data.loginStreak : null;
  return { data, milestone };
}

export function tickJournalStreak(): { data: StreakData; milestone: number | null } {
  const today = todayKey();
  const prev = loadStreaks();
  const newStreak = getNextStreak(prev.lastJournal, prev.journalStreak, today);
  const alreadyToday = prev.lastJournal === today;
  const data: StreakData = {
    ...prev,
    journalStreak: alreadyToday ? prev.journalStreak : newStreak,
    lastJournal: today,
    journalHistory: updateHistory(prev.journalHistory, true),
    bestJournalStreak: Math.max(prev.bestJournalStreak, alreadyToday ? prev.journalStreak : newStreak),
  };
  saveStreaks(data);
  const milestone = [7, 30, 100, 365].includes(data.journalStreak) ? data.journalStreak : null;
  return { data, milestone };
}

export function tickBriefingStreak(): { data: StreakData; milestone: number | null } {
  const today = todayKey();
  const prev = loadStreaks();
  const newStreak = getNextStreak(prev.lastBriefing, prev.briefingStreak, today);
  const alreadyToday = prev.lastBriefing === today;
  const data: StreakData = {
    ...prev,
    briefingStreak: alreadyToday ? prev.briefingStreak : newStreak,
    lastBriefing: today,
    briefingHistory: updateHistory(prev.briefingHistory, true),
    bestBriefingStreak: Math.max(prev.bestBriefingStreak, alreadyToday ? prev.briefingStreak : newStreak),
  };
  saveStreaks(data);
  const milestone = [7, 30, 100, 365].includes(data.briefingStreak) ? data.briefingStreak : null;
  return { data, milestone };
}

/** On login, load streaks from DB and update local cache. */
export async function loadStreaksFromDB(): Promise<StreakData> {
  try {
    const res = await fetch("/api/engagement", { credentials: "include" });
    if (!res.ok) return loadStreaks();
    const json = (await res.json()) as { engagement?: Record<string, unknown> | null };
    const e = json.engagement;
    if (!e) return loadStreaks();
    const data: StreakData = {
      loginStreak: (e.login_streak as number) ?? 0,
      journalStreak: (e.journal_streak as number) ?? 0,
      briefingStreak: (e.briefing_streak as number) ?? 0,
      lastLogin: (e.last_login as string) ?? "",
      lastJournal: (e.last_journal as string) ?? "",
      lastBriefing: (e.last_briefing as string) ?? "",
      bestLoginStreak: (e.best_login_streak as number) ?? 0,
      bestJournalStreak: (e.best_journal_streak as number) ?? 0,
      bestBriefingStreak: (e.best_briefing_streak as number) ?? 0,
      loginHistory: Array.isArray(e.login_history) ? (e.login_history as boolean[]) : DEFAULT.loginHistory,
      journalHistory: Array.isArray(e.journal_history) ? (e.journal_history as boolean[]) : DEFAULT.journalHistory,
      briefingHistory: Array.isArray(e.briefing_history) ? (e.briefing_history as boolean[]) : DEFAULT.briefingHistory,
    };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    return data;
  } catch {
    return loadStreaks();
  }
}
