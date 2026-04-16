"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Treemap,
  Cell,
} from "recharts";
import { useToast } from "../../components/ToastContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScreenerStock {
  symbol: string;
  companyName: string;
  marketCap: number | null;
  sector: string | null;
  industry: string | null;
  beta: number | null;
  price: number | null;
  lastAnnualDividend: number | null;
  volume: number | null;
  exchange: string | null;
  country: string | null;
  isEtf: boolean;
  isActivelyTrading: boolean;
  pe: number | null;
  eps: number | null;
  priceToBook: number | null;
  dividendYield: number | null;
  debtToEquity: number | null;
  revenueGrowth: number | null;
  image: string | null;
  dayChange: number | null;
  dayChangePct: number | null;
  vsMA50: number | null;
  vsMA200: number | null;
  vs52wkHigh: number | null;
  vs52wkLow: number | null;
}

interface TechData {
  rsi: number | null;
  sma50: number | null;
  sma200: number | null;
  aboveSma50: boolean;
  aboveSma200: boolean;
}

interface ScreenerFilters {
  exchange: string[];
  sector: string[];
  country: string;
  marketCapMin: string;
  marketCapMax: string;
  priceMin: string;
  priceMax: string;
  betaMin: string;
  betaMax: string;
  volumeMin: string;
  dividendMin: string;
  peMin: string;
  peMax: string;
  pbMin: string;
  dayChangePctMin: string;
  dayChangePctMax: string;
  rsiMin: string;
  rsiMax: string;
  vsSma50: "above" | "below" | "any";
  vsSma200: "above" | "below" | "any";
}

interface SavedScreen {
  id: string;
  name: string;
  description: string | null;
  filters: Partial<ScreenerFilters>;
  is_public: boolean;
  alerts_enabled: boolean;
  created_at: string;
}

type HeatColorBy = "dayChangePct" | "vsMA50" | "vsMA200" | "vs52wkHigh" | "vs52wkLow" | "revenueGrowth" | "pe" | "beta";

const HEAT_COLOR_OPTIONS: { value: HeatColorBy; label: string }[] = [
  { value: "dayChangePct", label: "Day Change %" },
  { value: "vsMA50",       label: "vs 50-Day MA" },
  { value: "vsMA200",      label: "vs 200-Day MA" },
  { value: "vs52wkHigh",   label: "vs 52-Wk High" },
  { value: "vs52wkLow",    label: "vs 52-Wk Low" },
  { value: "revenueGrowth",label: "Revenue Growth" },
  { value: "pe",           label: "P/E Ratio" },
  { value: "beta",         label: "Beta" },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_SECTORS = [
  "Technology",
  "Healthcare",
  "Financial Services",
  "Energy",
  "Consumer Cyclical",
  "Consumer Defensive",
  "Industrials",
  "Basic Materials",
  "Utilities",
  "Real Estate",
  "Communication Services",
];

const DEFAULT_FILTERS: ScreenerFilters = {
  exchange: ["NYSE", "NASDAQ", "AMEX"],
  sector: [...ALL_SECTORS],
  country: "US",
  marketCapMin: "",
  marketCapMax: "",
  priceMin: "",
  priceMax: "",
  betaMin: "",
  betaMax: "",
  volumeMin: "",
  dividendMin: "",
  peMin: "",
  peMax: "",
  pbMin: "",
  dayChangePctMin: "",
  dayChangePctMax: "",
  rsiMin: "",
  rsiMax: "",
  vsSma50: "any",
  vsSma200: "any",
};

const SECTORS = ALL_SECTORS;
const EXCHANGES = ["NYSE", "NASDAQ", "AMEX"];

// SVG icon paths for templates
const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  "buffett-value": (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  "growth-momentum": (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  "oversold-bounce": (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  ),
  "dividend-income": (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  "small-cap-gems": (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  "breakout": (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
  ),
};

const TEMPLATES = [
  {
    id: "buffett-value",
    label: "Buffett Value",
    filters: {
      peMax: "15",
      betaMax: "1.0",
      dividendMin: "0.01",
      marketCapMin: "1000000000",
    },
  },
  {
    id: "growth-momentum",
    label: "Growth Momentum",
    filters: { vsSma50: "above" as const, volumeMin: "500000" },
  },
  {
    id: "oversold-bounce",
    label: "Oversold Bounce",
    filters: {
      rsiMax: "35",
      vsSma200: "above" as const,
      marketCapMin: "500000000",
      volumeMin: "300000",
    },
  },
  {
    id: "dividend-income",
    label: "Dividend Income",
    filters: { dividendMin: "3", peMax: "20", marketCapMin: "2000000000" },
  },
  {
    id: "small-cap-gems",
    label: "Small Cap Gems",
    filters: {
      marketCapMin: "300000000",
      marketCapMax: "2000000000",
      peMax: "25",
      volumeMin: "100000",
    },
  },
  {
    id: "breakout",
    label: "52-Wk Breakout",
    filters: { vsSma50: "above" as const, volumeMin: "150000" },
  },
];

// ─── Utility Functions ────────────────────────────────────────────────────────

function fmtPrice(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtMktCap(v: number | null): string {
  if (v === null || v === undefined) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

function fmtPct(v: number | null, decimals = 2): string {
  if (v === null || v === undefined) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(decimals)}%`;
}

function fmtVol(v: number | null): string {
  if (v === null || v === undefined) return "—";
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return `${v}`;
}

function fmtNum(v: number | null, decimals = 2): string {
  if (v === null || v === undefined) return "—";
  return v.toFixed(decimals);
}

function getHeatColor(pct: number): string {
  if (pct <= -5) return "#7f1d1d";
  if (pct <= -2) return "#dc2626";
  if (pct <= -0.5) return "#f97316";
  if (pct < 0) return "#52525b";
  if (pct < 2) return "#86efac";
  if (pct < 5) return "#22c55e";
  return "#14532d";
}

function buildApiParams(filters: ScreenerFilters): URLSearchParams {
  const p = new URLSearchParams();
  // Exchange: pass checked exchanges (API defaults to NYSE,NASDAQ if not set)
  if (filters.exchange.length > 0) p.set("exchange", filters.exchange.join(","));
  // Sector: FMP only supports a single sector; skip if all/none selected (filter client-side)
  if (filters.sector.length === 1) p.set("sector", filters.sector[0]);
  if (filters.country) p.set("country", filters.country);
  if (filters.marketCapMin) p.set("marketCapMoreThan", filters.marketCapMin);
  if (filters.marketCapMax) p.set("marketCapLowerThan", filters.marketCapMax);
  if (filters.priceMin) p.set("priceMoreThan", filters.priceMin);
  if (filters.priceMax) p.set("priceLowerThan", filters.priceMax);
  if (filters.betaMin) p.set("betaMoreThan", filters.betaMin);
  if (filters.betaMax) p.set("betaLowerThan", filters.betaMax);
  if (filters.volumeMin) p.set("volumeMoreThan", filters.volumeMin);
  if (filters.dividendMin) p.set("dividendMoreThan", filters.dividendMin);
  return p;
}

function applyClientFilters(
  stocks: ScreenerStock[],
  filters: ScreenerFilters,
  techData: Record<string, TechData>
): ScreenerStock[] {
  return stocks.filter((s) => {
    // Sector: when 2–10 sectors selected, server returns all (no server filter), so filter here.
    // 0 or 1 selected: server handles it (0 = all, 1 = passed to FMP).
    // ALL_SECTORS.length selected: no filter needed.
    if (filters.sector.length > 1 && filters.sector.length < ALL_SECTORS.length) {
      if (!filters.sector.includes(s.sector ?? "")) return false;
    }
    if (filters.peMin && (s.pe === null || s.pe < parseFloat(filters.peMin))) return false;
    if (filters.peMax && (s.pe === null || s.pe > parseFloat(filters.peMax))) return false;
    if (filters.pbMin && (s.priceToBook === null || s.priceToBook < parseFloat(filters.pbMin))) return false;
    if (filters.dayChangePctMin && (s.dayChangePct === null || s.dayChangePct < parseFloat(filters.dayChangePctMin))) return false;
    if (filters.dayChangePctMax && (s.dayChangePct === null || s.dayChangePct > parseFloat(filters.dayChangePctMax))) return false;

    const td = techData[s.symbol];
    if (filters.rsiMin || filters.rsiMax) {
      const rsi = td?.rsi ?? null;
      if (filters.rsiMin && (rsi === null || rsi < parseFloat(filters.rsiMin))) return false;
      if (filters.rsiMax && (rsi === null || rsi > parseFloat(filters.rsiMax))) return false;
    }
    if (filters.vsSma50 !== "any") {
      if (!td) return false;
      if (filters.vsSma50 === "above" && !td.aboveSma50) return false;
      if (filters.vsSma50 === "below" && td.aboveSma50) return false;
    }
    if (filters.vsSma200 !== "any") {
      if (!td) return false;
      if (filters.vsSma200 === "above" && !td.aboveSma200) return false;
      if (filters.vsSma200 === "below" && td.aboveSma200) return false;
    }
    return true;
  });
}

// ─── useDebounce hook ─────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/10">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-200"
      >
        <span>{title}</span>
        <svg
          className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-zinc-300">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 hover:bg-white/10 hover:text-white"
        aria-label={`Remove filter ${label}`}
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

function SortHeader({
  label,
  colKey,
  sortCol,
  sortAsc,
  onSort,
}: {
  label: string;
  colKey: string;
  sortCol: string;
  sortAsc: boolean;
  onSort: (col: string) => void;
}) {
  const active = sortCol === colKey;
  return (
    <th
      className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
      onClick={() => onSort(colKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        <span className={`transition-colors ${active ? "text-[var(--accent-color)]" : "text-zinc-700"}`}>
          {active ? (sortAsc ? "↑" : "↓") : "↕"}
        </span>
      </span>
    </th>
  );
}

function RsiBadge({ rsi }: { rsi: number | null }) {
  if (rsi === null) return <span className="text-zinc-600">—</span>;
  const color =
    rsi > 70
      ? "text-red-400 bg-red-500/10"
      : rsi < 30
        ? "text-green-400 bg-green-500/10"
        : "text-zinc-400 bg-white/5";
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${color}`}>
      {rsi.toFixed(0)}
    </span>
  );
}

function SmaArrow({ above }: { above: boolean | null }) {
  if (above === null || above === undefined) return <span className="text-zinc-600">—</span>;
  return (
    <span className={above ? "text-green-400" : "text-red-400"}>
      {above ? "↑" : "↓"}
    </span>
  );
}

function DayChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-zinc-600">—</span>;
  const positive = pct >= 0;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        positive
          ? "bg-green-500/15 text-green-400"
          : "bg-red-500/15 text-red-400"
      }`}
    >
      {fmtPct(pct)}
    </span>
  );
}

// ─── TableView ────────────────────────────────────────────────────────────────

function TableView({
  stocks,
  techData,
  sortCol,
  sortAsc,
  onSort,
  onSelect,
  onAddWatchlist,
}: {
  stocks: ScreenerStock[];
  techData: Record<string, TechData>;
  sortCol: string;
  sortAsc: boolean;
  onSort: (col: string) => void;
  onSelect: (stock: ScreenerStock) => void;
  onAddWatchlist: (symbol: string, name: string) => void;
}) {
  if (stocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
        <svg className="mb-4 h-12 w-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-medium">No stocks match your filters</p>
        <p className="mt-1 text-xs">Try loosening your criteria</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="sticky top-0 z-10 bg-[var(--app-card-alt)]">
            <SortHeader label="Ticker" colKey="symbol" sortCol={sortCol} sortAsc={sortAsc} onSort={onSort} />
            <SortHeader label="Company" colKey="companyName" sortCol={sortCol} sortAsc={sortAsc} onSort={onSort} />
            <SortHeader label="Sector" colKey="sector" sortCol={sortCol} sortAsc={sortAsc} onSort={onSort} />
            <SortHeader label="Price" colKey="price" sortCol={sortCol} sortAsc={sortAsc} onSort={onSort} />
            <SortHeader label="Day %" colKey="dayChangePct" sortCol={sortCol} sortAsc={sortAsc} onSort={onSort} />
            <SortHeader label="Mkt Cap" colKey="marketCap" sortCol={sortCol} sortAsc={sortAsc} onSort={onSort} />
            <SortHeader label="P/E" colKey="pe" sortCol={sortCol} sortAsc={sortAsc} onSort={onSort} />
            <SortHeader label="Volume" colKey="volume" sortCol={sortCol} sortAsc={sortAsc} onSort={onSort} />
            <SortHeader label="Beta" colKey="beta" sortCol={sortCol} sortAsc={sortAsc} onSort={onSort} />
            <SortHeader label="Div" colKey="dividendYield" sortCol={sortCol} sortAsc={sortAsc} onSort={onSort} />
            <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">RSI</th>
            <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">50</th>
            <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">200</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {stocks.map((s) => {
            const td = techData[s.symbol];
            return (
              <tr
                key={s.symbol}
                className="cursor-pointer border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                onClick={() => onSelect(s)}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    {s.image ? (
                      <img
                        src={s.image}
                        alt={s.symbol}
                        width={20}
                        height={20}
                        className="rounded-sm object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-white/10 text-[10px] font-bold text-zinc-300">
                        {s.symbol[0]}
                      </span>
                    )}
                    <span className="font-semibold text-zinc-50">{s.symbol}</span>
                  </div>
                </td>
                <td className="max-w-[160px] truncate px-3 py-2.5 text-zinc-400">{s.companyName}</td>
                <td className="px-3 py-2.5">
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-xs text-zinc-400">
                    {s.sector ?? "—"}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-medium text-zinc-50">{fmtPrice(s.price)}</td>
                <td className="px-3 py-2.5">
                  <DayChangeBadge pct={s.dayChangePct} />
                </td>
                <td className="px-3 py-2.5 text-zinc-400">{fmtMktCap(s.marketCap)}</td>
                <td className="px-3 py-2.5 text-zinc-400">{fmtNum(s.pe)}</td>
                <td className="px-3 py-2.5 text-zinc-400">{fmtVol(s.volume)}</td>
                <td className="px-3 py-2.5 text-zinc-400">{fmtNum(s.beta)}</td>
                <td className="px-3 py-2.5 text-zinc-400">
                  {s.dividendYield !== null ? `${(s.dividendYield * 100).toFixed(2)}%` : "—"}
                </td>
                <td className="px-3 py-2.5">
                  <RsiBadge rsi={td?.rsi ?? null} />
                </td>
                <td className="px-3 py-2.5 text-base">
                  <SmaArrow above={td ? td.aboveSma50 : null} />
                </td>
                <td className="px-3 py-2.5 text-base">
                  <SmaArrow above={td ? td.aboveSma200 : null} />
                </td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddWatchlist(s.symbol, s.companyName);
                    }}
                    className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-zinc-400 hover:border-[var(--accent-color)]/50 hover:text-[var(--accent-color)] transition-colors"
                    title="Add to watchlist"
                  >
                    +
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── HeatmapView ──────────────────────────────────────────────────────────────

interface TreemapEntry {
  name: string;
  size: number;
  pct: number;
  metricLabel: string;
  company: string;
  price: number | null;
  symbol: string;
  [key: string]: unknown;
}

interface TreemapGroup {
  name: string;
  children: TreemapEntry[];
  [key: string]: unknown;
}

function getMetricValue(s: ScreenerStock, colorBy: HeatColorBy): number {
  switch (colorBy) {
    case "dayChangePct":   return s.dayChangePct ?? 0;
    case "vsMA50":         return s.vsMA50 ?? 0;
    case "vsMA200":        return s.vsMA200 ?? 0;
    case "vs52wkHigh":     return s.vs52wkHigh ?? 0;
    case "vs52wkLow":      return s.vs52wkLow ?? 0;
    case "revenueGrowth":  return s.revenueGrowth !== null ? s.revenueGrowth * 100 : 0;
    // PE and Beta: invert so low=green, high=red; normalize to a ±10 scale
    case "pe":    return s.pe !== null ? Math.max(-10, Math.min(10, 20 - s.pe)) : 0;
    case "beta":  return s.beta !== null ? Math.max(-10, Math.min(10, (1 - s.beta) * 10)) : 0;
    default:       return 0;
  }
}

function fmtMetricValue(s: ScreenerStock, colorBy: HeatColorBy): string {
  switch (colorBy) {
    case "dayChangePct":  return fmtPct(s.dayChangePct);
    case "vsMA50":        return fmtPct(s.vsMA50);
    case "vsMA200":       return fmtPct(s.vsMA200);
    case "vs52wkHigh":    return fmtPct(s.vs52wkHigh);
    case "vs52wkLow":     return fmtPct(s.vs52wkLow);
    case "revenueGrowth": return s.revenueGrowth !== null ? fmtPct(s.revenueGrowth * 100) : "—";
    case "pe":            return s.pe !== null ? `PE ${s.pe.toFixed(1)}` : "—";
    case "beta":          return s.beta !== null ? `β ${s.beta.toFixed(2)}` : "—";
    default:              return "—";
  }
}

function HeatmapView({
  stocks,
  colorBy,
  onSelect,
}: {
  stocks: ScreenerStock[];
  colorBy: HeatColorBy;
  onSelect: (s: ScreenerStock) => void;
}) {
  const stockMap = useMemo(() => {
    const m: Record<string, ScreenerStock> = {};
    stocks.forEach((s) => (m[s.symbol] = s));
    return m;
  }, [stocks]);

  const treeData: TreemapGroup[] = useMemo(() => {
    const byS: Record<string, ScreenerStock[]> = {};
    stocks.forEach((s) => {
      const sec = s.sector ?? "Other";
      if (!byS[sec]) byS[sec] = [];
      byS[sec].push(s);
    });
    return Object.entries(byS).map(([sector, list]) => ({
      name: sector,
      children: list.map((s) => ({
        name: s.symbol,
        symbol: s.symbol,
        size: Math.max(Math.log((s.marketCap ?? 1e9) + 1) * 10, 1),
        pct: getMetricValue(s, colorBy),
        metricLabel: fmtMetricValue(s, colorBy),
        company: s.companyName,
        price: s.price,
      })),
    }));
  }, [stocks, colorBy]);

  const TreeContent = (props: Record<string, unknown>) => {
    const x = props.x as number;
    const y = props.y as number;
    const width = props.width as number;
    const height = props.height as number;
    const name = props.name as string;
    const pct = (props.pct as number) ?? 0;
    const metricLabel = (props.metricLabel as string | undefined) ?? fmtPct(pct);
    const price = props.price as number | null;
    const company = (props.company as string | undefined) ?? "";

    // Recharts passes parent group nodes too — skip them (no stock match)
    if (!stockMap[name]) return null;

    const color = getHeatColor(pct);
    const showText = width > 40 && height > 30;
    const showCompany = width > 80 && height > 50;

    return (
      <g
        style={{ cursor: "pointer" }}
        onClick={() => {
          const s = stockMap[name];
          if (s) onSelect(s);
        }}
      >
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={color}
          fillOpacity={0.85}
          stroke="var(--app-bg)"
          strokeWidth={2}
          rx={4}
        />
        {showText && (
          <>
            <text
              x={x + width / 2}
              y={y + height / 2 - (showCompany ? 12 : 6)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={Math.min(14, width / 4)}
              fontWeight="700"
            >
              {name}
            </text>
            {showCompany && (
              <text
                x={x + width / 2}
                y={y + height / 2 + 4}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="rgba(255,255,255,0.7)"
                fontSize={Math.min(10, width / 8)}
              >
                {company.length > 20 ? company.slice(0, 18) + "…" : company}
              </text>
            )}
            <text
              x={x + width / 2}
              y={y + height / 2 + (showCompany ? 20 : 10)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(255,255,255,0.85)"
              fontSize={Math.min(11, width / 6)}
              fontWeight="600"
            >
              {metricLabel}
            </text>
            {price !== null && showCompany && (
              <text
                x={x + width / 2}
                y={y + height / 2 + 34}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="rgba(255,255,255,0.6)"
                fontSize={Math.min(9, width / 8)}
              >
                {fmtPrice(price)}
              </text>
            )}
          </>
        )}
      </g>
    );
  };

  interface TooltipPayloadItem {
    payload?: TreemapEntry;
  }

  const HeatmapTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: TooltipPayloadItem[];
  }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
      <div className="rounded-lg border border-white/10 bg-[var(--app-card-alt)] p-3 shadow-xl text-xs">
        <p className="font-bold text-zinc-50">{d.symbol} — {d.company}</p>
        <p className="text-zinc-400 mt-1">{fmtPrice(d.price)}</p>
        <p className={d.pct >= 0 ? "text-green-400" : "text-red-400"}>{d.metricLabel}</p>
      </div>
    );
  };

  if (stocks.length === 0) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-500 text-sm">
        No stocks to display
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Legend */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span>↓ &lt;-5%</span>
        <div className="h-3 flex-1 rounded" style={{ background: "linear-gradient(to right, #7f1d1d, #dc2626, #f97316, #52525b, #86efac, #22c55e, #14532d)" }} />
        <span>&gt;+5% ↑</span>
      </div>
      <ResponsiveContainer width="100%" height={600}>
        <Treemap
          data={treeData}
          dataKey="size"
          content={<TreeContent />}
        >
          <Tooltip content={<HeatmapTooltip />} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}

// ─── DetailPanel ──────────────────────────────────────────────────────────────

function DetailPanel({
  stock,
  techData,
  onClose,
}: {
  stock: ScreenerStock;
  techData: Record<string, TechData>;
  onClose: () => void;
}) {
  const td = techData[stock.symbol];
  const { showToast } = useToast();

  const handleAddWatchlist = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: stock.symbol, company: stock.companyName }),
      });
      if (!res.ok) throw new Error("Failed");
      showToast(`${stock.symbol} added to watchlist`, "success");
    } catch {
      showToast("Failed to add to watchlist", "error");
    }
  }, [stock, showToast]);

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-white/10 p-5">
        <div className="flex items-center gap-3">
          {stock.image ? (
            <img
              src={stock.image}
              alt={stock.symbol}
              width={24}
              height={24}
              className="rounded object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded bg-white/10 text-xs font-bold text-zinc-300">
              {stock.symbol[0]}
            </span>
          )}
          <div>
            <p className="text-sm font-semibold text-zinc-50">{stock.companyName}</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="rounded bg-[var(--accent-color)]/20 px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent-color)]">
                {stock.symbol}
              </span>
              {stock.exchange && (
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-500">
                  {stock.exchange}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-200 transition-colors"
          aria-label="Close panel"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Price */}
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <span className="text-3xl font-bold text-zinc-50">{fmtPrice(stock.price)}</span>
        <DayChangeBadge pct={stock.dayChangePct} />
      </div>

      {/* Metrics grid */}
      <div className="border-b border-white/10 p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Fundamentals</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Market Cap", value: fmtMktCap(stock.marketCap) },
            { label: "Sector", value: stock.sector ?? "—" },
            { label: "P/E Ratio", value: fmtNum(stock.pe) },
            { label: "Industry", value: stock.industry ?? "—" },
            { label: "P/B Ratio", value: fmtNum(stock.priceToBook) },
            { label: "Country", value: stock.country ?? "—" },
            { label: "EPS", value: fmtNum(stock.eps) },
            { label: "Dividend Yield", value: stock.dividendYield !== null ? `${(stock.dividendYield * 100).toFixed(2)}%` : "—" },
            { label: "Beta", value: fmtNum(stock.beta) },
            { label: "Debt/Equity", value: fmtNum(stock.debtToEquity) },
            { label: "Volume", value: fmtVol(stock.volume) },
            { label: "Rev. Growth", value: stock.revenueGrowth !== null ? fmtPct(stock.revenueGrowth * 100) : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-white/5 p-2.5">
              <p className="text-[10px] text-zinc-600">{label}</p>
              <p className="mt-0.5 text-xs font-medium text-zinc-200 break-words">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Technical */}
      {td && (
        <div className="border-b border-white/10 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Technical</p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
              <span className="text-xs text-zinc-400">RSI (14)</span>
              <RsiBadge rsi={td.rsi} />
            </div>
            {td.sma50 !== null && (
              <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                <span className="text-xs text-zinc-400">SMA 50</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-300">{fmtPrice(td.sma50)}</span>
                  <SmaArrow above={td.aboveSma50} />
                </div>
              </div>
            )}
            {td.sma200 !== null && (
              <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                <span className="text-xs text-zinc-400">SMA 200</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-300">{fmtPrice(td.sma200)}</span>
                  <SmaArrow above={td.aboveSma200} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="border-b border-white/10 p-5">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleAddWatchlist}
            className="w-full rounded-xl bg-[var(--accent-color)] py-2.5 text-sm font-semibold text-[var(--app-bg)] hover:opacity-90 transition-opacity"
          >
            + Add to Watchlist
          </button>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`/backtest?ticker=${stock.symbol}`}
              className="rounded-xl border border-white/10 bg-white/5 py-2.5 text-center text-sm font-medium text-zinc-300 hover:bg-white/10 transition-colors"
            >
              Run Backtest
            </a>
            <a
              href={`/search/${stock.symbol}`}
              className="rounded-xl border border-white/10 bg-white/5 py-2.5 text-center text-sm font-medium text-zinc-300 hover:bg-white/10 transition-colors"
            >
              Full Page →
            </a>
          </div>
        </div>
      </div>

      {/* News placeholder */}
      <div className="p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">News</p>
        <a
          href={`https://finnhub.io/stock/${stock.symbol.toLowerCase()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-[var(--accent-color)] hover:underline"
        >
          View {stock.symbol} latest news →
        </a>
      </div>
    </div>
  );
}

// ─── SaveScreenModal ──────────────────────────────────────────────────────────

function SaveScreenModal({
  filters,
  onSave,
  onClose,
}: {
  filters: ScreenerFilters;
  onSave: (
    name: string,
    description: string,
    isPublic: boolean,
    alertsEnabled: boolean
  ) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  void filters;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(name.trim(), description.trim(), isPublic, alertsEnabled);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[var(--app-card)] p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-50">Save Screen</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-200 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Screen Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. High Dividend Large Caps"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]/30"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this screen look for?"
              rows={3}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]/30"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-zinc-300">Public screen</p>
              <p className="text-xs text-zinc-500">Visible to other users</p>
            </div>
            <button
              type="button"
              onClick={() => setIsPublic((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition-colors ${isPublic ? "bg-[var(--accent-color)]" : "bg-white/10"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isPublic ? "left-[22px]" : "left-0.5"}`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-zinc-300">Price alerts</p>
              <p className="text-xs text-zinc-500">Get notified when stocks match</p>
            </div>
            <button
              type="button"
              onClick={() => setAlertsEnabled((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition-colors ${alertsEnabled ? "bg-[var(--accent-color)]" : "bg-white/10"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${alertsEnabled ? "left-[22px]" : "left-0.5"}`}
              />
            </button>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-zinc-400 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="flex-1 rounded-xl bg-[var(--accent-color)] py-2.5 text-sm font-semibold text-[var(--app-bg)] hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Saving…
                </>
              ) : (
                "Save Screen"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-0">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-white/5 px-4 py-3">
          <div className="h-5 w-5 rounded animate-pulse bg-white/10" />
          <div className="h-4 w-16 rounded animate-pulse bg-white/10" />
          <div className="h-4 w-32 rounded animate-pulse bg-white/10" />
          <div className="ml-auto flex items-center gap-4">
            <div className="h-4 w-16 rounded animate-pulse bg-white/10" />
            <div className="h-4 w-12 rounded animate-pulse bg-white/10" />
            <div className="h-4 w-20 rounded animate-pulse bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main ScreenerView ────────────────────────────────────────────────────────

export default function ScreenerView() {
  const [filters, setFilters] = useState<ScreenerFilters>(DEFAULT_FILTERS);
  const [stocks, setStocks] = useState<ScreenerStock[]>([]);
  const [techData, setTechData] = useState<Record<string, TechData>>({});
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"heatmap" | "table">("heatmap");
  const [heatColorBy, setHeatColorBy] = useState<HeatColorBy>("dayChangePct");
  const [selected, setSelected] = useState<ScreenerStock | null>(null);
  const [sortCol, setSortCol] = useState("marketCap");
  const [sortAsc, setSortAsc] = useState(false);
  const [saveModal, setSaveModal] = useState(false);
  const [savedScreens, setSavedScreens] = useState<SavedScreen[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [techLoading, setTechLoading] = useState(false);
  const [loadDropdownOpen, setLoadDropdownOpen] = useState(false);
  const { showToast } = useToast();

  const debouncedFilters = useDebounce(filters, 500);

  // Helper to set a single filter key
  const setFilter = useCallback(
    <K extends keyof ScreenerFilters>(key: K, value: ScreenerFilters[K]) =>
      setFilters((f) => ({ ...f, [key]: value })),
    []
  );

  // Fetch stocks
  const fetchStocks = useCallback(async (f: ScreenerFilters) => {
    setLoading(true);
    try {
      const params = buildApiParams(f);
      const res = await fetch(`/api/screener?${params}`);
      if (!res.ok) throw new Error("Fetch failed");
      const data: ScreenerStock[] = await res.json();
      setStocks(data);
    } catch {
      showToast("Failed to load stocks", "error");
      setStocks([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Fetch tech data for a batch of symbols
  const fetchTechData = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) return;
    setTechLoading(true);
    try {
      const res = await fetch(`/api/screener/technical?tickers=${symbols.join(",")}`);
      if (!res.ok) return;
      const data: Record<string, TechData> = await res.json();
      setTechData((prev) => ({ ...prev, ...data }));
    } catch {
      // silent
    } finally {
      setTechLoading(false);
    }
  }, []);

  // Fetch saved screens on mount
  useEffect(() => {
    fetch("/api/screener/save")
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) setSavedScreens(data as SavedScreen[]);
      })
      .catch(() => {});
  }, []);

  // Refetch on debounced filter change
  useEffect(() => {
    fetchStocks(debouncedFilters);
  }, [debouncedFilters, fetchStocks]);

  // Fetch tech data when stocks change
  const stockSymbolsKey = stocks.map((s) => s.symbol).join(",");
  useEffect(() => {
    const symbols = stocks.map((s) => s.symbol).slice(0, 100);
    if (symbols.length > 0) {
      fetchTechData(symbols);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockSymbolsKey, fetchTechData]);

  // Filtered + sorted stocks
  const filteredStocks = useMemo(() => {
    const filtered = applyClientFilters(stocks, filters, techData);
    return [...filtered].sort((a, b) => {
      let aVal: number | string | null = null;
      let bVal: number | string | null = null;

      switch (sortCol) {
        case "symbol": aVal = a.symbol; bVal = b.symbol; break;
        case "companyName": aVal = a.companyName; bVal = b.companyName; break;
        case "sector": aVal = a.sector; bVal = b.sector; break;
        case "price": aVal = a.price; bVal = b.price; break;
        case "dayChangePct": aVal = a.dayChangePct; bVal = b.dayChangePct; break;
        case "marketCap": aVal = a.marketCap; bVal = b.marketCap; break;
        case "pe": aVal = a.pe; bVal = b.pe; break;
        case "volume": aVal = a.volume; bVal = b.volume; break;
        case "beta": aVal = a.beta; bVal = b.beta; break;
        case "dividendYield": aVal = a.dividendYield; bVal = b.dividendYield; break;
        default: aVal = a.marketCap; bVal = b.marketCap;
      }

      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const an = aVal as number;
      const bn = bVal as number;
      return sortAsc ? an - bn : bn - an;
    });
  }, [stocks, filters, techData, sortCol, sortAsc]);

  // Sort handler
  const handleSort = useCallback((col: string) => {
    setSortCol((prev) => {
      if (prev === col) {
        setSortAsc((a) => !a);
        return col;
      }
      setSortAsc(false);
      return col;
    });
  }, []);

  // Watchlist handler
  const handleAddWatchlist = useCallback(
    async (symbol: string, name: string) => {
      try {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker: symbol, company: name }),
        });
        if (!res.ok) throw new Error("Failed");
        showToast(`${symbol} added to watchlist`, "success");
      } catch {
        showToast("Failed to add to watchlist", "error");
      }
    },
    [showToast]
  );

  // Save screen handler
  const handleSaveScreen = useCallback(
    async (
      name: string,
      desc: string,
      isPublic: boolean,
      alertsEnabled: boolean
    ) => {
      const res = await fetch("/api/screener/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: desc,
          filters,
          is_public: isPublic,
          alerts_enabled: alertsEnabled,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const saved: SavedScreen = await res.json();
      setSavedScreens((prev) => [saved, ...prev]);
      showToast("Screen saved!", "success");
    },
    [filters, showToast]
  );

  // Load screen handler
  const handleLoadScreen = useCallback(
    (screen: { filters: Partial<ScreenerFilters> }) => {
      setFilters({ ...DEFAULT_FILTERS, ...screen.filters });
      setLoadDropdownOpen(false);
    },
    []
  );

  // Active filter chips
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; reset: () => void }[] = [];

    if (filters.exchange.length > 0 && JSON.stringify(filters.exchange) !== JSON.stringify(DEFAULT_FILTERS.exchange)) {
      chips.push({ key: "exchange", label: `Exchange: ${filters.exchange.join(", ")}`, reset: () => setFilter("exchange", DEFAULT_FILTERS.exchange) });
    }
    if (filters.sector.length > 0) {
      chips.push({ key: "sector", label: `Sector: ${filters.sector.join(", ")}`, reset: () => setFilter("sector", []) });
    }
    if (filters.country && filters.country !== "US") {
      chips.push({ key: "country", label: `Country: ${filters.country}`, reset: () => setFilter("country", "US") });
    }
    if (filters.marketCapMin) chips.push({ key: "mcMin", label: `Cap ≥ ${fmtMktCap(parseFloat(filters.marketCapMin))}`, reset: () => setFilter("marketCapMin", "") });
    if (filters.marketCapMax) chips.push({ key: "mcMax", label: `Cap ≤ ${fmtMktCap(parseFloat(filters.marketCapMax))}`, reset: () => setFilter("marketCapMax", "") });
    if (filters.priceMin) chips.push({ key: "prMin", label: `Price ≥ $${filters.priceMin}`, reset: () => setFilter("priceMin", "") });
    if (filters.priceMax) chips.push({ key: "prMax", label: `Price ≤ $${filters.priceMax}`, reset: () => setFilter("priceMax", "") });
    if (filters.betaMin) chips.push({ key: "betaMin", label: `Beta ≥ ${filters.betaMin}`, reset: () => setFilter("betaMin", "") });
    if (filters.betaMax) chips.push({ key: "betaMax", label: `Beta ≤ ${filters.betaMax}`, reset: () => setFilter("betaMax", "") });
    if (filters.volumeMin) chips.push({ key: "volMin", label: `Vol ≥ ${fmtVol(parseFloat(filters.volumeMin))}`, reset: () => setFilter("volumeMin", "") });
    if (filters.dividendMin) chips.push({ key: "divMin", label: `Div ≥ ${filters.dividendMin}%`, reset: () => setFilter("dividendMin", "") });
    if (filters.peMin) chips.push({ key: "peMin", label: `P/E ≥ ${filters.peMin}`, reset: () => setFilter("peMin", "") });
    if (filters.peMax) chips.push({ key: "peMax", label: `P/E ≤ ${filters.peMax}`, reset: () => setFilter("peMax", "") });
    if (filters.pbMin) chips.push({ key: "pbMin", label: `P/B ≥ ${filters.pbMin}`, reset: () => setFilter("pbMin", "") });
    if (filters.dayChangePctMin) chips.push({ key: "dcMin", label: `Day% ≥ ${filters.dayChangePctMin}%`, reset: () => setFilter("dayChangePctMin", "") });
    if (filters.dayChangePctMax) chips.push({ key: "dcMax", label: `Day% ≤ ${filters.dayChangePctMax}%`, reset: () => setFilter("dayChangePctMax", "") });
    if (filters.rsiMin) chips.push({ key: "rsiMin", label: `RSI ≥ ${filters.rsiMin}`, reset: () => setFilter("rsiMin", "") });
    if (filters.rsiMax) chips.push({ key: "rsiMax", label: `RSI ≤ ${filters.rsiMax}`, reset: () => setFilter("rsiMax", "") });
    if (filters.vsSma50 !== "any") chips.push({ key: "sma50", label: `Price ${filters.vsSma50} SMA50`, reset: () => setFilter("vsSma50", "any") });
    if (filters.vsSma200 !== "any") chips.push({ key: "sma200", label: `Price ${filters.vsSma200} SMA200`, reset: () => setFilter("vsSma200", "any") });

    return chips;
  }, [filters, setFilter]);

  const loadDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (loadDropdownRef.current && !loadDropdownRef.current.contains(e.target as Node)) {
        setLoadDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="flex w-full min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10" style={{ background: "var(--app-bg)" }}>
      {/* Sidebar */}
      <aside
        className={`shrink-0 border-r border-white/10 bg-[var(--app-card-alt)] transition-all duration-200 overflow-y-auto ${
          sidebarOpen ? "w-[280px]" : "w-0 overflow-hidden"
        }`}
      >
        {sidebarOpen && (
          <div className="flex flex-col">
            {/* Templates */}
            <div className="border-b border-white/10 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Quick Templates
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleLoadScreen(t)}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300 hover:border-[var(--accent-color)]/40 hover:text-[var(--accent-color)] transition-colors"
                  >
                    {TEMPLATE_ICONS[t.id]}
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Market Filters */}
            <FilterSection title="Market">
              {/* Exchanges */}
              <div className="mb-3">
                <p className="mb-2 text-xs text-zinc-500">Exchange</p>
                <div className="flex flex-wrap gap-2">
                  {EXCHANGES.map((ex) => (
                    <label key={ex} className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-300">
                      <input
                        type="checkbox"
                        checked={filters.exchange.includes(ex)}
                        onChange={() => {
                          const next = filters.exchange.includes(ex)
                            ? filters.exchange.filter((e) => e !== ex)
                            : [...filters.exchange, ex];
                          setFilter("exchange", next);
                        }}
                        className="h-3 w-3 rounded accent-[var(--accent-color)]"
                      />
                      {ex}
                    </label>
                  ))}
                </div>
              </div>

              {/* Sectors */}
              <div className="mb-3">
                <p className="mb-2 text-xs text-zinc-500">Sector</p>
                <div className="max-h-32 overflow-y-auto flex flex-col gap-1 pr-1">
                  {SECTORS.map((sec) => (
                    <label key={sec} className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-300 hover:text-zinc-100">
                      <input
                        type="checkbox"
                        checked={filters.sector.includes(sec)}
                        onChange={() => {
                          const next = filters.sector.includes(sec)
                            ? filters.sector.filter((s) => s !== sec)
                            : [...filters.sector, sec];
                          setFilter("sector", next);
                        }}
                        className="h-3 w-3 rounded accent-[var(--accent-color)]"
                      />
                      {sec}
                    </label>
                  ))}
                </div>
              </div>

              {/* Market Cap presets */}
              <div className="mb-3">
                <p className="mb-2 text-xs text-zinc-500">Market Cap</p>
                <div className="mb-2 flex flex-wrap gap-1">
                  {[
                    { label: "Mega", min: "200000000000", max: "" },
                    { label: "Large", min: "10000000000", max: "200000000000" },
                    { label: "Mid", min: "2000000000", max: "10000000000" },
                    { label: "Small", min: "300000000", max: "2000000000" },
                    { label: "Micro", min: "0", max: "300000000" },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setFilter("marketCapMin", p.min);
                        setFilter("marketCapMax", p.max);
                      }}
                      className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-zinc-400 hover:border-[var(--accent-color)]/40 hover:text-[var(--accent-color)] transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.marketCapMin}
                    onChange={(e) => setFilter("marketCapMin", e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.marketCapMax}
                    onChange={(e) => setFilter("marketCapMax", e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                  />
                </div>
              </div>

              {/* Price */}
              <div className="mb-3">
                <p className="mb-2 text-xs text-zinc-500">Price ($)</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.priceMin}
                    onChange={(e) => setFilter("priceMin", e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.priceMax}
                    onChange={(e) => setFilter("priceMax", e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                  />
                </div>
              </div>

              {/* Country */}
              <div>
                <p className="mb-2 text-xs text-zinc-500">Country</p>
                <input
                  type="text"
                  placeholder="e.g. US"
                  value={filters.country}
                  onChange={(e) => setFilter("country", e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                />
              </div>
            </FilterSection>

            {/* Fundamental Filters */}
            <FilterSection title="Fundamental" defaultOpen={false}>
              {/* P/E */}
              <div className="mb-3">
                <p className="mb-2 text-xs text-zinc-500">P/E Ratio</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.peMin}
                    onChange={(e) => setFilter("peMin", e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.peMax}
                    onChange={(e) => setFilter("peMax", e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                  />
                </div>
              </div>

              {/* P/B */}
              <div className="mb-3">
                <p className="mb-2 text-xs text-zinc-500">P/B Min</p>
                <input
                  type="number"
                  placeholder="Min P/B"
                  value={filters.pbMin}
                  onChange={(e) => setFilter("pbMin", e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                />
              </div>

              {/* Dividend */}
              <div className="mb-3">
                <p className="mb-2 text-xs text-zinc-500">Min Dividend Yield (%)</p>
                <input
                  type="number"
                  placeholder="e.g. 2"
                  value={filters.dividendMin}
                  onChange={(e) => setFilter("dividendMin", e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                />
              </div>

              {/* Beta */}
              <div className="mb-3">
                <p className="mb-2 text-xs text-zinc-500">Beta</p>
                <div className="mb-2 flex gap-1">
                  {[
                    { label: "Low", betaMin: "", betaMax: "0.5" },
                    { label: "Medium", betaMin: "0.5", betaMax: "1.5" },
                    { label: "High", betaMin: "1.5", betaMax: "" },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setFilter("betaMin", p.betaMin);
                        setFilter("betaMax", p.betaMax);
                      }}
                      className="flex-1 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-zinc-400 hover:border-[var(--accent-color)]/40 hover:text-[var(--accent-color)] transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.betaMin}
                    onChange={(e) => setFilter("betaMin", e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.betaMax}
                    onChange={(e) => setFilter("betaMax", e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                  />
                </div>
              </div>

              {/* Volume */}
              <div>
                <p className="mb-2 text-xs text-zinc-500">Min Volume</p>
                <input
                  type="number"
                  placeholder="e.g. 500000"
                  value={filters.volumeMin}
                  onChange={(e) => setFilter("volumeMin", e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                />
              </div>
            </FilterSection>

            {/* Technical Filters */}
            <FilterSection title="Technical" defaultOpen={false}>
              {/* RSI */}
              <div className="mb-3">
                <p className="mb-2 text-xs text-zinc-500">RSI (14)</p>
                <div className="mb-2 flex gap-1">
                  {[
                    { label: "Oversold", rsiMin: "", rsiMax: "30" },
                    { label: "Neutral", rsiMin: "30", rsiMax: "70" },
                    { label: "Overbought", rsiMin: "70", rsiMax: "" },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setFilter("rsiMin", p.rsiMin);
                        setFilter("rsiMax", p.rsiMax);
                      }}
                      className="flex-1 rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[10px] text-zinc-400 hover:border-[var(--accent-color)]/40 hover:text-[var(--accent-color)] transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.rsiMin}
                    onChange={(e) => setFilter("rsiMin", e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.rsiMax}
                    onChange={(e) => setFilter("rsiMax", e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                  />
                </div>
              </div>

              {/* vs SMA 50 */}
              <div className="mb-3">
                <p className="mb-2 text-xs text-zinc-500">Price vs SMA 50</p>
                <div className="flex gap-1">
                  {(["any", "above", "below"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFilter("vsSma50", opt)}
                      className={`flex-1 rounded border py-1 text-xs transition-colors capitalize ${
                        filters.vsSma50 === opt
                          ? "border-[var(--accent-color)]/50 bg-[var(--accent-color)]/15 text-[var(--accent-color)]"
                          : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* vs SMA 200 */}
              <div>
                <p className="mb-2 text-xs text-zinc-500">Price vs SMA 200</p>
                <div className="flex gap-1">
                  {(["any", "above", "below"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFilter("vsSma200", opt)}
                      className={`flex-1 rounded border py-1 text-xs transition-colors capitalize ${
                        filters.vsSma200 === opt
                          ? "border-[var(--accent-color)]/50 bg-[var(--accent-color)]/15 text-[var(--accent-color)]"
                          : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </FilterSection>

            {/* Performance Filters */}
            <FilterSection title="Performance" defaultOpen={false}>
              <div>
                <p className="mb-2 text-xs text-zinc-500">Day Change %</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min %"
                    value={filters.dayChangePctMin}
                    onChange={(e) => setFilter("dayChangePctMin", e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max %"
                    value={filters.dayChangePctMax}
                    onChange={(e) => setFilter("dayChangePctMax", e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                  />
                </div>
              </div>
            </FilterSection>

            {/* Clear All */}
            <div className="p-4">
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="w-full rounded-xl border border-red-500/20 bg-red-500/10 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center gap-3 border-b border-white/10 bg-[var(--app-card-alt)] px-4 py-3">
          {/* Sidebar toggle */}
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-colors"
            aria-label="Toggle sidebar"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Results count */}
          <span className="text-sm text-zinc-500">
            {loading ? (
              <span className="text-zinc-600">Loading…</span>
            ) : (
              <>
                <span className="font-semibold text-zinc-300">{filteredStocks.length}</span>
                {" "}stocks
                {techLoading && <span className="ml-2 text-xs text-zinc-600">· loading tech…</span>}
              </>
            )}
          </span>

          {/* View toggle */}
          <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
            {(["heatmap", "table"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === v
                    ? "bg-[var(--accent-color)] text-[var(--app-bg)]"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {v === "heatmap" ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    </svg>
                    Heatmap
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18M3 14h18M3 18h18" />
                    </svg>
                    Table
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Color-by selector (heatmap only) */}
          {view === "heatmap" && (
            <select
              value={heatColorBy}
              onChange={(e) => setHeatColorBy(e.target.value as HeatColorBy)}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-[var(--accent-color)]/50"
            >
              {HEAT_COLOR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}

          {/* Save + Load */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSaveModal(true)}
              className="rounded-xl border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/10 px-3 py-1.5 text-xs font-medium text-[var(--accent-color)] hover:bg-[var(--accent-color)]/20 transition-colors"
            >
              Save Screen
            </button>

            <div className="relative" ref={loadDropdownRef}>
              <button
                type="button"
                onClick={() => setLoadDropdownOpen((v) => !v)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-colors flex items-center gap-1"
              >
                Load
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {loadDropdownOpen && (
                <div className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-white/10 bg-[var(--app-card-alt)] shadow-2xl">
                  {savedScreens.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-zinc-500">No saved screens yet</p>
                  ) : (
                    savedScreens.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleLoadScreen(s)}
                        className="w-full px-4 py-2.5 text-left text-xs text-zinc-300 hover:bg-white/5 transition-colors"
                      >
                        <p className="font-medium">{s.name}</p>
                        {s.description && (
                          <p className="text-zinc-500 truncate">{s.description}</p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active filter chips */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-white/5 bg-[var(--app-card-alt)]/80 px-4 py-2">
            {activeChips.map((chip) => (
              <FilterChip key={chip.key} label={chip.label} onRemove={chip.reset} />
            ))}
          </div>
        )}

        {/* View content */}
        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <LoadingSkeleton />
          ) : view === "heatmap" ? (
            <HeatmapView stocks={filteredStocks} colorBy={heatColorBy} onSelect={setSelected} />
          ) : (
            <TableView
              stocks={filteredStocks}
              techData={techData}
              sortCol={sortCol}
              sortAsc={sortAsc}
              onSort={handleSort}
              onSelect={setSelected}
              onAddWatchlist={handleAddWatchlist}
            />
          )}
        </div>
      </div>

      {/* Detail panel backdrop */}
      {selected && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        />
      )}

      {/* Detail panel */}
      <div
        className={`fixed right-0 top-0 z-50 h-screen w-[380px] overflow-y-auto border-l border-white/10 bg-[var(--app-card-alt)] shadow-2xl transition-transform duration-300 ${
          selected ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {selected && (
          <DetailPanel
            stock={selected}
            techData={techData}
            onClose={() => setSelected(null)}
          />
        )}
      </div>

      {/* Save screen modal */}
      {saveModal && (
        <SaveScreenModal
          filters={filters}
          onSave={handleSaveScreen}
          onClose={() => setSaveModal(false)}
        />
      )}
    </div>
  );
}
