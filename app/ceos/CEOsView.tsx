"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CEOS,
  CEO_SECTORS,
  type CEOEntry,
  type CEOSentiment,
  getInitials,
  sentimentColor,
} from "../../lib/ceo-data";
import {
  addToWatchlistApi,
  fetchWatchlist,
  isTickerInWatchlist,
  removeFromWatchlistApi,
} from "../../lib/watchlist-api";
import { TypewriterText } from "../../components/TypewriterText";

// ─── LocalStorage helpers ────────────────────────────────────────────────────

const CEO_FILTERS_KEY = "quantivtrade-ceo-filters";

type FilterState = {
  search: string;
  sectors: Set<string>;
  sentiment: "all" | "positive" | "negative" | "alerts";
  tenure: "all" | "new" | "established" | "veteran";
  marketCap: "all" | "mega" | "large" | "mid";
};

function getCeoFilters(): FilterState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CEO_FILTERS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const p = parsed as { search?: string; sectors?: string[]; sentiment?: string; tenure?: string; marketCap?: string };
    const sectors = Array.isArray(p.sectors) ? new Set(p.sectors) : new Set(CEO_SECTORS);
    const sentiment = (["all", "positive", "negative", "alerts"] as const).includes(p.sentiment as FilterState["sentiment"]) ? (p.sentiment as FilterState["sentiment"]) : "all";
    const tenure = (["all", "new", "established", "veteran"] as const).includes(p.tenure as FilterState["tenure"]) ? (p.tenure as FilterState["tenure"]) : "all";
    const marketCap = (["all", "mega", "large", "mid"] as const).includes(p.marketCap as FilterState["marketCap"]) ? (p.marketCap as FilterState["marketCap"]) : "all";
    return { search: typeof p.search === "string" ? p.search : "", sectors, sentiment, tenure, marketCap };
  } catch {
    return null;
  }
}

function saveCeoFilters(filters: FilterState) {
  try {
    localStorage.setItem(
      CEO_FILTERS_KEY,
      JSON.stringify({
        search: filters.search,
        sectors: Array.from(filters.sectors),
        sentiment: filters.sentiment,
        tenure: filters.tenure,
        marketCap: filters.marketCap,
      })
    );
  } catch {
    // ignore
  }
}

const defaultFilters = (): FilterState => ({
  search: "",
  sectors: new Set(CEO_SECTORS),
  sentiment: "all",
  tenure: "all",
  marketCap: "all",
});

// ─── Preset data ──────────────────────────────────────────────────────────────

type QuickPresetId = "spy500" | "qqq100" | "dow30" | "magnificent7" | "techGiants";

const QUICK_PRESET_BUTTON_LABEL: Record<QuickPresetId, string> = {
  spy500: "SPY 500",
  qqq100: "QQQ 100",
  dow30: "Dow 30",
  magnificent7: "Magnificent 7",
  techGiants: "Tech Giants",
};

const QUICK_PRESET_SHOW_LABEL: Record<QuickPresetId, string> = {
  spy500: "S&P 500 Companies",
  qqq100: "QQQ 100",
  dow30: "Dow 30",
  magnificent7: "Magnificent 7",
  techGiants: "Tech Giants",
};

const QUICK_PRESET_TICKERS: Record<QuickPresetId, Set<string> | null> = {
  // S&P 500: all large-cap US companies in our dataset (excludes foreign ADRs + micro-caps)
  spy500: new Set([
    // Technology
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "ORCL", "INTU",
    "IBM", "VZ", "TXN", "CSCO", "TMUS", "CMCSA", "BKNG", "AMD", "QCOM", "ADBE",
    "NFLX", "CRM", "PANW", "CRWD", "KLAC", "SNPS", "CDNS", "LRCX", "WDAY", "NXPI",
    "FTNT", "CHTR", "TTD", "MCHP", "DDOG", "EA", "CTSH", "ON", "ANSS", "ZS",
    "TTWO", "VRSK", "MDB", "UBER", "SHOP", "INTC",
    // Finance
    "JPM", "BAC", "WFC", "V", "MA", "BRK", "GS", "MS", "BLK", "AXP",
    "C", "ADP", "USB", "SCHW", "COF", "TRV", "PAYX", "PYPL",
    // Healthcare
    "UNH", "LLY", "JNJ", "MRK", "ABBV", "AMGN", "VRTX", "REGN", "CVS", "GILD",
    "CI", "PFE", "ISRG", "BMY", "HUM", "IDXX", "GEHC", "MRNA", "DXCM", "BIIB",
    // Energy
    "XOM", "CVX", "COP", "SLB", "EOG", "CEG", "MPC", "OXY", "HAL", "BKR",
    "EXC", "XEL", "FANG",
    // Consumer
    "WMT", "HD", "PG", "COST", "KO", "PEP", "DIS", "MCD", "SBUX", "MDLZ",
    "NKE", "TGT", "ORLY", "MNST", "ROST", "KDP", "DLTR", "CMG", "LULU", "YUM",
    "WBD", "WBA",
    // Industrials
    "BA", "CAT", "GE", "HON", "RTX", "UPS", "CTAS", "FDX", "ROP", "PCAR",
    "FAST", "ODFL", "MMM", "DOW",
    // Auto (US-listed domestic)
    "F", "GM",
    // Crypto/Fintech (S&P 500 members)
    "COIN",
  ]),
  // Nasdaq-100 (QQQ): full index as of 2025
  qqq100: new Set([
    "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOG", "GOOGL", "AVGO", "TSLA", "COST",
    "NFLX", "ASML", "AMD", "MELI", "ISRG", "QCOM", "CSCO", "INTU", "TXN", "AMGN",
    "ADBE", "PEP", "REGN", "VRTX", "ABNB", "HON", "PANW", "LRCX", "CRWD", "GILD",
    "ADP", "CDNS", "SNPS", "SBUX", "KLAC", "NXPI", "FTNT", "MCHP", "CEG", "BKNG",
    "PYPL", "ON", "ORLY", "CTAS", "MDLZ", "WDAY", "ROST", "PCAR", "ROP", "DXCM",
    "PAYX", "TTD", "FAST", "MNST", "EA", "BIIB", "CTSH", "IDXX", "MRNA", "DLTR",
    "ODFL", "ANSS", "VRSK", "KDP", "TTWO", "MDB", "ZS", "DDOG", "GEHC", "WBD",
    "EXC", "XEL", "FANG", "INTC", "TMUS", "CMCSA", "CHTR", "TTD", "UBER", "LULU",
    "AZN", "TEAM", "CDW", "ARM", "ILMN", "MRVL", "SMCI",
  ]),
  dow30: new Set([
    "AAPL", "MSFT", "UNH", "GS", "HD", "MCD", "CAT", "AMGN", "V", "BA",
    "CRM", "HON", "IBM", "JPM", "AXP", "JNJ", "WMT", "PG", "TRV", "CVX",
    "MMM", "MRK", "DIS", "NKE", "DOW", "INTC", "VZ", "CSCO", "KO", "WBA",
  ]),
  magnificent7: new Set(["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA"]),
  techGiants: new Set([
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "ORCL", "CRM",
    "ADBE", "INTC", "AMD", "QCOM", "SHOP", "UBER", "NFLX", "SPOT",
  ]),
};

// ─── Filter logic ─────────────────────────────────────────────────────────────

function filterCEOs(ceos: CEOEntry[], filters: FilterState): CEOEntry[] {
  return ceos.filter((c) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.company.toLowerCase().includes(q) && !c.ticker.toLowerCase().includes(q))
        return false;
    }
    if (!filters.sectors.has(c.sector)) return false;
    if (filters.sentiment === "positive" && c.sentiment !== "positive") return false;
    if (filters.sentiment === "negative" && c.sentiment !== "negative") return false;
    if (filters.sentiment === "alerts" && !c.recentAlert) return false;
    const years = new Date().getFullYear() - c.tenureStart;
    if (filters.tenure === "new" && years >= 2) return false;
    if (filters.tenure === "established" && (years < 2 || years > 10)) return false;
    if (filters.tenure === "veteran" && years <= 10) return false;
    if (filters.marketCap === "mega" && c.marketCap < 500) return false;
    if (filters.marketCap === "large" && (c.marketCap < 100 || c.marketCap >= 500)) return false;
    if (filters.marketCap === "mid" && c.marketCap >= 100) return false;
    return true;
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────


function formatMarketCap(mc: number): string {
  if (mc >= 1000) return `$${(mc / 1000).toFixed(1)}T`;
  return `$${mc}B`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CEOAlertItem = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  company?: string;
  matchedTicker?: string;
};

const CEO_PROFILE_CACHE_VER = "v3";

function ceoProfileCacheKey(ticker: string): string {
  return `${ticker.toUpperCase()}:${CEO_PROFILE_CACHE_VER}`;
}

type CeoClaudeProfile = {
  tenure_start: string;
  tenure_years: number;
  legal_history: string | null;
  legal_severity: "none" | "minor" | "significant";
  sentiment: "Bullish" | "Bearish" | "Neutral";
  sentiment_reason: string;
  stock_since_tenure_percent_approx: number | null;
  stock_since_tenure_summary: string;
};

function mapClaudeSentimentToTint(s: string): "bullish" | "bearish" | "neutral" | null {
  const u = s.trim().toLowerCase();
  if (u === "bullish") return "bullish";
  if (u === "bearish") return "bearish";
  if (u === "neutral") return "neutral";
  return null;
}

function parseCeoClaudeProfile(raw: string): CeoClaudeProfile | null {
  let s = raw.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
  if (fence?.[1]) s = fence[1].trim();
  try {
    const o = JSON.parse(s) as Record<string, unknown>;
    const tenure_start = typeof o.tenure_start === "string" ? o.tenure_start : "";
    const tyRaw = o.tenure_years;
    const tenure_years =
      typeof tyRaw === "number" && !Number.isNaN(tyRaw)
        ? tyRaw
        : typeof tyRaw === "string"
          ? Number.parseFloat(tyRaw) || 0
          : 0;
    let legal_history: string | null = null;
    if (o.legal_history === null) legal_history = null;
    else if (typeof o.legal_history === "string") legal_history = o.legal_history;
    const leg = typeof o.legal_severity === "string" ? o.legal_severity.toLowerCase() : "";
    const legal_severity: CeoClaudeProfile["legal_severity"] =
      leg === "minor" || leg === "significant" || leg === "none" ? leg : "none";
    const sentRaw = typeof o.sentiment === "string" ? o.sentiment.trim().toLowerCase() : "";
    const sentiment: CeoClaudeProfile["sentiment"] =
      sentRaw === "bullish" ? "Bullish" : sentRaw === "bearish" ? "Bearish" : "Neutral";
    const sentiment_reason = typeof o.sentiment_reason === "string" ? o.sentiment_reason : "";
    const spRaw = o.stock_since_tenure_percent_approx;
    let stock_since_tenure_percent_approx: number | null = null;
    if (spRaw === null) stock_since_tenure_percent_approx = null;
    else if (typeof spRaw === "number" && Number.isFinite(spRaw)) stock_since_tenure_percent_approx = spRaw;
    else if (typeof spRaw === "string") {
      const n = Number.parseFloat(spRaw);
      stock_since_tenure_percent_approx = Number.isFinite(n) ? n : null;
    }
    const stock_since_tenure_summary =
      typeof o.stock_since_tenure_summary === "string" ? o.stock_since_tenure_summary.trim() : "";
    return { tenure_start, tenure_years, legal_history, legal_severity, sentiment, sentiment_reason, stock_since_tenure_percent_approx, stock_since_tenure_summary };
  } catch {
    return null;
  }
}

function claudeSentimentStyles(sentiment: CeoClaudeProfile["sentiment"]) {
  switch (sentiment) {
    case "Bullish": return { color: "#00ff88", bg: "#00ff8822", border: "#00ff8855" };
    case "Bearish": return { color: "#ff4444", bg: "#ff444422", border: "#ff444455" };
    default: return { color: "#60A5FA", bg: "#60A5FA22", border: "#60A5FA55" };
  }
}

// ─── Sector badge colors ──────────────────────────────────────────────────────

const SECTOR_COLORS: Record<string, { bg: string; color: string }> = {
  Technology:       { bg: "rgba(59,130,246,0.15)",  color: "#60A5FA" },
  Finance:          { bg: "rgba(16,185,129,0.15)",   color: "#34D399" },
  Healthcare:       { bg: "rgba(139,92,246,0.15)",   color: "#A78BFA" },
  Energy:           { bg: "rgba(245,158,11,0.15)",   color: "#FCD34D" },
  Consumer:         { bg: "rgba(236,72,153,0.15)",   color: "#F472B6" },
  Industrials:      { bg: "rgba(107,114,128,0.15)",  color: "#9CA3AF" },
  Auto:             { bg: "rgba(251,146,60,0.15)",   color: "#FB923C" },
  "Crypto/Fintech": { bg: "rgba(167,139,250,0.15)",  color: "#C084FC" },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PanelFieldSkeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/10 ${className ?? "h-4 w-full"}`} />;
}

// ─── Filter Sidebar ───────────────────────────────────────────────────────────

function FilterSidebar({
  filters,
  onFiltersChange,
  alertsCount,
  ceoOfWeek,
  recentAlerts,
  ceoOfWeekAlertTitle,
  weeklyAlerts,
  sentimentChanges,
  activeQuickPreset,
  onQuickPresetChange,
  presetShownCount,
  allViewLabel,
  activePresetShowLabel,
  onSelectCeo,
}: {
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
  alertsCount: number;
  ceoOfWeek: CEOEntry | null;
  recentAlerts: CEOAlertItem[];
  ceoOfWeekAlertTitle?: string | null;
  weeklyAlerts: CEOAlertItem[];
  sentimentChanges: { ticker: string; name: string; company: string; from: CEOSentiment; to: CEOSentiment; changedAt: string }[];
  activeQuickPreset: QuickPresetId | null;
  onQuickPresetChange: (id: QuickPresetId | null) => void;
  presetShownCount: number;
  allViewLabel: string;
  activePresetShowLabel: string | null;
  onSelectCeo: (ticker: string) => void;
}) {
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    const id = window.setTimeout(() => setNowMs(Date.now()), 0);
    const t = window.setInterval(() => setNowMs(Date.now()), 60 * 1000);
    return () => { window.clearTimeout(id); window.clearInterval(t); };
  }, []);

  const timeAgo = (iso: string) => {
    const ts = Date.parse(iso);
    if (!Number.isFinite(ts) || !nowMs) return "";
    const s = Math.max(0, Math.floor((nowMs - ts) / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div className="flex h-full w-[200px] shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-[rgba(15,21,32,0.97)] scrollbar-hide">
      <div className="flex flex-col gap-4 p-3 pt-4">

        {/* Preset pills */}
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Index</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onQuickPresetChange(null)}
              className={`rounded-full border px-2 py-1 text-[10px] transition ${
                activeQuickPreset === null
                  ? "border-[var(--accent-color)] bg-[var(--accent-color)]/15 text-[var(--accent-color)]"
                  : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
              }`}
            >
              {allViewLabel}
            </button>
            {(["spy500", "qqq100", "dow30", "techGiants", "magnificent7"] as QuickPresetId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onQuickPresetChange(activeQuickPreset === id ? null : id)}
                className={`rounded-full border px-2 py-1 text-[10px] transition ${
                  activeQuickPreset === id
                    ? "border-[var(--accent-color)] bg-[var(--accent-color)]/15 text-[var(--accent-color)]"
                    : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                }`}
              >
                {QUICK_PRESET_BUTTON_LABEL[id]}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-zinc-600">
            {presetShownCount} in {activeQuickPreset ? activePresetShowLabel : allViewLabel}
          </p>
        </div>

        {/* Sector */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Sector</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => onFiltersChange({ ...filters, sectors: new Set(CEO_SECTORS) })} className="text-[10px] text-[var(--accent-color)] hover:underline">All</button>
              <button type="button" onClick={() => onFiltersChange({ ...filters, sectors: new Set() })} className="text-[10px] text-zinc-500 hover:underline">Clear</button>
            </div>
          </div>
          <div className="space-y-1.5">
            {CEO_SECTORS.map((s) => {
              const sc = SECTOR_COLORS[s];
              return (
                <label key={s} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.sectors.has(s)}
                    onChange={() => {
                      const next = new Set(filters.sectors);
                      if (next.has(s)) next.delete(s); else next.add(s);
                      onFiltersChange({ ...filters, sectors: next });
                    }}
                    className="rounded border-white/20 text-[var(--accent-color)]"
                  />
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: sc?.bg ?? "rgba(255,255,255,0.08)", color: sc?.color ?? "#9CA3AF" }}
                  >
                    {s}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Sentiment */}
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Sentiment</p>
          <select
            value={filters.sentiment}
            onChange={(e) => onFiltersChange({ ...filters, sentiment: e.target.value as FilterState["sentiment"] })}
            className="w-full rounded-lg border border-white/10 bg-[var(--app-card)] px-2 py-1.5 text-[11px] text-zinc-200 focus:border-[var(--accent-color)] focus:outline-none [&>option]:bg-[var(--app-card)]"
          >
            <option value="all">All</option>
            <option value="positive">Positive only</option>
            <option value="negative">Negative only</option>
            <option value="alerts">Recent alerts only</option>
          </select>
        </div>

        {/* Tenure */}
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Tenure</p>
          <select
            value={filters.tenure}
            onChange={(e) => onFiltersChange({ ...filters, tenure: e.target.value as FilterState["tenure"] })}
            className="w-full rounded-lg border border-white/10 bg-[var(--app-card)] px-2 py-1.5 text-[11px] text-zinc-200 focus:border-[var(--accent-color)] focus:outline-none [&>option]:bg-[var(--app-card)]"
          >
            <option value="all">All</option>
            <option value="new">New (&lt; 2 yrs)</option>
            <option value="established">Established (2–10 yrs)</option>
            <option value="veteran">Veteran (10+ yrs)</option>
          </select>
        </div>

        {/* Market cap */}
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Market Cap</p>
          <select
            value={filters.marketCap}
            onChange={(e) => onFiltersChange({ ...filters, marketCap: e.target.value as FilterState["marketCap"] })}
            className="w-full rounded-lg border border-white/10 bg-[var(--app-card)] px-2 py-1.5 text-[11px] text-zinc-200 focus:border-[var(--accent-color)] focus:outline-none [&>option]:bg-[var(--app-card)]"
          >
            <option value="all">All</option>
            <option value="mega">Mega cap (&gt;$500B)</option>
            <option value="large">Large cap ($100–500B)</option>
            <option value="mid">Mid cap (&lt;$100B)</option>
          </select>
        </div>

        {/* CEO of the week */}
        {ceoOfWeek && (
          <div className="rounded-lg border border-[var(--accent-color)]/25 bg-[var(--accent-color)]/5 p-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-[var(--accent-color)]">CEO of the week</p>
            <p className="mt-1 text-[12px] font-semibold text-zinc-100">{ceoOfWeek.name}</p>
            <p className="text-[10px] text-zinc-400">{ceoOfWeek.company} · {ceoOfWeek.ticker}</p>
            <p className="mt-1 text-[9px] leading-snug text-zinc-500">{ceoOfWeekAlertTitle ?? "Most talked about this week"}</p>
            <button type="button" onClick={() => onSelectCeo(ceoOfWeek.ticker)} className="mt-1.5 text-[10px] text-[var(--accent-color)] hover:underline">
              View profile →
            </button>
          </div>
        )}

        {/* Weekly CEO changes */}
        <div className="border-t border-white/10 pt-3 pb-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Weekly Changes</p>

          {/* Sentiment shifts detected by the weekly AI refresh */}
          {sentimentChanges.length > 0 && (
            <ul className="mb-3 space-y-1.5">
              {sentimentChanges.slice(0, 5).map((sc) => {
                const toColor = sc.to === "positive" ? "#00C896" : sc.to === "negative" ? "#EF4444" : "#6B7280";
                const arrow = sc.to === "positive" ? "↑" : sc.to === "negative" ? "↓" : "→";
                const fromLabel = sc.from.charAt(0).toUpperCase() + sc.from.slice(1);
                const toLabel = sc.to.charAt(0).toUpperCase() + sc.to.slice(1);
                return (
                  <li key={sc.ticker}>
                    <button
                      type="button"
                      className="w-full rounded-md px-1.5 py-1.5 text-left hover:bg-white/5"
                      onClick={() => onSelectCeo(sc.ticker)}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[13px] font-bold" style={{ color: toColor }}>{arrow}</span>
                          <span className="text-[11px] font-medium text-zinc-200 truncate">{sc.name}</span>
                        </div>
                        <span className="shrink-0 rounded bg-white/10 px-1 py-px text-[9px] text-zinc-400">{sc.ticker}</span>
                      </div>
                      <p className="mt-0.5 text-[10px]" style={{ color: toColor }}>
                        {fromLabel} → {toLabel}
                      </p>
                      <p className="text-[9px] text-zinc-600">{timeAgo(sc.changedAt)}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* News headlines */}
          {sentimentChanges.length === 0 && <p className="text-[10px] text-zinc-600">No sentiment shifts this week</p>}
        </div>

        {/* Recent CEO news — any story, not just tracked tickers */}
        <div className="border-t border-white/10 pt-3 pb-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Recent News</p>
          {recentAlerts.length === 0 ? (
            <p className="text-[10px] text-zinc-600">No recent CEO news</p>
          ) : (
            <ul className="space-y-2">
              {recentAlerts.slice(0, 8).map((a) => {
                const t = (a.matchedTicker ?? "").toUpperCase();
                return (
                  <li key={a.url}>
                    <button
                      type="button"
                      className="w-full rounded-md px-1.5 py-1 text-left hover:bg-white/5"
                      onClick={() => { if (t) onSelectCeo(t); else window.open(a.url, "_blank"); }}
                    >
                      <p className="line-clamp-2 text-[10px] leading-tight text-zinc-300">
                        {a.title.length > 80 ? a.title.slice(0, 80) + "…" : a.title}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <p className="text-[9px] text-zinc-600">{a.source} · {timeAgo(a.publishedAt)}</p>
                        {t && <span className="rounded bg-white/10 px-1 py-px text-[9px] text-zinc-500">{t}</span>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CEO List Row ─────────────────────────────────────────────────────────────

function CEORow({ ceo, isSelected, onClick }: { ceo: CEOEntry; isSelected: boolean; onClick: (e: React.MouseEvent) => void }) {
  const sentColor = sentimentColor(ceo.sentiment);
  const sentimentLabel = ceo.sentiment === "positive" ? "Bullish" : ceo.sentiment === "negative" ? "Bearish" : "Neutral";
  const sectorStyle = SECTOR_COLORS[ceo.sector] ?? { bg: "rgba(107,114,128,0.12)", color: "#9CA3AF" };
  const tenureYrs = new Date().getFullYear() - ceo.tenureStart;

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      className="group w-full text-left transition-colors duration-100"
      style={{
        borderLeft: `3px solid ${isSelected ? "var(--accent-color)" : "transparent"}`,
        backgroundColor: isSelected ? "rgba(255,255,255,0.04)" : "transparent",
      }}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5 group-hover:bg-white/[0.025]">
        {/* Ticker + alert dot */}
        <div className="w-[52px] shrink-0">
          <div className="flex items-center gap-1">
            <span
              className="text-[11px] font-bold leading-none text-[var(--accent-color)]"
              style={{ fontFamily: "var(--font-jetbrains-mono, 'JetBrains Mono'), monospace" }}
            >
              {ceo.ticker.toUpperCase()}
            </span>
            {ceo.recentAlert && (
              <span className="mt-px h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" title="Recent alert" />
            )}
          </div>
        </div>

        {/* Company + CEO name */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium leading-tight text-zinc-200">{ceo.company}</p>
          <p className="truncate text-[10px] leading-tight text-zinc-500">{ceo.name}</p>
        </div>

        {/* Sector badge */}
        <span
          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-none"
          style={{ backgroundColor: sectorStyle.bg, color: sectorStyle.color }}
        >
          {ceo.sector === "Crypto/Fintech" ? "Crypto" : ceo.sector}
        </span>

        {/* Tenure */}
        <span
          className="w-7 shrink-0 text-right text-[10px] text-zinc-600"
          style={{ fontFamily: "var(--font-jetbrains-mono, 'JetBrains Mono'), monospace" }}
        >
          {tenureYrs}yr
        </span>

        {/* Sentiment badge */}
        <span
          className="w-14 shrink-0 rounded-full px-1.5 py-0.5 text-center text-[9px] font-medium leading-none"
          style={{
            backgroundColor: sentColor + "22",
            color: sentColor,
            border: `1px solid ${sentColor}44`,
          }}
        >
          {sentimentLabel}
        </span>

        {/* Market cap */}
        <span
          className="w-12 shrink-0 text-right text-[10px] text-zinc-500"
          style={{ fontFamily: "var(--font-jetbrains-mono, 'JetBrains Mono'), monospace" }}
        >
          {formatMarketCap(ceo.marketCap)}
        </span>
      </div>
    </button>
  );
}

// ─── CEO List Panel ───────────────────────────────────────────────────────────

function CEOListPanel({
  ceos,
  selectedId,
  onSelect,
  onDeselect,
}: {
  ceos: CEOEntry[];
  selectedId: string | null;
  onSelect: (ceo: CEOEntry) => void;
  onDeselect: () => void;
}) {
  const positive = ceos.filter((c) => c.sentiment === "positive").length;
  const neutral  = ceos.filter((c) => c.sentiment === "neutral").length;
  const negative = ceos.filter((c) => c.sentiment === "negative").length;

  return (
    <div className="flex h-full flex-1 min-w-0 flex-col border-r border-white/10">
      {/* Sentiment summary bubbles */}
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2" style={{ backgroundColor: "rgba(15,21,32,0.8)" }}>
        <span className="text-[10px] text-zinc-600 mr-1">{ceos.length} CEOs</span>
        <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium" style={{ backgroundColor: "#00C89618", color: "#00C896", border: "1px solid #00C89640" }}>
          <span className="h-1.5 w-1.5 rounded-full bg-[#00C896]" />
          {positive} Bullish
        </span>
        <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium" style={{ backgroundColor: "#60A5FA18", color: "#60A5FA", border: "1px solid #60A5FA40" }}>
          <span className="h-1.5 w-1.5 rounded-full bg-[#60A5FA]" />
          {neutral} Neutral
        </span>
        <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium" style={{ backgroundColor: "#EF444418", color: "#EF4444", border: "1px solid #EF444440" }}>
          <span className="h-1.5 w-1.5 rounded-full bg-[#EF4444]" />
          {negative} Bearish
        </span>
      </div>
      {/* Column headers */}
      <div
        className="flex shrink-0 items-center gap-2.5 border-b border-white/10 px-3 py-2"
        style={{ backgroundColor: "rgba(15,21,32,0.6)" }}
      >
        <span className="w-[52px] shrink-0 text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Ticker</span>
        <span className="min-w-0 flex-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Company / CEO</span>
        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Sector</span>
        <span className="w-7 shrink-0 text-right text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Tenure</span>
        <span className="w-14 shrink-0 text-center text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Sent.</span>
        <span className="w-12 shrink-0 text-right text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Mkt Cap</span>
      </div>
      {/* Rows — clicking the background (not a row) deselects */}
      <div className="flex-1 overflow-y-auto scrollbar-hide" onClick={onDeselect}>
        {ceos.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-zinc-500">No CEOs match the current filters</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {ceos.map((ceo) => (
              <CEORow
                key={ceo.id}
                ceo={ceo}
                isSelected={ceo.id === selectedId}
                onClick={() => onSelect(ceo)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  ceo,
  onClose,
  alertsCount,
  profileCacheRef,
  onClaudeGraphSentiment,
}: {
  ceo: CEOEntry;
  onClose: () => void;
  alertsCount: number;
  profileCacheRef: React.MutableRefObject<Map<string, CeoClaudeProfile>>;
  onClaudeGraphSentiment: (ticker: string, tint: "bullish" | "bearish" | "neutral") => void;
}) {
  const [news, setNews] = useState<{ title: string; url: string; source: string; publishedAt: string; sentiment: string }[]>([]);
  const [newsOverallSentiment, setNewsOverallSentiment] = useState<"positive" | "neutral" | "negative" | null>(null);
  const [quote, setQuote] = useState<{ price: number } | null>(null);
  const [stockSince, setStockSince] = useState<{ ok: boolean; percentChange?: number; startYear?: number } | null>(null);
  const [assessment, setAssessment] = useState<{ leadershipScore: number; scoreLabel: string; summary: string; strengths: string[]; watchPoints: string[]; longTermOutlook: string; investorVerdict: string } | null>(null);
  const [assessLoading, setAssessLoading] = useState(false);
  const [assessStreaming, setAssessStreaming] = useState(false);
  const [assessProgress, setAssessProgress] = useState(0);
  const [animateAssess, setAnimateAssess] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [claudeProfile, setClaudeProfile] = useState<CeoClaudeProfile | null>(null);
  const [claudeProfileLoading, setClaudeProfileLoading] = useState(false);
  const tenureYears = new Date().getFullYear() - ceo.tenureStart;

  useEffect(() => {
    const t = ceo.ticker.toUpperCase();
    const ck = ceoProfileCacheKey(ceo.ticker);
    const cached = profileCacheRef.current.get(ck);
    if (cached) {
      setClaudeProfile(cached);
      setClaudeProfileLoading(false);
      const tint = mapClaudeSentimentToTint(cached.sentiment);
      if (tint) onClaudeGraphSentiment(t, tint);
      return;
    }
    setClaudeProfile(null);
    setClaudeProfileLoading(true);
    let cancelled = false;
    const prompt = `Return ONLY valid JSON, no markdown, no explanation:
{
  "tenure_start": "Month Year",
  "tenure_years": number,
  "legal_history": "string describing any significant legal issues, or null if none",
  "legal_severity": "none" | "minor" | "significant",
  "sentiment": "Bullish" | "Bearish" | "Neutral",
  "sentiment_reason": "one sentence max",
  "stock_since_tenure_percent_approx": number | null,
  "stock_since_tenure_summary": "one concise sentence: approximate total shareholder return (price appreciation + dividends) from roughly the start of this CEO's tenure to now for the given equantivtrade-listed ticker, or null/empty if you cannot estimate"
}

CEO: ${ceo.name}
Company: ${ceo.company}
Ticker: ${ceo.ticker}`;

    void (async () => {
      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
        });
        const data = (await res.json()) as { content?: string };
        if (!res.ok || cancelled) return;
        const parsed = data.content ? parseCeoClaudeProfile(data.content) : null;
        if (cancelled || !parsed) return;
        profileCacheRef.current.set(ck, parsed);
        setClaudeProfile(parsed);
        const tint = mapClaudeSentimentToTint(parsed.sentiment);
        if (tint) onClaudeGraphSentiment(t, tint);
      } catch {
        // keep fallbacks
      } finally {
        if (!cancelled) setClaudeProfileLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ceo.ticker, ceo.name, ceo.company, profileCacheRef, onClaudeGraphSentiment]);

  useEffect(() => {
    fetch(`/api/ceo-news?name=${encodeURIComponent(ceo.name)}&company=${encodeURIComponent(ceo.company)}`)
      .then((r) => r.json())
      .then((d) => { setNews(d?.articles ?? []); setNewsOverallSentiment(d?.overallSentiment ?? null); })
      .catch(() => { setNews([]); setNewsOverallSentiment(null); });
  }, [ceo.id, ceo.name, ceo.company]);

  useEffect(() => {
    setStockSince(null);
    fetch(`/api/ceo-stock-performance?ticker=${encodeURIComponent(ceo.ticker)}&tenureStartYear=${encodeURIComponent(String(ceo.tenureStart))}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d?.ok) setStockSince({ ok: true, percentChange: d.percentChange, startYear: d.startYear }); else setStockSince({ ok: false }); })
      .catch(() => setStockSince({ ok: false }));
  }, [ceo.ticker, ceo.tenureStart]);

  useEffect(() => {
    fetch(`/api/ticker-quote?ticker=${encodeURIComponent(ceo.ticker)}`)
      .then((r) => r.json())
      .then((d) => {
        const p = d?.price;
        const price = typeof p === "number" && Number.isFinite(p) && p > 0 ? p : null;
        setQuote(price != null ? { price } : null);
      })
      .catch(() => setQuote(null));
  }, [ceo.ticker]);

  useEffect(() => {
    let mounted = true;
    fetchWatchlist().then((list) => { if (mounted) setInWatchlist(isTickerInWatchlist(list, ceo.ticker)); });
    return () => { mounted = false; };
  }, [ceo.ticker]);

  useEffect(() => {
    setAssessment(null);
    const cacheKey = `ceo-assess-${ceo.id}`;
    if (typeof localStorage === "undefined") return;
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return;
    try {
      const parsed = JSON.parse(cached) as { _ts?: number; leadershipScore?: number; scoreLabel?: string; summary?: string; strengths?: string[]; watchPoints?: string[]; longTermOutlook?: string; investorVerdict?: string };
      if (Date.now() - (parsed._ts ?? 0) < 24 * 60 * 60 * 1000 && parsed.leadershipScore != null && parsed.summary != null) {
        const { _ts, ...rest } = parsed;
        setAssessment({
          leadershipScore: rest.leadershipScore ?? 0,
          scoreLabel: rest.scoreLabel ?? "",
          summary: rest.summary ?? "",
          strengths: Array.isArray(rest.strengths) ? rest.strengths : [],
          watchPoints: Array.isArray(rest.watchPoints) ? rest.watchPoints : [],
          longTermOutlook: rest.longTermOutlook ?? "",
          investorVerdict: rest.investorVerdict ?? "",
        });
      }
    } catch { /* ignore */ }
  }, [ceo.id]);

  const handleWatchlist = async () => {
    setWatchlistLoading(true);
    try {
      if (inWatchlist) { await removeFromWatchlistApi(ceo.ticker); setInWatchlist(false); }
      else { await addToWatchlistApi({ ticker: ceo.ticker, name: ceo.company }); setInWatchlist(true); }
    } finally { setWatchlistLoading(false); }
  };

  const runAssessment = async () => {
    const cacheKey = `ceo-assess-${ceo.id}`;
    try {
      const cached = typeof localStorage !== "undefined" ? localStorage.getItem(cacheKey) : null;
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - (parsed._ts ?? 0) < 24 * 60 * 60 * 1000) {
          delete parsed._ts;
          setAnimateAssess(false);
          setAssessment(parsed);
          return;
        }
      }
      setAssessStreaming(true);
      setAssessProgress(0);
      const res = await fetch("/api/ceo-assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ceo.name, company: ceo.company, ticker: ceo.ticker, tenureYears, headlines: news.map((a) => a.title) }),
      });
      if (!res.ok || !res.body) throw new Error("Assessment failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setAssessProgress(accumulated.length);
      }
      const jsonStr = accumulated.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, "$1").trim();
      const data = JSON.parse(jsonStr);
      if (typeof data.leadershipScore !== "number") data.leadershipScore = 5;
      if (!Array.isArray(data.strengths)) data.strengths = [];
      if (!Array.isArray(data.watchPoints)) data.watchPoints = [];
      setAnimateAssess(true);
      setAssessment(data);
      if (typeof localStorage !== "undefined") localStorage.setItem(cacheKey, JSON.stringify({ ...data, _ts: Date.now() }));
    } catch { setAssessment(null); }
    setAssessStreaming(false);
  };

  const shownSentiment = newsOverallSentiment ?? ceo.sentiment;
  const fallbackSentimentColor = sentimentColor(shownSentiment);
  const avatarColor = claudeProfile ? claudeSentimentStyles(claudeProfile.sentiment).color : fallbackSentimentColor;
  const sectorStyle = SECTOR_COLORS[ceo.sector] ?? { bg: "rgba(107,114,128,0.12)", color: "#9CA3AF" };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--app-card)]/60">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between border-b border-white/10 p-5">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-[#080d14]"
            style={{ backgroundColor: avatarColor }}
          >
            {getInitials(ceo.name)}
          </div>
          <div>
            <h2
              className="text-2xl font-bold leading-tight text-zinc-100"
              style={{ fontFamily: "var(--font-lora, Georgia), serif" }}
            >
              {ceo.name}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span
                className="text-sm font-medium text-zinc-300"
                style={{ fontFamily: "var(--font-jetbrains-mono, monospace)" }}
              >
                {ceo.ticker}
              </span>
              <span className="text-zinc-600">·</span>
              <span className="text-sm text-zinc-400">{ceo.company}</span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: sectorStyle.bg, color: sectorStyle.color }}
              >
                {ceo.sector}
              </span>
              {ceo.interimNames?.length ? (
                <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                  Interim
                </span>
              ) : null}
              {ceo.coCeoNames?.length ? (
                <span className="rounded bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-200">
                  Co-CEOs
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded p-1.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300" aria-label="Close">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-5 overflow-y-auto p-5 scrollbar-hide">

        {/* Key stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-white/8 bg-white/[0.03] p-3">
            <p className="text-[10px] text-zinc-500">Tenure</p>
            {claudeProfileLoading && !claudeProfile ? (
              <PanelFieldSkeleton className="mt-1 h-4 w-20" />
            ) : claudeProfile ? (
              <p className="mt-0.5 text-[13px] font-semibold text-zinc-200" style={{ fontFamily: "var(--font-jetbrains-mono, monospace)" }}>
                {claudeProfile.tenure_years}yr
              </p>
            ) : (
              <p className="mt-0.5 text-[13px] font-semibold text-zinc-200" style={{ fontFamily: "var(--font-jetbrains-mono, monospace)" }}>
                {tenureYears}yr
              </p>
            )}
            {claudeProfile && (
              <p className="text-[10px] text-zinc-500">since {claudeProfile.tenure_start}</p>
            )}
          </div>

          <div className="rounded-lg border border-white/8 bg-white/[0.03] p-3">
            <p className="text-[10px] text-zinc-500">Sentiment</p>
            {claudeProfileLoading && !claudeProfile ? (
              <PanelFieldSkeleton className="mt-1 h-5 w-20" />
            ) : claudeProfile ? (
              <span
                className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: claudeSentimentStyles(claudeProfile.sentiment).bg,
                  color: claudeSentimentStyles(claudeProfile.sentiment).color,
                  border: `1px solid ${claudeSentimentStyles(claudeProfile.sentiment).border}`,
                }}
                title={claudeProfile.sentiment_reason || undefined}
              >
                {claudeProfile.sentiment}
              </span>
            ) : (
              <span
                className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ backgroundColor: fallbackSentimentColor + "22", color: fallbackSentimentColor, border: `1px solid ${fallbackSentimentColor}55` }}
              >
                {shownSentiment === "positive" ? "Positive" : shownSentiment === "negative" ? "Negative" : "Neutral"}
              </span>
            )}
          </div>

          <div className="rounded-lg border border-white/8 bg-white/[0.03] p-3">
            <p className="text-[10px] text-zinc-500">Mkt Cap</p>
            <p className="mt-0.5 text-[13px] font-semibold text-zinc-200" style={{ fontFamily: "var(--font-jetbrains-mono, monospace)" }}>
              {formatMarketCap(ceo.marketCap)}
            </p>
          </div>
        </div>

        {/* Stock performance */}
        <div className="rounded-lg border border-white/8 bg-white/[0.03] p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Stock</p>
            {quote != null ? (
              <p className="text-2xl font-bold text-zinc-100" style={{ fontFamily: "var(--font-jetbrains-mono, monospace)" }}>
                ${quote.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            ) : (
              <p className="text-sm text-zinc-500">Live price unavailable</p>
            )}
            {claudeProfileLoading && !claudeProfile ? (
              <PanelFieldSkeleton className="mt-2 h-3.5 w-60" />
            ) : claudeProfile?.stock_since_tenure_summary ? (
              <p className="mt-2 text-xs leading-snug text-zinc-400">
                <span className="font-medium text-zinc-500">Since tenure (AI est.): </span>
                {claudeProfile.stock_since_tenure_summary}
                {typeof claudeProfile.stock_since_tenure_percent_approx === "number" && Number.isFinite(claudeProfile.stock_since_tenure_percent_approx) ? (
                  <span className={claudeProfile.stock_since_tenure_percent_approx >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {" "}({claudeProfile.stock_since_tenure_percent_approx >= 0 ? "+" : ""}{claudeProfile.stock_since_tenure_percent_approx.toFixed(1)}%)
                  </span>
                ) : null}
              </p>
            ) : stockSince?.ok ? (
              <p className="mt-2 text-xs text-zinc-500">
                Since {ceo.name} took over ({stockSince.startYear}):{" "}
                <span className={(stockSince.percentChange ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {(stockSince.percentChange ?? 0) >= 0 ? "+" : ""}{(stockSince.percentChange ?? 0).toFixed(2)}%
                </span>
              </p>
            ) : stockSince?.ok === false ? (
              <p className="mt-2 text-xs text-zinc-500">Historical performance unavailable.</p>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">Loading performance…</p>
            )}
        </div>

        {/* Alert banner */}
        {ceo.recentAlert && alertsCount > 0 && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/8 p-3">
            <p className="text-sm font-semibold text-red-300">Leadership change detected</p>
            <p className="mt-1 text-xs text-red-200/70">See recent news for details.</p>
          </div>
        )}

        {/* Legal history */}
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Legal History</p>

          {/* AI summary — always shown first as the authoritative source */}
          {claudeProfileLoading && !claudeProfile ? (
            <PanelFieldSkeleton className="h-10 w-full" />
          ) : claudeProfile ? (
            <div
              className={`mb-3 rounded-lg border p-3 text-xs leading-relaxed ${
                claudeProfile.legal_severity === "significant"
                  ? "border-red-500/30 bg-red-500/6 text-red-200/90"
                  : claudeProfile.legal_severity === "minor"
                    ? "border-amber-500/30 bg-amber-500/6 text-amber-200/90"
                    : "border-emerald-500/20 bg-emerald-500/5 text-emerald-300/80"
              }`}
            >
              <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wider opacity-60">
                {claudeProfile.legal_severity === "significant" ? "⚠ Significant Issues" : claudeProfile.legal_severity === "minor" ? "Minor Issues" : "Clean Record"}
              </span>
              {claudeProfile.legal_history ?? "No significant legal or regulatory issues on record."}
            </div>
          ) : (
            <p className="mb-3 text-xs text-zinc-500">No legal history data available.</p>
          )}

        </div>

        {/* Recent news */}
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Recent News</p>
          {news.length === 0 ? (
            <p className="text-xs text-zinc-500">No recent articles</p>
          ) : (
            <ul className="space-y-2">
              {news.map((a, i) => (
                <li key={i} className="rounded border border-white/5 bg-white/[0.03] p-2.5">
                  <p className="line-clamp-2 text-xs text-zinc-200">{a.title}</p>
                  <p className="mt-1 text-[10px] text-zinc-500">{a.source} · {new Date(a.publishedAt).toLocaleDateString()}</p>
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[10px] text-[var(--accent-color)] hover:underline">
                    Read full story →
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Leadership assessment */}
        <div>
          {assessStreaming ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent-color)]" style={{ animationDelay: `${d}ms` }} />
                ))}
                <span className="text-xs text-zinc-400">Analyzing leadership…</span>
              </div>
              <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full rounded-full bg-[var(--accent-color)]/60 transition-all duration-300" style={{ width: `${Math.min(90, (assessProgress / 700) * 100)}%` }} />
              </div>
            </div>
          ) : assessment ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-200">Leadership Assessment</p>
                <span className="rounded bg-[var(--accent-color)]/15 px-2 py-0.5 text-xs font-bold text-[var(--accent-color)]">
                  {assessment.leadershipScore}/10
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-500">{assessment.scoreLabel}</p>
              <p className="mt-2 text-xs text-zinc-300">
                {animateAssess ? <TypewriterText text={assessment.summary} startDelay={0} /> : assessment.summary}
              </p>
              <p className="mt-3 text-[11px] font-medium text-zinc-400">Strengths</p>
              <ul className="mt-1 list-disc pl-4 text-xs text-zinc-400">
                {assessment.strengths.map((s, i) => (
                  <li key={i}>{animateAssess ? <TypewriterText text={s} startDelay={550 + i * 200} /> : s}</li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] font-medium text-zinc-400">Watch Points</p>
              <ul className="mt-1 list-disc pl-4 text-xs text-zinc-400">
                {assessment.watchPoints.map((s, i) => (
                  <li key={i}>{animateAssess ? <TypewriterText text={s} startDelay={1150 + i * 200} /> : s}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-zinc-300">
                {animateAssess ? <TypewriterText text={assessment.investorVerdict} startDelay={1600} /> : assessment.investorVerdict}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={runAssessment}
              disabled={assessLoading}
              className="w-full rounded-lg bg-[var(--accent-color)] py-2.5 text-sm font-semibold text-[#020308] hover:opacity-90 disabled:opacity-50"
            >
              Run Leadership Report
            </button>
          )}
        </div>

        {/* Watchlist */}
        <button
          type="button"
          onClick={handleWatchlist}
          disabled={watchlistLoading}
          className="w-full rounded-lg border border-white/15 py-2 text-sm font-medium text-zinc-300 hover:bg-white/5 disabled:opacity-50"
        >
          {inWatchlist ? `✓ Watching ${ceo.ticker}` : "Add to Watchlist"}
        </button>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyDetailState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-[var(--app-card)]/30 p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
        <svg className="h-7 w-7 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <p className="text-center text-sm text-zinc-500">
        Select a CEO from the list to view their profile,<br />news, legal history, and leadership assessment.
      </p>
    </div>
  );
}

// ─── Compare Modal ────────────────────────────────────────────────────────────

function CompareModal({ ceos, onClose }: { ceos: CEOEntry[]; onClose: () => void }) {
  if (ceos.length === 0) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/10 bg-[var(--app-card)] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="text-lg font-semibold text-zinc-100">Compare CEOs</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-white/10">×</button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {ceos.map((c) => (
            <div key={c.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="font-semibold text-zinc-100">{c.name}</p>
              <p className="text-xs text-zinc-400">{c.company} ({c.ticker})</p>
              <p className="mt-1 text-[10px] text-zinc-500">
                Tenure: {new Date().getFullYear() - c.tenureStart} years · Sentiment: {c.sentiment}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-zinc-500">Shift-click rows to add/remove from comparison.</p>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function CEOsView() {
  const [filters, setFilters] = useState<FilterState>(() => getCeoFilters() ?? defaultFilters());
  const [selected, setSelected] = useState<CEOEntry | null>(null);
  const [compare, setCompare] = useState<CEOEntry[]>([]);
  const [alertsCount, setAlertsCount] = useState(0);
  const [ceoAlerts, setCeoAlerts] = useState<CEOAlertItem[]>([]);
  const [weeklyCeoAlerts, setWeeklyCeoAlerts] = useState<CEOAlertItem[]>([]);
  const [allCeoNews, setAllCeoNews] = useState<CEOAlertItem[]>([]);
  const [activeQuickPreset, setActiveQuickPreset] = useState<QuickPresetId | null>(null);
  const [liveSentiments, setLiveSentiments] = useState<Map<string, { sentiment: CEOSentiment; reason: string; previousSentiment: CEOSentiment | null; changedAt: string | null; updatedAt: string }>>(new Map());

  const ceoProfileCacheRef = useRef<Map<string, CeoClaudeProfile>>(new Map());
  const [graphClaudeByTicker, setGraphClaudeByTicker] = useState<Record<string, "bullish" | "bearish" | "neutral">>({});
  const shiftRef = useRef(false);

  const handleClaudeGraphSentiment = useCallback((ticker: string, tint: "bullish" | "bearish" | "neutral") => {
    setGraphClaudeByTicker((prev) => ({ ...prev, [ticker.toUpperCase()]: tint }));
  }, []);

  const CEOS_BY_TICKER = useMemo(() => new Map(CEOS.map((c) => [c.ticker.toUpperCase(), c])), []);

  const ceoUniverse = useMemo(() => {
    const alertTickers = new Set(ceoAlerts.map((a) => a.matchedTicker?.toUpperCase()).filter((t): t is string => Boolean(t)));

    const applyLive = (c: CEOEntry) => {
      const live = liveSentiments.get(c.ticker.toUpperCase());
      return {
        ...c,
        recentAlert: alertTickers.has(c.ticker.toUpperCase()),
        ...(live ? { sentiment: live.sentiment } : {}),
      };
    };

    const base = CEOS.map(applyLive);

    if (!activeQuickPreset || activeQuickPreset === "spy500") {
      const presetSet = QUICK_PRESET_TICKERS["spy500"];
      if (!presetSet) return base;
      return Array.from(presetSet)
        .map((ticker) => CEOS_BY_TICKER.get(ticker.toUpperCase()))
        .filter((c): c is CEOEntry => c !== undefined)
        .map(applyLive);
    }

    const presetSet = QUICK_PRESET_TICKERS[activeQuickPreset];
    if (!presetSet) return base;

    return Array.from(presetSet)
      .map((ticker) => CEOS_BY_TICKER.get(ticker.toUpperCase()))
      .filter((c): c is CEOEntry => c !== undefined)
      .map(applyLive);
  }, [activeQuickPreset, ceoAlerts, liveSentiments, CEOS_BY_TICKER]);

  const filtered = useMemo(() => filterCEOs(ceoUniverse, filters), [ceoUniverse, filters]);

  const presetShownCount = filtered.length;
  const activePresetShowLabel = activeQuickPreset ? QUICK_PRESET_SHOW_LABEL[activeQuickPreset] : null;
  const allViewLabel = "Overall";

  const ceoOfWeek = useMemo(() => {
    const ticker = ceoAlerts[0]?.matchedTicker?.toUpperCase();
    if (!ticker) return null;
    return ceoUniverse.find((c) => c.ticker.toUpperCase() === ticker) ?? null;
  }, [ceoAlerts, ceoUniverse]);

  // Sentiment shifts detected this week (previous_sentiment differs from current)
  const sentimentChanges = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const changes: { ticker: string; name: string; company: string; from: CEOSentiment; to: CEOSentiment; changedAt: string }[] = [];
    for (const ceo of CEOS) {
      const live = liveSentiments.get(ceo.ticker.toUpperCase());
      if (!live?.previousSentiment || !live.changedAt) continue;
      if (live.previousSentiment === live.sentiment) continue;
      if (new Date(live.changedAt).getTime() < weekAgo) continue;
      changes.push({ ticker: ceo.ticker, name: ceo.name, company: ceo.company, from: live.previousSentiment, to: live.sentiment, changedAt: live.changedAt });
    }
    return changes.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
  }, [liveSentiments]);

  const searchMatches = useMemo(() => {
    if (!filters.search.trim()) return [];
    const q = filters.search.toLowerCase();
    return CEOS.filter((c) => c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q) || c.ticker.toLowerCase().includes(q)).slice(0, 10);
  }, [filters.search]);

  // Auto-select first CEO on load / when filtered changes and selected is null
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (!autoSelectedRef.current && filtered.length > 0) {
      setSelected(filtered[0]);
      autoSelectedRef.current = true;
    }
  }, [filtered]);

  // Data fetching
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const r = await fetch("/api/ceo-alerts", { cache: "no-store" });
        const d = await r.json();
        if (!mounted) return;
        setAlertsCount(d?.count ?? 0);
        setCeoAlerts(Array.isArray(d?.alerts) ? d.alerts : []);
        setWeeklyCeoAlerts(Array.isArray(d?.weekly) ? d.weekly : []);
        setAllCeoNews(Array.isArray(d?.allNews) ? d.allNews : []);
      } catch {
        if (!mounted) return;
        setAlertsCount(0); setCeoAlerts([]); setWeeklyCeoAlerts([]); setAllCeoNews([]);
      }
    };
    load();
    const t = setInterval(load, 2 * 60 * 1000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  // Fetch live sentiments from Supabase (populated weekly by /api/ceo-sentiment POST)
  useEffect(() => {
    let mounted = true;
    fetch("/api/ceo-sentiment")
      .then((r) => r.json())
      .then((d: { sentiments?: { ticker: string; sentiment: string; sentiment_reason: string; previous_sentiment?: string | null; sentiment_changed_at?: string | null; updated_at: string }[] }) => {
        if (!mounted) return;
        const map = new Map<string, { sentiment: CEOSentiment; reason: string; previousSentiment: CEOSentiment | null; changedAt: string | null; updatedAt: string }>();
        for (const row of d?.sentiments ?? []) {
          if (row.sentiment === "positive" || row.sentiment === "neutral" || row.sentiment === "negative") {
            const prev = row.previous_sentiment;
            map.set(row.ticker.toUpperCase(), {
              sentiment: row.sentiment,
              reason: row.sentiment_reason ?? "",
              previousSentiment: (prev === "positive" || prev === "neutral" || prev === "negative") ? prev : null,
              changedAt: row.sentiment_changed_at ?? null,
              updatedAt: row.updated_at ?? "",
            });
          }
        }
        setLiveSentiments(map);
      })
      .catch(() => { /* silently fall back to static sentiment */ });
    return () => { mounted = false; };
  }, []);

  // Persist filters
  const filtersPersistSkippedRef = useRef(false);
  useEffect(() => {
    if (!filtersPersistSkippedRef.current) { filtersPersistSkippedRef.current = true; return; }
    saveCeoFilters(filters);
  }, [filters]);

  // Keyboard: shift for compare, Escape to close detail
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      shiftRef.current = e.shiftKey;
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey); };
  }, []);

  const handleCeoSelect = useCallback((ceo: CEOEntry) => {
    if (shiftRef.current) {
      setCompare((prev) => {
        const next = prev.filter((c) => c.id !== ceo.id);
        if (next.length === prev.length && next.length < 3) next.push(ceo);
        else if (next.length === prev.length) next.shift();
        return next;
      });
    } else {
      setCompare([]);
      setSelected(ceo);
    }
  }, []);

  const handleSelectByTicker = useCallback((ticker: string) => {
    const ceo = ceoUniverse.find((c) => c.ticker.toUpperCase() === ticker.toUpperCase());
    if (ceo) { setSelected(ceo); setCompare([]); }
  }, [ceoUniverse]);

  const handleExport = useCallback(() => {
    const headers = "Company,CEO,Sector,Tenure,Sentiment,MarketCap\n";
    const rows = filtered.map((c) => `${c.company},${c.name},${c.sector},${c.tenureStart},${c.sentiment},${c.marketCap}`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "quantivtrade-ceo-list.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }, [filtered]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#080d14]">

      {/* ── Header ── */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[var(--app-card)] px-5">
        <h1
          className="text-xl font-bold text-zinc-100"
          style={{ fontFamily: "var(--font-lora, Georgia), serif" }}
        >
          CEO Intelligence
        </h1>

        <div className="flex items-center gap-3">
          {alertsCount > 0 && (
            <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-medium text-red-400">
              {alertsCount} changes this month
            </span>
          )}

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search CEO or company…"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="w-52 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-[var(--accent-color)] focus:outline-none"
            />
            {searchMatches.length > 0 && (
              <ul className="absolute left-0 top-full z-50 mt-1 max-h-60 w-64 overflow-y-auto rounded-lg border border-white/10 bg-[var(--app-card)] py-1 shadow-xl">
                {searchMatches.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
                      onClick={() => { setSelected(c); setCompare([]); setFilters((f) => ({ ...f, search: "" })); }}
                    >
                      {c.name} · {c.company}
                      <span className="ml-1 text-[11px] text-zinc-500" style={{ fontFamily: "monospace" }}>({c.ticker})</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/10"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export CSV
          </button>
        </div>
      </header>

      {/* ── Body: 3-panel layout ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left: Filter sidebar */}
        <FilterSidebar
          filters={filters}
          onFiltersChange={setFilters}
          alertsCount={alertsCount}
          ceoOfWeek={ceoOfWeek}
          recentAlerts={allCeoNews.length > 0 ? allCeoNews : ceoAlerts}
          ceoOfWeekAlertTitle={ceoAlerts[0]?.title ?? null}
          weeklyAlerts={weeklyCeoAlerts}
          sentimentChanges={sentimentChanges}
          activeQuickPreset={activeQuickPreset}
          onQuickPresetChange={(id) => setActiveQuickPreset((cur) => (cur === id ? null : id))}
          presetShownCount={presetShownCount}
          allViewLabel={allViewLabel}
          activePresetShowLabel={activePresetShowLabel}
          onSelectCeo={handleSelectByTicker}
        />

        {/* Center: CEO list */}
        <CEOListPanel
          ceos={filtered}
          selectedId={selected?.id ?? null}
          onSelect={handleCeoSelect}
          onDeselect={() => setSelected(null)}
        />

        {/* Right: Detail panel — only shown when a CEO is selected */}
        {selected && (
          <div className="flex w-[440px] shrink-0 flex-col overflow-hidden border-l border-white/10">
            <DetailPanel
              ceo={selected}
              onClose={() => setSelected(null)}
              alertsCount={alertsCount}
              profileCacheRef={ceoProfileCacheRef}
              onClaudeGraphSentiment={handleClaudeGraphSentiment}
            />
          </div>
        )}
      </div>

      {compare.length >= 2 && <CompareModal ceos={compare} onClose={() => setCompare([])} />}
      <footer className="shrink-0 border-t border-white/10 bg-[var(--app-card)] px-6 py-2 flex items-center justify-between">
        <p className="text-[10px] text-zinc-600">© {new Date().getFullYear()} QuantivTrade · CEO Intelligence</p>
        <p className="text-[10px] text-zinc-600">Sentiment updated weekly · Data for informational purposes only</p>
      </footer>
    </div>
  );
}
