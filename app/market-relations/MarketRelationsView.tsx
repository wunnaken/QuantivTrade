"use client";

import React, { useState, useEffect, useCallback, useRef, useReducer, Component, type ReactNode } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Section Error Boundary ──────────────────────────────────────────────────

class SectionErrorBoundary extends Component<
  { name: string; children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { name: string; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-center">
          <p className="text-xs font-medium text-red-400">Failed to render {this.props.name}</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 rounded-lg bg-white/10 px-3 py-1.5 text-[10px] text-zinc-300 hover:bg-white/15"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PerformanceEntry = { "1d"?: number | null; "1w"?: number | null; "1m"?: number | null; price?: number | null };

type CorrelationData = {
  matrix: Record<string, Record<string, number | null>>;
  tickers: string[];
  surprisingPairs: SurprisingPair[];
  safeHavenScores: Record<string, number | null>;
  performance: Record<string, Record<string, PerformanceEntry>>;
  normalizedSeries: Record<string, Array<{ date: string; value: number }>>;
  days: number;
};

type SurprisingPair = {
  assetA: string; assetB: string;
  classA: string; classB: string;
  correlation: number; surprise_score: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSETS: Record<string, string[]> = {
  us_indices:      ["SPY", "QQQ", "DIA", "IWM", "VIX"],
  global_indices:  ["EWJ", "FXI", "EWG", "EWU", "EWA", "EWZ", "INDA", "EWY"],
  precious_metals: ["GLD", "SLV", "PPLT", "PALL"],
  commodities:     ["USO", "BNO", "UNG", "CPER", "WEAT", "CORN"],
  forex:           ["UUP", "FXE", "FXY", "FXB", "CYB"],
  bonds:           ["TLT", "IEF", "SHY", "HYG", "EMB", "BNDX"],
  crypto:          ["BTC-USD", "ETH-USD"],
  volatility:      ["VIXY"],
};

const TICKER_CLASS: Record<string, string> = {};
for (const [cls, tickers] of Object.entries(ASSETS)) {
  for (const t of tickers) TICKER_CLASS[t] = cls;
}

const CLASS_COLORS: Record<string, string> = {
  us_indices:      "#6366f1",
  global_indices:  "#8b5cf6",
  precious_metals: "#f59e0b",
  commodities:     "#f97316",
  forex:           "#06b6d4",
  bonds:           "#3b82f6",
  crypto:          "#a855f7",
  volatility:      "#ef4444",
};

const CLASS_LABELS: Record<string, string> = {
  us_indices:      "US Indices",
  global_indices:  "Global Indices",
  precious_metals: "Precious Metals",
  commodities:     "Commodities",
  forex:           "Forex",
  bonds:           "Bonds",
  crypto:          "Crypto",
  volatility:      "Volatility",
};

const CLASS_ORDER = [
  "us_indices", "global_indices", "precious_metals", "commodities",
  "forex", "bonds", "crypto", "volatility",
];

const TICKER_NAMES: Record<string, string> = {
  // US Indices
  SPY: "S&P 500 ETF", QQQ: "Nasdaq 100 ETF", DIA: "Dow Jones ETF", IWM: "Russell 2000 ETF", VIX: "Volatility Index",
  // Global Indices
  EWJ: "Japan Equities", FXI: "China Large-Cap", EWG: "Germany Equities", EWU: "UK Equities",
  EWA: "Australia Equities", EWZ: "Brazil Equities", INDA: "India Equities", EWY: "South Korea Equities",
  // Precious Metals
  GLD: "Gold ETF", SLV: "Silver ETF", PPLT: "Platinum ETF", PALL: "Palladium ETF",
  // Commodities
  USO: "US Oil ETF", BNO: "Brent Oil ETF", UNG: "Natural Gas ETF", CPER: "Copper ETF", WEAT: "Wheat ETF", CORN: "Corn ETF",
  // Forex
  UUP: "US Dollar Index", FXE: "Euro ETF", FXY: "Japanese Yen ETF", FXB: "British Pound ETF", CYB: "Chinese Yuan ETF",
  // Bonds
  TLT: "20+ Yr Treasury", IEF: "7-10 Yr Treasury", SHY: "1-3 Yr Treasury",
  HYG: "High Yield Corp Bonds", EMB: "Emerging Market Bonds", BNDX: "Intl Bond ETF",
  // Crypto
  "BTC-USD": "Bitcoin", "ETH-USD": "Ethereum",
  // Volatility
  VIXY: "VIX Futures ETF",
};

function tickerName(t: string): string { return TICKER_NAMES[t] ?? t; }

const TIMEFRAMES = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "3Y", days: 1095 },
];

// Chart sections (surprising correlations + commodity-currency) include 1W
const TIMEFRAMES_CHART = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "3Y", days: 1095 },
];

const SAFE_HAVEN_CONFIGS = [
  { ticker: "GLD",  name: "Gold",          desc: "Global store of value",  dotColor: "#f59e0b" },
  { ticker: "TLT",  name: "US Treasuries", desc: "20+ Year T-Bond ETF",    dotColor: "#3b82f6" },
  { ticker: "UUP",  name: "US Dollar",     desc: "Dollar Index Bullish",   dotColor: "#06b6d4" },
  { ticker: "FXY",  name: "Japanese Yen",  desc: "CurrencyShares Yen",     dotColor: "#8b5cf6" },
];

const COMMODITY_FX_PAIRS = [
  {
    commodityTicker: "USO", commodityName: "Oil",    dotColorA: "#f97316",
    fxTicker: "UUP",        fxName: "US Dollar",    dotColorB: "#06b6d4",
    relationship: "Oil–Dollar Inverse",
    description: "Oil is priced in USD globally. When the dollar strengthens, oil typically gets more expensive for other countries, dampening demand.",
    expectedSign: -1, // inverse: stronger dollar → weaker oil demand
  },
  {
    commodityTicker: "GLD", commodityName: "Gold",   dotColorA: "#f59e0b",
    fxTicker: "FXE",        fxName: "Euro",          dotColorB: "#3b82f6",
    relationship: "Gold–Euro correlation",
    description: "Both gold and the euro tend to move against the US dollar, creating a strong positive relationship in dollar-denominated terms.",
    expectedSign: 1, // positive: both move against the dollar together
  },
  {
    commodityTicker: "CPER", commodityName: "Copper",    dotColorA: "#ef4444",
    fxTicker: "FXI",         fxName: "China Large-Cap", dotColorB: "#a855f7",
    relationship: "China industrial demand",
    description: "China consumes ~50% of global copper. FXI (iShares China Large-Cap ETF) reflects Chinese economic activity which closely tracks copper demand.",
    expectedSign: 1, // positive: Chinese growth lifts both copper demand and equities
  },
  {
    commodityTicker: "WEAT", commodityName: "Wheat",  dotColorA: "#eab308",
    fxTicker: "UUP",         fxName: "US Dollar",     dotColorB: "#06b6d4",
    relationship: "Agricultural export pricing",
    description: "Agricultural commodities are globally priced in USD. A stronger dollar typically makes US wheat exports less competitive, pressuring prices.",
    expectedSign: -1, // inverse: stronger dollar → cheaper dollar-priced wheat globally
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCellBg(value: number | null | undefined, isDiagonal = false): string {
  if (isDiagonal) return "#2d2d35";
  if (value === null || value === undefined || !isFinite(value as number)) return "#0d0d1a";
  const v = Math.max(-1, Math.min(1, value));
  if (Math.abs(v) < 0.04) return "#111120";
  // sqrt scaling so even 0.1 correlations produce clearly visible colour
  const t = Math.sqrt(Math.abs(v));
  if (v > 0) {
    // dark → vivid green (#16a34a)
    return `rgb(${Math.round(20 + 12 * t)},${Math.round(40 + 130 * t)},${Math.round(20 + 18 * t)})`;
  } else {
    // dark → vivid red (#dc2626)
    return `rgb(${Math.round(40 + 180 * t)},${Math.round(20 + 12 * t)},${Math.round(20 + 12 * t)})`;
  }
}

function strengthLabel(abs: number): string {
  if (abs >= 0.8) return "Very Strong";
  if (abs >= 0.65) return "Strong";
  if (abs >= 0.5) return "Moderate";
  return "Weak";
}

function strengthBadgeClass(abs: number): string {
  if (abs >= 0.8) return "bg-red-500/20 text-red-300 border-red-500/30";
  if (abs >= 0.65) return "bg-orange-500/20 text-orange-300 border-orange-500/30";
  if (abs >= 0.5) return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
  return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
}

function formatCorr(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(2);
}

function timeSince(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ago`;
}

function pct(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
}

function pctColor(v: number | null | undefined): string {
  if (v === null || v === undefined) return "text-zinc-500";
  return v >= 0 ? "text-emerald-400" : "text-red-400";
}

function detectRegime(perf: Record<string, Record<string, PerformanceEntry>>) {
  const spy1m  = perf?.us_indices?.SPY?.["1m"]      ?? 0;
  const tlt1m  = perf?.bonds?.TLT?.["1m"]           ?? 0;
  const gld1m  = perf?.precious_metals?.GLD?.["1m"] ?? 0;
  const uso1m  = perf?.commodities?.USO?.["1m"]     ?? 0;
  const uup1m  = perf?.forex?.UUP?.["1m"]           ?? 0;
  const hyg1m  = perf?.bonds?.HYG?.["1m"]           ?? 0;
  const vix1m  = perf?.us_indices?.VIX?.["1m"]      ?? 0;

  // Risk-Off: equities falling hard, safe-havens rallying
  if (spy1m < -4 && tlt1m > 2 && gld1m > 1)
    return { name: "Risk-Off", dotColor: "#f87171", cls: "text-red-400 border-red-500/30 bg-red-500/10", bullAssets: ["TLT", "GLD", "SHY", "UUP", "FXY"], bearAssets: ["SPY", "QQQ", "HYG", "BTC-USD"] };

  // Stagflation: oil/commodities surging, bonds selling off, equities flat/weak
  if (uso1m > 5 && tlt1m < -2 && spy1m < 2)
    return { name: "Stagflation", dotColor: "#fbbf24", cls: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10", bullAssets: ["GLD", "SLV", "USO", "WEAT", "CORN"], bearAssets: ["TLT", "IEF", "QQQ"] };

  // Deflation: sharp equity crash + dollar surge + Treasuries surging (liquidity crunch)
  if (spy1m < -6 && uup1m > 3 && tlt1m > 4)
    return { name: "Deflation", dotColor: "#a1a1aa", cls: "text-zinc-300 border-zinc-500/30 bg-zinc-500/10", bullAssets: ["TLT", "IEF", "SHY", "UUP"], bearAssets: ["SPY", "GLD", "USO", "BTC-USD"] };

  // Risk-On: equities strong, bonds selling off, credit healthy, VIX quiet
  if (spy1m > 3 && tlt1m < 0 && hyg1m > 0 && vix1m < 5)
    return { name: "Risk-On", dotColor: "#4ade80", cls: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", bullAssets: ["SPY", "QQQ", "IWM", "HYG", "BTC-USD", "EWZ"], bearAssets: ["TLT", "GLD", "VIX"] };

  // Goldilocks: steady but moderate equity gains, low volatility, bonds and gold both stable
  if (spy1m > 0 && spy1m <= 3 && Math.abs(tlt1m) < 2 && Math.abs(gld1m) < 2 && Math.abs(uup1m) < 1.5 && vix1m < 10)
    return { name: "Goldilocks", dotColor: "#60a5fa", cls: "text-blue-400 border-blue-500/30 bg-blue-500/10", bullAssets: ["SPY", "QQQ", "DIA", "IEF", "GLD"], bearAssets: ["VIX", "VIXY"] };

  // Mixed / Transitional: conditions don't fit a clean regime
  return { name: "Mixed", dotColor: "#a78bfa", cls: "text-violet-400 border-violet-500/30 bg-violet-500/10", bullAssets: ["GLD", "IEF", "SPY"], bearAssets: ["VIXY"] };
}

function buildDualSeries(
  seriesA: Array<{ date: string; value: number }> | undefined,
  seriesB: Array<{ date: string; value: number }> | undefined,
  tickerA: string,
  tickerB: string,
): Array<Record<string, string | number>> {
  if (!seriesA || !seriesB) return [];
  const mapB = new Map(seriesB.map((p) => [p.date, p.value]));
  return seriesA
    .filter((p) => mapB.has(p.date))
    .map((p) => ({ date: p.date, [tickerA]: p.value, [tickerB]: mapB.get(p.date)! }));
}

// ─── Static lookup tables ─────────────────────────────────────────────────────

const CLASS_PAIR_NOTES: Record<string, string> = {
  "bonds|crypto":           "Rate hikes tighten dollar liquidity, hurting bond prices and crypto risk appetite simultaneously.",
  "bonds|us_indices":       "Classic flight-to-safety: equity selloffs drive investors into Treasuries, pushing bond prices up.",
  "bonds|forex":            "USD risk-off demand and Treasury rallies often coincide as global capital repatriates to US safety.",
  "bonds|commodities":      "Commodity inflation pushes yields up and bond prices down — both signal rising inflation expectations.",
  "bonds|global_indices":   "Global equity stress triggers bond buying as investors seek capital preservation.",
  "bonds|precious_metals":  "Gold and long bonds are both safe havens, rallying together when systemic risk rises.",
  "bonds|volatility":       "Fear spikes (VIX) correlate with bond rallies — equity panic drives demand for Treasury safety.",
  "crypto|us_indices":      "Post-2020, crypto tracks equities on the risk cycle: both rise and fall with global liquidity.",
  "crypto|forex":           "A stronger dollar drains global liquidity, pressuring speculative assets like BTC and ETH first.",
  "crypto|precious_metals": "Both serve as dollar alternatives and inflation hedges, though crypto adds extreme volatility.",
  "forex|us_indices":       "Strong USD headwinds multinational earnings; weak USD boosts overseas revenues in dollar terms.",
  "forex|commodities":      "Commodities priced in USD move inversely to the dollar — stronger USD depresses global demand.",
  "forex|precious_metals":  "Gold is dollar-denominated: USD weakness directly lifts gold prices as purchasing power falls.",
  "forex|global_indices":   "EM currencies and equities move together — risk appetite drives capital flows to both.",
  "us_indices|global_indices": "Global equity markets are highly integrated; US moves ripple to Europe and Asia within hours.",
  "us_indices|precious_metals": "Gold hedges equity risk; sharp market drops trigger safe-haven gold buying.",
  "us_indices|commodities": "Growth expectations drive equities and industrial commodity demand simultaneously.",
  "us_indices|volatility":  "VIX tracks equity fear directly — as the S&P falls, implied volatility spikes inversely.",
  "commodities|precious_metals": "Gold and oil both hedge inflation; rising oil signals broader price pressure, lifting gold.",
  "global_indices|precious_metals": "Global equity weakness triggers gold buying as the universal safe-haven of last resort.",
  "commodities|global_indices": "Global growth drives commodity demand and equity earnings at the same time.",
  "global_indices|volatility": "Global equity weakness amplifies the VIX as uncertainty spreads beyond US markets.",
};

const REGIME_EXPLANATIONS: Record<string, { short: string; detail: string }> = {
  "Risk-Off":    { short: "Capital fleeing equities into safety assets.", detail: "Bonds, gold, and defensive currencies outperform. Avoid equities, high-yield credit, and crypto. Watch for policy response as the primary catalyst for regime change." },
  "Stagflation": { short: "Inflation without growth — worst environment for 60/40.", detail: "Real assets (commodities, gold, TIPS) are the primary hedge. Both stocks and bonds may underperform simultaneously. Duration risk is elevated." },
  "Deflation":   { short: "Liquidity crunch — dollar and Treasuries dominate.", detail: "Cash and short-duration bonds outperform. Avoid commodities, credit, and most equities. This rare regime typically demands central bank intervention to resolve." },
  "Risk-On":     { short: "Growth accelerating — equity risk rewarded.", detail: "Cyclicals, small-caps, high-yield credit, and emerging markets outperform. Bonds and volatility instruments underperform. Stay long the cycle." },
  "Goldilocks":  { short: "Just right — steady growth, contained inflation, patient central bank.", detail: "Named after the fairy tale: the economy is neither hot enough to force aggressive rate hikes nor cold enough to signal recession. Inflation sits in the 2–3% range, job growth is healthy, and the Fed stays on hold or cuts slowly. Corporate earnings expand steadily and credit conditions are loose. Historically this describes 1995–98 and 2013–17. Broad equity exposure works well — both growth and value participate. Quality bonds hold their value. Low-volatility assets underperform. Watch for inflation creeping above 3% (shifts toward Stagflation) or a sudden jobs deterioration (shifts toward Risk-Off) as the two most common exit signals." },
  "Mixed":       { short: "No dominant regime — cross-currents creating mixed signals.", detail: "Current macro data doesn't cleanly fit a single regime. Equity gains are muted, safe havens are neither rallying nor selling off sharply, and volatility is neither spiking nor collapsing. This often occurs at regime transitions — when the market is deciding whether to price in growth acceleration, a slowdown, or a policy shift. In mixed regimes, diversification matters most. Avoid concentrated bets on a single macro theme. Watch SPY vs TLT direction over the next few weeks for the regime that eventually crystallises." },
};

const REGIME_ASSETS = [
  { ticker: "SPY", label: "US Equities", cls: "us_indices" },
  { ticker: "TLT", label: "Long Bonds",  cls: "bonds" },
  { ticker: "GLD", label: "Gold",        cls: "precious_metals" },
  { ticker: "USO", label: "Oil",         cls: "commodities" },
  { ticker: "UUP", label: "US Dollar",   cls: "forex" },
] as const;

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => <div key={i} className="h-8 w-14 rounded-lg bg-white/5" />)}
      </div>
      <div className="h-[420px] rounded-2xl bg-white/5" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[...Array(6)].map((_, i) => <div key={i} className="h-48 rounded-2xl bg-white/5" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-36 rounded-2xl bg-white/5" />)}
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ label, title, subtitle }: { label?: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      {label && <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--accent-color)]/70">{label}</p>}
      <h2 className="mt-0.5 text-base font-semibold text-zinc-50">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
    </div>
  );
}

// ─── Correlation Pair Modal ───────────────────────────────────────────────────

function CorrelationModal({
  assetA, assetB, defaultTfIdx, onClose, cacheRef, fetchingRef, loadDays,
}: {
  assetA: string; assetB: string;
  defaultTfIdx: number;
  onClose: () => void;
  cacheRef: { current: Record<number, CorrelationData> };
  fetchingRef: { current: Set<number> };
  loadDays: (days: number) => Promise<void>;
}) {
  const [tfIdx, setTfIdx] = useState(defaultTfIdx);
  const days = TIMEFRAMES[tfIdx]!.days;
  const data = cacheRef.current[days];
  const isLoading = !data && fetchingRef.current.has(days);

  // Trigger load whenever the modal's own timeframe changes
  useEffect(() => { void loadDays(days); }, [days, loadDays]);

  const clsA = TICKER_CLASS[assetA] ?? "unknown";
  const clsB = TICKER_CLASS[assetB] ?? "unknown";
  const correlation = data?.matrix[assetA]?.[assetB] ?? null;
  const normalizedSeries = data?.normalizedSeries ?? {};
  const chartData = buildDualSeries(normalizedSeries[assetA], normalizedSeries[assetB], assetA, assetB);
  const absCorr = correlation !== null ? Math.abs(correlation) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-5 shadow-2xl"
        style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Asset pair header */}
        <div className="mb-1 flex items-center gap-3 pr-8">
          <div className="flex flex-col items-start">
            <span
              className="rounded-lg px-2.5 py-1 text-sm font-bold"
              style={{ background: (CLASS_COLORS[clsA] ?? "#6366f1") + "22", color: CLASS_COLORS[clsA] ?? "#6366f1" }}
            >
              {assetA}
            </span>
            <span className="mt-0.5 pl-1 text-[10px] text-zinc-500">{tickerName(assetA)}</span>
          </div>
          <span className="text-xs font-medium text-zinc-500">vs</span>
          <div className="flex flex-col items-start">
            <span
              className="rounded-lg px-2.5 py-1 text-sm font-bold"
              style={{ background: (CLASS_COLORS[clsB] ?? "#6366f1") + "22", color: CLASS_COLORS[clsB] ?? "#6366f1" }}
            >
              {assetB}
            </span>
            <span className="mt-0.5 pl-1 text-[10px] text-zinc-500">{tickerName(assetB)}</span>
          </div>
        </div>

        {/* Correlation value */}
        <div className="mb-4 flex items-baseline gap-3">
          <span
            className={`text-3xl font-black tabular-nums ${
              isLoading ? "text-zinc-600"
              : correlation === null ? "text-zinc-500"
              : correlation >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {isLoading ? "…" : formatCorr(correlation)}
          </span>
          {!isLoading && correlation !== null && (
            <span className={`rounded border px-1.5 py-0.5 text-[10px] ${strengthBadgeClass(absCorr)}`}>
              {strengthLabel(absCorr)}
            </span>
          )}
          <span className="ml-auto text-[10px] text-zinc-600">
            {CLASS_LABELS[clsA]} ↔ {CLASS_LABELS[clsB]}
          </span>
        </div>

        {/* Timeframe toggle — changing tf keeps the modal open */}
        <div className="mb-3 flex gap-1">
          {TIMEFRAMES.map((tf, i) => (
            <button
              key={tf.label}
              onClick={() => setTfIdx(i)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                tfIdx === i
                  ? "bg-[var(--accent-color)] text-black"
                  : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Chart */}
        {isLoading ? (
          <div className="mb-3 flex h-40 animate-pulse items-center justify-center rounded-xl bg-white/5 text-xs text-zinc-600">
            Loading…
          </div>
        ) : chartData.length > 1 ? (
          <>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 8, fill: "#52525b" }} tickLine={false}
                    axisLine={{ stroke: "rgba(255,255,255,0.08)" }} interval="preserveStartEnd"
                    tickFormatter={(d: string) => d.slice(5)} height={14} />
                  <YAxis yAxisId="a" orientation="left" domain={["auto", "auto"]} tick={{ fontSize: 8, fill: "#52525b" }}
                    tickLine={false} axisLine={false} width={30} tickCount={4} tickFormatter={(v: number) => v.toFixed(0)} />
                  <YAxis yAxisId="b" orientation="right" domain={["auto", "auto"]} tick={{ fontSize: 8, fill: "#52525b" }}
                    tickLine={false} axisLine={false} width={30} tickCount={4} tickFormatter={(v: number) => v.toFixed(0)} />
                  <RechartTooltip contentStyle={{ background: "var(--app-card)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: "#71717a" }} />
                  <Line yAxisId="a" type="monotone" dataKey={assetA} stroke="var(--accent-color)" dot={false} strokeWidth={2} />
                  <Line yAxisId="b" type="monotone" dataKey={assetB} stroke="#60a5fa" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mb-2 mt-1 flex justify-center gap-4 text-[10px] text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-4 rounded" style={{ background: "var(--accent-color)" }} />
                {assetA} <span className="text-zinc-700">· {tickerName(assetA)}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-4 rounded bg-blue-400" />
                {assetB} <span className="text-zinc-700">· {tickerName(assetB)}</span>
              </span>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[10px] leading-relaxed text-zinc-500">
              <span className="font-medium text-zinc-300">Independent axes.</span>{" "}
              Each line starts at <span className="font-medium text-zinc-300">100</span> so movement is comparable regardless of price scale.
            </div>
          </>
        ) : (
          <div className="mb-3 flex h-40 items-center justify-center text-xs text-zinc-600">No chart data available</div>
        )}

        {/* Pre-built pair explanation — instant, no AI call */}
        {(() => {
          const key = [clsA, clsB].sort().join("|");
          const note = CLASS_PAIR_NOTES[key];
          return note ? (
            <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-zinc-400">
              {note}
            </div>
          ) : null;
        })()}
      </div>
    </div>
  );
}

// ─── Expanded Correlation Modal ────────────────────────────────────────────────

function ExpandedCorrelationCard({
  pair, defaultTfIdx, onClose, cacheRef, fetchingRef, loadDays,
}: {
  pair: SurprisingPair;
  defaultTfIdx: number;
  onClose: () => void;
  cacheRef: { current: Record<number, CorrelationData> };
  fetchingRef: { current: Set<number> };
  loadDays: (days: number) => Promise<void>;
}) {
  const [tfIdx, setTfIdx] = useState(defaultTfIdx);
  const days = TIMEFRAMES_CHART[tfIdx]!.days;
  const data = cacheRef.current[days];
  const isLoading = !data && fetchingRef.current.has(days);

  useEffect(() => { void loadDays(days); }, [days, loadDays]);

  const corrVal = data?.matrix[pair.assetA]?.[pair.assetB] ?? pair.correlation;
  const safeCorr = typeof corrVal === "number" && isFinite(corrVal) ? corrVal : 0;
  const absCorr = Math.abs(safeCorr);
  const clrA = CLASS_COLORS[pair.classA] ?? "#6366f1";
  const clrB = CLASS_COLORS[pair.classB] ?? "#60a5fa";
  const normalizedSeries = data?.normalizedSeries ?? {};
  const chartData = buildDualSeries(normalizedSeries[pair.assetA], normalizedSeries[pair.assetB], pair.assetA, pair.assetB);
  const pairNote = CLASS_PAIR_NOTES[[pair.classA, pair.classB].sort().join("|")];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-5 shadow-2xl"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header — ticker + full name */}
        <div className="mb-3 flex items-start gap-3 pr-8">
          <div className="flex flex-col items-start">
            <span className="rounded-lg px-2.5 py-1 text-sm font-bold" style={{ background: clrA + "22", color: clrA }}>{pair.assetA}</span>
            <span className="mt-1 pl-1 text-xs text-zinc-400">{tickerName(pair.assetA)}</span>
            <span className="pl-1 text-[10px] text-zinc-600">{CLASS_LABELS[pair.classA]}</span>
          </div>
          <div className="mt-1 flex flex-col items-center">
            <span className="text-base font-black" style={{ color: safeCorr >= 0 ? "#60a5fa" : "#f87171" }}>{safeCorr >= 0 ? "↑↑" : "↑↓"}</span>
            <span className={`text-xl font-black tabular-nums ${safeCorr >= 0 ? "text-blue-400" : "text-red-400"}`}>{formatCorr(safeCorr)}</span>
            <span className={`mt-0.5 rounded border px-1.5 py-0.5 text-[9px] ${strengthBadgeClass(absCorr)}`}>{strengthLabel(absCorr)}</span>
          </div>
          <div className="flex flex-col items-start">
            <span className="rounded-lg px-2.5 py-1 text-sm font-bold" style={{ background: clrB + "22", color: clrB }}>{pair.assetB}</span>
            <span className="mt-1 pl-1 text-xs text-zinc-400">{tickerName(pair.assetB)}</span>
            <span className="pl-1 text-[10px] text-zinc-600">{CLASS_LABELS[pair.classB]}</span>
          </div>
        </div>

        {/* Timeframe selector */}
        <div className="mb-3 flex gap-1">
          {TIMEFRAMES_CHART.map((tf, i) => (
            <button key={tf.label} onClick={() => setTfIdx(i)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                tfIdx === i ? "bg-[var(--accent-color)] text-black" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
              }`}>
              {tf.label}
            </button>
          ))}
        </div>

        {/* Chart */}
        {isLoading ? (
          <div className="flex h-56 animate-pulse items-center justify-center rounded-xl bg-white/5 text-xs text-zinc-600">Loading…</div>
        ) : chartData.length > 1 ? (
          <>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false}
                    axisLine={{ stroke: "rgba(255,255,255,0.08)" }} interval="preserveStartEnd"
                    tickFormatter={(d: string) => d.slice(5)} height={16} />
                  <YAxis yAxisId="a" orientation="left" domain={["auto", "auto"]}
                    tick={{ fontSize: 9, fill: clrA + "cc" }} tickLine={false} axisLine={false}
                    width={36} tickCount={4} tickFormatter={(v: number) => v.toFixed(0)} />
                  <YAxis yAxisId="b" orientation="right" domain={["auto", "auto"]}
                    tick={{ fontSize: 9, fill: clrB + "cc" }} tickLine={false} axisLine={false}
                    width={36} tickCount={4} tickFormatter={(v: number) => v.toFixed(0)} />
                  <RechartTooltip
                    contentStyle={{ background: "var(--app-card)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: "#71717a" }}
                  />
                  <Line yAxisId="a" type="monotone" dataKey={pair.assetA} stroke={clrA} dot={false} strokeWidth={2} />
                  <Line yAxisId="b" type="monotone" dataKey={pair.assetB} stroke={clrB} dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex justify-center gap-6 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-4 rounded" style={{ background: clrA }} />
                {pair.assetA} · {tickerName(pair.assetA)} <span className="text-zinc-700">· left axis</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-4 rounded" style={{ background: clrB }} />
                {pair.assetB} · {tickerName(pair.assetB)} <span className="text-zinc-700">· right axis</span>
              </span>
            </div>
          </>
        ) : (
          <div className="flex h-40 items-center justify-center text-xs text-zinc-600">No chart data available for this period</div>
        )}

        {/* Explanation */}
        {pairNote && (
          <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 text-[11px] leading-relaxed text-zinc-400">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Why this correlation exists</span>
            {pairNote}
          </div>
        )}
        <div className="mt-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[10px] leading-relaxed text-zinc-500">
          <span className="font-medium text-zinc-300">Independent axes.</span>{" "}
          Each line starts at 100 so movement is comparable regardless of price scale. The {safeCorr >= 0 ? "similar direction" : "opposing direction"} of movement produces the {formatCorr(safeCorr)} coefficient.
        </div>
      </div>
    </div>
  );
}

// ─── Surprising Correlation Card ──────────────────────────────────────────────

function SurprisingCard({
  pair, normalizedSeries, onExpand,
}: {
  pair: SurprisingPair;
  normalizedSeries: Record<string, Array<{ date: string; value: number }>>;
  onExpand: () => void;
}) {
  const corrVal = typeof pair.correlation === "number" && isFinite(pair.correlation) ? pair.correlation : 0;
  const absCorr = Math.abs(corrVal);
  const chartData = buildDualSeries(normalizedSeries[pair.assetA], normalizedSeries[pair.assetB], pair.assetA, pair.assetB);
  const clrA = CLASS_COLORS[pair.classA] ?? "#6366f1";
  const clrB = CLASS_COLORS[pair.classB] ?? "#60a5fa";

  return (
    <div
      className="flex cursor-pointer flex-col rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4 transition-colors hover:border-white/20"
      onClick={onExpand}
    >
      {/* Header: two asset badges + correlation */}
      <div className="mb-2 flex items-start gap-2">
        <div className="flex flex-col">
          <span className="rounded-lg px-2.5 py-1 text-xs font-bold" style={{ background: clrA + "22", color: clrA }}>{pair.assetA}</span>
          <span className="mt-0.5 pl-1 text-[9px] text-zinc-600">{tickerName(pair.assetA)}</span>
        </div>
        <span className="mt-1 text-xs font-black" style={{ color: corrVal >= 0 ? "#60a5fa" : "#f87171" }}>
          {corrVal >= 0 ? "↑↑" : "↑↓"}
        </span>
        <div className="flex flex-col">
          <span className="rounded-lg px-2.5 py-1 text-xs font-bold" style={{ background: clrB + "22", color: clrB }}>{pair.assetB}</span>
          <span className="mt-0.5 pl-1 text-[9px] text-zinc-600">{tickerName(pair.assetB)}</span>
        </div>
        <span className={`ml-auto mt-1 text-sm font-bold tabular-nums ${corrVal >= 0 ? "text-blue-400" : "text-red-400"}`}>
          {formatCorr(corrVal)}
        </span>
      </div>

      {/* Correlation bar */}
      <div className="mb-2">
        <div className="h-1.5 w-full rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${absCorr * 100}%`, background: corrVal >= 0 ? "#60a5fa" : "#f87171" }}
          />
        </div>
      </div>

      {/* Strength + class labels */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className={`rounded border px-1.5 py-0.5 ${strengthBadgeClass(absCorr)}`}>{strengthLabel(absCorr)}</span>
        <span className="text-zinc-600">{CLASS_LABELS[pair.classA]}</span>
        <span className="text-zinc-700">↔</span>
        <span className="text-zinc-600">{CLASS_LABELS[pair.classB]}</span>
      </div>

      {/* Mini dual-axis chart — no tooltip, independent Y-axes */}
      {chartData.length > 1 ? (
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 7, fill: "#52525b" }}
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                interval="preserveStartEnd"
                tickFormatter={(d: string) => d.slice(5)}
                height={14}
              />
              <YAxis yAxisId="a" orientation="left" domain={["auto", "auto"]}
                tick={{ fontSize: 7, fill: "#52525b" }} tickLine={false} axisLine={false}
                width={24} tickCount={3} tickFormatter={(v: number) => v.toFixed(0)} />
              <YAxis yAxisId="b" orientation="right" domain={["auto", "auto"]}
                tick={{ fontSize: 7, fill: "#52525b" }} tickLine={false} axisLine={false}
                width={24} tickCount={3} tickFormatter={(v: number) => v.toFixed(0)} />
              <Line yAxisId="a" type="monotone" dataKey={pair.assetA} stroke={clrA} dot={false} strokeWidth={1.5} />
              <Line yAxisId="b" type="monotone" dataKey={pair.assetB} stroke={clrB} dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-20 items-center justify-center text-[10px] text-zinc-700">No chart data</div>
      )}
      <p className="mt-1.5 text-center text-[9px] text-zinc-700">click to expand</p>
    </div>
  );
}

// ─── Safe Haven Card ──────────────────────────────────────────────────────────

function SafeHavenCard({
  config, corrVsSPY, perf,
}: {
  config: (typeof SAFE_HAVEN_CONFIGS)[number];
  corrVsSPY: number | null;
  perf: PerformanceEntry | undefined;
}) {
  const corr = corrVsSPY;
  const status =
    corr !== null && corr < -0.5 ? "Safe Haven Active"
    : corr !== null && corr < 0 ? "Neutral"
    : "Risk-On";
  const statusCls =
    status === "Safe Haven Active" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
    : status === "Neutral" ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"
    : "text-red-400 border-red-500/30 bg-red-500/10";

  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: config.dotColor }} />
        <div>
          <p className="text-sm font-semibold text-zinc-100">{config.name}</p>
          <p className="text-[10px] text-zinc-600">{config.ticker} · {config.desc}</p>
        </div>
      </div>
      <div className="mb-3 flex items-center gap-2">
        {perf?.price != null && (
          <span className="text-base font-bold text-zinc-50">${perf.price.toFixed(2)}</span>
        )}
        {perf?.["1d"] != null && (
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${pctColor(perf["1d"])} ${(perf["1d"] ?? 0) >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>{pct(perf["1d"])}</span>
        )}
      </div>
      <div className="mb-3">
        <p className="mb-1 text-[10px] text-zinc-600">30-day corr vs SPY</p>
        <div className="flex items-center gap-2">
          <span className={`text-base font-bold tabular-nums ${corr !== null && corr < 0 ? "text-emerald-400" : "text-red-400"}`}>
            {corr !== null ? formatCorr(corr) : "—"}
          </span>
          <div className="flex-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.abs(corr ?? 0) * 100}%`,
                  background: (corr ?? 0) < 0 ? "#4ade80" : "#f87171",
                }}
              />
            </div>
          </div>
        </div>
      </div>
      <span className={`rounded border px-2 py-0.5 text-[10px] font-medium ${statusCls}`}>{status}</span>
    </div>
  );
}

// ─── Commodity–Currency Card ──────────────────────────────────────────────────

function CommodityFxCard({
  pair, normalizedSeries, matrix,
}: {
  pair: (typeof COMMODITY_FX_PAIRS)[number];
  normalizedSeries: Record<string, Array<{ date: string; value: number }>>;
  matrix: Record<string, Record<string, number | null>>;
}) {
  const corr = matrix[pair.commodityTicker]?.[pair.fxTicker] ?? null;
  const chartData = buildDualSeries(
    normalizedSeries[pair.commodityTicker], normalizedSeries[pair.fxTicker],
    pair.commodityTicker, pair.fxTicker,
  );

  // Detect divergence relative to the expected direction for this pair.
  // corrAligned > 0 means the relationship is behaving as expected; < 0 means it has inverted.
  const corrAligned = corr !== null ? corr * pair.expectedSign : null;
  const divergenceNote = corrAligned !== null
    ? corrAligned >= 0.7
      ? "Relationship very strong — the structural link is firing on all cylinders. High conviction that moves in one are leading the other."
      : corrAligned >= 0.5
      ? "Relationship holding — the structural link is active. Moves in one are likely leading the other."
      : corrAligned >= 0.35
      ? "Relationship moderate — the link is present but not dominant. Other macro forces may be diluting it."
      : corrAligned >= 0.15
      ? "Relationship weakening — the link is fading. Monitor for a potential breakdown or regime shift."
      : corrAligned >= -0.15
      ? "Relationship neutral — neither confirming nor breaking the expected link. Likely driven by other forces."
      : corrAligned >= -0.35
      ? "Relationship weakly inverted — showing early signs of moving opposite to structural expectation."
      : "Relationship inverted — assets are moving opposite to the structural expectation. Potential mean-reversion signal."
    : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
      <div className="mb-2 flex items-center gap-2 text-sm">
        <span className="h-2 w-2 rounded-full" style={{ background: pair.dotColorA }} />
        <span className="font-semibold text-zinc-200">{pair.commodityName}</span>
        <span className="text-zinc-600">↔</span>
        <span className="h-2 w-2 rounded-full" style={{ background: pair.dotColorB }} />
        <span className="font-semibold text-zinc-200">{pair.fxName}</span>
      </div>
      <p className="mb-1 text-[10px] font-medium text-[var(--accent-color)]/70">{pair.relationship}</p>
      <p className="mb-3 text-[10px] leading-relaxed text-zinc-600">{pair.description}</p>

      {corr !== null && corrAligned !== null && (() => {
        // Label reflects how well the expected relationship is holding, not raw Pearson magnitude.
        // corrAligned > 0 = behaving as expected; < 0 = inverted.
        // Finer-grained thresholds so the label visibly shifts across timeframes.
        const expectedDir = pair.expectedSign > 0 ? "together" : "inverse";
        const relLabel =
          corrAligned >= 0.7  ? `Very strong ${expectedDir}`
          : corrAligned >= 0.5  ? `Strong ${expectedDir}`
          : corrAligned >= 0.35 ? `Moderate ${expectedDir}`
          : corrAligned >= 0.15 ? `Weak ${expectedDir}`
          : corrAligned >= -0.15 ? "Neutral"
          : corrAligned >= -0.35 ? "Weakly inverted"
          : `Inverted`;
        const relBadge =
          corrAligned >= 0.7  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
          : corrAligned >= 0.5  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
          : corrAligned >= 0.35 ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"
          : corrAligned >= 0.15 ? "bg-orange-500/15 text-orange-300 border-orange-500/30"
          : corrAligned >= -0.15 ? "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
          : corrAligned >= -0.35 ? "bg-red-500/10 text-red-300 border-red-500/20"
          : "bg-red-500/15 text-red-300 border-red-500/30";
        return (
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[10px] text-zinc-600">Corr:</span>
            <span className={`text-sm font-bold tabular-nums ${corr >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatCorr(corr)}
            </span>
            <span className={`rounded border px-1.5 py-0.5 text-[10px] ${relBadge}`}>
              {relLabel}
            </span>
          </div>
        );
      })()}

      {/* Dual Y-axis chart: each line gets its own scale so neither appears flat */}
      {chartData.length > 1 ? (
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 32, left: 0, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 7, fill: "#52525b" }} tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.08)" }} interval="preserveStartEnd"
                tickFormatter={(d: string) => d.slice(5)} height={14} />
              <YAxis yAxisId="a" orientation="left" domain={["auto", "auto"]}
                tick={{ fontSize: 7, fill: pair.dotColorA }} tickLine={false} axisLine={false}
                width={28} tickCount={3} tickFormatter={(v: number) => v.toFixed(0)} />
              <YAxis yAxisId="b" orientation="right" domain={["auto", "auto"]}
                tick={{ fontSize: 7, fill: pair.dotColorB }} tickLine={false} axisLine={false}
                width={28} tickCount={3} tickFormatter={(v: number) => v.toFixed(0)} />
              <RechartTooltip contentStyle={{ background: "var(--app-card)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, fontSize: 10 }} />
              <Line yAxisId="a" type="monotone" dataKey={pair.commodityTicker} stroke={pair.dotColorA} dot={false} strokeWidth={1.5} />
              <Line yAxisId="b" type="monotone" dataKey={pair.fxTicker} stroke={pair.dotColorB} dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-20 items-center justify-center text-[10px] text-zinc-700">No chart data</div>
      )}

      {/* Divergence note */}
      {divergenceNote && (
        <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
          <span className="font-medium text-zinc-400">Reading: </span>{divergenceNote}
        </p>
      )}
    </div>
  );
}

// ─── Market Regime Panel ──────────────────────────────────────────────────────

function RegimePanel({ performance }: { performance: Record<string, Record<string, PerformanceEntry>> }) {
  const regime = detectRegime(performance);
  const explanation = REGIME_EXPLANATIONS[regime.name];

  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-3 w-3 rounded-full" style={{ background: regime.dotColor }} />
        <div>
          <p className={`text-lg font-bold ${regime.cls.split(" ")[0]}`}>{regime.name}</p>
          <p className="text-[10px] text-zinc-500">Current market regime · based on 1-month returns</p>
        </div>
      </div>

      {/* Live 1M performance bars — diverging from center */}
      <div className="mb-4 space-y-2">
        {REGIME_ASSETS.map(({ ticker, label, cls }) => {
          const val = performance?.[cls]?.[ticker]?.["1m"] ?? null;
          // Scale: ±20% maps to full half-bar width
          const barPct = val !== null ? Math.min(Math.abs(val) / 20 * 50, 50) : 0;
          return (
            <div key={ticker} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-[10px] text-zinc-400">{label}</span>
              <div className="relative flex h-3.5 flex-1 items-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="h-px w-full bg-white/10" />
                </div>
                <div className="absolute left-1/2 h-full w-px bg-white/20" />
                {val !== null && (
                  <div
                    className="absolute h-2.5 rounded-sm"
                    style={{
                      width: `${barPct}%`,
                      background: val >= 0 ? "#4ade80" : "#f87171",
                      ...(val >= 0 ? { left: "50%" } : { right: "50%" }),
                    }}
                  />
                )}
              </div>
              <span className={`w-14 shrink-0 text-right text-[10px] font-medium tabular-nums ${
                val !== null ? (val >= 0 ? "text-emerald-400" : "text-red-400") : "text-zinc-600"
              }`}>
                {val !== null ? pct(val) : "—"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-emerald-400/70">Outperforms</p>
          <div className="flex flex-wrap gap-1">
            {regime.bullAssets.map((t) => (
              <span key={t} className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">{t}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-red-400/70">Underperforms</p>
          <div className="flex flex-wrap gap-1">
            {regime.bearAssets.map((t) => (
              <span key={t} className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400">{t}</span>
            ))}
          </div>
        </div>
      </div>

      {explanation && (
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
          <p className="mb-1 text-xs font-medium text-zinc-200">{explanation.short}</p>
          <p className="text-[11px] leading-relaxed text-zinc-500">{explanation.detail}</p>
        </div>
      )}
    </div>
  );
}

// ─── Timeframe Button Group ───────────────────────────────────────────────────

function TfButtons({ value, onChange, timeframes = TIMEFRAMES }: {
  value: number;
  onChange: (i: number) => void;
  timeframes?: Array<{ label: string; days: number }>;
}) {
  return (
    <div className="flex gap-1">
      {timeframes.map((tf, i) => (
        <button
          key={tf.label}
          onClick={() => onChange(i)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            value === i
              ? "bg-[var(--accent-color)] text-black"
              : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
          }`}
        >
          {tf.label}
        </button>
      ))}
    </div>
  );
}

// ─── Section skeleton (inline loading) ───────────────────────────────────────

function SectionSkeleton({ height = 200 }: { height?: number }) {
  return <div className="animate-pulse rounded-2xl bg-white/5" style={{ height }} />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MarketRelationsView() {
  // Per-section timeframe indices (independent)
  const [hmTf, setHmTf] = useState(1);   // heatmap → 3M default
  const [spTf, setSpTf] = useState(1);   // surprising correlations
  const [cfTf, setCfTf] = useState(1);   // commodity-currency links
  const [spFilter, setSpFilter] = useState<"all" | "together" | "opposite">("all");
  const [expandedPair, setExpandedPair] = useState<SurprisingPair | null>(null);

  // Cache-based fetch: refs avoid stale closures; forceUpdate triggers re-render
  const cacheRef = useRef<Record<number, CorrelationData>>({});
  const fetchingRef = useRef<Set<number>>(new Set());
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const [error, setError] = useState<string | null>(null);
  const [selectedPair, setSelectedPair] = useState<{ a: string; b: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [, setTick] = useState(0);

  const fetchDays = useCallback(async (days: number, force = false) => {
    if (fetchingRef.current.has(days)) return;
    if (!force && cacheRef.current[days] !== undefined) return;
    fetchingRef.current.add(days);
    forceUpdate();
    try {
      const res = await fetch(`/api/market-relations/correlations?days=${days}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as CorrelationData & { error?: string };
      if (json.error) throw new Error(json.error);
      cacheRef.current = { ...cacheRef.current, [days]: json };
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load correlation data");
    } finally {
      fetchingRef.current.delete(days);
      forceUpdate();
    }
  }, [forceUpdate]);

  // Stable wrapper that doesn't force — used by child modals
  const loadDays = useCallback(async (days: number) => { await fetchDays(days); }, [fetchDays]);

  // Load data whenever a section's timeframe changes
  useEffect(() => { void fetchDays(TIMEFRAMES[hmTf]!.days); }, [hmTf, fetchDays]);
  useEffect(() => { void fetchDays(TIMEFRAMES_CHART[spTf]!.days); }, [spTf, fetchDays]);
  useEffect(() => { void fetchDays(TIMEFRAMES_CHART[cfTf]!.days); }, [cfTf, fetchDays]);

  // Clock tick for "last updated" text
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Live refresh: force-refetch active timeframes every 2 minutes
  useEffect(() => {
    const id = setInterval(() => {
      const activeDays = new Set([
        TIMEFRAMES[hmTf]!.days,
        TIMEFRAMES_CHART[spTf]!.days,
        TIMEFRAMES_CHART[cfTf]!.days,
      ]);
      for (const d of activeDays) void fetchDays(d, true);
    }, 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [hmTf, spTf, cfTf, fetchDays]);

  // Derive per-section data from cache
  const hmData = cacheRef.current[TIMEFRAMES[hmTf]!.days] ?? null;
  const spData = cacheRef.current[TIMEFRAMES_CHART[spTf]!.days] ?? null;
  const cfData = cacheRef.current[TIMEFRAMES_CHART[cfTf]!.days] ?? null;
  // Treat "no data yet" as loading — prevents flash of empty section before useEffect fires
  const hmLoading = !hmData;
  const spLoading = !spData;
  const cfLoading = !cfData;

  // Heatmap ticker order + class boundary markers
  const orderedTickers = hmData
    ? CLASS_ORDER.flatMap((cls) => ASSETS[cls]?.filter((t) => hmData.tickers.includes(t)) ?? [])
    : [];
  const classBoundaries = new Set<number>();
  if (hmData) {
    let idx = 0;
    for (const cls of CLASS_ORDER) {
      const count = ASSETS[cls]?.filter((t) => hmData.tickers.includes(t)).length ?? 0;
      if (count > 0) { idx += count; classBoundaries.add(idx - 1); }
    }
  }

  if (hmLoading) return <LoadingSkeleton />;

  if (error && !hmData) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <p className="mb-1 text-sm font-medium text-red-400">Failed to load correlation data</p>
        <p className="mb-4 text-xs text-zinc-600">{error}</p>
        <button onClick={() => fetchDays(TIMEFRAMES[hmTf].days, true)} className="rounded-lg bg-white/10 px-4 py-2 text-xs text-zinc-300 hover:bg-white/20">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Section 1: Correlation Heatmap ───────────────────────────────────── */}
      <SectionErrorBoundary name="Correlation Heatmap">
      <section>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--accent-color)]/70">Correlation Matrix</p>
            <h2 className="mt-0.5 text-base font-semibold text-zinc-50">Full Cross-Asset Heatmap</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Green = positive · Red = negative · Grey = self. Click any cell for detail.</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <TfButtons value={hmTf} onChange={setHmTf} />
            {lastUpdated && <p className="text-[10px] text-zinc-600">Updated: {timeSince(lastUpdated)}</p>}
          </div>
        </div>

        {hmLoading ? <SectionSkeleton height={320} /> : hmData && (
          <>
            <div className="w-full overflow-x-auto rounded-2xl border border-white/10 bg-[var(--app-card-alt)]">
              <table className="border-collapse" style={{ width: "100%", minWidth: "max-content", fontSize: "8px" }}>
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-20 w-[60px] min-w-[60px] bg-[var(--app-card-alt)] p-0" />
                    {orderedTickers.map((colTicker, ci) => (
                      <th key={colTicker} className="sticky top-0 z-10 bg-[var(--app-card-alt)] p-0"
                        style={{ width: 20, minWidth: 20, maxWidth: 20, borderRight: classBoundaries.has(ci) ? "1px solid rgba(255,255,255,0.08)" : undefined }}>
                        <div style={{ height: 76, width: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: 3 }}>
                          <span style={{
                            writingMode: "vertical-rl",
                            transform: "rotate(180deg)",
                            whiteSpace: "nowrap", fontSize: 8, fontWeight: 500,
                            color: CLASS_COLORS[TICKER_CLASS[colTicker]] ?? "#71717a",
                          }}>
                            {colTicker}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orderedTickers.map((rowTicker, ri) => (
                    <tr key={rowTicker} style={{ borderBottom: classBoundaries.has(ri) ? "1px solid rgba(255,255,255,0.08)" : undefined }}>
                      <td className="sticky left-0 z-10 bg-[var(--app-card-alt)] py-0 pl-2 pr-1 font-medium"
                        style={{ color: CLASS_COLORS[TICKER_CLASS[rowTicker]] ?? "#71717a" }}>
                        {rowTicker}
                      </td>
                      {orderedTickers.map((colTicker, ci) => {
                        const isDiag = rowTicker === colTicker;
                        const val = isDiag ? null : (hmData.matrix[rowTicker]?.[colTicker] ?? null);
                        return (
                          <td key={colTicker} className="group relative p-0"
                            style={{
                              width: 20, height: 18, minWidth: 20, minHeight: 18,
                              backgroundColor: getCellBg(val, isDiag),
                              borderRight: classBoundaries.has(ci) ? "1px solid rgba(255,255,255,0.08)" : undefined,
                              cursor: isDiag ? "default" : "pointer",
                            }}
                            onClick={() => !isDiag && setSelectedPair({ a: rowTicker, b: colTicker })}
                            title={isDiag ? rowTicker : `${rowTicker} / ${colTicker}: ${formatCorr(val)}`}
                          >
                            {!isDiag && (
                              <span className="pointer-events-none absolute inset-0 hidden items-center justify-center text-[7px] font-bold text-white ring-2 ring-inset ring-transparent group-hover:flex group-hover:ring-white/40">
                                {val !== null ? val.toFixed(2) : ""}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Color scale */}
            <div className="mt-2 flex items-center gap-2">
              <span className="shrink-0 text-[9px] text-zinc-500">-1.0 Neg</span>
              <div className="h-2 flex-1 rounded-full" style={{ background: "linear-gradient(to right, #dc2626, #7f1d1d, #111120, #14532d, #16a34a)" }} />
              <span className="shrink-0 text-[9px] text-zinc-500">+1.0 Pos</span>
            </div>
            {/* Class legend */}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              {CLASS_ORDER.map((cls) => (
                <div key={cls} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: CLASS_COLORS[cls] }} />
                  <span className="text-[10px] text-zinc-600">{CLASS_LABELS[cls]}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
      </SectionErrorBoundary>

      {/* ── Section 2: Surprising Correlations ───────────────────────────────── */}
      {expandedPair && (
        <ExpandedCorrelationCard
          pair={expandedPair}
          defaultTfIdx={spTf}
          onClose={() => setExpandedPair(null)}
          cacheRef={cacheRef}
          fetchingRef={fetchingRef}
          loadDays={loadDays}
        />
      )}
      <SectionErrorBoundary name="Surprising Correlations">
      <section>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--accent-color)]/70">Signal Detection</p>
            <h2 className="mt-0.5 text-base font-semibold text-zinc-50">Surprising Correlations Detected</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Assets from different classes moving unusually together or opposite — signals most traders miss.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Direction filter */}
            <div className="flex gap-1">
              {([
                { label: "All", val: "all" },
                { label: "↑↑ Together", val: "together" },
                { label: "↑↓ Opposite", val: "opposite" },
              ] as const).map((f) => (
                <button
                  key={f.val}
                  onClick={() => setSpFilter(f.val)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    spFilter === f.val
                      ? "bg-[var(--accent-color)] text-black"
                      : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <TfButtons value={spTf} onChange={(v) => { setSpTf(v); setExpandedPair(null); }} timeframes={TIMEFRAMES_CHART} />
          </div>
        </div>
        {spLoading ? <SectionSkeleton height={200} /> : spData && (() => {
          const filtered = spData.surprisingPairs.filter((p) =>
            spFilter === "together" ? p.correlation >= 0
            : spFilter === "opposite" ? p.correlation < 0
            : true
          );
          return filtered.length === 0 ? (
            <p className="text-xs text-zinc-600">
              {spFilter === "all"
                ? "No notable cross-class correlations detected in this period."
                : `No ${spFilter === "together" ? "positively correlated" : "inversely correlated"} pairs detected in this period.`}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.slice(0, 12).map((pair) => (
                <SurprisingCard
                  key={`${pair.assetA}-${pair.assetB}`}
                  pair={pair}
                  normalizedSeries={spData.normalizedSeries}
                  onExpand={() => setExpandedPair(pair)}
                />
              ))}
            </div>
          );
        })()}
      </section>
      </SectionErrorBoundary>

      {/* ── Section 3: Safe Haven Monitor ────────────────────────────────────── */}
      <SectionErrorBoundary name="Safe Haven Monitor">
      <section>
        <SectionHeader label="Risk Sentiment" title="Safe Haven Status"
          subtitle="When fear rises, capital flows to safety. Track where money is hiding right now." />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {SAFE_HAVEN_CONFIGS.map((cfg) => {
            const cls = TICKER_CLASS[cfg.ticker];
            const perf = cls && hmData ? hmData.performance[cls]?.[cfg.ticker] : undefined;
            return (
              <SafeHavenCard key={cfg.ticker} config={cfg}
                corrVsSPY={hmData?.safeHavenScores[cfg.ticker] ?? null} perf={perf} />
            );
          })}
        </div>
        <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <p className="text-[10px] leading-relaxed text-zinc-500">
            <span className="font-medium text-zinc-300">What is 30-day corr vs SPY?</span>{" "}
            The Pearson correlation of each asset{"'"}s daily returns against SPY (S&P 500) over the past 30 trading days.
            A score near <span className="text-emerald-400 font-medium">−1.0</span> means the asset reliably moves opposite to equities during market stress — the hallmark of a true safe haven.
            Near <span className="text-zinc-400 font-medium">0.0</span> means no relationship (neutral refuge),
            and near <span className="text-red-400 font-medium">+1.0</span> means the asset tracks equities (risk-on behavior, not a safe haven).
          </p>
        </div>
      </section>
      </SectionErrorBoundary>

      {/* ── Section 4: Commodity-Currency Links ──────────────────────────────── */}
      <SectionErrorBoundary name="Commodity-Currency Links">
      <section>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--accent-color)]/70">Structural Links</p>
            <h2 className="mt-0.5 text-base font-semibold text-zinc-50">Commodity-Currency Links</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Commodity-exporting nations{"'"} currencies often track their primary exports.</p>
          </div>
          <TfButtons value={cfTf} onChange={setCfTf} timeframes={TIMEFRAMES_CHART} />
        </div>
        {cfLoading ? <SectionSkeleton height={200} /> : cfData && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {COMMODITY_FX_PAIRS.map((pair) => (
              <CommodityFxCard key={`${pair.commodityTicker}-${pair.fxTicker}`}
                pair={pair} normalizedSeries={cfData.normalizedSeries} matrix={cfData.matrix} />
            ))}
          </div>
        )}
      </section>
      </SectionErrorBoundary>

      {/* ── Section 5: Market Regime Detection ───────────────────────────────── */}
      <SectionErrorBoundary name="Market Regime Detection">
      <section>
        <SectionHeader label="Macro Analysis" title="Market Regime Detection"
          subtitle="Cross-asset correlation patterns reveal the current market environment." />
        {hmData && <RegimePanel performance={hmData.performance} />}
      </section>
      </SectionErrorBoundary>

      {/* ── Modal ────────────────────────────────────────────────────────────── */}
      {selectedPair && (
        <CorrelationModal
          assetA={selectedPair.a}
          assetB={selectedPair.b}
          defaultTfIdx={hmTf}
          onClose={() => setSelectedPair(null)}
          cacheRef={cacheRef}
          fetchingRef={fetchingRef}
          loadDays={loadDays}
        />
      )}
    </div>
  );
}
