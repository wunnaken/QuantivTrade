/**
 * Daily streaks: login, journal, briefing.
 * Stored in localStorage. One day = calendar day in user's local timezone.
 */

const STORAGE_KEY = "quantivtrade-streaks";

export type StreakType = "login" | "journal" | "briefing";

export interface StreakData {
  loginStreak: number;
  journalStreak: number;
  briefingStreak: number;
  lastLogin: string; // YYYY-MM-DD
  lastJournal: string;
  lastBriefing: string;
  /** Last 7 days activity for each type: [today-6, ..., today] */
  loginHistory: boolean[];
  journalHistory: boolean[];
  briefingHistory: boolean[];
  bestLoginStreak: number;
  bestJournalStreak: number;
  bestBriefingStreak: number;
}

const DEFAULT: StreakData = {
  loginStreak: 0,
  journalStreak: 0,
  briefingStreak: 0,
  lastLogin: "",
  lastJournal: "",
  lastBriefing: "",
  loginHistory: [false, false, false, false, false, false, false],
  journalHistory: [false, false, false, false, false, false, false],
  briefingHistory: [false, false, false, false, false, false, false],
  bestLoginStreak: 0,
  bestJournalStreak: 0,
  bestBriefingStreak: 0,
};

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDate(key: string): Date | null {
  if (!key) return null;
  const d = new Date(key + "T12:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: string, b: string): number {
  const d1 = parseDate(a);
  const d2 = parseDate(b);
  if (!d1 || !d2) return 999;
  const ms = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function updateHistory(history: boolean[], markedToday: boolean): boolean[] {
  const today = todayKey();
  const out = [...history];
  // Shift: we store [day-6, day-5, ..., day0] where day0 is today
  // When we tick, we don't shift; we just set the last slot to today's activity.
  // Simpler: keep last 7 days as [today-6 ... today]. When we load, we don't have full history,
  // so we use the stored array and set index 6 to "did we do it today?"
  out[6] = markedToday;
  return out;
}

function getNextStreak(lastDate: string, currentStreak: number, today: string): number {
  if (!lastDate) return 1;
  const days = daysBetween(lastDate, today);
  if (days === 0) return currentStreak; // already did today
  if (days === 1) return currentStreak + 1; // yesterday -> increment
  return 1; // gap -> reset
}

export function loadStreaks(): StreakData {
  if (typeof window === "undefined") return { ...DEFAULT };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<StreakData>;
    return {
      ...DEFAULT,
      ...parsed,
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
  } catch {
    // ignore
  }
}

/** Call on app load to update login streak. Returns updated data and whether we crossed a milestone (7, 30, 100, 365). */
export function tickLoginStreak(): { data: StreakData; milestone: number | null } {
  const today = todayKey();
  const prev = loadStreaks();
  const newLoginStreak = getNextStreak(prev.lastLogin, prev.loginStreak, today);
  const alreadyLoggedToday = prev.lastLogin === today;

  const data: StreakData = {
    ...prev,
    loginStreak: alreadyLoggedToday ? prev.loginStreak : newLoginStreak,
    lastLogin: today,
    loginHistory: updateHistory(prev.loginHistory, true),
    bestLoginStreak: Math.max(prev.bestLoginStreak, alreadyLoggedToday ? prev.loginStreak : newLoginStreak),
  };
  saveStreaks(data);
  const streak = data.loginStreak;
  const milestone = [7, 30, 100, 365].includes(streak) ? streak : null;
  return { data, milestone };
}

/** Call when user logs a trade in journal. */
export function tickJournalStreak(): { data: StreakData; milestone: number | null } {
  const today = todayKey();
  const prev = loadStreaks();
  const newJournalStreak = getNextStreak(prev.lastJournal, prev.journalStreak, today);
  const alreadyDidToday = prev.lastJournal === today;

  const data: StreakData = {
    ...prev,
    journalStreak: alreadyDidToday ? prev.journalStreak : newJournalStreak,
    lastJournal: today,
    journalHistory: updateHistory(prev.journalHistory, true),
    bestJournalStreak: Math.max(prev.bestJournalStreak, alreadyDidToday ? prev.journalStreak : newJournalStreak),
  };
  saveStreaks(data);
  const streak = data.journalStreak;
  const milestone = [7, 30, 100, 365].includes(streak) ? streak : null;
  return { data, milestone };
}

/** Call when user reads morning briefing. */
export function tickBriefingStreak(): { data: StreakData; milestone: number | null } {
  const today = todayKey();
  const prev = loadStreaks();
  const newBriefingStreak = getNextStreak(prev.lastBriefing, prev.briefingStreak, today);
  const alreadyDidToday = prev.lastBriefing === today;

  const data: StreakData = {
    ...prev,
    briefingStreak: alreadyDidToday ? prev.briefingStreak : newBriefingStreak,
    lastBriefing: today,
    briefingHistory: updateHistory(prev.briefingHistory, true),
    bestBriefingStreak: Math.max(prev.bestBriefingStreak, alreadyDidToday ? prev.briefingStreak : newBriefingStreak),
  };
  saveStreaks(data);
  const streak = data.briefingStreak;
  const milestone = [7, 30, 100, 365].includes(streak) ? streak : null;
  return { data, milestone };
}
