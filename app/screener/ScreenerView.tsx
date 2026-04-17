"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
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
  vsSma50Pct: number | null;
  vsSma200Pct: number | null;
  weekChangePct: number | null;
  monthChangePct: number | null;
  ytdChangePct: number | null;
  yearChangePct: number | null;
  vs52wkHighPct: number | null;
  vs52wkLowPct: number | null;
}

interface ScreenerFilters {
  exchange: string[];
  sector: string[];
  country: string;
  marketCapMin: string;
  marketCapMax: string;
  /** Selected market-cap preset labels (Mega/Large/Mid/Small/Micro). Multi-
   *  select; the encompassing min/max range is derived from these for the
   *  server query, and client-side filter keeps only stocks in selected
   *  categories so non-contiguous selections don't leak through middle ranges. */
  marketCapPresets?: string[];
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
  weekChangePctMin: string;
  weekChangePctMax: string;
  monthChangePctMin: string;
  monthChangePctMax: string;
  ytdChangePctMin: string;
  ytdChangePctMax: string;
  yearChangePctMin: string;
  yearChangePctMax: string;
  vs52wkHighPctMin: string;
  vs52wkLowPctMin: string;
  rsiMin: string;
  rsiMax: string;
  vsSma50: "above" | "below" | "any";
  vsSma200: "above" | "below" | "any";
  vsSma50PctMin: string;
  vsSma50PctMax: string;
  vsSma200PctMin: string;
  vsSma200PctMax: string;
  /** When set, only stocks whose symbol is in this list pass the filter.
   *  Used by index presets (S&P 500, Nasdaq 100, Dow 30) so loading an index
   *  shows the actual members instead of a coarse market-cap proxy. */
  tickerWhitelist?: string[];
  /** Display label for the active whitelist (e.g. "S&P 500") so the UI can
   *  show what universe the user is looking at. */
  tickerWhitelistLabel?: string;
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

// HEAT_COLOR_OPTIONS removed — the dropdown that consumed it duplicated the
// Performance filter section. Heatmap colors by `dayChangePct` by default.

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

const MARKET_CAP_PRESETS: { label: string; min: string; max: string }[] = [
  { label: "Mega", min: "200000000000", max: "" },
  { label: "Large", min: "10000000000", max: "200000000000" },
  { label: "Mid", min: "2000000000", max: "10000000000" },
  { label: "Small", min: "300000000", max: "2000000000" },
  { label: "Micro", min: "0", max: "300000000" },
];

const DEFAULT_FILTERS: ScreenerFilters = {
  exchange: ["NYSE", "NASDAQ", "AMEX"],
  sector: [...ALL_SECTORS],
  country: "US",
  marketCapMin: "",
  marketCapMax: "",
  marketCapPresets: [],
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
  weekChangePctMin: "",
  weekChangePctMax: "",
  monthChangePctMin: "",
  monthChangePctMax: "",
  ytdChangePctMin: "",
  ytdChangePctMax: "",
  yearChangePctMin: "",
  yearChangePctMax: "",
  vs52wkHighPctMin: "",
  vs52wkLowPctMin: "",
  rsiMin: "",
  rsiMax: "",
  vsSma50: "any",
  vsSma200: "any",
  vsSma50PctMin: "",
  vsSma50PctMax: "",
  vsSma200PctMin: "",
  vsSma200PctMax: "",
  tickerWhitelist: undefined,
  tickerWhitelistLabel: undefined,
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

// Each template uses market-cap ranges as its PRIMARY differentiator because
// market cap is the one field guaranteed to be non-null and reliably filterable
// for every stock. Secondary criteria (beta, dividend, SMA direction, vs52wk)
// add further narrowing when the data is available but don't defeat the
// template if enrichment hasn't populated those fields yet.
const TEMPLATES = [
  {
    id: "buffett-value",
    label: "Buffett Value",
    desc: "Mega-cap blue chips with low beta and dividends — classic value",
    filters: {
      marketCapMin: "50000000000",   // >$50B mega-cap
      betaMax: "1.2",
      dividendMin: "0.5",
    },
  },
  {
    id: "growth-momentum",
    label: "Growth Momentum",
    desc: "Mid-to-large cap high-beta names with strong trading volume",
    filters: {
      marketCapMin: "10000000000",   // $10B–$200B
      marketCapMax: "200000000000",
      volumeMin: "1000000",
    },
  },
  {
    id: "oversold-bounce",
    label: "Oversold Bounce",
    desc: "Pulled back below 50-day MA but still above 200-day — dip-buy zone",
    filters: {
      vsSma50: "below" as const,
      vsSma200: "above" as const,
      marketCapMin: "2000000000",
      volumeMin: "300000",
    },
  },
  {
    id: "dividend-income",
    label: "Dividend Income",
    desc: "Large caps yielding 2%+ — income-focused portfolio building blocks",
    filters: {
      marketCapMin: "20000000000",   // >$20B
      dividendMin: "2",
    },
  },
  {
    id: "small-cap-gems",
    label: "Small Cap Gems",
    desc: "$300M–$2B market cap, actively traded — emerging growth stories",
    filters: {
      marketCapMin: "300000000",
      marketCapMax: "2000000000",
      volumeMin: "100000",
    },
  },
  {
    id: "breakout",
    label: "52-Wk Breakout",
    desc: "Near 52-week highs with volume confirmation — breakout territory",
    filters: {
      vs52wkHighPctMin: "-5",
      marketCapMin: "5000000000",     // >$5B
      volumeMin: "500000",
    },
  },
];

/** Index-style presets surfaced as a top-of-page chip bar (separate from the
 *  in-sidebar "Quick Templates"). Loose size + exchange proxies — won't match
 *  actual index constituent lists exactly (the Dow is curated, not size-based)
 *  but get the user to the right neighborhood without needing a separate
 *  constituent-list API. */
const INDEX_PRESETS: { id: string; label: string; filters: Partial<ScreenerFilters> }[] = [
  {
    id: "sp500",
    label: "S&P 500",
    filters: { marketCapMin: "5000000000", exchange: ["NYSE", "NASDAQ"], country: "US" },
  },
  {
    id: "nasdaq100",
    label: "Nasdaq 100",
    filters: { marketCapMin: "15000000000", exchange: ["NASDAQ"], country: "US" },
  },
  {
    id: "midcap400",
    label: "MidCap 400",
    filters: {
      marketCapMin: "2000000000",
      marketCapMax: "10000000000",
      exchange: ["NYSE", "NASDAQ"],
      country: "US",
    },
  },
  {
    id: "russell2000",
    label: "Russell 2000",
    filters: {
      marketCapMin: "300000000",
      marketCapMax: "2000000000",
      exchange: ["NYSE", "NASDAQ", "AMEX"],
      country: "US",
    },
  },
  {
    id: "dow30",
    label: "Dow 30",
    filters: { marketCapMin: "100000000000", exchange: ["NYSE", "NASDAQ"], country: "US" },
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

/** Refined "terminal-style" green-to-red gradient. Less saturated than the
 *  raw Tailwind reds/greens — closer to Bloomberg / FT terminal palettes —
 *  so the heatmap reads as a professional dashboard rather than a bright
 *  chart. Each step still maps cleanly to magnitude. */
function getHeatColor(pct: number): string {
  if (pct <= -5) return "#5f1d1d";   // burgundy
  if (pct <= -3) return "#8a2a2a";   // brick
  if (pct <= -1) return "#b04a4a";   // muted red
  if (pct < 0)   return "#c98080";   // dusty rose
  if (pct === 0) return "#5a5e66";   // slate (true flat — very rare)
  if (pct < 1)   return "#7fa991";   // pale jade
  if (pct < 3)   return "#3f8060";   // jade
  if (pct < 5)   return "#266049";   // forest
  return "#1b4435";                  // deep forest
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
  // Pre-build a Set for the whitelist lookup so we don't recompute per-stock.
  const whitelistSet = filters.tickerWhitelist && filters.tickerWhitelist.length > 0
    ? new Set(filters.tickerWhitelist.map((t) => t.toUpperCase()))
    : null;

  return stocks.filter((s) => {
    // Index whitelist (e.g. "S&P 500 only") — applied first so we short-circuit
    // out of the rest of the filter cascade for stocks that aren't members.
    if (whitelistSet && !whitelistSet.has(s.symbol.toUpperCase())) return false;

    // Sector: when 2–10 sectors selected, server returns all (no server filter), so filter here.
    // 0 or 1 selected: server handles it (0 = all, 1 = passed to FMP).
    // ALL_SECTORS.length selected: no filter needed.
    if (filters.sector.length > 1 && filters.sector.length < ALL_SECTORS.length) {
      if (!filters.sector.includes(s.sector ?? "")) return false;
    }
    // Market-cap presets: when multiple non-contiguous categories are picked
    // (e.g. Mega + Small) the server query covers the encompassing range so
    // we filter Mid stocks out here. If no presets are selected, the raw
    // marketCapMin/marketCapMax inputs handle it server-side.
    const presets = filters.marketCapPresets ?? [];
    if (presets.length > 0 && s.marketCap != null) {
      const inAny = presets.some((label) => {
        const p = MARKET_CAP_PRESETS.find((mp) => mp.label === label);
        if (!p) return false;
        const min = parseFloat(p.min || "0");
        const max = p.max === "" ? Infinity : parseFloat(p.max);
        return s.marketCap! >= min && s.marketCap! < max;
      });
      if (!inAny) return false;
    }
    // ─── Numeric filters: null = no data = pass through ───
    // If we don't have data for a field, let the stock through — the user
    // sees "—" in the column. The real narrowing for templates happens
    // server-side (FMP screener applies beta/dividend/mcap params) and via
    // the whitelist NOT backfilling non-qualifying stocks.
    const numFail = (val: number | null | undefined, minStr: string, maxStr: string): boolean => {
      if (val == null) return false;
      if (minStr && val < parseFloat(minStr)) return true;
      if (maxStr && val > parseFloat(maxStr)) return true;
      return false;
    };

    // Client-side duplicates of server-side filters — FMP free tier silently
    // ignores some params (betaLowerThan, dividendMoreThan, etc.), so the
    // broad universe comes back unfiltered. Applying them here ensures Quick
    // Templates like "Buffett Value" actually narrow the results.
    if (numFail(s.marketCap, filters.marketCapMin, filters.marketCapMax)) return false;
    if (numFail(s.price, filters.priceMin, filters.priceMax)) return false;
    if (numFail(s.beta, filters.betaMin, filters.betaMax)) return false;
    if (numFail(s.volume, filters.volumeMin, "")) return false;
    if (numFail(s.dividendYield, filters.dividendMin, "")) return false;

    if (numFail(s.pe, filters.peMin, filters.peMax)) return false;
    if (numFail(s.priceToBook, filters.pbMin, "")) return false;
    if (numFail(s.dayChangePct, filters.dayChangePctMin, filters.dayChangePctMax)) return false;

    const td = techData[s.symbol];

    // RSI — only available from tech route; no ScreenerStock fallback.
    if (numFail(td?.rsi ?? null, filters.rsiMin, filters.rsiMax)) return false;

    // SMA direction — use the enrichment-level vsMA50/vsMA200 from FMP /quote
    // as the PRIMARY source (available for top 500 immediately). Tech data is
    // the fallback (loads async, might not be ready). Without this, the three
    // SMA-based templates (Growth Momentum, Oversold Bounce, 52-Wk Breakout)
    // all passed everything through and showed identical stocks.
    if (filters.vsSma50 !== "any") {
      // Coalesce: ScreenerStock vsMA50 → techData aboveSma50 → null (pass)
      const above = s.vsMA50 != null ? s.vsMA50 > 0
        : td != null ? td.aboveSma50
        : null;
      if (above !== null) {
        if (filters.vsSma50 === "above" && !above) return false;
        if (filters.vsSma50 === "below" && above) return false;
      }
    }
    if (filters.vsSma200 !== "any") {
      const above = s.vsMA200 != null ? s.vsMA200 > 0
        : td != null ? td.aboveSma200
        : null;
      if (above !== null) {
        if (filters.vsSma200 === "above" && !above) return false;
        if (filters.vsSma200 === "below" && above) return false;
      }
    }

    // ─── Performance / 52-wk / SMA distance filters ───
    // Coalesce ScreenerStock enrichment values with techData. Enrichment is
    // available immediately for the top 500; techData loads asynchronously.
    if (numFail(td?.weekChangePct ?? null, filters.weekChangePctMin, filters.weekChangePctMax)) return false;
    if (numFail(td?.monthChangePct ?? null, filters.monthChangePctMin, filters.monthChangePctMax)) return false;
    if (numFail(td?.ytdChangePct ?? null, filters.ytdChangePctMin, filters.ytdChangePctMax)) return false;
    if (numFail(td?.yearChangePct ?? null, filters.yearChangePctMin, filters.yearChangePctMax)) return false;

    // 52-week: ScreenerStock has these from enrichment; tech route as fallback.
    if (numFail(s.vs52wkHigh ?? td?.vs52wkHighPct ?? null, filters.vs52wkHighPctMin, "")) return false;
    if (numFail(s.vs52wkLow ?? td?.vs52wkLowPct ?? null, filters.vs52wkLowPctMin, "")) return false;

    // SMA % distance: ScreenerStock enrichment → techData fallback.
    if (numFail(s.vsMA50 ?? td?.vsSma50Pct ?? null, filters.vsSma50PctMin, filters.vsSma50PctMax)) return false;
    if (numFail(s.vsMA200 ?? td?.vsSma200Pct ?? null, filters.vsSma200PctMin, filters.vsSma200PctMax)) return false;

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

  // Flat treemap sorted by market cap descending. Cell area = raw market
  // cap so visual area is proportional to actual market value (a $3T stock
  // really takes ~10× the area of a $300B stock). Recharts' squarified
  // algorithm keeps the shapes well-proportioned.
  const treeData = useMemo(() => {
    const sorted = [...stocks].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
    return sorted.map((s) => ({
      name: s.symbol,
      symbol: s.symbol,
      size: Math.max(s.marketCap ?? 1e9, 1),
      pct: getMetricValue(s, colorBy),
      metricLabel: fmtMetricValue(s, colorBy),
      company: s.companyName,
      price: s.price,
    }));
  }, [stocks, colorBy]);

  const TreeContent = (props: Record<string, unknown>) => {
    const x = props.x as number;
    const y = props.y as number;
    const width = props.width as number;
    const height = props.height as number;
    const name = props.name as string;
    const depth = props.depth as number | undefined;
    const root = props.root as { children?: Array<{ name: string }> } | undefined;
    const pct = (props.pct as number) ?? 0;
    const metricLabel = (props.metricLabel as string | undefined) ?? fmtPct(pct);
    const price = props.price as number | null;

    // Flat treemap — no sector grouping, every node is a leaf stock cell.
    // Skip anything that doesn't match a real ticker (Recharts also passes
    // a synthetic root node through this render function).
    void depth;
    void root;
    if (!stockMap[name]) return null;

    const color = getHeatColor(pct);
    const showText = width > 40 && height > 30;
    const roomy = width > 80 && height > 50;

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
            {/* Ticker — primary label. Company name was removed per user
                request; ticker + metric (+ price on roomy cells) is enough. */}
            <text
              x={x + width / 2}
              y={y + height / 2 - 6}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={Math.min(14, width / 4)}
              fontWeight="700"
            >
              {name}
            </text>
            <text
              x={x + width / 2}
              y={y + height / 2 + 10}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(255,255,255,0.85)"
              fontSize={Math.min(11, width / 6)}
              fontWeight="600"
            >
              {metricLabel}
            </text>
            {price !== null && roomy && (
              <text
                x={x + width / 2}
                y={y + height / 2 + 24}
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
      {/* Legend — plain labels, no arrow glyphs (the gradient itself shows
          direction; the up/down/sideways arrow chars were inconsistent). */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span>−5%</span>
        <div
          className="h-3 flex-1 rounded"
          style={{ background: "linear-gradient(to right, #5f1d1d, #8a2a2a, #b04a4a, #c98080, #7fa991, #3f8060, #266049, #1b4435)" }}
        />
        <span>+5%</span>
      </div>
      <ResponsiveContainer width="100%" height={600}>
        <Treemap
          data={treeData}
          dataKey="size"
          content={<TreeContent />}
          // Animation removed entirely — was re-running on every filter change
          // and felt jarring. Treemap now snaps directly to the new layout.
          isAnimationActive={false}
          animationDuration={0}
        >
          <Tooltip content={<HeatmapTooltip />} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}


// ── StockNews ─────────────────────────────────────────────────────────────────

type NewsArticle = {
  headline: string;
  source: string;
  url: string;
  datetime: number;
  summary: string;
};

function StockNews({ symbol }: { symbol: string }) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setArticles([]);
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    fetch(`/api/ticker-news?ticker=${encodeURIComponent(symbol)}`)
      .then((r) => (r.ok ? r.json() : { news: [] }))
      .then((data: { news?: NewsArticle[] }) => {
        setArticles(Array.isArray(data.news) ? data.news.slice(0, 5) : []);
      })
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [symbol]);

  return (
    <div className="p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {symbol} News
      </p>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <p className="text-xs text-zinc-600">No recent news found</p>
      ) : (
        <div className="flex flex-col gap-2">
          {articles.map((a, i) => (
            <a
              key={i}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-lg border border-white/[0.07] p-2.5 transition-colors hover:border-[var(--accent-color)]/30 hover:bg-[var(--accent-color)]/5"
            >
              <p className="text-xs font-medium text-zinc-200 line-clamp-2 group-hover:text-[var(--accent-color)]">
                {a.headline}
              </p>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-500">
                <span>{a.source}</span>
                <span>·</span>
                <span>{new Date(a.datetime * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </div>
            </a>
          ))}
        </div>
      )}
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

      {/* Metrics grid — shows whatever data is available from the screener +
          enrichment. dividendYield is already in % (e.g. 2.5 = 2.5%), so
          we do NOT multiply by 100 again (old code did → showed 250%). */}
      <div className="border-b border-white/10 p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Fundamentals</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Market Cap", value: fmtMktCap(stock.marketCap) },
            { label: "Sector", value: stock.sector ?? "—" },
            { label: "P/E Ratio", value: fmtNum(stock.pe) },
            { label: "Industry", value: stock.industry ?? "—" },
            { label: "EPS", value: fmtNum(stock.eps) },
            { label: "Country", value: stock.country ?? "—" },
            { label: "Beta", value: fmtNum(stock.beta) },
            { label: "Dividend Yield", value: stock.dividendYield != null ? `${stock.dividendYield.toFixed(2)}%` : "—" },
            { label: "Volume", value: fmtVol(stock.volume) },
            { label: "Day Change", value: stock.dayChangePct != null ? fmtPct(stock.dayChangePct) : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-white/5 p-2.5">
              <p className="text-[10px] text-zinc-600">{label}</p>
              <p className="mt-0.5 text-xs font-medium text-zinc-200 break-words">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Technical — show enrichment-level MA data when techData isn't loaded */}
      <div className="border-b border-white/10 p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Technical</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
            <span className="text-xs text-zinc-400">RSI (14)</span>
            {td?.rsi != null ? <RsiBadge rsi={td.rsi} /> : <span className="text-xs text-zinc-600">—</span>}
          </div>
          {(stock.vsMA50 != null || td?.sma50 != null) && (
            <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
              <span className="text-xs text-zinc-400">vs SMA 50</span>
              <div className="flex items-center gap-2">
                {stock.vsMA50 != null ? (
                  <span className={`text-xs font-medium ${stock.vsMA50 >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {stock.vsMA50 >= 0 ? "+" : ""}{stock.vsMA50.toFixed(1)}%
                  </span>
                ) : td?.sma50 != null ? (
                  <>
                    <span className="text-xs text-zinc-300">{fmtPrice(td.sma50)}</span>
                    <SmaArrow above={td.aboveSma50} />
                  </>
                ) : null}
              </div>
            </div>
          )}
          {(stock.vsMA200 != null || td?.sma200 != null) && (
            <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
              <span className="text-xs text-zinc-400">vs SMA 200</span>
              <div className="flex items-center gap-2">
                {stock.vsMA200 != null ? (
                  <span className={`text-xs font-medium ${stock.vsMA200 >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {stock.vsMA200 >= 0 ? "+" : ""}{stock.vsMA200.toFixed(1)}%
                  </span>
                ) : td?.sma200 != null ? (
                  <>
                    <span className="text-xs text-zinc-300">{fmtPrice(td.sma200)}</span>
                    <SmaArrow above={td.aboveSma200} />
                  </>
                ) : null}
              </div>
            </div>
          )}
          {(stock.vs52wkHigh != null || stock.vs52wkLow != null) && (
            <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
              <span className="text-xs text-zinc-400">52-Wk Range</span>
              <span className="text-xs text-zinc-300">
                {stock.vs52wkHigh != null ? `${stock.vs52wkHigh.toFixed(1)}% from high` : ""}
                {stock.vs52wkHigh != null && stock.vs52wkLow != null ? " · " : ""}
                {stock.vs52wkLow != null ? `${stock.vs52wkLow.toFixed(1)}% from low` : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Actions — Run Backtest removed per user request */}
      <div className="border-b border-white/10 p-5">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleAddWatchlist}
            className="w-full rounded-xl bg-[var(--accent-color)] py-2.5 text-sm font-semibold text-[var(--app-bg)] hover:opacity-90 transition-opacity"
          >
            + Add to Watchlist
          </button>
          <a
            href={`/search/${stock.symbol}`}
            className="rounded-xl border border-white/10 bg-white/5 py-2.5 text-center text-sm font-medium text-zinc-300 hover:bg-white/10 transition-colors"
          >
            Full Page →
          </a>
        </div>
      </div>

      {/* Company News — fetched live from Finnhub /company-news (free tier) */}
      <StockNews symbol={stock.symbol} />
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
  // Heatmap coloring is fixed to Day Change % — the dropdown that exposed
  // other options was removed (it duplicated the Performance filter section).
  const heatColorBy: HeatColorBy = "dayChangePct";
  const [selected, setSelected] = useState<ScreenerStock | null>(null);
  const [sortCol, setSortCol] = useState("marketCap");
  const [sortAsc, setSortAsc] = useState(false);
  const [saveModal, setSaveModal] = useState(false);
  const [savedScreens, setSavedScreens] = useState<SavedScreen[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [templatesOpen, setTemplatesOpen] = useState(true);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [techLoading, setTechLoading] = useState(false);
  const [loadDropdownOpen, setLoadDropdownOpen] = useState(false);
  const [indexDropdownOpen, setIndexDropdownOpen] = useState(false);
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
      // Send the ticker whitelist so the server can backfill any index
      // members the FMP screener missed — BUT skip when any non-default
      // filters are active (template or manual). With active filters, FMP
      // screener already returns only qualifying stocks; backfilling would
      // re-add non-qualifying members with null data that pass our null-
      // tolerant client filters, making the template do nothing visible.
      //
      // We detect "has active filters" by comparing filter values to defaults
      // rather than checking activeTemplateId — the state might not have
      // committed yet when fetchStocks is called from inside setFilters.
      const hasNonDefaultFilters = (Object.keys(DEFAULT_FILTERS) as Array<keyof ScreenerFilters>).some((key) => {
        if (key === "tickerWhitelist" || key === "tickerWhitelistLabel" || key === "exchange" || key === "sector" || key === "country" || key === "marketCapPresets") return false;
        return f[key] !== DEFAULT_FILTERS[key] && f[key] !== "" && f[key] !== undefined;
      });
      if (f.tickerWhitelist && f.tickerWhitelist.length > 0 && !hasNonDefaultFilters) {
        params.set("whitelist", f.tickerWhitelist.join(","));
      }
      const res = await fetch(`/api/screener?${params}`);
      if (!res.ok) throw new Error("Fetch failed");
      const data: ScreenerStock[] = await res.json();
      setStocks(data);
    } catch {
      showToast("Failed to load stocks", "error");
      // Keep previous stocks on error — don't wipe to blank. The stale
      // data is better than an empty screen while the user retries.
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

  // On first mount, default to the S&P 500 universe so the page lands on a
  // recognizable, focused set of large-cap US stocks instead of the broad
  // ~5000-ticker default. Only runs once.
  const didDefaultRef = useRef(false);
  useEffect(() => {
    if (didDefaultRef.current) return;
    didDefaultRef.current = true;
    const sp500 = INDEX_PRESETS.find((p) => p.id === "sp500");
    if (sp500) loadIndexPreset(sp500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch tech data when stocks change
  const stockSymbolsKey = stocks.map((s) => s.symbol).join(",");
  useEffect(() => {
    // Cap at 30 symbols for tech data — Finnhub free tier allows 60 req/min
    // and each symbol needs 1 candle call. 30 symbols in batches of 10 = 3
    // sequential batches, well within the limit.
    const symbols = stocks.map((s) => s.symbol).slice(0, 30);
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

  // Save screen handler — server enforces a 10-screen cap per user; surface
  // the 409 with a clear message so the user knows to delete an old one.
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
      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Saved-screen limit reached.");
      }
      if (!res.ok) throw new Error("Save failed");
      const saved: SavedScreen = await res.json();
      setSavedScreens((prev) => [saved, ...prev]);
      showToast("Screen saved!", "success");
    },
    [filters, showToast]
  );

  const savedCapReached = savedScreens.length >= 10;

  // Load screen / template handler. Preserves the active index whitelist so
  // clicking a Quick Template while on "S&P 500" applies the template's
  // filters (PE, beta, SMA, etc.) within that index — rather than wiping the
  // index and reverting to the full broad universe.
  const handleLoadScreen = useCallback(
    (screen: { filters: Partial<ScreenerFilters> }) => {
      setFilters((prev) => ({
        ...DEFAULT_FILTERS,
        ...screen.filters,
        // Carry over the current index whitelist so the template narrows
        // within the active index rather than unloading it.
        tickerWhitelist: prev.tickerWhitelist,
        tickerWhitelistLabel: prev.tickerWhitelistLabel,
      }));
      setLoadDropdownOpen(false);
    },
    []
  );

  /** Load an index preset by fetching its real constituent list (FMP +
   *  hardcoded fallbacks on the server) and setting it as the active ticker
   *  whitelist. Never applies the old size+exchange proxy filters — those
   *  added unwanted chips ("Cap ≥ $100B", "Exchange: NYSE,NASDAQ") that the
   *  user didn't want. The server route guarantees a non-empty ticker list
   *  for sp500 / nasdaq100 / dow30 via hardcoded fallbacks; for indexes
   *  without constituent data (russell2000, midcap400) the size proxy is
   *  the only option, so for those we still apply preset.filters. */
  const loadIndexPreset = useCallback(
    async (preset: { id: string; label: string; filters: Partial<ScreenerFilters> }) => {
      setIndexDropdownOpen(false);
      setActiveTemplateId(null); // switching index clears any active template
      const HAS_CONSTITUENT_LIST = new Set(["sp500", "nasdaq100", "dow30"]);
      if (HAS_CONSTITUENT_LIST.has(preset.id)) {
        try {
          const res = await fetch(`/api/screener/index-constituents?index=${preset.id}`);
          if (res.ok) {
            const data = (await res.json()) as { tickers?: string[] };
            if (Array.isArray(data.tickers) && data.tickers.length > 0) {
              setFilters({
                ...DEFAULT_FILTERS,
                tickerWhitelist: data.tickers,
                tickerWhitelistLabel: preset.label,
              });
              return;
            }
          }
        } catch {
          /* swallow — falls through to proxy */
        }
      }
      // No constituent list available for this index → use size proxy.
      // (Adds exchange/mcap chips, but otherwise the click would do nothing.)
      setFilters({ ...DEFAULT_FILTERS, ...preset.filters, tickerWhitelistLabel: preset.label });
    },
    []
  );

  // Active filter chips
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; reset: () => void }[] = [];

    // Surface the active index whitelist as the first chip so the user always
    // knows what universe they're looking at (e.g. "S&P 500: 500 stocks").
    if (filters.tickerWhitelist && filters.tickerWhitelist.length > 0) {
      const label = filters.tickerWhitelistLabel ?? "Custom list";
      chips.push({
        key: "whitelist",
        label: `${label}: ${filters.tickerWhitelist.length} tickers`,
        reset: () => {
          setFilter("tickerWhitelist", undefined);
          setFilter("tickerWhitelistLabel", undefined);
        },
      });
    }

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
  const indexDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (loadDropdownRef.current && !loadDropdownRef.current.contains(target)) {
        setLoadDropdownOpen(false);
      }
      if (indexDropdownRef.current && !indexDropdownRef.current.contains(target)) {
        setIndexDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="flex w-full min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10" style={{ background: "var(--app-bg)" }}>
      {/* Sidebar — overflow-x-hidden so wide content (long tickers in saved
          screens, etc.) never produces a horizontal scrollbar. */}
      <aside
        className={`shrink-0 border-r border-white/10 bg-[var(--app-card-alt)] transition-all duration-200 overflow-y-auto overflow-x-hidden ${
          sidebarOpen ? "w-[280px]" : "w-0 overflow-hidden"
        }`}
      >
        {sidebarOpen && (
          <div className="flex flex-col">
            {/* Templates — collapsible section. Header row also hosts the
                "collapse the whole sidebar" chevron on the right. */}
            <div className="border-b border-white/10">
              <div className="flex items-center gap-1 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setTemplatesOpen((o) => !o)}
                  className="flex flex-1 items-center justify-between text-left text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-200 transition-colors"
                  aria-expanded={templatesOpen}
                >
                  <span>Quick Templates</span>
                  {/* Same chevron behavior as FilterSection: points down when
                      collapsed, flips to point up (rotate-180) when expanded. */}
                  <svg
                    className={`h-4 w-4 transition-transform duration-200 ${templatesOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="rounded p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-[var(--accent-color)]"
                  aria-label="Collapse filters"
                  title="Collapse filters"
                >
                  {/* Sidebar-collapse chevron — sized to match the FilterSection
                      arrows (h-4 w-4); rotated 90° to point left ◀. */}
                  <svg className="h-4 w-4 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {templatesOpen && (
                <div className="flex flex-col gap-1.5 px-4 pb-4">
                  <p className="rounded-md bg-[var(--accent-color)]/10 px-2.5 py-1.5 text-[10px] font-medium text-[var(--accent-color)]">More detailed templates coming soon</p>
                  {TEMPLATES.map((t) => {
                    const isActive = activeTemplateId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          if (isActive) {
                            // Toggle off — reset template filters but keep index.
                            // Immediate fetch so user sees the full set right away
                            // instead of stale template-filtered stocks.
                            setActiveTemplateId(null);
                            setFilters((prev) => {
                              const newF: ScreenerFilters = {
                                ...DEFAULT_FILTERS,
                                tickerWhitelist: prev.tickerWhitelist,
                                tickerWhitelistLabel: prev.tickerWhitelistLabel,
                              };
                              fetchStocks(newF);
                              return newF;
                            });
                          } else {
                            // Activate template — compute filters and immediately
                            // fetch so the user doesn't see stale stocks from the
                            // previous template while waiting for the 500ms debounce.
                            setActiveTemplateId(t.id);
                            setFilters((prev) => {
                              const newF: ScreenerFilters = {
                                ...DEFAULT_FILTERS,
                                ...t.filters,
                                tickerWhitelist: prev.tickerWhitelist,
                                tickerWhitelistLabel: prev.tickerWhitelistLabel,
                              };
                              fetchStocks(newF);
                              return newF;
                            });
                          }
                        }}
                        className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                          isActive
                            ? "border-[var(--accent-color)]/60 bg-[var(--accent-color)]/15 text-[var(--accent-color)]"
                            : "border-white/10 bg-white/5 text-zinc-300 hover:border-[var(--accent-color)]/40 hover:text-[var(--accent-color)]"
                        }`}
                      >
                        <span className="mt-0.5 shrink-0">{TEMPLATE_ICONS[t.id]}</span>
                        <span className="min-w-0">
                          <span className="font-medium">{t.label}</span>
                          <span className="mt-0.5 block text-[10px] leading-tight text-zinc-500">
                            {t.desc}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
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

              {/* Market Cap presets — multi-select. Each click toggles the
                  preset; selected presets compose: server gets the encompassing
                  min/max range, and client-side filtering keeps only stocks
                  that fall inside one of the SELECTED categories (so picking
                  Mega+Small doesn't accidentally let Mid through). */}
              <div className="mb-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs text-zinc-500">Market Cap</p>
                  {(filters.marketCapMin || filters.marketCapMax || (filters.marketCapPresets?.length ?? 0) > 0) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilter("marketCapMin", "");
                        setFilter("marketCapMax", "");
                        setFilter("marketCapPresets", []);
                      }}
                      className="text-[10px] text-zinc-500 hover:text-[var(--accent-color)] transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="mb-2 flex flex-wrap gap-1">
                  {MARKET_CAP_PRESETS.map((p) => {
                    const selected = (filters.marketCapPresets ?? []).includes(p.label);
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          const cur = filters.marketCapPresets ?? [];
                          const next = cur.includes(p.label)
                            ? cur.filter((x) => x !== p.label)
                            : [...cur, p.label];
                          setFilter("marketCapPresets", next);
                          // Recompute the encompassing server range from the
                          // selected presets so FMP receives the union.
                          const selectedRanges = MARKET_CAP_PRESETS.filter((mp) => next.includes(mp.label));
                          if (selectedRanges.length === 0) {
                            setFilter("marketCapMin", "");
                            setFilter("marketCapMax", "");
                          } else {
                            const mins = selectedRanges.map((r) => parseFloat(r.min || "0"));
                            const maxes = selectedRanges.map((r) => (r.max === "" ? Infinity : parseFloat(r.max)));
                            setFilter("marketCapMin", String(Math.min(...mins)));
                            const maxVal = Math.max(...maxes);
                            setFilter("marketCapMax", maxVal === Infinity ? "" : String(maxVal));
                          }
                        }}
                        className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                          selected
                            ? "border-[var(--accent-color)]/60 bg-[var(--accent-color)]/15 text-[var(--accent-color)]"
                            : "border-white/10 bg-white/5 text-zinc-400 hover:border-[var(--accent-color)]/40 hover:text-[var(--accent-color)]"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.marketCapMin}
                    onChange={(e) => setFilter("marketCapMin", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.marketCapMax}
                    onChange={(e) => setFilter("marketCapMax", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                  />
                </div>
              </div>

              {/* Price */}
              <div className="mb-3">
                <p className="mb-2 text-xs text-zinc-500">Price ($)</p>
                <div className="flex flex-col gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.priceMin}
                    onChange={(e) => setFilter("priceMin", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.priceMax}
                    onChange={(e) => setFilter("priceMax", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
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
                <div className="flex flex-col gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.peMin}
                    onChange={(e) => setFilter("peMin", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.peMax}
                    onChange={(e) => setFilter("peMax", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
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
                <div className="flex flex-col gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.betaMin}
                    onChange={(e) => setFilter("betaMin", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.betaMax}
                    onChange={(e) => setFilter("betaMax", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
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
                <div className="flex flex-col gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.rsiMin}
                    onChange={(e) => setFilter("rsiMin", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.rsiMax}
                    onChange={(e) => setFilter("rsiMax", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                  />
                </div>
              </div>

              {/* vs SMA 50 (direction) */}
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

              {/* vs SMA 50 distance % (signed) */}
              <div className="mb-3">
                <p className="mb-2 text-xs text-zinc-500">SMA 50 distance (%)</p>
                <div className="flex flex-col gap-2">
                  <input
                    type="number"
                    placeholder="Min %"
                    value={filters.vsSma50PctMin}
                    onChange={(e) => setFilter("vsSma50PctMin", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max %"
                    value={filters.vsSma50PctMax}
                    onChange={(e) => setFilter("vsSma50PctMax", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                  />
                </div>
              </div>

              {/* vs SMA 200 (direction) */}
              <div className="mb-3">
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

              {/* vs SMA 200 distance % (signed) */}
              <div>
                <p className="mb-2 text-xs text-zinc-500">SMA 200 distance (%)</p>
                <div className="flex flex-col gap-2">
                  <input
                    type="number"
                    placeholder="Min %"
                    value={filters.vsSma200PctMin}
                    onChange={(e) => setFilter("vsSma200PctMin", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max %"
                    value={filters.vsSma200PctMax}
                    onChange={(e) => setFilter("vsSma200PctMax", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                  />
                </div>
              </div>
            </FilterSection>

            {/* Performance Filters */}
            <FilterSection title="Performance" defaultOpen={false}>
              {([
                { label: "Day Change %",   minKey: "dayChangePctMin",   maxKey: "dayChangePctMax" },
                { label: "1-Week %",       minKey: "weekChangePctMin",  maxKey: "weekChangePctMax" },
                { label: "1-Month %",      minKey: "monthChangePctMin", maxKey: "monthChangePctMax" },
                { label: "YTD %",          minKey: "ytdChangePctMin",   maxKey: "ytdChangePctMax" },
                { label: "1-Year %",       minKey: "yearChangePctMin",  maxKey: "yearChangePctMax" },
              ] as const).map((row) => (
                <div key={row.label} className="mb-3">
                  <p className="mb-2 text-xs text-zinc-500">{row.label}</p>
                  <div className="flex flex-col gap-2">
                    <input
                      type="number"
                      placeholder="Min %"
                      value={filters[row.minKey] as string}
                      onChange={(e) => setFilter(row.minKey, e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Max %"
                      value={filters[row.maxKey] as string}
                      onChange={(e) => setFilter(row.maxKey, e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                    />
                  </div>
                </div>
              ))}

              <div className="mb-3">
                <p className="mb-2 text-xs text-zinc-500">vs 52-Wk High (≥ %)</p>
                <input
                  type="number"
                  placeholder="e.g. -5"
                  value={filters.vs52wkHighPctMin}
                  onChange={(e) => setFilter("vs52wkHighPctMin", e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-zinc-600">−5 = within 5% of the high</p>
              </div>
              <div>
                <p className="mb-2 text-xs text-zinc-500">vs 52-Wk Low (≥ %)</p>
                <input
                  type="number"
                  placeholder="e.g. 30"
                  value={filters.vs52wkLowPctMin}
                  onChange={(e) => setFilter("vs52wkLowPctMin", e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-50 placeholder:text-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-zinc-600">30 = at least 30% above the low</p>
              </div>
            </FilterSection>

            {/* Clear All */}
            <div className="p-4">
              <button
                type="button"
                onClick={() => { setFilters(DEFAULT_FILTERS); setActiveTemplateId(null); }}
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
        {/* Header bar — flex-wrap so View toggle / Save / Load / Indexes / etc.
            wrap to a second row on narrow widths instead of being cut off. */}
        <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-[var(--app-card-alt)] px-4 py-3">
          {/* Results count — always shows the current filtered count so
              template changes feel instant. A tiny dot pulses while a
              background fetch is in flight; no "Loading…" text replacement. */}
          <span className="text-sm text-zinc-500">
            <span className="font-semibold text-zinc-300">{filteredStocks.length}</span>
            {" "}stocks
            {loading && <span className="ml-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent-color)]" />}
          </span>

          {/* View toggle — shrink-0 + flex-wrap on the parent guarantees the
              two pills always render in full and wrap as a unit if needed. */}
          <div className="flex shrink-0 rounded-xl border border-white/10 bg-white/5 p-1">
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

          {/* (Heatmap "Day Change %" color-by selector removed — duplicates
              the Performance filter section in the sidebar. Heatmap colors by
              day change by default; if we want to expose other coloring later
              it should live next to the Performance filters, not here.) */}

          {/* Save + Load — shrink-0 so they never get clipped on narrow widths. */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (savedCapReached) {
                  showToast("Saved-screen limit reached (10). Delete one first.", "error");
                  return;
                }
                setSaveModal(true);
              }}
              disabled={savedCapReached}
              title={savedCapReached ? "10/10 saved screens — delete one to add another" : "Save current filters as a screen"}
              className="rounded-xl border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/10 px-3 py-1.5 text-xs font-medium text-[var(--accent-color)] hover:bg-[var(--accent-color)]/20 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save Screen {savedCapReached ? "(10/10)" : ""}
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

            {/* Index presets — same dropdown idiom as Load, sits right next
                to it. One-click switch between S&P 500 / Nasdaq 100 / etc.
                The trigger button shows the active index label so users can
                see which preset is loaded at a glance. */}
            <div className="relative" ref={indexDropdownRef}>
              <button
                type="button"
                onClick={() => setIndexDropdownOpen((v) => !v)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${
                  filters.tickerWhitelistLabel
                    ? "border-[var(--accent-color)]/40 bg-[var(--accent-color)]/10 text-[var(--accent-color)] hover:bg-[var(--accent-color)]/15"
                    : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                }`}
              >
                {filters.tickerWhitelistLabel ?? "Indexes"}
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {indexDropdownOpen && (
                <div className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-white/10 bg-[var(--app-card-alt)] shadow-2xl">
                  {INDEX_PRESETS.map((p) => {
                    const active = filters.tickerWhitelistLabel === p.label;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => loadIndexPreset(p)}
                        className={`w-full px-4 py-2.5 text-left text-xs font-medium transition-colors ${
                          active
                            ? "bg-[var(--accent-color)]/15 text-[var(--accent-color)]"
                            : "text-zinc-300 hover:bg-white/5 hover:text-[var(--accent-color)]"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Expand-filters button — only visible when the sidebar is closed.
              When open, the collapse arrow lives inside the sidebar next to
              "Quick Templates". */}
          {!sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-colors"
              aria-label="Expand filters"
              title="Expand filters"
            >
              <svg className="h-3 w-3 -rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Active filter chips */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-white/5 bg-[var(--app-card-alt)]/80 px-4 py-2">
            {activeChips.map((chip) => (
              <FilterChip key={chip.key} label={chip.label} onRemove={chip.reset} />
            ))}
          </div>
        )}

        {/* View content — skeleton only on first load when there's nothing yet.
            After that, filter changes re-filter the existing stocks instantly
            (filteredStocks useMemo depends on `filters` directly, not the
            debounced version). The background API refetch updates stocks
            silently when it completes — no overlay needed. */}
        <div className="min-h-0 flex-1 overflow-auto">
          {filteredStocks.length === 0 && loading ? (
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
          className="fixed inset-0 z-40 bg-black/30"
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
