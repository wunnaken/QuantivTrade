/**
 * Trade journal: types and localStorage persistence.
 * Database integration later.
 */

export const JOURNAL_STORAGE_KEY = "quantivtrade-journal-trades";

export type Direction = "LONG" | "SHORT";

export const STRATEGIES = [
  "Momentum",
  "Breakout",
  "Swing",
  "Scalp",
  "Buy & Hold",
  "Mean Reversion",
  "News Play",
  "Options",
  "Other",
] as const;

export type Strategy = (typeof STRATEGIES)[number];

export type JournalTrade = {
  id: string;
  asset: string;
  direction: Direction;
  entryPrice: number;
  exitPrice: number | null;
  entryDate: string; // ISO
  exitDate: string | null;
  positionSize: number;
  strategy: Strategy;
  notes: string;
  tags: string[];
  optionPl: number | null; // optional options P/L (e.g. premium P/L)
  /** When set, overrides computed P&L (e.g. for options). Persisted to Supabase as pnl_dollars/pnl_percent. */
  pnlDollars?: number | null;
  pnlPercent?: number | null;
  createdAt: string; // ISO
};

export type JournalTradeInput = Omit<JournalTrade, "id" | "createdAt"> & {
  id?: string;
  createdAt?: string;
};

function generateId(): string {
  return `tj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getTrades(): JournalTrade[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as (JournalTrade & { optionPl?: number | null })[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t) => ({ ...t, optionPl: t.optionPl ?? null }));
  } catch {
    return [];
  }
}

export function saveTrades(trades: JournalTrade[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(trades));
}

export function addTrade(input: JournalTradeInput): JournalTrade {
  const trades = getTrades();
  const trade: JournalTrade = {
    ...input,
    id: input.id ?? generateId(),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  trades.unshift(trade);
  saveTrades(trades);
  return trade;
}

export function updateTrade(id: string, updates: Partial<JournalTradeInput>): JournalTrade | null {
  const trades = getTrades();
  const i = trades.findIndex((t) => t.id === id);
  if (i === -1) return null;
  trades[i] = { ...trades[i], ...updates };
  saveTrades(trades);
  return trades[i];
}

export function deleteTrade(id: string): boolean {
  const trades = getTrades().filter((t) => t.id !== id);
  saveTrades(trades);
  return true;
}

export function computePnL(t: JournalTrade): { pnlDollars: number; pnlPercent: number; optionPl: number | null } | null {
  const cost = t.entryPrice * t.positionSize;
  if (t.pnlDollars != null || t.pnlPercent != null) {
    const pnlDollars = t.pnlDollars ?? (typeof t.pnlPercent === "number" && cost !== 0 ? (t.pnlPercent / 100) * cost : 0);
    const pnlPercent = t.pnlPercent ?? (cost !== 0 ? (pnlDollars / cost) * 100 : 0);
    return { pnlDollars, pnlPercent, optionPl: t.optionPl ?? null };
  }
  const mult = t.direction === "LONG" ? 1 : -1;
  let pnlDollars = 0;
  let pnlPercent = 0;
  if (t.exitPrice != null) {
    pnlDollars = (t.exitPrice - t.entryPrice) * mult * t.positionSize;
    pnlPercent = ((t.exitPrice - t.entryPrice) / t.entryPrice) * 100 * mult;
  }
  const optionPl = t.optionPl ?? null;
  if (optionPl != null) pnlDollars += optionPl;
  if (t.exitPrice == null && optionPl == null) return null;
  return { pnlDollars, pnlPercent, optionPl };
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatPercent(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
