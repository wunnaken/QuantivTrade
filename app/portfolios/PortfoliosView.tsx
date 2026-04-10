"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLivePrices } from "../../lib/hooks/useLivePrice";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ThematicHolding {
  ticker: string;
  rank: number;
  weight: number;
  price: number | null;
  changePercent: number | null;
  change: number | null;
}

interface ThematicPortfolio {
  id: string;
  name: string;
  description: string;
  color: string;
  tickers: string[];
  holdings: ThematicHolding[];
  dayChangePct: number | null;
  bestPerformer: { ticker: string; changePercent: number } | null;
  worstPerformer: { ticker: string; changePercent: number } | null;
}

type InvestorChange = "NEW" | "INCREASED" | "DECREASED" | "CLOSED" | "UNCHANGED";

interface InvestorHolding {
  rank: number;
  ticker: string;
  companyName: string;
  value: number;
  shares: number;
  portfolioPct: number;
  change: InvestorChange;
  changePct: number | null;
  price?: number | null;
  changePercent?: number | null;
  dayChange?: number | null;
}

interface FamousInvestor {
  id: string;
  name: string;
  fund: string;
  style: string;
  cik: string;
  filingDate: string | null;
  filingPeriod: string | null;
  nextFilingEst: string | null;
  totalValue: number;
  holdingsCount: number;
  holdings: InvestorHolding[];
  changes: { newPositions: number; increased: number; decreased: number; closed: number };
}

interface ChartPoint { t: number; value: number }

// ─── Constants ────────────────────────────────────────────────────────────────

const TIMEFRAMES = ["1D","1W","1M","3M","YTD","1Y"] as const;
type Timeframe = typeof TIMEFRAMES[number];


const STYLE_COLORS: Record<string, string> = {
  Value: "#3b82f6",
  Growth: "#8b5cf6",
  Macro: "#f59e0b",
  Activist: "#ef4444",
  Contrarian: "#71717a",
  Distressed: "#f97316",
};

const CHANGE_STYLES: Record<InvestorChange, { label: string; bg: string; text: string }> = {
  NEW: { label: "NEW", bg: "bg-emerald-500/15", text: "text-emerald-400" },
  INCREASED: { label: "↑", bg: "bg-blue-500/15", text: "text-blue-400" },
  DECREASED: { label: "↓", bg: "bg-amber-500/15", text: "text-amber-400" },
  CLOSED: { label: "CLOSED", bg: "bg-red-500/15", text: "text-red-400" },
  UNCHANGED: { label: "—", bg: "bg-white/5", text: "text-zinc-500" },
};

const THEMATIC_CATEGORIES: Record<string, string[]> = {
  Tech: ["ai", "cyber", "gaming", "5g"],
  Energy: ["nuclear", "oil", "clean"],
  Finance: ["banks", "reits", "crypto"],
  Healthcare: ["biotech", "genomics"],
  Consumer: ["consumer", "luxury"],
  Defense: ["defense", "space"],
  Other: ["ev", "infrastructure", "emerging", "ag"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Map portfolio crypto tickers to the symbol that useLivePrices / ticker-quote understands
const CRYPTO_LIVE_MAP: Record<string, string> = {
  "BTC-USD": "BTC",
  "ETH-USD": "ETH",
  "SOL-USD": "SOL",
  "BNB-USD": "BNB",
  "XRP-USD": "XRP",
  "ADA-USD": "ADA",
  "AVAX-USD": "AVAX",
  "DOT-USD": "DOT",
};
function toLiveSymbol(ticker: string): string {
  return CRYPTO_LIVE_MAP[ticker] ?? ticker;
}

function pct(n: number | null, decimals = 2): string {
  if (n == null) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(decimals) + "%";
}

function pctColor(n: number | null): string {
  if (n == null) return "text-zinc-500";
  return n >= 0 ? "text-emerald-400" : "text-red-400";
}

function fmtMoney(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtTs(t: number, tf: Timeframe): string {
  const d = new Date(t * 1000);
  if (tf === "1D") return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TimeframePicker({ value, onChange }: { value: Timeframe; onChange: (tf: Timeframe) => void }) {
  return (
    <div className="flex gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          onClick={() => onChange(tf)}
          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
            value === tf ? "bg-white/10 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent-color)]" />
    </div>
  );
}

function AIAnalysisCard({
  type, name, description, style, holdings, dayChangePct, filingPeriod,
}: {
  type: "thematic" | "famous";
  name: string;
  description?: string;
  style?: string;
  holdings: Array<{ ticker: string; companyName?: string; portfolioPct?: number; changePercent?: number | null; change?: InvestorChange }>;
  dayChangePct?: number | null;
  filingPeriod?: string | null;
}) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  async function load() {
    if (fetched || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/portfolios/ai-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name, description, style, holdings, dayChangePct, filingPeriod }),
      });
      const data = (await res.json()) as { analysis?: string };
      setAnalysis(data.analysis ?? null);
    } catch {
      setAnalysis(null);
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Analysis</span>
        {!fetched && !loading && (
          <button
            onClick={load}
            className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-zinc-500 hover:text-white hover:border-white/20 transition-colors"
          >
            Generate
          </button>
        )}
      </div>
      {loading && (
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <div className="h-2.5 w-2.5 animate-spin rounded-full border border-zinc-500 border-t-transparent" />
          Analyzing...
        </div>
      )}
      {analysis && <p className="text-[11px] leading-relaxed text-zinc-400">{analysis}</p>}
      {fetched && !analysis && !loading && (
        <p className="text-[11px] text-zinc-600">Unavailable.</p>
      )}
    </div>
  );
}

// ─── Portfolio Chart (calls /api/portfolios/chart — server batches Finnhub) ───

const SKIP_TICKERS_CLIENT = new Set([
  "BTC-USD","ETH-USD","SOL-USD","BNB-USD","XRP-USD","ADA-USD","AVAX-USD","DOT-USD",
]);

interface ChartData {
  points: ChartPoint[];
  benchmark: ChartPoint[];
  tickerPerf: Record<string, number>; // ticker → final normalized %
}

// Module-level cache — persists across component mounts/unmounts on the same page
const _chartCache = new Map<string, ChartData>();

function usePortfolioChart(tickers: string[], timeframe: Timeframe, cacheKey: string): { data: ChartData | null; loading: boolean } {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const tickersKey = tickers.join(",");

  useEffect(() => {
    const tf = timeframe.toLowerCase(); // "YTD" → "ytd", "1D" → "1d", etc.
    const key = `${cacheKey}:${timeframe}`;
    if (_chartCache.has(key)) { setData(_chartCache.get(key)!); setLoading(false); return; }

    setLoading(true);
    const stockTickers = tickers.filter((t) => !SKIP_TICKERS_CLIENT.has(t));
    const params = new URLSearchParams({ id: cacheKey, tf });
    if (stockTickers.length) params.set("tickers", stockTickers.join(","));

    fetch(`/api/portfolios/chart?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        const result: ChartData = {
          points: d?.points ?? [],
          benchmark: d?.benchmark ?? [],
          tickerPerf: d?.tickerPerf ?? {},
        };
        _chartCache.set(key, result);
        setData(result);
      })
      .catch(() => setData({ points: [], benchmark: [], tickerPerf: {} }))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, timeframe, tickersKey]);

  return { data, loading };
}

function PortfolioLineChart({ data, loading, color, timeframe }: { data: ChartData | null; loading: boolean; color: string; timeframe: Timeframe }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[220px]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent-color)]" />
      </div>
    );
  }
  if (!data || (!data.points.length && !data.benchmark.length)) {
    return <div className="flex items-center justify-center h-[220px] text-xs text-zinc-600">No chart data</div>;
  }

  const tsMap = new Map<number, { portfolio?: number; spy?: number }>();
  data.points.forEach((p) => { const e = tsMap.get(p.t) ?? {}; tsMap.set(p.t, { ...e, portfolio: p.value }); });
  data.benchmark.forEach((p) => { const e = tsMap.get(p.t) ?? {}; tsMap.set(p.t, { ...e, spy: p.value }); });
  const chartData = [...tsMap.entries()].sort(([a], [b]) => a - b).map(([t, v]) => ({ t, portfolio: v.portfolio ?? null, spy: v.spy ?? null }));
  const lastPct = data.points.length ? data.points[data.points.length - 1].value : null;

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: number }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-white/10 bg-[var(--app-bg)] px-3 py-2 text-xs shadow-xl">
        <p className="text-zinc-500 mb-1">{label ? fmtTs(label, timeframe) : ""}</p>
        {payload.map((p) => <p key={p.name} style={{ color: p.color }}>{p.name}: {pct(p.value)}</p>)}
      </div>
    );
  };

  return (
    <div>
      {lastPct != null && <p className={`text-lg font-bold tabular-nums mb-1 ${pctColor(lastPct)}`}>{pct(lastPct)}</p>}
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis dataKey="t" tickFormatter={(v) => fmtTs(v as number, timeframe)} tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tickFormatter={(v) => `${(v as number) > 0 ? "+" : ""}${(v as number).toFixed(1)}%`} tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false} width={44} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="portfolio" stroke={color} strokeWidth={2} dot={false} name="Portfolio" connectNulls />
          <Line type="monotone" dataKey="spy" stroke="#52525b" strokeWidth={1.5} dot={false} name="SPY" strokeDasharray="4 3" connectNulls />
          <Legend iconType="line" iconSize={12} formatter={(value) => <span style={{ fontSize: 9, color: "#71717a" }}>{value}</span>} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Ticker Performance Bars (replaces Radar) ─────────────────────────────────

function TickerPerfBars({ tickerPerf, color, timeframe, loading }: { tickerPerf: Record<string, number>; color: string; timeframe: Timeframe; loading?: boolean }) {
  const entries = Object.entries(tickerPerf).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    return (
      <div className="flex items-center justify-center py-4">
        {loading
          ? <div className="h-4 w-4 animate-spin rounded-full border border-white/20 border-t-zinc-400" />
          : <p className="text-xs text-zinc-600">No data</p>
        }
      </div>
    );
  }
  const maxAbs = Math.max(...entries.map(([, v]) => Math.abs(v)), 0.01);

  return (
    <div className="space-y-1.5 py-1">
      <p className="text-[9px] text-zinc-600 mb-2 uppercase tracking-wider">{timeframe} return per holding</p>
      {entries.map(([ticker, perf]) => {
        const isUp = perf >= 0;
        const barPct = (Math.abs(perf) / maxAbs) * 50; // 50% = max width per side
        return (
          <div key={ticker} className="flex items-center gap-2 text-[10px]">
            <span className="w-11 text-right font-mono text-zinc-400 shrink-0">{ticker}</span>
            <div className="flex-1 relative h-3.5 flex items-center">
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-white/5" />
              <div className="absolute left-1/2 top-1/2 -translate-y-1/2 w-px h-3 bg-white/15" />
              {isUp
                ? <div className="absolute left-1/2 top-1/2 -translate-y-1/2 h-2.5 rounded-r-sm" style={{ width: `${barPct}%`, background: color + "cc" }} />
                : <div className="absolute right-1/2 top-1/2 -translate-y-1/2 h-2.5 rounded-l-sm bg-red-500/70" style={{ width: `${barPct}%` }} />
              }
            </div>
            <span className={`w-14 tabular-nums ${isUp ? "text-emerald-400" : "text-red-400"}`}>
              {isUp ? "+" : ""}{perf.toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Thematic Tab ─────────────────────────────────────────────────────────────

function ThematicCard({
  portfolio,
  isExpanded,
  onToggle,
  livePrices,
}: {
  portfolio: ThematicPortfolio;
  isExpanded: boolean;
  onToggle: () => void;
  livePrices: ReturnType<typeof useLivePrices>;
}) {
  const topHoldings = portfolio.holdings.slice(0, 3);

  // Compute live day change pct average from live prices where available
  const liveChanges = portfolio.holdings
    .map((h) => livePrices[toLiveSymbol(h.ticker)]?.changePercent)
    .filter((v): v is number => v != null);
  const liveDayChangePct = liveChanges.length > 0
    ? liveChanges.reduce((s, v) => s + v, 0) / liveChanges.length
    : portfolio.dayChangePct;

  return (
    <button
      onClick={onToggle}
      className="text-left w-full rounded-2xl border border-white/10 bg-[var(--app-card-alt)] overflow-hidden transition-all duration-200 hover:border-white/20 hover:bg-white/[0.025]"
      style={{ borderLeft: `3px solid ${portfolio.color}` }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="text-sm font-semibold text-zinc-100">{portfolio.name}</p>
            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{portfolio.description}</p>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-lg font-bold tabular-nums ${pctColor(liveDayChangePct)}`}>
              {pct(liveDayChangePct)}
            </p>
            <p className="text-[10px] text-zinc-600">today</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {topHoldings.map((h) => {
            const sym = toLiveSymbol(h.ticker);
            const live = livePrices[sym];
            const cp = (live && !live.isLoading && live.changePercent != null) ? live.changePercent : h.changePercent;
            return (
              <span
                key={h.ticker}
                className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[10px]"
              >
                <span className="text-zinc-300 font-medium">{h.ticker}</span>
                <span className={pctColor(cp)}>{pct(cp, 1)}</span>
              </span>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex gap-3 text-[10px] text-zinc-600">
            {portfolio.bestPerformer && (
              <span>Best: <span className="text-emerald-400">{portfolio.bestPerformer.ticker}</span></span>
            )}
            {portfolio.worstPerformer && (
              <span>Worst: <span className="text-red-400">{portfolio.worstPerformer.ticker}</span></span>
            )}
          </div>
          <span className="text-xs text-zinc-500">
            {isExpanded ? "Collapse ↑" : "View →"}
          </span>
        </div>
      </div>
    </button>
  );
}

function ThematicDetail({ portfolio }: { portfolio: ThematicPortfolio }) {
  const [tf, setTf] = useState<Timeframe>("YTD");

  // Client-side chart data (used for both SPY line chart and ticker perf bars)
  const stockTickers = useMemo(
    () => portfolio.tickers.filter((t) => !SKIP_TICKERS_CLIENT.has(t)),
    [portfolio.tickers]
  );
  const { data: chartData, loading: chartLoading } = usePortfolioChart(stockTickers, tf, portfolio.id);

  // Live prices via WebSocket + REST for this portfolio's tickers
  const liveSymbols = useMemo(
    () => portfolio.tickers.map(toLiveSymbol),
    [portfolio.tickers]
  );
  const livePrices = useLivePrices(liveSymbols);

  // Merge live data over API data: use live price when available and non-null
  const holdings = useMemo(() => portfolio.holdings.map((h) => {
    const sym = toLiveSymbol(h.ticker);
    const live = livePrices[sym];
    if (live && !live.isLoading && live.price != null) {
      return { ...h, price: live.price, changePercent: live.changePercent, change: live.change };
    }
    return h;
  }), [portfolio.holdings, livePrices]);


  return (
    <div className="col-span-full rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-5 space-y-5"
      style={{ borderLeft: `3px solid ${portfolio.color}` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-semibold" style={{ color: portfolio.color }}>{portfolio.name}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{portfolio.description} · {portfolio.holdings.length} holdings · Equal weighted</p>
        </div>
        <TimeframePicker value={tf} onChange={setTf} />
      </div>

      {/* Main chart */}
      {portfolio.id !== "crypto" && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-3">Performance vs SPY</p>
          <PortfolioLineChart data={chartData} loading={chartLoading} color={portfolio.color} timeframe={tf} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Holdings table */}
        <div className="lg:col-span-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5 text-zinc-600 uppercase tracking-wider">
                <th className="pb-2 text-left w-6">#</th>
                <th className="pb-2 text-left">Ticker</th>
                <th className="pb-2 text-right">Weight</th>
                <th className="pb-2 text-right">Price</th>
                <th className="pb-2 text-right">Day %</th>
                <th className="pb-2 text-right hidden sm:table-cell pl-4">Chg $</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {holdings.map((h) => {
                const sym = toLiveSymbol(h.ticker);
                const isLive = livePrices[sym] && !livePrices[sym].isLoading && livePrices[sym].price != null;
                return (
                  <tr key={h.ticker} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2 text-zinc-600">{h.rank}</td>
                    <td className="py-2 font-medium text-zinc-200">
                      {h.ticker}
                      {isLive && <span className="ml-1.5 inline-block h-1 w-1 rounded-full bg-emerald-500 align-middle" title="Live" />}
                    </td>
                    <td className="py-2 text-right text-zinc-400">{h.weight}%</td>
                    <td className="py-2 text-right text-zinc-300 tabular-nums">
                      {h.price != null ? `$${h.price < 1 ? h.price.toFixed(4) : h.price.toFixed(2)}` : "—"}
                    </td>
                    <td className={`py-2 text-right font-medium tabular-nums ${pctColor(h.changePercent)}`}>
                      {pct(h.changePercent, 2)}
                    </td>
                    <td className={`py-2 hidden sm:table-cell pl-4 text-right tabular-nums text-xs font-medium ${pctColor(h.change)}`}>
                      {h.change != null
                        ? `${h.change >= 0 ? "+" : ""}${Math.abs(h.change) < 0.01 ? h.change.toFixed(4) : h.change.toFixed(2)}`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right: radar + AI */}
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-1">Holdings Breakdown</p>
            <TickerPerfBars
              tickerPerf={chartData?.tickerPerf ?? {}}
              color={portfolio.color}
              timeframe={tf}
              loading={chartLoading}
            />
          </div>
          <AIAnalysisCard
            type="thematic"
            name={portfolio.name}
            description={portfolio.description}
            holdings={holdings.map((h) => ({ ticker: h.ticker, changePercent: h.changePercent }))}
            dayChangePct={portfolio.dayChangePct}
          />
        </div>
      </div>
    </div>
  );
}

function ThematicTab({ portfolios, loading }: { portfolios: ThematicPortfolio[]; loading: boolean }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [expanded, setExpanded] = useState<string | null>(null);

  const categoryIds = useMemo(() => {
    if (category === "All") return null;
    return THEMATIC_CATEGORIES[category] ?? null;
  }, [category]);

  const filtered = useMemo(() => {
    return portfolios.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryIds && !categoryIds.includes(p.id)) return false;
      return true;
    });
  }, [portfolios, search, categoryIds]);

  const expandedPortfolio = expanded ? filtered.find((p) => p.id === expanded) ?? null : null;

  // Subscribe to live prices for all top-3 tickers across visible portfolios
  const visibleTopTickers = useMemo(
    () => [...new Set(filtered.flatMap((p) => p.holdings.slice(0, 3).map((h) => toLiveSymbol(h.ticker))))],
    [filtered]
  );
  const livePrices = useLivePrices(visibleTopTickers);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => (prev === id ? null : id));
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search portfolios..."
          className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-white/20 transition-colors"
        />
        <div className="flex gap-1.5 flex-wrap">
          {["All", "Tech", "Energy", "Finance", "Healthcare", "Consumer", "Defense", "Other"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                category === cat
                  ? "bg-[var(--accent-color)] text-black"
                  : "border border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/20"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((portfolio) => (
          <React.Fragment key={portfolio.id}>
            <ThematicCard
              portfolio={portfolio}
              isExpanded={expanded === portfolio.id}
              onToggle={() => toggleExpand(portfolio.id)}
              livePrices={livePrices}
            />
            {expanded === portfolio.id && expandedPortfolio && (
              <ThematicDetail portfolio={expandedPortfolio} />
            )}
          </React.Fragment>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-zinc-600">No portfolios match your filters.</div>
      )}
    </div>
  );
}

// ─── Famous Investors Tab ─────────────────────────────────────────────────────

function InvestorCard({
  investor,
  isExpanded,
  onToggle,
}: {
  investor: FamousInvestor;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const styleColor = STYLE_COLORS[investor.style] ?? "#71717a";
  const topHoldings = investor.holdings.slice(0, 3);

  return (
    <button
      onClick={onToggle}
      className="text-left w-full rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4 transition-all duration-200 hover:border-white/20 hover:bg-white/[0.025]"
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-sm font-bold text-white"
          style={{ background: styleColor + "33", border: `1px solid ${styleColor}55` }}
        >
          {getInitials(investor.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-100">{investor.name}</p>
          <p className="text-xs text-zinc-500 truncate">{investor.fund}</p>
        </div>
        <span
          className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium"
          style={{ background: styleColor + "22", color: styleColor }}
        >
          {investor.style}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {topHoldings.map((h) => (
          <span key={`${h.ticker}-${h.rank}`} className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-zinc-300 font-medium">
            {h.ticker}
            {h.portfolioPct > 0 && <span className="text-zinc-600 ml-1">{h.portfolioPct.toFixed(1)}%</span>}
          </span>
        ))}
        {investor.holdings.length === 0 && (
          <span className="text-[10px] text-zinc-600">Fetching filing data…</span>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-zinc-600">
        <div className="flex gap-3">
          <span>Filed: <span className="text-zinc-400">{fmtDate(investor.filingDate)}</span></span>
          {investor.totalValue > 0 && <span>{fmtMoney(investor.totalValue * 1000)} AUM</span>}
        </div>
        <span className="text-zinc-500">{isExpanded ? "Collapse ↑" : "View →"}</span>
      </div>
    </button>
  );
}

function InvestorDetail({ investor }: { investor: FamousInvestor }) {
  const styleColor = STYLE_COLORS[investor.style] ?? "#71717a";
  const { newPositions, increased, decreased, closed } = investor.changes;
  const [tf, setTf] = useState<Timeframe>("YTD");

  // Build top ticker list for chart (valid US tickers only)
  const chartTickerList = useMemo(
    () => investor.holdings
      .filter((h) => h.ticker && h.ticker.length <= 5 && /^[A-Z.]+$/.test(h.ticker))
      .slice(0, 8)
      .map((h) => h.ticker),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [investor.id]
  );
  const { data: chartData, loading: chartLoading } = usePortfolioChart(chartTickerList, tf, investor.id);

  return (
    <div className="col-span-full rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div
            className="h-14 w-14 shrink-0 rounded-full flex items-center justify-center text-lg font-bold text-white"
            style={{ background: styleColor + "33", border: `2px solid ${styleColor}55` }}
          >
            {getInitials(investor.name)}
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-100">{investor.name}</h3>
            <p className="text-xs text-zinc-500">{investor.fund}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="rounded-md px-2 py-0.5 text-[10px] font-medium" style={{ background: styleColor + "22", color: styleColor }}>
                {investor.style}
              </span>
              {investor.totalValue > 0 && (
                <span className="text-[10px] text-zinc-500">{fmtMoney(investor.totalValue * 1000)} AUM · {investor.holdingsCount} positions</span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right text-xs text-zinc-500 shrink-0">
          <p>Filed: <span className="text-zinc-300">{fmtDate(investor.filingDate)}</span></p>
          <p className="mt-0.5">Period: <span className="text-zinc-300">{investor.filingPeriod ?? "—"}</span></p>
          {investor.nextFilingEst && (
            <p className="mt-0.5">Next est: <span className="text-zinc-300">{fmtDate(investor.nextFilingEst)}</span></p>
          )}
        </div>
      </div>

      {/* Changes summary */}
      {(newPositions + increased + decreased + closed) > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {newPositions > 0 && <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-400">{newPositions} new</span>}
          {increased > 0 && <span className="rounded-md bg-blue-500/10 px-2 py-1 text-blue-400">{increased} increased</span>}
          {decreased > 0 && <span className="rounded-md bg-amber-500/10 px-2 py-1 text-amber-400">{decreased} decreased</span>}
          {closed > 0 && <span className="rounded-md bg-red-500/10 px-2 py-1 text-red-400">{closed} closed</span>}
        </div>
      )}

      {/* Performance chart */}
      {chartTickerList.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Portfolio vs SPY</p>
            <TimeframePicker value={tf} onChange={setTf} />
          </div>
          <PortfolioLineChart data={chartData} loading={chartLoading} color={styleColor} timeframe={tf} />
        </div>
      )}

      {investor.holdings.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Holdings table */}
          <div className="lg:col-span-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5 text-zinc-600 uppercase tracking-wider">
                  <th className="pb-2 text-left w-6">#</th>
                  <th className="pb-2 text-left">Ticker</th>
                  <th className="pb-2 text-left hidden sm:table-cell">Company</th>
                  <th className="pb-2 text-right">% Port.</th>
                  <th className="pb-2 text-right">Value</th>
                  <th className="pb-2 text-right hidden sm:table-cell">Today</th>
                  <th className="pb-2 text-right">Qtr</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {investor.holdings.map((h) => {
                  const cs = CHANGE_STYLES[h.change];
                  const isUp = (h.changePercent ?? 0) >= 0;
                  return (
                    <tr key={`${h.ticker}-${h.rank}`} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2 text-zinc-600">{h.rank}</td>
                      <td className="py-2 font-medium text-zinc-200">{h.ticker}</td>
                      <td className="py-2 text-zinc-500 max-w-[140px] truncate hidden sm:table-cell">{h.companyName}</td>
                      <td className="py-2 text-right text-zinc-300 tabular-nums">{h.portfolioPct.toFixed(1)}%</td>
                      <td className="py-2 text-right text-zinc-400 tabular-nums">{fmtMoney(h.value * 1000)}</td>
                      <td className={`py-2 text-right tabular-nums font-medium hidden sm:table-cell ${h.changePercent != null ? pctColor(h.changePercent) : "text-zinc-600"}`}>
                        {h.changePercent != null ? pct(h.changePercent, 2) : "—"}
                      </td>
                      <td className="py-2 text-right">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-semibold ${cs.bg} ${cs.text}`}>
                          {cs.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Right: ticker perf bars + Analysis */}
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <TickerPerfBars
                tickerPerf={chartData?.tickerPerf ?? {}}
                color={styleColor}
                timeframe={tf}
                loading={chartLoading}
              />
            </div>
            <AIAnalysisCard
              type="famous"
              name={investor.name}
              style={investor.style}
              holdings={investor.holdings.map((h) => ({ ticker: h.ticker, companyName: h.companyName, portfolioPct: h.portfolioPct, change: h.change, changePercent: h.changePercent }))}
              filingPeriod={investor.filingPeriod}
            />
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-zinc-600">
          13F data not yet available — SEC EDGAR parsing in progress.
        </div>
      )}
    </div>
  );
}

function FamousTab({ investors, loading }: { investors: FamousInvestor[]; loading: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => (prev === id ? null : id));
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {investors.map((investor) => (
        <React.Fragment key={investor.id}>
          <InvestorCard
            investor={investor}
            isExpanded={expanded === investor.id}
            onToggle={() => toggle(investor.id)}
          />
          {expanded === investor.id && (
            <InvestorDetail key={`detail-${investor.id}`} investor={investor} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Comparison Tool ──────────────────────────────────────────────────────────

function ComparisonTool({
  thematic,
  famous,
}: {
  thematic: ThematicPortfolio[];
  famous: FamousInvestor[];
}) {
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");

  function getPortfolioData(id: string) {
    if (id.startsWith("t:")) {
      const p = thematic.find((t) => t.id === id.slice(2));
      if (!p) return null;
      return { name: p.name, color: p.color, dayChange: p.dayChangePct, topTickers: p.tickers.slice(0, 5) };
    }
    const inv = famous.find((f) => f.id === id.slice(2));
    if (!inv) return null;
    return {
      name: inv.name,
      color: STYLE_COLORS[inv.style] ?? "#71717a",
      dayChange: null as number | null,
      topTickers: inv.holdings.slice(0, 5).map((h) => h.ticker),
    };
  }

  const left = leftId ? getPortfolioData(leftId) : null;
  const right = rightId ? getPortfolioData(rightId) : null;
  const overlap = left && right ? left.topTickers.filter((t) => right.topTickers.includes(t)) : [];

  const selectClass = "rounded-lg border border-white/10 bg-[#0d1120] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-white/20 transition-colors appearance-none";

  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-color)]/70 mb-1">Compare Portfolios</p>
      <h3 className="text-sm font-semibold text-zinc-200 mb-4">Side-by-side comparison</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <select value={leftId} onChange={(e) => setLeftId(e.target.value)} className={selectClass} style={{ colorScheme: "dark" }}>
          <option value="">Select first portfolio...</option>
          <optgroup label="Thematic">
            {thematic.map((p) => <option key={p.id} value={`t:${p.id}`}>{p.name}</option>)}
          </optgroup>
          <optgroup label="Famous Investors">
            {famous.map((i) => <option key={i.id} value={`f:${i.id}`}>{i.name}</option>)}
          </optgroup>
        </select>

        <select value={rightId} onChange={(e) => setRightId(e.target.value)} className={selectClass} style={{ colorScheme: "dark" }}>
          <option value="">Select second portfolio...</option>
          <optgroup label="Thematic">
            {thematic.map((p) => <option key={p.id} value={`t:${p.id}`}>{p.name}</option>)}
          </optgroup>
          <optgroup label="Famous Investors">
            {famous.map((i) => <option key={i.id} value={`f:${i.id}`}>{i.name}</option>)}
          </optgroup>
        </select>
      </div>

      {left && right ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border p-3 text-center" style={{ borderColor: left.color + "44" }}>
            <p className="text-xs font-medium" style={{ color: left.color }}>{left.name}</p>
            {left.dayChange != null && (
              <p className={`text-lg font-bold tabular-nums mt-1 ${pctColor(left.dayChange)}`}>{pct(left.dayChange)}</p>
            )}
            <div className="flex flex-wrap gap-1 justify-center mt-2">
              {left.topTickers.map((t) => (
                <span key={t} className="text-[10px] rounded bg-white/5 px-1.5 py-0.5 text-zinc-400">{t}</span>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-2">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Overlap</p>
            {overlap.length > 0 ? (
              <div className="flex flex-wrap gap-1 justify-center">
                {overlap.map((t) => (
                  <span key={t} className="text-[10px] rounded bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 px-1.5 py-0.5 text-[var(--accent-color)]">{t}</span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-600">No overlap</p>
            )}
          </div>

          <div className="rounded-xl border p-3 text-center" style={{ borderColor: right.color + "44" }}>
            <p className="text-xs font-medium" style={{ color: right.color }}>{right.name}</p>
            {right.dayChange != null && (
              <p className={`text-lg font-bold tabular-nums mt-1 ${pctColor(right.dayChange)}`}>{pct(right.dayChange)}</p>
            )}
            <div className="flex flex-wrap gap-1 justify-center mt-2">
              {right.topTickers.map((t) => (
                <span key={t} className="text-[10px] rounded bg-white/5 px-1.5 py-0.5 text-zinc-400">{t}</span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-zinc-600">
          Select two portfolios above to compare them.
        </div>
      )}
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function PortfoliosView() {
  const [tab, setTab] = useState<"thematic" | "famous">("thematic");
  const [thematicData, setThematicData] = useState<ThematicPortfolio[]>([]);
  const [famousData, setFamousData] = useState<FamousInvestor[]>([]);
  const [thematicLoading, setThematicLoading] = useState(true);
  const [famousLoading, setFamousLoading] = useState(true);
  const fetchedRef = useRef({ thematic: false, famous: false });

  function fetchThematic(initial = false) {
    if (initial) setThematicLoading(true);
    fetch("/api/portfolios/thematic")
      .then((r) => r.json())
      .then((d: { portfolios?: ThematicPortfolio[] }) => setThematicData(d.portfolios ?? []))
      .catch(() => {})
      .finally(() => { if (initial) setThematicLoading(false); });
  }

  useEffect(() => {
    if (!fetchedRef.current.thematic) {
      fetchedRef.current.thematic = true;
      fetchThematic(true);
    }
    // Refresh card data every 60s
    const interval = setInterval(() => fetchThematic(false), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (tab === "famous" && !fetchedRef.current.famous) {
      fetchedRef.current.famous = true;
      fetch("/api/portfolios/famous")
        .then((r) => r.json())
        .then((d: { investors?: FamousInvestor[] }) => setFamousData(d.investors ?? []))
        .catch(() => setFamousData([]))
        .finally(() => setFamousLoading(false));
    }
  }, [tab]);

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-1 w-fit">
        {(["thematic", "famous"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? "bg-white/10 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t === "thematic" ? "Thematic Portfolios" : "Famous Investors"}
          </button>
        ))}
      </div>

      {tab === "thematic" && <ThematicTab portfolios={thematicData} loading={thematicLoading} />}
      {tab === "famous" && <FamousTab investors={famousData} loading={famousLoading} />}

      {(thematicData.length > 0 || famousData.length > 0) && (
        <ComparisonTool thematic={thematicData} famous={famousData} />
      )}
    </div>
  );
}
