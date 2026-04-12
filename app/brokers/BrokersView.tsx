"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../../components/AuthContext";
import {
  LineChart, Line, BarChart, Bar, Cell, PieChart, Pie, Tooltip,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from "recharts";

const TEAL = "#14B8A6";
const GRID = "rgba(255,255,255,0.05)";
const fmt$ = (n: number) => `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtSign = (n: number) => `${n >= 0 ? "+" : "-"}${fmt$(n)}`;

type Account = {
  id: string;
  brokerage_authorization: string;
  name: string | null;
  number: string;
  institution_name: string;
  raw_type?: string | null;
  is_paper?: boolean;
  balance?: { total?: { value?: number | null; currency?: string } | null } | null;
};

type Balance = {
  currency?: { code?: string };
  cash?: number | null;
  buying_power?: number | null;
};

type Position = {
  symbol?: { symbol?: { symbol?: string; description?: string } };
  units?: number | null;
  price?: number | null;
  open_pnl?: number | null;
  average_purchase_price?: number | null;
};

type Holdings = {
  balances?: Balance[] | null;
  positions?: Position[] | null;
};

type Activity = {
  id?: string;
  trade_date?: string;
  type?: string;
  symbol?: { symbol?: string; description?: string } | null;
  price?: number;
  units?: number;
  amount?: number | null;
  currency?: { code?: string };
  description?: string;
};

type TabId = "overview" | "activity";

function accountTypeLabel(acc: Account): { label: string; color: string } {
  const raw = (acc.raw_type ?? "").toLowerCase();
  if (acc.is_paper) return { label: "Paper", color: "#a855f7" };
  if (raw.includes("margin")) return { label: "Margin", color: "#f59e0b" };
  if (raw.includes("rrsp")) return { label: "RRSP", color: "#3b82f6" };
  if (raw.includes("tfsa")) return { label: "TFSA", color: "#3b82f6" };
  if (raw.includes("ira")) return { label: "IRA", color: "#3b82f6" };
  if (raw.includes("roth")) return { label: "Roth IRA", color: "#6366f1" };
  if (raw.includes("401k") || raw.includes("retirement")) return { label: "Retirement", color: "#6366f1" };
  return { label: "Cash", color: "#10b981" };
}

const PIE_COLORS = ["#14B8A6", "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#a855f7", "#3b82f6", "#f97316"];

// Use open_pnl if available; otherwise compute from average_purchase_price vs current price.
// Works correctly for both long (positive units) and short (negative units) positions.
function getPnl(pos: Position): number {
  if (pos.open_pnl != null) return pos.open_pnl;
  if (pos.average_purchase_price != null && pos.price != null && pos.units != null) {
    return (pos.price - pos.average_purchase_price) * pos.units;
  }
  return 0;
}

export default function BrokersView() {
  const { user, authLoading } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [holdingsMap, setHoldingsMap] = useState<Record<string, Holdings>>({});
  const [activitiesMap, setActivitiesMap] = useState<Record<string, Activity[]>>({});
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingHoldingsSet, setLoadingHoldingsSet] = useState<Set<string>>(new Set());
  const [loadingActivitiesSet, setLoadingActivitiesSet] = useState<Set<string>>(new Set());
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [error, setError] = useState<string | null>(null);

  const fetchHoldings = useCallback(async (accountId: string) => {
    setLoadingHoldingsSet((p) => new Set(p).add(accountId));
    try {
      const res = await fetch(`/api/snaptrade/holdings?accountId=${accountId}`);
      const data = await res.json();
      if (data.holdings) setHoldingsMap((p) => ({ ...p, [accountId]: data.holdings as Holdings }));
    } catch { /* non-fatal */ } finally {
      setLoadingHoldingsSet((p) => { const s = new Set(p); s.delete(accountId); return s; });
    }
  }, []);

  const fetchActivitiesForAccount = useCallback(async (accountId: string) => {
    if (activitiesMap[accountId]) return; // already loaded
    setLoadingActivitiesSet((p) => new Set(p).add(accountId));
    try {
      const res = await fetch(`/api/snaptrade/activities?accountId=${accountId}`);
      const data = await res.json();
      const raw = data.activities;
      const arr: Activity[] = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
      setActivitiesMap((p) => ({ ...p, [accountId]: arr }));
    } catch { /* non-fatal */ } finally {
      setLoadingActivitiesSet((p) => { const s = new Set(p); s.delete(accountId); return s; });
    }
  }, [activitiesMap]);

  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    setError(null);
    try {
      const res = await fetch("/api/snaptrade/accounts");
      const data = await res.json();
      const accs: Account[] = data.accounts ?? [];
      setAccounts(accs);
      accs.forEach((a) => { fetchHoldings(a.id); fetchActivitiesForAccount(a.id); });
    } catch {
      setError("Failed to load accounts.");
    } finally {
      setLoadingAccounts(false);
    }
  }, [fetchHoldings, fetchActivitiesForAccount]);

  useEffect(() => { if (user) fetchAccounts(); }, [user, fetchAccounts]);

  // When switching to analytics/activity tab, ensure data is loaded
  useEffect(() => {
    if (activeTab === "activity") {
      const targets = selectedTab === "all" ? accounts : accounts.filter((a) => a.id === selectedTab);
      targets.forEach((a) => fetchActivitiesForAccount(a.id));
    }
  }, [activeTab, selectedTab, accounts, fetchActivitiesForAccount]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const redirectURL = `${window.location.origin}/brokers/callback`;
      const res = await fetch("/api/snaptrade/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redirectURL }),
      });
      const data = await res.json();
      if (!data.portalUrl) { setError("Could not open connection portal."); return; }
      window.location.href = data.portalUrl;
    } catch {
      setError("Failed to start broker connection.");
    } finally {
      setConnecting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setHoldingsMap({});
    setActivitiesMap({});
    await fetchAccounts();
    setRefreshing(false);
  };

  const handleDisconnect = async (connectionId: string, accountId: string) => {
    setDisconnecting(connectionId);
    try {
      await fetch(`/api/snaptrade/disconnect?connectionId=${connectionId}`, { method: "DELETE" });
      setHoldingsMap((p) => { const n = { ...p }; delete n[accountId]; return n; });
      setActivitiesMap((p) => { const n = { ...p }; delete n[accountId]; return n; });
      setSelectedTab("all");
      await fetchAccounts();
    } catch {
      setError("Failed to disconnect.");
    } finally {
      setDisconnecting(null);
    }
  };

  // Derived data based on selected tab
  const visibleAccounts = selectedTab === "all" ? accounts : accounts.filter((a) => a.id === selectedTab);
  const aggregatePositions = visibleAccounts.flatMap((a) => holdingsMap[a.id]?.positions ?? []);
  const aggregateBalances = visibleAccounts.flatMap((a) => holdingsMap[a.id]?.balances ?? []);
  const aggregateActivities = visibleAccounts.flatMap((a) => activitiesMap[a.id] ?? []);

  const totalCash = aggregateBalances.reduce((s, b) => s + (b.cash ?? 0), 0);
  // For short positions units is negative, so price * units gives negative market value (short exposure)
  const positionsValue = aggregatePositions.reduce((s, p) => s + Math.abs((p.price ?? 0) * (p.units ?? 0)), 0);
  const totalValue = totalCash + positionsValue;
  const openPnl = aggregatePositions.reduce((s, p) => s + getPnl(p), 0);

  const anyHoldingLoading = loadingHoldingsSet.size > 0;

  // Analytics computations
  const analyticsData = useMemo(() => {
    // Cumulative net P&L from all activity: buys are negative (cost), sells are positive (proceeds).
    // Summing all gives true net cash flow from trading. Open positions contribute their cost basis
    // as a negative until closed.
    const allActivity = aggregateActivities
      .filter((a) => a.trade_date && a.amount != null)
      .sort((a, b) => (a.trade_date ?? "") < (b.trade_date ?? "") ? -1 : 1);

    let running = 0;
    const cumulativePnl = allActivity.map((a) => {
      running += a.amount ?? 0;
      return {
        date: new Date(a.trade_date!).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        pnl: parseFloat(running.toFixed(2)),
      };
    });

    // Activity type breakdown
    const typeCount = new Map<string, number>();
    aggregateActivities.forEach((a) => { if (a.type) typeCount.set(a.type, (typeCount.get(a.type) ?? 0) + 1); });
    const activityBreakdown = Array.from(typeCount.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Portfolio allocation by symbol
    const allocation = aggregatePositions
      .filter((p) => (p.price ?? 0) * (p.units ?? 0) > 0)
      .map((p) => ({
        name: p.symbol?.symbol?.symbol ?? "Other",
        value: parseFloat(((p.price ?? 0) * (p.units ?? 0)).toFixed(2)),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Unrealized P&L by position — computed from avg cost when open_pnl is null
    const pnlBySymbol = aggregatePositions
      .map((p) => ({
        symbol: p.symbol?.symbol?.symbol ?? "?",
        pnl: parseFloat(getPnl(p).toFixed(2)),
      }))
      .filter((p) => p.pnl !== 0)
      .sort((a, b) => b.pnl - a.pnl);

    // Win rate from closed positions (sells that returned positive amount)
    const sellTransactions = aggregateActivities.filter((a) => a.type === "SELL" && a.amount != null);
    const winners = sellTransactions.filter((a) => (a.amount ?? 0) > 0).length;
    const winRate = sellTransactions.length > 0 ? (winners / sellTransactions.length) * 100 : null;
    const totalRealized = sellTransactions.reduce((s, a) => s + (a.amount ?? 0), 0);

    return { cumulativePnl, activityBreakdown, allocation, pnlBySymbol, winRate, totalRealized, tradeCount: sellTransactions.length };
  }, [aggregateActivities, aggregatePositions]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent-color)]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-400">
        Sign in to connect your brokerage.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-100">My Brokerages</h1>
            {accounts.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium" style={{ borderColor: `${TEAL}40`, color: TEAL, backgroundColor: `${TEAL}10` }}>
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                Verified Trader
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-500">Read-only access · We never trade on your behalf</p>
        </div>
        <div className="flex items-center gap-2">
          {accounts.length > 0 && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || loadingAccounts}
              title="Force sync latest positions from broker"
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-400 transition hover:border-white/20 hover:text-zinc-200 disabled:opacity-40"
            >
              <svg className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? "Syncing…" : "Refresh"}
            </button>
          )}
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-[#020308] transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: TEAL }}
          >
            {connecting ? "Redirecting…" : accounts.length > 0 ? "+ Add Broker" : "Connect Broker"}
          </button>
        </div>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

      {loadingAccounts && (
        <div className="mt-16 flex justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent-color)]" />
        </div>
      )}

      {/* Empty state */}
      {!loadingAccounts && accounts.length === 0 && (
        <div className="mt-20 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full text-3xl" style={{ backgroundColor: `${TEAL}20`, color: TEAL }}>🔗</div>
          <h2 className="mt-4 text-lg font-semibold text-zinc-200">No brokerages connected</h2>
          <p className="mt-2 max-w-sm text-sm text-zinc-500">Connect your brokerage to get Verified Trader status and view live portfolio analytics.</p>
          <p className="mt-1 text-xs text-zinc-600">Supports 50+ brokerages including Robinhood, Schwab, Fidelity, IBKR, and more.</p>
          <button type="button" onClick={handleConnect} disabled={connecting} className="mt-6 rounded-lg px-6 py-2.5 text-sm font-semibold text-[#020308] transition hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: TEAL }}>
            {connecting ? "Redirecting…" : "Connect Broker"}
          </button>
        </div>
      )}

      {/* Connected */}
      {!loadingAccounts && accounts.length > 0 && (
        <>
          {/* Broker selector tabs */}
          <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-1">
            <BrokerTab active={selectedTab === "all"} onClick={() => setSelectedTab("all")}>All Accounts</BrokerTab>
            {accounts.map((acc) => {
              const { label, color } = accountTypeLabel(acc);
              return (
                <BrokerTab key={acc.id} active={selectedTab === acc.id} onClick={() => setSelectedTab(acc.id)}>
                  <span>{acc.institution_name}</span>
                  {acc.number && <span className="opacity-60"> ····{acc.number.slice(-4)}</span>}
                  <span className="ml-1.5 rounded px-1 py-0.5 text-[9px] font-bold uppercase" style={{ backgroundColor: `${color}20`, color }}>{label}</span>
                </BrokerTab>
              );
            })}
          </div>

          {/* Page tabs */}
          <div className="mt-6 border-b border-white/10">
            <div className="flex gap-1">
              {(["overview", "activity"] as TabId[]).map((t) => (
                <button key={t} type="button" onClick={() => setActiveTab(t)}
                  className="relative px-4 py-2.5 text-sm font-medium capitalize transition-colors"
                  style={{ color: activeTab === t ? TEAL : "#71717a" }}>
                  {t}
                  {activeTab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ backgroundColor: TEAL }} />}
                </button>
              ))}
            </div>
          </div>

          {/* ── OVERVIEW ── */}
          {activeTab === "overview" && (
            <div className="mt-6 space-y-5">
              {/* Stats row */}
              {anyHoldingLoading ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[0,1,2,3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard label="Total Value" value={fmt$(totalValue)} />
                  <StatCard label="Cash Balance" value={fmt$(totalCash)} />
                  <StatCard label="Unrealized P&L" value={openPnl !== 0 ? fmtSign(openPnl) : "$0.00"} valueColor={openPnl > 0 ? "#10b981" : openPnl < 0 ? "#ef4444" : undefined} />
                  <StatCard label="Open Positions" value={String(aggregatePositions.length)} />
                </div>
              )}

              {/* Account cards */}
              <div className="grid gap-3 sm:grid-cols-2">
                {visibleAccounts.map((acc) => {
                  const h = holdingsMap[acc.id];
                  const { label, color } = accountTypeLabel(acc);
                  const cash = (h?.balances ?? []).reduce((s, b) => s + (b.cash ?? 0), 0);
                  const invested = (h?.positions ?? []).reduce((s, p) => s + Math.abs((p.price ?? 0) * (p.units ?? 0)), 0);
                  const pnl = (h?.positions ?? []).reduce((s, p) => s + getPnl(p), 0);
                  const posCount = h?.positions?.length ?? 0;
                  return (
                    <div key={acc.id} className="rounded-xl border border-white/10 bg-[var(--app-card)] p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-zinc-100">{acc.institution_name}</p>
                          <p className="text-xs text-zinc-500">{acc.name ?? (acc.number ? `····${acc.number.slice(-4)}` : "")}</p>
                        </div>
                        <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase" style={{ backgroundColor: `${color}20`, color }}>{label}</span>
                      </div>
                      {loadingHoldingsSet.has(acc.id) ? (
                        <div className="mt-3 h-4 w-24 animate-pulse rounded bg-white/5" />
                      ) : (
                        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-xs text-zinc-500">Value</p>
                            <p className="text-sm font-semibold text-zinc-100">{fmt$(cash + invested)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500">Positions</p>
                            <p className="text-sm font-semibold text-zinc-100">{posCount}</p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500">Unreal. P&L</p>
                            <p className={`text-sm font-semibold ${pnl > 0 ? "text-emerald-400" : pnl < 0 ? "text-red-400" : "text-zinc-400"}`}>
                              {pnl !== 0 ? fmtSign(pnl) : "—"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Positions table */}
              <div className="rounded-xl border border-white/10 bg-[var(--app-card)]">
                <div className="border-b border-white/10 px-4 py-3">
                  <h3 className="text-sm font-semibold text-zinc-200">
                    Open Positions
                    {!anyHoldingLoading && <span className="ml-2 text-xs font-normal text-zinc-500">({aggregatePositions.length})</span>}
                  </h3>
                </div>
                {anyHoldingLoading ? (
                  <div className="flex justify-center p-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent-color)]" /></div>
                ) : aggregatePositions.length === 0 ? (
                  <div className="px-4 py-6">
                    <p className="text-sm text-zinc-500">No open positions returned.</p>
                    <p className="mt-1 text-xs text-zinc-600">Snaptrade caches broker data — positions opened today may not sync immediately. Use the Refresh button above to force a sync.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/5 text-left text-xs text-zinc-500">
                          <th className="px-4 py-2 font-medium">Symbol</th>
                          {selectedTab === "all" && <th className="px-4 py-2 font-medium">Broker</th>}
                          <th className="px-4 py-2 font-medium text-right">Qty</th>
                          <th className="px-4 py-2 font-medium text-right">Avg Cost</th>
                          <th className="px-4 py-2 font-medium text-right">Last Price</th>
                          <th className="px-4 py-2 font-medium text-right">Mkt Value</th>
                          <th className="px-4 py-2 font-medium text-right">Unreal. P&L</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {visibleAccounts.flatMap((acc) =>
                          (holdingsMap[acc.id]?.positions ?? []).map((pos, i) => {
                            const ticker = pos.symbol?.symbol?.symbol ?? "—";
                            const qty = pos.units ?? 0;
                            const isShort = qty < 0;
                            const price = pos.price ?? 0;
                            const avg = pos.average_purchase_price ?? 0;
                            const value = Math.abs(qty * price);
                            const pnl = getPnl(pos);
                            return (
                              <tr key={`${acc.id}-${i}`} className="text-zinc-300 hover:bg-white/[0.02]">
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-semibold text-zinc-100">{ticker}</p>
                                    {isShort && <span className="rounded px-1 py-0.5 text-[9px] font-bold uppercase bg-orange-500/20 text-orange-400">Short</span>}
                                  </div>
                                  <p className="text-[11px] text-zinc-500 truncate max-w-[120px]">{pos.symbol?.symbol?.description ?? ""}</p>
                                </td>
                                {selectedTab === "all" && (
                                  <td className="px-4 py-2.5">
                                    <p className="text-xs text-zinc-400">{acc.institution_name}</p>
                                    <span className="rounded px-1 py-0.5 text-[9px] font-bold uppercase" style={{ backgroundColor: `${accountTypeLabel(acc).color}20`, color: accountTypeLabel(acc).color }}>{accountTypeLabel(acc).label}</span>
                                  </td>
                                )}
                                <td className="px-4 py-2.5 text-right font-mono">{qty}</td>
                                <td className="px-4 py-2.5 text-right">{avg > 0 ? `$${avg.toFixed(2)}` : "—"}</td>
                                <td className="px-4 py-2.5 text-right">${price.toFixed(2)}</td>
                                <td className="px-4 py-2.5 text-right font-medium">{fmt$(value)}</td>
                                <td className={`px-4 py-2.5 text-right font-semibold ${pnl > 0 ? "text-emerald-400" : pnl < 0 ? "text-red-400" : "text-zinc-500"}`}>
                                  {pnl !== 0 ? fmtSign(pnl) : "—"}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Cash & Balances */}
              {!anyHoldingLoading && aggregateBalances.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-[var(--app-card)] p-4">
                  <h3 className="mb-3 text-sm font-semibold text-zinc-200">Cash &amp; Balances</h3>
                  <div className="flex flex-wrap gap-3">
                    {visibleAccounts.flatMap((acc) =>
                      (holdingsMap[acc.id]?.balances ?? []).map((b, i) => {
                        const { label, color } = accountTypeLabel(acc);
                        return (
                          <div key={`${acc.id}-${i}`} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 min-w-[160px]">
                            {selectedTab === "all" && <p className="text-[10px] text-zinc-500">{acc.institution_name}</p>}
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs text-zinc-500">{b.currency?.code ?? "USD"}</p>
                              <span className="rounded px-1 py-0.5 text-[9px] font-bold uppercase" style={{ backgroundColor: `${color}20`, color }}>{label}</span>
                            </div>
                            <p className="mt-1 text-lg font-bold text-zinc-100">{fmt$(b.cash ?? 0)}</p>
                            {b.buying_power != null && b.buying_power !== b.cash && (
                              <p className="text-[11px] text-zinc-500">Buying power: {fmt$(b.buying_power)}</p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Cumulative net P&L chart */}
              {analyticsData.cumulativePnl.length > 1 && (
                <div className="rounded-xl border border-white/10 bg-[var(--app-card)] p-4">
                  <h3 className="mb-1 text-sm font-semibold text-zinc-200">Cumulative Net P&L</h3>
                  <p className="mb-4 text-[11px] text-zinc-500">Running net of all buys (negative) and sells/income (positive)</p>
                  <div className="h-48 [&_svg]:!bg-transparent [&_.recharts-surface]:!bg-transparent">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analyticsData.cumulativePnl} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 10 }} stroke="transparent" interval="preserveStartEnd" />
                        <YAxis tick={{ fill: "#71717a", fontSize: 10 }} stroke="transparent" tickFormatter={(v) => `$${(v as number) >= 1000 || (v as number) <= -1000 ? `${((v as number)/1000).toFixed(1)}k` : v}`} width={55} />
                        <Tooltip
                          cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }}
                          contentStyle={{ backgroundColor: "#18181b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 10px" }}
                          labelStyle={{ color: "#71717a", fontSize: 11 }}
                          itemStyle={{ color: TEAL }}
                          formatter={(v: unknown) => [fmtSign(Number(v)), "Net P&L"]}
                          wrapperStyle={{ zIndex: 50 }}
                          isAnimationActive={false}
                        />
                        <Line type="linear" dataKey="pnl" stroke={TEAL} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: TEAL, stroke: "#18181b", strokeWidth: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Charts grid */}
              <div className="grid gap-4 lg:grid-cols-2">
                {analyticsData.allocation.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-[var(--app-card)] p-4">
                    <h3 className="mb-4 text-sm font-semibold text-zinc-200">Portfolio Allocation</h3>
                    <div className="h-52 [&_svg]:!bg-transparent [&_.recharts-surface]:!bg-transparent">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={analyticsData.allocation} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                            {analyticsData.allocation.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} formatter={(v: unknown) => [fmt$(Number(v)), "Value"]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {analyticsData.pnlBySymbol.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-[var(--app-card)] p-4">
                    <h3 className="mb-4 text-sm font-semibold text-zinc-200">Unrealized P&L by Position</h3>
                    <div className="h-52 [&_svg]:!bg-transparent [&_.recharts-surface]:!bg-transparent">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsData.pnlBySymbol} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                          <XAxis type="number" tick={{ fill: "#71717a", fontSize: 10 }} stroke="transparent" tickFormatter={(v) => `$${(v as number) >= 1000 || (v as number) <= -1000 ? `${((v as number)/1000).toFixed(1)}k` : v}`} />
                          <YAxis type="category" dataKey="symbol" width={48} tick={{ fill: "#a1a1aa", fontSize: 11 }} stroke="transparent" />
                          <Tooltip
                            cursor={{ fill: "rgba(255,255,255,0.04)" }}
                            contentStyle={{ backgroundColor: "#18181b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 10px" }}
                            labelStyle={{ color: "#71717a", fontSize: 11 }}
                            wrapperStyle={{ zIndex: 50 }}
                            isAnimationActive={false}
                            formatter={(v: unknown) => [fmtSign(Number(v)), "P&L"]}
                          />
                          <Bar dataKey="pnl" radius={3} maxBarSize={18}>
                            {analyticsData.pnlBySymbol.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? "#10b981" : "#ef4444"} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {analyticsData.activityBreakdown.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-[var(--app-card)] p-4">
                    <h3 className="mb-4 text-sm font-semibold text-zinc-200">Activity Breakdown</h3>
                    <div className="h-48 [&_svg]:!bg-transparent [&_.recharts-surface]:!bg-transparent">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analyticsData.activityBreakdown} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                          <XAxis dataKey="type" tick={{ fill: "#71717a", fontSize: 9 }} stroke="transparent" />
                          <YAxis tick={{ fill: "#71717a", fontSize: 10 }} stroke="transparent" allowDecimals={false} width={28} />
                          <Tooltip
                            cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }}
                            contentStyle={{ backgroundColor: "#18181b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 10px" }}
                            labelStyle={{ color: "#71717a", fontSize: 11 }}
                            itemStyle={{ color: TEAL }}
                            wrapperStyle={{ zIndex: 50 }}
                            isAnimationActive={false}
                          />
                          <Line type="linear" dataKey="count" stroke={TEAL} strokeWidth={2} dot={{ fill: TEAL, r: 3, stroke: "#18181b", strokeWidth: 1 }} activeDot={{ r: 5, fill: TEAL, stroke: "#18181b", strokeWidth: 2 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {analyticsData.pnlBySymbol.length > 0 && (
                  <div className="space-y-3">
                    {analyticsData.pnlBySymbol[0] && (
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                        <p className="text-xs font-medium uppercase tracking-wider text-emerald-400/80">Best open position</p>
                        <p className="mt-1 text-lg font-bold text-zinc-100">{analyticsData.pnlBySymbol[0].symbol}</p>
                        <p className="font-semibold text-emerald-400">{fmtSign(analyticsData.pnlBySymbol[0].pnl)}</p>
                      </div>
                    )}
                    {analyticsData.pnlBySymbol[analyticsData.pnlBySymbol.length - 1]?.pnl < 0 && (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                        <p className="text-xs font-medium uppercase tracking-wider text-red-400/80">Worst open position</p>
                        <p className="mt-1 text-lg font-bold text-zinc-100">{analyticsData.pnlBySymbol[analyticsData.pnlBySymbol.length - 1].symbol}</p>
                        <p className="font-semibold text-red-400">{fmtSign(analyticsData.pnlBySymbol[analyticsData.pnlBySymbol.length - 1].pnl)}</p>
                      </div>
                    )}
                    {analyticsData.winRate != null && (
                      <div className="rounded-xl border border-white/10 bg-[var(--app-card)] p-4">
                        <p className="text-xs text-zinc-500">Win Rate (closed trades)</p>
                        <p className={`mt-1 text-2xl font-bold ${analyticsData.winRate >= 50 ? "text-emerald-400" : "text-red-400"}`}>{analyticsData.winRate.toFixed(1)}%</p>
                        <p className="text-xs text-zinc-500">{analyticsData.tradeCount} closed trades</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}


          {/* ── ACTIVITY ── */}
          {activeTab === "activity" && (
            <div className="mt-6 rounded-xl border border-white/10 bg-[var(--app-card)]">
              <div className="border-b border-white/10 px-4 py-3">
                <h3 className="text-sm font-semibold text-zinc-200">
                  Transaction History
                  {aggregateActivities.length > 0 && <span className="ml-2 text-xs font-normal text-zinc-500">({aggregateActivities.length})</span>}
                </h3>
              </div>
              {loadingActivitiesSet.size > 0 ? (
                <div className="flex justify-center p-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent-color)]" /></div>
              ) : aggregateActivities.length === 0 ? (
                <p className="px-4 py-6 text-sm text-zinc-500">No activity found.</p>
              ) : (
                <div className="divide-y divide-white/5">
                  {aggregateActivities
                    .sort((a, b) => (a.trade_date ?? "") < (b.trade_date ?? "") ? 1 : -1)
                    .slice(0, 100)
                    .map((act, i) => (
                      <ActivityRow key={act.id ?? i} activity={act} showBroker={selectedTab === "all"} brokerName={
                        selectedTab === "all" ? visibleAccounts.find((a) => activitiesMap[a.id]?.includes(act))?.institution_name : undefined
                      } />
                    ))
                  }
                </div>
              )}
            </div>
          )}


          {/* Manage connections */}
          <div className="mt-10">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Manage Connections</h3>
            <div className="mt-2 space-y-2">
              {accounts.map((acc) => {
                const { label, color } = accountTypeLabel(acc);
                return (
                  <div key={acc.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-[var(--app-card)] px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-zinc-200">{acc.institution_name}</p>
                          <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ backgroundColor: `${color}20`, color }}>{label}</span>
                        </div>
                        <p className="text-xs text-zinc-500">{acc.name ?? (acc.number ? `Account ····${acc.number.slice(-4)}` : "Connected")}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDisconnect(acc.brokerage_authorization, acc.id)}
                      disabled={!!disconnecting}
                      className="text-xs text-zinc-500 hover:text-red-400 disabled:opacity-40"
                    >
                      {disconnecting === acc.brokerage_authorization ? "Disconnecting…" : "Disconnect"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BrokerTab({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm transition ${active ? "border-transparent font-semibold text-[#020308]" : "border-white/10 text-zinc-400 hover:text-zinc-200"}`}
      style={active ? { backgroundColor: TEAL } : {}}>
      {children}
    </button>
  );
}

function StatCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[var(--app-card)] p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold truncate" style={{ color: valueColor ?? "#f4f4f5" }}>{value}</p>
    </div>
  );
}

function ActivityRow({ activity, showBroker, brokerName }: { activity: Activity; showBroker?: boolean; brokerName?: string }) {
  const type = activity.type ?? "";
  const ticker = activity.symbol?.symbol ?? "—";
  const date = activity.trade_date
    ? new Date(activity.trade_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";
  const amount = activity.amount ?? 0;
  const isBuy = type === "BUY";
  const isSell = type === "SELL";
  const isDividend = type === "DIVIDEND" || type === "REI" || type === "INTEREST";
  const currency = activity.currency?.code ?? "USD";

  const typeColor = isBuy ? "bg-emerald-500/20 text-emerald-400"
    : isSell ? "bg-red-500/20 text-red-400"
    : isDividend ? "bg-blue-500/20 text-blue-400"
    : "bg-white/10 text-zinc-400";

  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02]">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${typeColor}`}>{type || "—"}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-200">{ticker !== "—" ? ticker : activity.description ?? "—"}</p>
          <div className="flex items-center gap-2">
            {activity.units != null && activity.price != null && (
              <p className="text-xs text-zinc-500">{activity.units} @ ${activity.price.toFixed(2)}</p>
            )}
            {showBroker && brokerName && <p className="text-xs text-zinc-600">{brokerName}</p>}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4 pl-4">
        <span className={`text-sm font-semibold ${amount > 0 ? "text-emerald-400" : amount < 0 ? "text-red-400" : "text-zinc-400"}`}>
          {amount !== 0 ? `${amount > 0 ? "+" : "-"}${currency} $${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
        </span>
        <span className="w-28 text-right text-xs text-zinc-600">{date}</span>
      </div>
    </div>
  );
}
