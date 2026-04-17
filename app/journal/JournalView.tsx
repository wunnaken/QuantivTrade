"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteTrade,
  formatCurrency,
  formatPercent,
  getTrades,
  computePnL,
  JOURNAL_STORAGE_KEY,
  type JournalTrade,
} from "../../lib/journal";
import { useToast } from "../../components/ToastContext";
import { LogTradeModal } from "./components/LogTradeModal";
import { TradePerformanceCalendar } from "./components/TradePerformanceCalendar";
import type { JournalInsightsResponse } from "../api/journal-insights/route";
import { TypewriterText } from "../../components/TypewriterText";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";

const BG = "var(--app-bg)";
const GRID_COLOR = "#1a2535";
const MAX_TRADES_PER_DAY = 15;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type TabId = "trades" | "analytics" | "insights";

/** Tolerant JSON parse for the insights stream:
 *   - strips ```json``` markdown fences
 *   - trims any text before the first `{` and after the last `}`
 *   - falls back to extracting balanced braces if the model emitted prose
 *   Returns null on unrecoverable garbage (caller surfaces a friendly error). */
function parseInsightsJson(raw: string): JournalInsightsResponse | null {
  if (!raw) return null;
  let text = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  text = text.slice(first, last + 1);
  try {
    return JSON.parse(text) as JournalInsightsResponse;
  } catch {
    return null;
  }
}

function getCalendarDays(year: number, month: number): { date: string; day: number; isCurrentMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const out: { date: string; day: number; isCurrentMonth: boolean }[] = [];
  for (let i = 0; i < startPad; i++) {
    const d = new Date(year, month, -startPad + i + 1);
    out.push({
      date: d.toISOString().slice(0, 10),
      day: d.getDate(),
      isCurrentMonth: false,
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    out.push({ date: dateStr, day: d, isCurrentMonth: true });
  }
  const remainder = out.length % 7;
  if (remainder !== 0) {
    const nextMonth = month + 1;
    const nextYear = nextMonth > 11 ? year + 1 : year;
    const nextM = nextMonth % 12;
    for (let d = 1; d <= 7 - remainder; d++) {
      const dateStr = `${nextYear}-${String(nextM + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      out.push({ date: dateStr, day: d, isCurrentMonth: false });
    }
  }
  return out;
}

export default function JournalView() {
  const [activeTab, setActiveTab] = useState<TabId>("trades");
  const [trades, setTrades] = useState<JournalTrade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(true);
  const [failedLocalTrades, setFailedLocalTrades] = useState<JournalTrade[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<JournalTrade | null>(null);
  const [insights, setInsights] = useState<JournalInsightsResponse | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [insightsStreaming, setInsightsStreaming] = useState(false);
  const [insightsProgress, setInsightsProgress] = useState(0);
  const [animateInsights, setAnimateInsights] = useState(false);
  // Insights cache lives only in memory: it's recomputed whenever a trade is
  // written (logged / edited / deleted) and held until the user navigates away.
  const insightsCacheRef = useRef<JournalInsightsResponse | null>(null);
  // Abort handle so leaving the Insights tab cancels any in-flight request.
  const insightsAbortRef = useRef<AbortController | null>(null);
  const migratedRef = useRef(false);
  const toast = useToast();
  const [openPrices, setOpenPrices] = useState<Record<string, number>>({});

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // Filters
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "closed">("all");
  const [filterAsset, setFilterAsset] = useState("");
  const [filterDirection, setFilterDirection] = useState<"all" | "LONG" | "SHORT">("all");
  const [filterOutcome, setFilterOutcome] = useState<"all" | "winners" | "losers">("all");
  // sortBy is fixed for now — kept as a const so the existing filteredTrades
  // memo doesn't need to change when we add a sort UI later.
  const sortBy: "date" | "pnl" | "asset" = "date";

  const loadTrades = useCallback(async () => {
    setTradesLoading(true);
    try {
      const res = await fetch("/api/trades", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { trades: JournalTrade[] };
        const list = Array.isArray(data.trades) ? data.trades : [];
        setTrades(list);
        if (!migratedRef.current && typeof window !== "undefined") {
          migratedRef.current = true;
          const raw = window.localStorage.getItem(JOURNAL_STORAGE_KEY);
          if (raw) {
            try {
              const local = JSON.parse(raw) as JournalTrade[];
              if (Array.isArray(local) && local.length > 0) {
                // Parallel migration — old code awaited each POST sequentially,
                // which could take 30+ seconds for users with many local trades.
                const results = await Promise.all(
                  local.map((t) => {
                    const body = {
                      asset: t.asset,
                      direction: t.direction,
                      entry_price: t.entryPrice,
                      exit_price: t.exitPrice,
                      position_size: t.positionSize,
                      entry_date: t.entryDate.slice(0, 10),
                      exit_date: t.exitDate ? t.exitDate.slice(0, 10) : null,
                      strategy: t.strategy,
                      notes: t.notes,
                      tags: t.tags,
                    };
                    return fetch("/api/trades", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(body),
                    }).then((r) => r.ok).catch(() => false);
                  })
                );
                const migrated = results.filter(Boolean).length;
                window.localStorage.removeItem(JOURNAL_STORAGE_KEY);
                if (migrated > 0) {
                  const refetch = await fetch("/api/trades", { cache: "no-store" });
                  if (refetch.ok) {
                    const d = (await refetch.json()) as { trades: JournalTrade[] };
                    setTrades(Array.isArray(d.trades) ? d.trades : []);
                  }
                }
              }
            } catch {
              // keep localStorage as fallback
            }
          }
        }
      } else {
        const local = getTrades();
        setTrades(local);
      }
    } catch {
      setTrades(getTrades());
    } finally {
      setTradesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  const displayTrades = useMemo(() => {
    const byId = new Map<string, JournalTrade>();
    trades.forEach((t) => byId.set(t.id, t));
    failedLocalTrades.forEach((t) => byId.set(t.id, t));
    return Array.from(byId.values()).sort((a, b) => (b.entryDate + b.id).localeCompare(a.entryDate + a.id));
  }, [trades, failedLocalTrades]);

  const openTradeAssets = useMemo(
    () => [...new Set(displayTrades.filter((t) => t.exitPrice == null).map((t) => t.asset.trim().toUpperCase()).filter(Boolean))].slice(0, 15),
    [displayTrades]
  );
  // Use a stable string key so the effect only re-fires when the *set* of open
  // tickers actually changes (avoiding the "complex expression in deps" lint).
  const openTradeAssetsKey = openTradeAssets.join(",");
  useEffect(() => {
    const symbols = openTradeAssetsKey ? openTradeAssetsKey.split(",") : [];
    if (symbols.length === 0) {
      setOpenPrices({});
      return;
    }
    const map: Record<string, number> = {};
    let done = 0;
    symbols.forEach((symbol) => {
      fetch(`/api/ticker-quote?ticker=${encodeURIComponent(symbol)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (d?.price != null) map[symbol] = Number(d.price);
        })
        .finally(() => {
          done++;
          if (done === symbols.length) setOpenPrices((prev) => ({ ...prev, ...map }));
        });
    });
  }, [openTradeAssetsKey]);

  const filteredTrades = useMemo(() => {
    let list = [...displayTrades];
    if (filterStatus === "open") list = list.filter((t) => t.exitPrice == null);
    if (filterStatus === "closed") list = list.filter((t) => t.exitPrice != null);
    if (filterAsset.trim()) {
      const q = filterAsset.trim().toLowerCase();
      list = list.filter((t) => t.asset.toLowerCase().includes(q));
    }
    if (filterDirection !== "all") list = list.filter((t) => t.direction === filterDirection);
    if (filterOutcome !== "all" && filterStatus !== "open") {
      list = list.filter((t) => {
        const pnl = computePnL(t);
        if (!pnl) return false;
        if (filterOutcome === "winners") return pnl.pnlDollars >= 0;
        return pnl.pnlDollars < 0;
      });
    }

    if (sortBy === "date") list.sort((a, b) => (b.entryDate + b.id).localeCompare(a.entryDate + a.id));
    else if (sortBy === "asset") list.sort((a, b) => a.asset.localeCompare(b.asset));
    else if (sortBy === "pnl") {
      list.sort((a, b) => {
        const pa = computePnL(a)?.pnlDollars ?? -Infinity;
        const pb = computePnL(b)?.pnlDollars ?? -Infinity;
        return pb - pa;
      });
    }
    return list;
  }, [displayTrades, filterStatus, filterAsset, filterDirection, filterOutcome, sortBy]);

  const closedTrades = useMemo(() => displayTrades.filter((t) => t.exitPrice != null), [displayTrades]);
  // No cap — analytics, charts, and stats now reflect every closed trade so
  // power users with hundreds of trades see full history.
  const analyticsTrades = closedTrades;

  const stats = useMemo(() => {
    const total = displayTrades.length;
    const closed = closedTrades.length;
    const winners = closedTrades.filter((t) => (computePnL(t)?.pnlDollars ?? 0) >= 0).length;
    const winRate = closed > 0 ? (winners / closed) * 100 : 0;
    // Dollar-weighted return on capital: total P&L / total capital deployed.
    // Replaces the old "average of pnlPercent" which was misleading — a +100%
    // win on $100 cancelled a -100% loss on $1000 to read 0% even though net
    // was -$900.
    let totalPnl = 0;
    let totalCapital = 0;
    closedTrades.forEach((t) => {
      const p = computePnL(t);
      if (!p) return;
      totalPnl += p.pnlDollars;
      totalCapital += t.entryPrice * t.positionSize;
    });
    const avgReturn = totalCapital > 0 ? (totalPnl / totalCapital) * 100 : 0;
    return { total, closed, winRate, totalPnl, avgReturn, winners, losers: closed - winners };
  }, [displayTrades, closedTrades]);

  const cumulativeData = useMemo(() => {
    const sorted = [...closedTrades].sort((a, b) => (a.exitDate || a.entryDate).localeCompare(b.exitDate || b.entryDate));
    let running = 0;
    return sorted.map((t) => {
      const p = computePnL(t);
      if (p) running += p.pnlDollars;
      return { date: t.exitDate || t.entryDate, pnl: running, label: t.exitDate?.slice(0, 10) || t.entryDate.slice(0, 10) };
    });
  }, [closedTrades]);

  const pnlByAsset = useMemo(() => {
    const map = new Map<string, number>();
    closedTrades.forEach((t) => {
      const p = computePnL(t);
      if (p) map.set(t.asset, (map.get(t.asset) ?? 0) + p.pnlDollars);
    });
    return Array.from(map.entries())
      .map(([asset, pnl]) => ({ asset, pnl }))
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 10);
  }, [closedTrades]);

  const bestWorst = useMemo(() => {
    const withPnl = closedTrades
      .map((t) => ({ trade: t, pnl: computePnL(t) }))
      .filter((x): x is { trade: JournalTrade; pnl: { pnlDollars: number; pnlPercent: number; optionPl: number | null } } => x.pnl != null);
    if (withPnl.length === 0) return { best: null, worst: null };
    const sorted = [...withPnl].sort((a, b) => b.pnl.pnlDollars - a.pnl.pnlDollars);
    return { best: sorted[0] ?? null, worst: sorted[sorted.length - 1] ?? null };
  }, [closedTrades]);

  const patterns = useMemo(() => {
    const byStrategy = new Map<string, { wins: number; total: number; pnl: number }>();
    closedTrades.forEach((t) => {
      const p = computePnL(t);
      if (!p) return;
      const cur = byStrategy.get(t.strategy) ?? { wins: 0, total: 0, pnl: 0 };
      cur.total += 1;
      cur.pnl += p.pnlDollars;
      if (p.pnlDollars >= 0) cur.wins += 1;
      byStrategy.set(t.strategy, cur);
    });
    let bestStrategy = "—";
    let bestRate = 0;
    byStrategy.forEach((v, k) => {
      if (v.total >= 2 && v.wins / v.total > bestRate) {
        bestRate = v.wins / v.total;
        bestStrategy = k;
      }
    });

    const byDay = new Map<number, { wins: number; total: number }>();
    closedTrades.forEach((t) => {
      const d = new Date(t.entryDate).getDay();
      const cur = byDay.get(d) ?? { wins: 0, total: 0 };
      cur.total += 1;
      const p = computePnL(t);
      if (p && p.pnlDollars >= 0) cur.wins += 1;
      byDay.set(d, cur);
    });
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let bestDay = "—";
    let bestDayRate = 0;
    byDay.forEach((v, d) => {
      if (v.total >= 1 && v.wins / v.total > bestDayRate) {
        bestDayRate = v.wins / v.total;
        bestDay = days[d];
      }
    });

    let totalHoldMs = 0;
    let holdCount = 0;
    closedTrades.forEach((t) => {
      if (t.exitDate) {
        totalHoldMs += new Date(t.exitDate).getTime() - new Date(t.entryDate).getTime();
        holdCount += 1;
      }
    });
    const avgHoldDays = holdCount > 0 ? totalHoldMs / holdCount / (24 * 60 * 60 * 1000) : 0;

    const longPnl = closedTrades.filter((t) => t.direction === "LONG").reduce((s, t) => s + (computePnL(t)?.pnlDollars ?? 0), 0);
    const shortPnl = closedTrades.filter((t) => t.direction === "SHORT").reduce((s, t) => s + (computePnL(t)?.pnlDollars ?? 0), 0);

    return { bestStrategy, bestDay, avgHoldDays, longPnl, shortPnl };
  }, [closedTrades]);

  const fetchInsights = useCallback(async () => {
    if (displayTrades.length < 5) return;
    setInsightsError(null);

    // Hit the in-memory cache first; it's invalidated whenever a trade is
    // written (see invalidateInsights below), so a hit means nothing has
    // changed since the last analysis.
    const cached = insightsCacheRef.current;
    if (cached) {
      setAnimateInsights(false);
      setInsights(cached);
      return;
    }

    // Cancel any prior in-flight request before starting a new one.
    insightsAbortRef.current?.abort();
    const ctrl = new AbortController();
    insightsAbortRef.current = ctrl;

    setInsightsStreaming(true);
    setInsightsProgress(0);

    // Concise per-trade summary (≈30 chars/trade) is far cheaper than
    // JSON.stringify of the full Trade objects — fewer input tokens, faster
    // model response, same signal for the analyst.
    const last10 = displayTrades.slice(0, 10);
    const tradeLines = last10
      .map((t) => {
        const pnl = computePnL(t);
        const pnlStr = pnl ? `${pnl.pnlDollars >= 0 ? "+" : ""}${pnl.pnlDollars.toFixed(2)}` : "open";
        const exit = t.exitPrice != null ? `→${t.exitPrice}` : "→open";
        return `${t.entryDate.slice(0, 10)} ${t.asset} ${t.direction} ${t.entryPrice}${exit} sz${t.positionSize} ${t.strategy} ${pnlStr}`;
      })
      .join("\n");

    const mostUsedStrategy = (() => {
      if (!displayTrades.length) return "—";
      const m = new Map<string, number>();
      displayTrades.forEach((t) => m.set(t.strategy, (m.get(t.strategy) ?? 0) + 1));
      let max = 0;
      let out = "";
      m.forEach((c, s) => {
        if (c > max) {
          max = c;
          out = s;
        }
      });
      return out;
    })();

    const userMessage = `Analyze my trading journal (process feedback only — never market advice):
Total trades: ${displayTrades.length}
Win rate: ${stats.winRate.toFixed(1)}%
Total P&L: $${stats.totalPnl.toFixed(2)}
Avg return: ${stats.avgReturn.toFixed(2)}%
Best trade: ${bestWorst.best ? `${bestWorst.best.trade.asset} +${bestWorst.best.pnl.pnlPercent.toFixed(2)}%` : "—"}
Worst trade: ${bestWorst.worst ? `${bestWorst.worst.trade.asset} ${bestWorst.worst.pnl.pnlPercent.toFixed(2)}%` : "—"}
Most-used strategy: ${mostUsedStrategy}

Recent trades:
${tradeLines}`;

    try {
      const res = await fetch("/api/journal-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || res.statusText);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        if (!ctrl.signal.aborted) setInsightsProgress(accumulated.length);
      }
      if (ctrl.signal.aborted) return;
      const data = parseInsightsJson(accumulated);
      if (!data) {
        setInsightsError("Insights response was malformed — try again.");
        return;
      }
      setAnimateInsights(true);
      setInsights(data);
      insightsCacheRef.current = data;
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setInsightsError(e instanceof Error ? e.message : "Failed to load insights");
    } finally {
      if (!ctrl.signal.aborted) {
        setInsightsStreaming(false);
        setInsightsLoading(false);
      }
    }
  }, [displayTrades, stats.winRate, stats.totalPnl, stats.avgReturn, bestWorst]);

  /** Cleared whenever a trade is written so the next Insights view re-analyzes
   *  with the new data. The user clicks the analyze icon to actually run it. */
  const invalidateInsights = useCallback(() => {
    insightsCacheRef.current = null;
    setInsights(null);
  }, []);

  // Cancel any in-flight insights request when the user leaves the tab.
  useEffect(() => {
    if (activeTab !== "insights") {
      insightsAbortRef.current?.abort();
    }
  }, [activeTab]);

  const handleDelete = useCallback(async (id: string) => {
    const isLocalId = id.startsWith("tj_");
    if (isLocalId) {
      deleteTrade(id);
      setFailedLocalTrades((prev) => prev.filter((t) => t.id !== id));
      setTrades((prev) => prev.filter((t) => t.id !== id));
      invalidateInsights();
      toast.showToast("Trade deleted", "info");
      return;
    }
    try {
      const res = await fetch(`/api/trades?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) {
        setTrades((prev) => prev.filter((t) => t.id !== id));
        invalidateInsights();
        toast.showToast("Trade deleted", "info");
      } else {
        toast.showToast("Delete failed", "error");
      }
    } catch {
      toast.showToast("Delete failed", "error");
    }
  }, [invalidateInsights, toast]);

  const tabs: { id: TabId; label: string }[] = [
    { id: "trades", label: `My Trades (${displayTrades.length})` },
    { id: "analytics", label: "Analytics" },
    { id: "insights", label: "Trade Insights" },
  ];

  const tradesByDate = useMemo(() => {
    const map = new Map<string, JournalTrade[]>();
    filteredTrades.forEach((t) => {
      const key = t.entryDate.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [filteredTrades]);

  const [calYear, calMonth] = useMemo(() => {
    const [y, m] = calendarMonth.split("-").map(Number);
    return [y, m - 1];
  }, [calendarMonth]);

  const calendarDays = useMemo(() => getCalendarDays(calYear, calMonth), [calYear, calMonth]);

  return (
    <div className="journal-page min-h-screen font-[&quot;Times_New_Roman&quot;,serif]" style={{ backgroundColor: BG }}>
      <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8 lg:py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            Trade Journal
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Log trades, track performance, and uncover patterns in your trading.
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-white/10">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="relative px-4 py-3 text-sm font-medium transition-colors"
                style={{
                  color: activeTab === tab.id ? "var(--accent-color)" : "var(--app-text-muted, #71717a)",
                }}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full transition-all"
                    style={{ backgroundColor: "var(--accent-color)" }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* My Trades */}
        {activeTab === "trades" && (
          <div className="mt-6">
            {tradesLoading ? (
              <div className="space-y-3">
                <div className="h-10 w-48 animate-pulse rounded-lg bg-white/10" />
                <div className="grid gap-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex h-14 animate-pulse items-center gap-4 rounded-xl bg-white/5 px-4">
                      <div className="h-4 w-20 rounded bg-white/10" />
                      <div className="h-4 w-16 rounded bg-white/10" />
                      <div className="h-4 flex-1 rounded bg-white/10" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
            <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as "all" | "open" | "closed")}
                  className="rounded-lg border border-white/10 bg-[var(--app-card)] px-3 py-1.5 text-xs text-zinc-200"
                >
                  <option value="all">All</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
                <input
                  type="text"
                  placeholder="Filter by asset"
                  value={filterAsset}
                  onChange={(e) => setFilterAsset(e.target.value)}
                  className="w-32 rounded-lg border border-white/10 bg-[var(--app-card)] px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500"
                />
                <select
                  value={filterDirection}
                  onChange={(e) => setFilterDirection(e.target.value as "all" | "LONG" | "SHORT")}
                  className="rounded-lg border border-white/10 bg-[var(--app-card)] px-3 py-1.5 text-xs text-zinc-200"
                >
                  <option value="all">All</option>
                  <option value="LONG">Long</option>
                  <option value="SHORT">Short</option>
                </select>
                <select
                  value={filterOutcome}
                  onChange={(e) => setFilterOutcome(e.target.value as "all" | "winners" | "losers")}
                  className="rounded-lg border border-white/10 bg-[var(--app-card)] px-3 py-1.5 text-xs text-zinc-200"
                >
                  <option value="all">All</option>
                  <option value="winners">Winners</option>
                  <option value="losers">Losers</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => {
                setEditingTrade(null);
                setModalOpen(true);
              }}
                className="shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold text-[#020308] transition hover:opacity-90"
                style={{ backgroundColor: "var(--accent-color)" }}
              >
                Log a trade
              </button>
            </div>

            {filteredTrades.length === 0 ? (
              <div className="mt-16 flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] py-16 text-center">
                <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-white/5 text-[var(--accent-color)]">
                  <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                </div>
                <p className="text-lg font-medium text-zinc-200">Start logging your trades</p>
                <p className="mt-2 max-w-sm text-sm text-zinc-400">
                  Track every entry and exit to understand your performance over time.
                </p>
                <button
                  type="button"
                  onClick={() => {
                  setEditingTrade(null);
                  setModalOpen(true);
                }}
                  className="mt-6 rounded-full px-6 py-2.5 text-sm font-semibold text-[#020308] transition hover:opacity-90"
                  style={{ backgroundColor: "var(--accent-color)" }}
                >
                  Log your first trade
                </button>
              </div>
            ) : (
              <div className="mt-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-200">
                    {new Date(calYear, calMonth, 1).toLocaleString("default", { month: "long", year: "numeric" })}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date(calYear, calMonth - 1, 1);
                        setCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
                      }}
                      className="rounded-lg border border-white/10 bg-[var(--app-card)] px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
                    >
                      ← Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date(calYear, calMonth + 1, 1);
                        setCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
                      }}
                      className="rounded-lg border border-white/10 bg-[var(--app-card)] px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
                    >
                      Next →
                    </button>
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 overflow-hidden">
                  <div className="grid grid-cols-7 border-b border-white/10 bg-white/5">
                    {WEEKDAYS.map((w) => (
                      <div key={w} className="p-2 text-center text-[10px] font-medium uppercase text-zinc-500">
                        {w}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {calendarDays.map((cell) => {
                      const dayTrades = (tradesByDate.get(cell.date) ?? []).slice(0, MAX_TRADES_PER_DAY);
                      const hasMore = (tradesByDate.get(cell.date)?.length ?? 0) > MAX_TRADES_PER_DAY;
                      return (
                        <div
                          key={cell.date}
                          className={`min-h-[100px] border-b border-r border-white/5 p-1.5 last:border-r-0 ${!cell.isCurrentMonth ? "bg-white/[0.02]" : ""}`}
                        >
                          <p className={`text-right text-[11px] font-medium ${cell.isCurrentMonth ? "text-zinc-400" : "text-zinc-600"}`}>
                            {cell.day}
                          </p>
                          <ul className="mt-1 space-y-0.5">
                            {dayTrades.map((t) => {
                              const pnl = computePnL(t);
                              const entryDateOnly = t.entryDate.slice(0, 10);
                              const today = new Date().toISOString().slice(0, 10);
                              const canEdit = entryDateOnly <= today;
                              return (
                                <li key={t.id} className="group flex items-center justify-between gap-0.5 rounded bg-white/5 px-1 py-0.5 text-[10px]">
                                  <span className="flex items-center gap-1 truncate">
                                    <span className="font-medium text-[var(--accent-color)]">{t.asset}</span>
                                    {t.exitPrice == null && (
                                      <span className="shrink-0 rounded bg-blue-500/20 px-1 py-0.5 text-[9px] font-medium text-blue-400">Open</span>
                                    )}
                                  </span>
                                  <span className={`shrink-0 ${pnl != null ? (pnl.pnlDollars >= 0 ? "text-emerald-400" : "text-red-400") : "text-zinc-500"}`}>
                                    {pnl != null
                                      ? formatCurrency(pnl.pnlDollars)
                                      : (() => {
                                          const cur = openPrices[t.asset.trim().toUpperCase()];
                                          if (cur == null) return "—";
                                          const mult = t.direction === "LONG" ? 1 : -1;
                                          const un = (cur - t.entryPrice) * mult * t.positionSize;
                                          return (
                                            <span className={un >= 0 ? "text-emerald-400" : "text-red-400"}>
                                              Unreal. {formatCurrency(un)}
                                            </span>
                                          );
                                        })()}
                                  </span>
                                  <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingTrade(t);
                                          setModalOpen(true);
                                        }}
                                        className="rounded p-0.5 text-zinc-500 hover:bg-[var(--accent-color)]/20 hover:text-[var(--accent-color)]"
                                        aria-label="Edit trade"
                                      >
                                        ✏
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(t.id)}
                                      className="rounded p-0.5 text-zinc-500 hover:bg-red-500/20 hover:text-red-400"
                                      aria-label="Delete"
                                    >
                                      🗑
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                          {hasMore && (
                            <p className="mt-0.5 text-[9px] text-zinc-500">
                              +{(tradesByDate.get(cell.date)?.length ?? 0) - MAX_TRADES_PER_DAY} more
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            </>
            )}
          </div>
        )}

        {/* Analytics */}
        {activeTab === "analytics" && (
          <div className="mt-6 space-y-8">
            {analyticsTrades.length < 3 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] py-16 text-center">
                <p className="text-lg font-medium text-zinc-200">Log more trades to see analytics</p>
                <p className="mt-2 text-sm text-zinc-400">Close at least 3 trades to unlock charts and patterns.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab("trades")}
                  className="mt-6 rounded-full border border-white/10 px-5 py-2 text-sm font-medium text-zinc-300 hover:bg-white/5"
                >
                  Go to My Trades
                </button>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Total Trades</p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-100">{stats.total}</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Win Rate</p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-100">{stats.winRate.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Total P&L</p>
                    <p className={`mt-1 text-2xl font-semibold ${stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {formatCurrency(stats.totalPnl)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Return on Capital</p>
                    <p className={`mt-1 text-2xl font-semibold ${stats.avgReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {formatPercent(stats.avgReturn)}
                    </p>
                  </div>
                </div>

                <TradePerformanceCalendar trades={analyticsTrades} />

                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <h3 className="mb-4 text-sm font-semibold text-zinc-200">Cumulative P&L</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={cumulativeData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                        <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 10 }} stroke={GRID_COLOR} />
                        <YAxis tick={{ fill: "#71717a", fontSize: 10 }} stroke={GRID_COLOR} tickFormatter={(v) => `$${v}`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "var(--app-card)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                          labelStyle={{ color: "#a1a1aa" }}
                          formatter={(value: unknown) => [formatCurrency(Number(value ?? 0)), "P&L"]}
                        />
                        <Line type="monotone" dataKey="pnl" stroke="var(--accent-color)" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <h3 className="mb-4 text-sm font-semibold text-zinc-200">Win / Loss</h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[{ name: "Winners", count: stats.winners, fill: "#34d399" }, { name: "Losers", count: stats.losers, fill: "#f87171" }]}>
                          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                          <XAxis dataKey="name" tick={{ fill: "#71717a", fontSize: 10 }} stroke={GRID_COLOR} />
                          <YAxis tick={{ fill: "#71717a", fontSize: 10 }} stroke={GRID_COLOR} />
                          <Bar dataKey="count" radius={4} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <h3 className="mb-4 text-sm font-semibold text-zinc-200">P&L by Asset</h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={pnlByAsset} layout="vertical" margin={{ left: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                          <XAxis type="number" tick={{ fill: "#71717a", fontSize: 10 }} stroke={GRID_COLOR} tickFormatter={(v) => `$${v}`} />
                          <YAxis type="category" dataKey="asset" width={50} tick={{ fill: "#71717a", fontSize: 10 }} stroke={GRID_COLOR} />
                          <Bar dataKey="pnl" radius={4}>
                            {pnlByAsset.map((_, i) => (
                              <Cell key={i} fill={pnlByAsset[i].pnl >= 0 ? "#34d399" : "#f87171"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {bestWorst.best && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                      <p className="text-xs font-medium uppercase tracking-wider text-emerald-400/80">Best trade</p>
                      <p className="mt-1 font-semibold text-zinc-100">{bestWorst.best.trade.asset}</p>
                      <p className="text-emerald-400">{formatPercent(bestWorst.best.pnl.pnlPercent)} · {formatCurrency(bestWorst.best.pnl.pnlDollars)}</p>
                    </div>
                  )}
                  {bestWorst.worst && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                      <p className="text-xs font-medium uppercase tracking-wider text-red-400/80">Worst trade</p>
                      <p className="mt-1 font-semibold text-zinc-100">{bestWorst.worst.trade.asset}</p>
                      <p className="text-red-400">{formatPercent(bestWorst.worst.pnl.pnlPercent)} · {formatCurrency(bestWorst.worst.pnl.pnlDollars)}</p>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <h3 className="mb-4 text-sm font-semibold text-zinc-200">Patterns</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                    <div>
                      <p className="text-xs text-zinc-500">Best strategy</p>
                      <p className="font-medium text-zinc-200">{patterns.bestStrategy}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Best day of week</p>
                      <p className="font-medium text-zinc-200">{patterns.bestDay}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Avg hold time</p>
                      <p className="font-medium text-zinc-200">{patterns.avgHoldDays.toFixed(1)} days</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Long vs Short P&L</p>
                      <p className="font-medium text-zinc-200">
                        Long {formatCurrency(patterns.longPnl)} · Short {formatCurrency(patterns.shortPnl)}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Trade Insights */}
        {activeTab === "insights" && (
          <div className="mt-6">
            {displayTrades.length < 5 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] py-16 text-center">
                <p className="text-lg font-medium text-zinc-200">Log at least 5 trades to unlock trade insights</p>
                <div className="mt-4 w-64 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (displayTrades.length / 5) * 100)}%`,
                      backgroundColor: "var(--accent-color)",
                    }}
                  />
                </div>
                <p className="mt-2 text-sm text-zinc-400">{displayTrades.length}/5 trades logged</p>
              </div>
            ) : insightsStreaming ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] py-16 gap-4">
                <div className="flex items-center gap-3">
                  {[0,150,300].map((d) => (
                    <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent-color)]" style={{ animationDelay: `${d}ms` }} />
                  ))}
                  <span className="text-sm text-zinc-400">Analyzing your {displayTrades.length} trades…</span>
                </div>
                <div className="w-48 h-0.5 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-[var(--accent-color)]/60 transition-all duration-300" style={{ width: `${Math.min(90, (insightsProgress / 900) * 100)}%` }} />
                </div>
              </div>
            ) : insightsLoading ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-color)] border-t-transparent" />
                <p className="mt-4 text-sm text-zinc-400">Analyzing your {displayTrades.length} trades...</p>
              </div>
            ) : insightsError ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
                <p className="text-red-400">{insightsError}</p>
                <button
                  type="button"
                  onClick={() => fetchInsights()}
                  className="mt-4 rounded-full bg-[var(--accent-color)] px-5 py-2 text-sm font-semibold text-[#020308]"
                >
                  Retry
                </button>
              </div>
            ) : !insights ? (
              // Click-to-analyze empty state — replaces the old auto-fetch
              // behavior so analysis only runs on explicit user action.
              // Shown when 5+ trades exist and no insights are cached.
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] py-16 text-center">
                <button
                  type="button"
                  onClick={() => fetchInsights()}
                  aria-label="Run trade analysis"
                  className="group relative flex h-24 w-24 items-center justify-center rounded-full bg-[var(--accent-color)]/15 transition hover:bg-[var(--accent-color)]/25"
                >
                  <span className="absolute inset-0 rounded-full bg-[var(--accent-color)]/0 transition group-hover:bg-[var(--accent-color)]/10" />
                  <svg
                    className="h-12 w-12 text-[var(--accent-color)] transition-transform group-hover:scale-110"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
                    />
                  </svg>
                </button>
                <p className="mt-5 text-base font-semibold text-zinc-200">Analyze my trades</p>
                <p className="mt-1 max-w-sm text-sm text-zinc-400">
                  Tap the icon to generate process feedback from your {displayTrades.length} logged trades.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-zinc-100">Your analysis</h2>
                  <span className="text-xs text-zinc-500">Re-runs after you log a new trade</span>
                </div>

                {/* Legal disclaimer — analysis is observational/educational, NOT
                    financial advice. Required so we can't be construed as giving
                    investment guidance. The system prompt also enforces this. */}
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-zinc-400">
                  <span className="font-semibold text-zinc-300">Educational only.</span>{" "}
                  This analysis describes patterns in your past trades for journaling and self-reflection.
                  It is not investment, financial, tax, or legal advice and does not recommend any specific trade,
                  security, or strategy. Consult a licensed professional before making investment decisions.
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
                  <span
                    className={`inline-block text-5xl font-bold ${insights.overallGrade.startsWith("A") ? "text-emerald-400" : insights.overallGrade.startsWith("B") ? "text-blue-400" : insights.overallGrade.startsWith("C") ? "text-amber-400" : "text-red-400"}`}
                  >
                    {insights.overallGrade}
                  </span>
                  <p className="mt-2 text-sm text-zinc-400">
                    {animateInsights ? <TypewriterText text={insights.gradeSummary} startDelay={0} /> : insights.gradeSummary}
                  </p>
                </div>

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-zinc-200">Strengths</h3>
                  <ul className="space-y-1">
                    {insights.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                        <span className="text-emerald-400">✓</span>{" "}
                        {animateInsights ? <TypewriterText text={s} startDelay={550 + i * 200} /> : s}
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-zinc-200">Weaknesses</h3>
                  <ul className="space-y-1">
                    {insights.weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                        <span className="text-amber-400">⚠</span>{" "}
                        {animateInsights ? <TypewriterText text={w} startDelay={1150 + i * 200} /> : w}
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-zinc-200">Patterns noticed</h3>
                  <ul className="space-y-1">
                    {insights.patterns.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                        <span className="text-blue-400">ℹ</span>{" "}
                        {animateInsights ? <TypewriterText text={p} startDelay={1750 + i * 200} /> : p}
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-zinc-200">Action items</h3>
                  <ol className="list-inside list-decimal space-y-1 text-sm text-zinc-300">
                    {insights.actionItems.map((a, i) => (
                      <li key={i}>
                        <span style={{ color: "var(--accent-color)" }}>{i + 1}.</span>{" "}
                        {animateInsights ? <TypewriterText text={a} startDelay={2250 + i * 200} /> : a}
                      </li>
                    ))}
                  </ol>
                </section>

                <div className="rounded-xl border-l-4 border-amber-500/60 bg-amber-500/5 p-4">
                  <h3 className="text-sm font-semibold text-zinc-200">Risk assessment</h3>
                  <p className="mt-1 text-sm text-zinc-300">
                    {animateInsights ? <TypewriterText text={insights.riskAssessment} startDelay={2850} /> : insights.riskAssessment}
                  </p>
                </div>

                <div className="rounded-xl border-2 p-4" style={{ borderColor: "var(--accent-color)", borderImage: "linear-gradient(to right, var(--accent-color), #6366f1) 1" }}>
                  <svg className="h-4 w-4 text-[var(--accent-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                  <h3 className="mt-1 text-sm font-semibold text-zinc-200">Coaching tip</h3>
                  <p className="mt-1 text-sm text-zinc-300">
                    {animateInsights ? <TypewriterText text={insights.coachingTip} startDelay={3450} /> : insights.coachingTip}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4">
                  <svg className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  <h3 className="mt-1 text-sm font-semibold text-zinc-200">Weekly challenge</h3>
                  <p className="mt-1 text-sm text-zinc-300">
                    {animateInsights ? <TypewriterText text={insights.weeklyChallenge} startDelay={4050} /> : insights.weeklyChallenge}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {modalOpen && (
        <LogTradeModal
          initialTrade={editingTrade}
          onClose={() => {
            setModalOpen(false);
            setEditingTrade(null);
          }}
          onSaved={(savedTrade) => {
            if (savedTrade) {
              if (editingTrade) {
                setTrades((prev) => prev.map((t) => (t.id === editingTrade.id ? savedTrade : t)));
                if (editingTrade.id.startsWith("tj_")) {
                  setFailedLocalTrades((prev) => prev.filter((t) => t.id !== editingTrade.id));
                }
              } else {
                setTrades((prev) => [savedTrade, ...prev]);
              }
              // Any write invalidates insights so the next Insights view
              // re-analyzes — replaces the manual "Re-analyze" button.
              invalidateInsights();
            }
            setModalOpen(false);
            setEditingTrade(null);
            if (savedTrade) toast.showToast("Trade saved", "info");
          }}
          onSaveFailed={(localTrade) => {
            setFailedLocalTrades((prev) => [...prev, localTrade]);
            invalidateInsights();
            setModalOpen(false);
            setEditingTrade(null);
            toast.showToast("Save failed — trade kept locally", "error");
          }}
        />
      )}

      {failedLocalTrades.length > 0 && (
        <div className="fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200 shadow-lg">
          <span>{failedLocalTrades.length} trade(s) saved locally. Save to cloud?</span>
          <button
            type="button"
            onClick={async () => {
              for (const t of [...failedLocalTrades]) {
                const body: Record<string, unknown> = {
                  asset: t.asset,
                  direction: t.direction,
                  entry_price: t.entryPrice,
                  exit_price: t.exitPrice,
                  position_size: t.positionSize,
                  entry_date: t.entryDate.slice(0, 10),
                  exit_date: t.exitDate ? t.exitDate.slice(0, 10) : null,
                  strategy: t.strategy,
                  notes: t.notes,
                  tags: t.tags,
                };
                if (t.pnlDollars != null || t.pnlPercent != null) {
                  body.pnl_dollars = t.pnlDollars ?? undefined;
                  body.pnl_percent = t.pnlPercent ?? undefined;
                }
                const res = await fetch("/api/trades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                if (res.ok) {
                  const saved = (await res.json()) as JournalTrade;
                  setTrades((prev) => [saved, ...prev]);
                  setFailedLocalTrades((prev) => prev.filter((x) => x.id !== t.id));
                  deleteTrade(t.id);
                }
              }
            }}
            className="rounded bg-amber-500 px-3 py-1 text-sm font-medium text-black hover:bg-amber-400"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
