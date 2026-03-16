/**
 * Prediction Markets: virtual points, markets, bets, payouts, leaderboard.
 * All data in localStorage (no real money).
 */

const POINTS_KEY = "xchange-predict-points";
const DAILY_CLAIM_KEY = "xchange-predict-daily-claim";
const MARKETS_KEY = "xchange-predict-markets";
const NOTIFICATIONS_KEY = "xchange-predict-notifications";
const INITIAL_POINTS = 1000;
const DAILY_BONUS = 50;
const CREATOR_BONUS = 25;
const MAX_NOTIFICATIONS = 20;

export type PredictCategory = "Finance" | "Crypto" | "Macro" | "Politics" | "All";

export interface PredictMarket {
  id: string;
  question: string;
  category: PredictCategory;
  closeDate: string; // YYYY-MM-DD
  createdAt: string; // ISO
  createdBy: string;
  yesPoints: number;
  noPoints: number;
  resolutionCriteria?: string;
  initialYesPercent: number;
  status: "open" | "awaiting" | "resolved";
  outcome?: "yes" | "no"; // when resolved
  resolvedAt?: string;
  resolvedBy?: string;
  lastBetAt?: string; // ISO, for trending
}

export interface PredictBet {
  id: string;
  marketId: string;
  userId: string;
  userName: string;
  side: "yes" | "no";
  amount: number;
  oddsAtBet: number; // 0-1 probability for their side
  placedAt: string;
  status: "open" | "won" | "lost";
  payout?: number;
  resolvedAt?: string;
}

export interface PredictNotification {
  id: string;
  message: string;
  link: string;
  time: string;
  read: boolean;
}

// --- Points ---
export function getPoints(): number {
  if (typeof window === "undefined") return INITIAL_POINTS;
  try {
    const raw = window.localStorage.getItem(POINTS_KEY);
    if (raw == null || raw === "") return INITIAL_POINTS;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : INITIAL_POINTS;
  } catch {
    return INITIAL_POINTS;
  }
}

export function setPoints(value: number): void {
  if (typeof window === "undefined") return;
  const v = Math.max(0, Math.floor(value));
  window.localStorage.setItem(POINTS_KEY, String(v));
}

export function addPoints(amount: number): void {
  setPoints(getPoints() + amount);
}

export function deductPoints(amount: number): boolean {
  const cur = getPoints();
  if (amount > cur) return false;
  setPoints(cur - amount);
  return true;
}

// --- Daily bonus ---
export function getLastDailyClaim(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DAILY_CLAIM_KEY);
    if (!raw) return null;
    const t = parseInt(raw, 10);
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
}

export function canClaimDaily(): boolean {
  const last = getLastDailyClaim();
  if (!last) return true;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  return now - last >= dayMs;
}

export function claimDailyBonus(): boolean {
  if (!canClaimDaily()) return false;
  addPoints(DAILY_BONUS);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(DAILY_CLAIM_KEY, String(Date.now()));
  }
  return true;
}

// --- Probability ---
export function getProbability(yesPoints: number, noPoints: number): { yes: number; no: number } {
  const total = yesPoints + noPoints;
  if (total <= 0) return { yes: 0.5, no: 0.5 };
  return {
    yes: yesPoints / total,
    no: noPoints / total,
  };
}

// Payout: if you bet X on YES at probability p, you receive X/p when YES wins (profit = X/p - X).
export function potentialPayout(betAmount: number, oddsForSide: number): number {
  if (oddsForSide <= 0) return 0;
  return Math.floor(betAmount / oddsForSide);
}

export function profitIfWin(betAmount: number, oddsForSide: number): number {
  return potentialPayout(betAmount, oddsForSide) - betAmount;
}

// --- Markets ---
function genId(): string {
  return `pm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const PRELOADED: Omit<PredictMarket, "id" | "createdAt" | "createdBy" | "yesPoints" | "noPoints" | "status" | "lastBetAt">[] = [
  { question: "Will the S&P 500 close above 5,800 by end of March 2026?", category: "Finance", closeDate: "2026-03-31", initialYesPercent: 58 },
  { question: "Will NVDA hit $1,100 before April 2026?", category: "Finance", closeDate: "2026-04-01", initialYesPercent: 34 },
  { question: "Will Apple announce a stock split in Q2 2026?", category: "Finance", closeDate: "2026-06-30", initialYesPercent: 22 },
  { question: "Will the Fed cut rates at the March 2026 FOMC meeting?", category: "Finance", closeDate: "2026-03-20", initialYesPercent: 12 },
  { question: "Will Bitcoin reach $100K before May 1, 2026?", category: "Crypto", closeDate: "2026-05-01", initialYesPercent: 61 },
  { question: "Will Ethereum flip Bitcoin in market cap by end of 2026?", category: "Crypto", closeDate: "2026-12-31", initialYesPercent: 8 },
  { question: "Will a spot Ethereum ETF see $1B inflows in March 2026?", category: "Crypto", closeDate: "2026-03-31", initialYesPercent: 44 },
  { question: "Will US inflation (CPI) fall below 2.5% by June 2026?", category: "Macro", closeDate: "2026-06-15", initialYesPercent: 38 },
  { question: "Will the US enter a recession in 2026?", category: "Macro", closeDate: "2026-12-31", initialYesPercent: 29 },
  { question: "Will the dollar index (DXY) fall below 100 by mid 2026?", category: "Macro", closeDate: "2026-06-30", initialYesPercent: 45 },
  { question: "Will there be a US government shutdown in 2026?", category: "Politics", closeDate: "2026-12-31", initialYesPercent: 41 },
  { question: "Will the UK cut interest rates 3+ times in 2026?", category: "Politics", closeDate: "2026-12-31", initialYesPercent: 52 },
];

function pointsFromPercent(pct: number): { yes: number; no: number } {
  const yes = Math.round(pct * 100);
  const no = 100 - yes;
  return { yes: Math.max(1, yes), no: Math.max(1, no) };
}

function getDefaultMarkets(_createdBy: string): PredictMarket[] {
  const now = new Date().toISOString();
  const creator = "Xchange";
  return PRELOADED.map((p, i) => {
    const { yes, no } = pointsFromPercent(p.initialYesPercent / 100);
    return {
      id: `preload-${i}-${p.closeDate}`,
      ...p,
      createdAt: now,
      createdBy: creator,
      yesPoints: yes,
      noPoints: no,
      status: "open" as const,
      lastBetAt: undefined,
    };
  });
}

export function loadMarkets(createdBy: string): PredictMarket[] {
  if (typeof window === "undefined") return getDefaultMarkets(createdBy);
  try {
    const raw = window.localStorage.getItem(MARKETS_KEY);
    if (!raw) return getDefaultMarkets(createdBy);
    const parsed = JSON.parse(raw) as PredictMarket[];
    if (!Array.isArray(parsed) || parsed.length === 0) return getDefaultMarkets(createdBy);
    return parsed;
  } catch {
    return getDefaultMarkets(createdBy);
  }
}

export function saveMarkets(markets: PredictMarket[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MARKETS_KEY, JSON.stringify(markets));
  } catch {
    // ignore
  }
}

export function getMarket(markets: PredictMarket[], id: string): PredictMarket | undefined {
  return markets.find((m) => m.id === id);
}

export function addMarket(
  markets: PredictMarket[],
  input: {
    question: string;
    category: PredictCategory;
    closeDate: string;
    resolutionCriteria?: string;
    initialYesPercent: number;
    createdBy: string;
    createdByName: string;
  }
): { market: PredictMarket; updated: PredictMarket[] } {
  const yes = Math.round((input.initialYesPercent / 100) * 100);
  const no = 100 - yes;
  const market: PredictMarket = {
    id: genId(),
    question: input.question,
    category: input.category === "All" ? "Finance" : input.category,
    closeDate: input.closeDate,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
    yesPoints: Math.max(1, yes),
    noPoints: Math.max(1, no),
    resolutionCriteria: input.resolutionCriteria,
    initialYesPercent: input.initialYesPercent,
    status: "open",
  };
  const updated = [market, ...markets];
  saveMarkets(updated);
  return { market, updated };
}

// Bets are stored inside market or we need a separate store. For simplicity store bets in a separate key.
const BETS_KEY = "xchange-predict-bets";

export function loadBets(): PredictBet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PredictBet[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBets(bets: PredictBet[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BETS_KEY, JSON.stringify(bets));
  } catch {
    // ignore
  }
}

export function placeBet(
  markets: PredictMarket[],
  bets: PredictBet[],
  marketId: string,
  userId: string,
  userName: string,
  side: "yes" | "no",
  amount: number
): { success: boolean; updatedMarkets?: PredictMarket[]; updatedBets?: PredictBet[]; error?: string } {
  const market = markets.find((m) => m.id === marketId);
  if (!market) return { success: false, error: "Market not found" };
  if (market.status !== "open") return { success: false, error: "Market is closed" };
  if (amount < 10) return { success: false, error: "Minimum bet is 10 XP" };
  if (getPoints() < amount) return { success: false, error: "Not enough XP" };

  const { yes, no } = getProbability(market.yesPoints, market.noPoints);
  const oddsForSide = side === "yes" ? yes : no;
  if (oddsForSide <= 0) return { success: false, error: "Invalid odds" };

  if (!deductPoints(amount)) return { success: false, error: "Not enough XP" };

  const bet: PredictBet = {
    id: genId(),
    marketId,
    userId,
    userName,
    side,
    amount,
    oddsAtBet: oddsForSide,
    placedAt: new Date().toISOString(),
    status: "open",
  };
  const newBets = [bet, ...bets];

  const updatedMarkets = markets.map((m) => {
    if (m.id !== marketId) return m;
    const addYes = side === "yes" ? amount : 0;
    const addNo = side === "no" ? amount : 0;
    return {
      ...m,
      yesPoints: m.yesPoints + addYes,
      noPoints: m.noPoints + addNo,
      lastBetAt: new Date().toISOString(),
    };
  });
  saveMarkets(updatedMarkets);
  saveBets(newBets);
  return { success: true, updatedMarkets, updatedBets: newBets };
}

export function resolveMarket(
  markets: PredictMarket[],
  bets: PredictBet[],
  marketId: string,
  outcome: "yes" | "no",
  resolvedBy: string
): { updatedMarkets: PredictMarket[]; updatedBets: PredictBet[] } {
  const now = new Date().toISOString();
  const updatedMarkets = markets.map((m) => {
    if (m.id !== marketId) return m;
    return { ...m, status: "resolved", outcome, resolvedAt: now, resolvedBy };
  });

  let totalPayout = 0;
  const updatedBets = bets.map((b) => {
    if (b.marketId !== marketId || b.status !== "open") return b;
    const won = b.side === outcome;
    const payout = won ? potentialPayout(b.amount, b.oddsAtBet) : 0;
    return { ...b, status: won ? "won" : "lost", payout: won ? payout : undefined, resolvedAt: now };
  });
  updatedBets.forEach((b) => {
    if (b.marketId === marketId && b.status === "won" && b.payout != null) {
      addPoints(b.payout);
    }
  });
  saveMarkets(updatedMarkets);
  saveBets(updatedBets);
  return { updatedMarkets, updatedBets };
}

export function markMarketAwaiting(markets: PredictMarket[], marketId: string): PredictMarket[] {
  const updated = markets.map((m) => (m.id === marketId ? { ...m, status: "awaiting" as const } : m));
  saveMarkets(updated);
  return updated;
}

// --- Leaderboard (from resolved bets) ---
export function getLeaderboard(bets: PredictBet[], tab: "week" | "all"): { userId: string; userName: string; wins: number; total: number; xpEarned: number; winRate: number }[] {
  const resolved = bets.filter((b) => b.status === "won" || b.status === "lost");
  const cutoff = tab === "week" ? Date.now() - 7 * 24 * 60 * 60 * 1000 : 0;
  const consider = tab === "all" ? resolved : resolved.filter((b) => b.resolvedAt && new Date(b.resolvedAt).getTime() >= cutoff);
  const byUser = new Map<string, { wins: number; total: number; xpEarned: number; userName: string }>();
  consider.forEach((b) => {
    const cur = byUser.get(b.userId) ?? { wins: 0, total: 0, xpEarned: 0, userName: b.userName };
    cur.total += 1;
    if (b.status === "won") {
      cur.wins += 1;
      cur.xpEarned += (b.payout ?? 0) - b.amount;
    }
    byUser.set(b.userId, cur);
  });
  return Array.from(byUser.entries())
    .map(([userId, v]) => ({ userId, userName: v.userName, wins: v.wins, total: v.total, xpEarned: v.xpEarned, winRate: v.total > 0 ? (v.wins / v.total) * 100 : 0 }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.xpEarned - a.xpEarned)
    .slice(0, 10);
}

// Simpler leaderboard: by total XP earned from predictions (all time) and win rate. We don't have resolvedAt on bet; when we resolve we could add it. For now leaderboard uses all resolved bets.
export function getLeaderboardSimple(bets: PredictBet[]): { userName: string; wins: number; total: number; xpEarned: number; winRate: number }[] {
  const resolved = bets.filter((b) => b.status === "won" || b.status === "lost");
  const byUser = new Map<string, { wins: number; total: number; xpEarned: number; userName: string }>();
  resolved.forEach((b) => {
    const cur = byUser.get(b.userId) ?? { wins: 0, total: 0, xpEarned: 0, userName: b.userName };
    cur.total += 1;
    if (b.status === "won") {
      cur.wins += 1;
      cur.xpEarned += (b.payout ?? 0) - b.amount;
    }
    byUser.set(b.userId, cur);
  });
  return Array.from(byUser.values())
    .filter((v) => v.total > 0)
    .map((v) => ({ ...v, winRate: (v.wins / v.total) * 100 }))
    .sort((a, b) => b.xpEarned - a.xpEarned)
    .slice(0, 10);
}

// --- Notifications ---
export function addPredictNotification(message: string, link: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_KEY);
    const list: PredictNotification[] = raw ? JSON.parse(raw) : [];
    list.unshift({
      id: genId(),
      message,
      link,
      time: new Date().toISOString(),
      read: false,
    });
    window.localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(list.slice(0, MAX_NOTIFICATIONS)));
  } catch {
    // ignore
  }
}

export function getPredictNotifications(): PredictNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function markPredictNotificationsRead(): void {
  if (typeof window === "undefined") return;
  try {
    const list = getPredictNotifications().map((n) => ({ ...n, read: true }));
    window.localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export const CREATOR_BONUS_XP = CREATOR_BONUS;
