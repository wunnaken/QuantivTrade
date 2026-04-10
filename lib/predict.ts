/**
 * Prediction Markets: virtual points, markets, bets, payouts, leaderboard.
 * localStorage cache + Supabase sync via /api/predict/user.
 */

const POINTS_KEY = "quantivtrade-predict-points";
const DAILY_CLAIM_KEY = "quantivtrade-predict-daily-claim";
const MARKETS_KEY = "quantivtrade-predict-markets";
const NOTIFICATIONS_KEY = "quantivtrade-predict-notifications";
const INITIAL_POINTS = 1000;
const DAILY_BONUS = 50;
const CREATOR_BONUS = 25;
const MAX_NOTIFICATIONS = 20;

export type PredictCategory = "Finance" | "Crypto" | "Macro" | "Politics" | "All";

export interface PredictMarket {
  id: string;
  question: string;
  category: PredictCategory;
  closeDate: string;
  createdAt: string;
  createdBy: string;
  yesPoints: number;
  noPoints: number;
  resolutionCriteria?: string;
  initialYesPercent: number;
  status: "open" | "awaiting" | "resolved";
  outcome?: "yes" | "no";
  resolvedAt?: string;
  resolvedBy?: string;
  lastBetAt?: string;
}

export interface PredictBet {
  id: string;
  marketId: string;
  userId: string;
  userName: string;
  side: "yes" | "no";
  amount: number;
  oddsAtBet: number;
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

// ── Points ──────────────────────────────────────────────────────────────────

export function getPoints(): number {
  if (typeof window === "undefined") return INITIAL_POINTS;
  try {
    const raw = window.localStorage.getItem(POINTS_KEY);
    if (raw == null || raw === "") return INITIAL_POINTS;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : INITIAL_POINTS;
  } catch { return INITIAL_POINTS; }
}

export function setPoints(value: number): void {
  if (typeof window === "undefined") return;
  const v = Math.max(0, Math.floor(value));
  window.localStorage.setItem(POINTS_KEY, String(v));
}

export function addPoints(amount: number): void { setPoints(getPoints() + amount); }

export function deductPoints(amount: number): boolean {
  const cur = getPoints();
  if (amount > cur) return false;
  setPoints(cur - amount);
  return true;
}

// ── Daily bonus ──────────────────────────────────────────────────────────────

export function getLastDailyClaim(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DAILY_CLAIM_KEY);
    if (!raw) return null;
    const t = parseInt(raw, 10);
    return Number.isFinite(t) ? t : null;
  } catch { return null; }
}

export function canClaimDaily(): boolean {
  const last = getLastDailyClaim();
  if (!last) return true;
  return Date.now() - last >= 24 * 60 * 60 * 1000;
}

export function claimDailyBonus(): boolean {
  if (!canClaimDaily()) return false;
  addPoints(DAILY_BONUS);
  const now = Date.now();
  if (typeof window !== "undefined") window.localStorage.setItem(DAILY_CLAIM_KEY, String(now));
  // Sync to DB
  fetch("/api/predict/user", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ points: getPoints(), last_daily_claim: now }),
  }).catch(() => {});
  return true;
}

// ── Probability ──────────────────────────────────────────────────────────────

export function getProbability(yesPoints: number, noPoints: number): { yes: number; no: number } {
  const total = yesPoints + noPoints;
  if (total <= 0) return { yes: 0.5, no: 0.5 };
  return { yes: yesPoints / total, no: noPoints / total };
}

export function potentialPayout(betAmount: number, oddsForSide: number): number {
  if (oddsForSide <= 0) return 0;
  return Math.floor(betAmount / oddsForSide);
}

export function profitIfWin(betAmount: number, oddsForSide: number): number {
  return potentialPayout(betAmount, oddsForSide) - betAmount;
}

// ── Markets ──────────────────────────────────────────────────────────────────

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

function getDefaultMarkets(): PredictMarket[] {
  const now = new Date().toISOString();
  return PRELOADED.map((p, i) => {
    const { yes, no } = pointsFromPercent(p.initialYesPercent / 100);
    return {
      id: `preload-${i}-${p.closeDate}`,
      ...p,
      createdAt: now,
      createdBy: "QuantivTrade",
      yesPoints: yes,
      noPoints: no,
      status: "open" as const,
    };
  });
}

/** Map DB row → PredictMarket */
function dbToMarket(row: Record<string, unknown>): PredictMarket {
  return {
    id: String(row.id),
    question: String(row.question ?? ""),
    category: (row.category as PredictCategory) ?? "Finance",
    closeDate: String(row.close_date ?? ""),
    createdAt: String(row.created_at ?? ""),
    createdBy: String(row.created_by ?? ""),
    yesPoints: Number(row.yes_points ?? 50),
    noPoints: Number(row.no_points ?? 50),
    resolutionCriteria: row.resolution_criteria ? String(row.resolution_criteria) : undefined,
    initialYesPercent: Number(row.initial_yes_percent ?? 50),
    status: (row.status as PredictMarket["status"]) ?? "open",
    outcome: row.outcome ? (row.outcome as "yes" | "no") : undefined,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : undefined,
    resolvedBy: row.resolved_by ? String(row.resolved_by) : undefined,
    lastBetAt: row.last_bet_at ? String(row.last_bet_at) : undefined,
  };
}

/** Map DB row → PredictBet */
function dbToBet(row: Record<string, unknown>): PredictBet {
  return {
    id: String(row.id),
    marketId: String(row.market_id ?? ""),
    userId: String(row.user_id ?? ""),
    userName: String(row.user_name ?? ""),
    side: (row.side as "yes" | "no") ?? "yes",
    amount: Number(row.amount ?? 0),
    oddsAtBet: Number(row.odds_at_bet ?? 0.5),
    placedAt: String(row.placed_at ?? ""),
    status: (row.status as PredictBet["status"]) ?? "open",
    payout: row.payout != null ? Number(row.payout) : undefined,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : undefined,
  };
}

export function loadMarkets(createdBy: string): PredictMarket[] {
  if (typeof window === "undefined") return getDefaultMarkets();
  try {
    const raw = window.localStorage.getItem(MARKETS_KEY);
    if (!raw) return getDefaultMarkets();
    const parsed = JSON.parse(raw) as PredictMarket[];
    if (!Array.isArray(parsed) || parsed.length === 0) return getDefaultMarkets();
    return parsed;
  } catch { return getDefaultMarkets(); }
}

export function saveMarkets(markets: PredictMarket[]): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(MARKETS_KEY, JSON.stringify(markets)); } catch { /* ignore */ }
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
  // Persist to DB
  fetch("/api/predict/user", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      update_market: {
        id: market.id,
        yes_points: market.yesPoints,
        no_points: market.noPoints,
        status: market.status,
      },
    }),
  }).catch(() => {});
  return { market, updated };
}

// ── Bets ─────────────────────────────────────────────────────────────────────

const BETS_KEY = "quantivtrade-predict-bets";

export function loadBets(): PredictBet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PredictBet[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveBets(bets: PredictBet[]): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(BETS_KEY, JSON.stringify(bets)); } catch { /* ignore */ }
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
    id: genId(), marketId, userId, userName, side, amount,
    oddsAtBet: oddsForSide, placedAt: new Date().toISOString(), status: "open",
  };
  const newBets = [bet, ...bets];
  const updatedMarkets = markets.map((m) => {
    if (m.id !== marketId) return m;
    return {
      ...m,
      yesPoints: m.yesPoints + (side === "yes" ? amount : 0),
      noPoints: m.noPoints + (side === "no" ? amount : 0),
      lastBetAt: new Date().toISOString(),
    };
  });
  saveMarkets(updatedMarkets);
  saveBets(newBets);

  const updatedMarket = updatedMarkets.find((m) => m.id === marketId)!;
  // Sync to DB
  fetch("/api/predict/user", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      points: getPoints(),
      bet: { id: bet.id, market_id: bet.marketId, user_name: bet.userName, side: bet.side, amount: bet.amount, odds_at_bet: bet.oddsAtBet },
      update_market: { id: marketId, yes_points: updatedMarket.yesPoints, no_points: updatedMarket.noPoints, last_bet_at: updatedMarket.lastBetAt },
    }),
  }).catch(() => {});

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
  const updatedMarkets = markets.map((m) =>
    m.id !== marketId ? m : { ...m, status: "resolved" as const, outcome, resolvedAt: now, resolvedBy }
  );
  const updatedBets = bets.map((b) => {
    if (b.marketId !== marketId || b.status !== "open") return b;
    const won = b.side === outcome;
    const payout = won ? potentialPayout(b.amount, b.oddsAtBet) : 0;
    return { ...b, status: (won ? "won" : "lost") as "won" | "lost", payout: won ? payout : undefined, resolvedAt: now };
  });
  updatedBets.forEach((b) => {
    if (b.marketId === marketId && b.status === "won" && b.payout != null) addPoints(b.payout);
  });
  saveMarkets(updatedMarkets);
  saveBets(updatedBets);

  // Sync to DB
  fetch("/api/predict/user", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      points: getPoints(),
      update_market: { id: marketId, status: "resolved", outcome, resolved_at: now, resolved_by: resolvedBy },
      resolve_bets: { market_id: marketId, outcome, resolved_at: now },
    }),
  }).catch(() => {});

  return { updatedMarkets, updatedBets };
}

export function markMarketAwaiting(markets: PredictMarket[], marketId: string): PredictMarket[] {
  const updated = markets.map((m) => (m.id === marketId ? { ...m, status: "awaiting" as const } : m));
  saveMarkets(updated);
  fetch("/api/predict/user", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ update_market: { id: marketId, status: "awaiting" } }),
  }).catch(() => {});
  return updated;
}

/** On login, load state from DB and update local cache. */
export async function loadPredictFromDB(): Promise<{ markets: PredictMarket[]; bets: PredictBet[]; points: number }> {
  const local = { markets: loadMarkets(""), bets: loadBets(), points: getPoints() };
  try {
    const res = await fetch("/api/predict/user", { credentials: "include" });
    if (!res.ok) return local;
    const data = await res.json() as {
      state?: { points?: number; last_daily_claim?: number } | null;
      bets?: Record<string, unknown>[];
      markets?: Record<string, unknown>[];
    };
    if (data.state?.points !== undefined) {
      setPoints(data.state.points);
      if (data.state.last_daily_claim != null) {
        window.localStorage.setItem(DAILY_CLAIM_KEY, String(data.state.last_daily_claim));
      }
    }
    const dbMarkets = (data.markets ?? []).map(dbToMarket);
    const dbBets = (data.bets ?? []).map(dbToBet);
    if (dbMarkets.length > 0) saveMarkets(dbMarkets);
    if (dbBets.length > 0) saveBets(dbBets);
    return {
      markets: dbMarkets.length > 0 ? dbMarkets : local.markets,
      bets: dbBets.length > 0 ? dbBets : local.bets,
      points: data.state?.points ?? local.points,
    };
  } catch { return local; }
}

// ── Leaderboard ──────────────────────────────────────────────────────────────

export function getLeaderboard(
  bets: PredictBet[],
  tab: "week" | "all"
): { userId: string; userName: string; wins: number; total: number; xpEarned: number; winRate: number }[] {
  const resolved = bets.filter((b) => b.status === "won" || b.status === "lost");
  const cutoff = tab === "week" ? Date.now() - 7 * 24 * 60 * 60 * 1000 : 0;
  const consider = tab === "all" ? resolved : resolved.filter((b) => b.resolvedAt && new Date(b.resolvedAt).getTime() >= cutoff);
  const byUser = new Map<string, { wins: number; total: number; xpEarned: number; userName: string }>();
  consider.forEach((b) => {
    const cur = byUser.get(b.userId) ?? { wins: 0, total: 0, xpEarned: 0, userName: b.userName };
    cur.total += 1;
    if (b.status === "won") { cur.wins += 1; cur.xpEarned += (b.payout ?? 0) - b.amount; }
    byUser.set(b.userId, cur);
  });
  return Array.from(byUser.entries())
    .map(([userId, v]) => ({ userId, userName: v.userName, wins: v.wins, total: v.total, xpEarned: v.xpEarned, winRate: v.total > 0 ? (v.wins / v.total) * 100 : 0 }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.xpEarned - a.xpEarned)
    .slice(0, 10);
}

export function getLeaderboardSimple(
  bets: PredictBet[]
): { userName: string; wins: number; total: number; xpEarned: number; winRate: number }[] {
  const resolved = bets.filter((b) => b.status === "won" || b.status === "lost");
  const byUser = new Map<string, { wins: number; total: number; xpEarned: number; userName: string }>();
  resolved.forEach((b) => {
    const cur = byUser.get(b.userId) ?? { wins: 0, total: 0, xpEarned: 0, userName: b.userName };
    cur.total += 1;
    if (b.status === "won") { cur.wins += 1; cur.xpEarned += (b.payout ?? 0) - b.amount; }
    byUser.set(b.userId, cur);
  });
  return Array.from(byUser.values())
    .filter((v) => v.total > 0)
    .map((v) => ({ ...v, winRate: (v.wins / v.total) * 100 }))
    .sort((a, b) => b.xpEarned - a.xpEarned)
    .slice(0, 10);
}

// ── Notifications ─────────────────────────────────────────────────────────────

export function addPredictNotification(message: string, link: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_KEY);
    const list: PredictNotification[] = raw ? JSON.parse(raw) : [];
    list.unshift({ id: genId(), message, link, time: new Date().toISOString(), read: false });
    window.localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(list.slice(0, MAX_NOTIFICATIONS)));
  } catch { /* ignore */ }
}

export function getPredictNotifications(): PredictNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function markPredictNotificationsRead(): void {
  if (typeof window === "undefined") return;
  try {
    const list = getPredictNotifications().map((n) => ({ ...n, read: true }));
    window.localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

export const CREATOR_BONUS_XP = CREATOR_BONUS;
