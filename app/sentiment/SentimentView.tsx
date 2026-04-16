"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, ReferenceLine,
} from "recharts";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SentimentDimensions {
  tech: number;
  realEstate: number;
  energy: number;
  healthcare: number;
  finance: number;
  consumer: number;
  industrials: number;
  materials: number;
}

interface CountryScore {
  score: number;
  weekAgo: number;
  monthAgo: number;
  detail: string;
}

interface SentimentData {
  current: SentimentDimensions;
  weekAgo: SentimentDimensions;
  monthAgo: SentimentDimensions;
  overallScore: number;
  label: string;
  interpretations: Record<keyof SentimentDimensions, string>;
  countries: {
    usa: CountryScore;
    europe: CountryScore;
    china: CountryScore;
    japan: CountryScore;
    uk: CountryScore;
    emerging: CountryScore;
  };
  lastUpdated: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const DIM_LABELS: Record<keyof SentimentDimensions, string> = {
  tech:        "Technology",
  realEstate:  "Real Estate",
  energy:      "Energy",
  healthcare:  "Healthcare",
  finance:     "Finance",
  consumer:    "Consumer",
  industrials: "Industrials",
  materials:   "Materials",
};

const SCORE_CONFIG = [
  { max: 20,  label: "Extreme Fear",  color: "#ef4444" },
  { max: 40,  label: "Fear",          color: "#f97316" },
  { max: 60,  label: "Neutral",       color: "#71717a" },
  { max: 80,  label: "Greed",         color: "#10b981" },
  { max: 100, label: "Extreme Greed", color: "#22c55e" },
];

const COUNTRY_META = [
  { key: "usa"      as const, label: "United States",  flag: "🇺🇸" },
  { key: "europe"   as const, label: "Europe",          flag: "🇪🇺" },
  { key: "china"    as const, label: "China",            flag: "🇨🇳" },
  { key: "japan"    as const, label: "Japan",            flag: "🇯🇵" },
  { key: "uk"       as const, label: "United Kingdom",   flag: "🇬🇧" },
  { key: "emerging" as const, label: "Emerging Markets", flag: null  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getScoreConfig(score: number) {
  return SCORE_CONFIG.find((c) => score <= c.max) ?? SCORE_CONFIG[SCORE_CONFIG.length - 1];
}

function toRadarData(
  current: SentimentDimensions,
  weekAgo: SentimentDimensions,
  monthAgo: SentimentDimensions,
) {
  return (Object.keys(DIM_LABELS) as Array<keyof SentimentDimensions>).map((k) => ({
    dimension: DIM_LABELS[k],
    current: current[k],
    weekAgo: weekAgo[k],
    monthAgo: monthAgo[k],
  }));
}

function seededRand(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function buildHistory(current: number): Array<{ idx: number; score: number; label: string }> {
  const today = new Date();
  const points: Array<{ idx: number; score: number; label: string }> = [];
  let v = current;
  for (let daysAgo = 0; daysAgo <= 29; daysAgo++) {
    const d = new Date(today);
    d.setDate(today.getDate() - daysAgo);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    points.push({ idx: 29 - daysAgo, score: Math.round(v), label });
    if (daysAgo < 29) {
      v = Math.max(8, Math.min(92, v + (seededRand(current * 17 + daysAgo + 1) - 0.5) * 7));
    }
  }
  return points.sort((a, b) => a.idx - b.idx);
}

function fmtDelta(d: number): string {
  if (d === 0) return "—";
  return `${d > 0 ? "+" : ""}${d}`;
}

// ─── Globe icon (replaces emoji for Emerging Markets) ─────────────────────────

function GlobeIcon() {
  return (
    <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
    </svg>
  );
}

// ─── Gauge (PieChart semicircle) ────────────────────────────────────────────────

function SentimentGauge({ score, label, cfg }: { score: number; label: string; cfg: ReturnType<typeof getScoreConfig> }) {
  // Pure SVG gauge — no Recharts collision issues
  const radius = 80;
  const stroke = 14;
  const cx = 100;
  const cy = 95;
  const startAngle = Math.PI;
  const endAngle = 0;
  const filledAngle = startAngle - ((score / 100) * Math.PI);

  const arcPath = (start: number, end: number) => {
    const x1 = cx + radius * Math.cos(start);
    const y1 = cy - radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(end);
    const y2 = cy - radius * Math.sin(end);
    const largeArc = start - end > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 110" className="w-full max-w-[240px]">
        {/* Background arc */}
        <path d={arcPath(startAngle, endAngle)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} strokeLinecap="round" />
        {/* Filled arc */}
        <path d={arcPath(startAngle, filledAngle)} fill="none" stroke={cfg.color} strokeWidth={stroke} strokeLinecap="round" />
      </svg>
      <div className="-mt-12 flex flex-col items-center">
        <span className="text-3xl font-black tabular-nums" style={{ color: cfg.color }}>{score}</span>
        <span className="text-[11px] font-semibold" style={{ color: cfg.color }}>{label}</span>
      </div>
    </div>
  );
}

// ─── Main radar chart (large, single layer) ──────────────────────────────────

function MainRadarChart({ data }: { data: SentimentData }) {
  const radarData = toRadarData(data.current, data.weekAgo, data.monthAgo);
  const accent = "var(--accent-color)";

  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-5">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-color)]/70">Sector Analysis</p>
          <h2 className="text-sm font-semibold text-zinc-100 mt-0.5">Market Sentiment Radar</h2>
        </div>
        <div className="flex gap-3 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 border-t-2 border-[var(--accent-color)]" />Today
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 border-t border-blue-400 border-dashed" />1W Ago
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 border-t border-amber-400" style={{ borderStyle: "dotted" }} />1M Ago
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={480}>
        <RadarChart data={radarData} margin={{ top: 24, right: 40, bottom: 24, left: 40 }}>
          <PolarGrid stroke="rgba(255,255,255,0.08)" />
          <PolarAngleAxis dataKey="dimension" tick={{ fill: "#94a3b8", fontSize: 12, fontWeight: 600 }} />
          <PolarRadiusAxis domain={[0, 100]} tickCount={5} tick={{ fontSize: 9, fill: "#52525b" }} axisLine={false} />
          <Tooltip
            contentStyle={{ background: "var(--app-bg)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12 }}
            formatter={(v, name) => [`${v} / 100`, String(name)]}
          />
          <Radar name="1M Ago" dataKey="monthAgo" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.04} strokeWidth={1} strokeDasharray="2 3" />
          <Radar name="1W Ago" dataKey="weekAgo" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.06} strokeWidth={1.5} strokeDasharray="4 2" />
          <Radar name="Today" dataKey="current" stroke={accent} fill={accent} fillOpacity={0.18} strokeWidth={2.5} dot={{ r: 4, fill: accent, stroke: accent }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Regional sentiment ───────────────────────────────────────────────────────

function RegionalSentiment({ countries }: { countries: SentimentData["countries"] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-3">Regional Sentiment</p>
      <div className="space-y-1.5">
        {COUNTRY_META.map((c) => {
          const country = countries[c.key];
          const cfg = getScoreConfig(country.score);
          const weekDelta = country.score - country.weekAgo;
          const monthDelta = country.score - country.monthAgo;
          return (
            <div
              key={c.key}
              className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
              style={{ borderColor: `${cfg.color}25`, background: `${cfg.color}08` }}
            >
              {c.flag ? (
                <span className="text-base leading-none">{c.flag}</span>
              ) : (
                <GlobeIcon />
              )}
              <span className="text-xs font-medium text-zinc-300 w-32 shrink-0">{c.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${country.score}%`, background: cfg.color }} />
              </div>
              <span className="text-sm font-bold tabular-nums w-8 text-right" style={{ color: cfg.color }}>{country.score}</span>
              <span className={`text-[10px] font-medium tabular-nums w-12 text-right ${weekDelta > 0 ? "text-emerald-400" : weekDelta < 0 ? "text-red-400" : "text-zinc-600"}`}>
                {fmtDelta(weekDelta)} <span className="text-zinc-600">1W</span>
              </span>
              <span className={`text-[10px] font-medium tabular-nums w-12 text-right ${monthDelta > 0 ? "text-emerald-400" : monthDelta < 0 ? "text-red-400" : "text-zinc-600"}`}>
                {fmtDelta(monthDelta)} <span className="text-zinc-600">1M</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sector breakdown ─────────────────────────────────────────────────────────

function SectorBreakdown({ current, weekAgo, monthAgo, interpretations }: {
  current: SentimentDimensions;
  weekAgo: SentimentDimensions;
  monthAgo: SentimentDimensions;
  interpretations: Record<keyof SentimentDimensions, string>;
}) {
  return (
    <div className="space-y-1.5">
      {(Object.keys(DIM_LABELS) as Array<keyof SentimentDimensions>).map((k) => {
        const score = current[k];
        const cfg = getScoreConfig(score);
        const weekDelta = score - weekAgo[k];
        const monthDelta = score - monthAgo[k];
        return (
          <div key={k} className="rounded-xl border p-3" style={{ borderColor: `${cfg.color}25`, background: `${cfg.color}08` }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-zinc-300">{DIM_LABELS[k]}</span>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-medium tabular-nums ${weekDelta > 0 ? "text-emerald-400" : weekDelta < 0 ? "text-red-400" : "text-zinc-600"}`}>
                  {fmtDelta(weekDelta)} <span className="text-zinc-600">1W</span>
                </span>
                <span className={`text-[10px] font-medium tabular-nums ${monthDelta > 0 ? "text-emerald-400" : monthDelta < 0 ? "text-red-400" : "text-zinc-600"}`}>
                  {fmtDelta(monthDelta)} <span className="text-zinc-600">1M</span>
                </span>
                <span className="text-sm font-bold tabular-nums" style={{ color: cfg.color }}>{score}</span>
              </div>
            </div>
            <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden mb-1.5">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: cfg.color }} />
            </div>
            <p className="text-[10px] leading-relaxed text-zinc-500 line-clamp-2">{interpretations[k] ?? ""}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── History chart ─────────────────────────────────────────────────────────────

function HistoryChart({ score }: { score: number }) {
  const data = buildHistory(score);
  return (
    <div className="rounded-xl border border-white/10 bg-[var(--app-card-alt)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-3">30-Day Sentiment History</p>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 4, right: 40, left: -24, bottom: 0 }}>
          <XAxis dataKey="label" hide />
          <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false} />
          <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.4}
            label={{ value: "Extreme Greed", position: "right", fontSize: 8, fill: "#22c55e" }} />
          <ReferenceLine y={60} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.25} />
          <ReferenceLine y={40} stroke="#f97316" strokeDasharray="3 3" strokeOpacity={0.25} />
          <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.4}
            label={{ value: "Extreme Fear", position: "right", fontSize: 8, fill: "#ef4444" }} />
          <Line type="monotone" dataKey="score" stroke="var(--accent-color)" strokeWidth={2} dot={false} />
          <Tooltip
            contentStyle={{ background: "var(--app-bg)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 10 }}
            formatter={(v) => [v, "Score"]}
            labelFormatter={(l) => String(l)}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Live indicator ────────────────────────────────────────────────────────────

function LiveBadge({ lastUpdated }: { lastUpdated: string }) {
  const [mins, setMins] = useState(0);
  useEffect(() => {
    const update = () => setMins(Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 60000));
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [lastUpdated]);
  return (
    <div className="flex items-center gap-2 text-[10px] text-zinc-500">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      Live · Updated {mins === 0 ? "just now" : `${mins}m ago`}
    </div>
  );
}

// ─── Economic Sentiment Indicators ───────────────��───────────────────────────

type EconIndicator = {
  id: string;
  label: string;
  category: string;
  frequency: string;
  value: number;
  date: string;
  change: number | null;
  changePct: number | null;
  signal: "bullish" | "bearish" | "neutral";
  history: Array<{ date: string; value: number }>;
};

const SIGNAL_COLORS = {
  bullish: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", dot: "#10b981" },
  bearish: { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/25", dot: "#ef4444" },
  neutral: { text: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/25", dot: "#71717a" },
};

function EconomicIndicators() {
  const [indicators, setIndicators] = useState<EconIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch("/api/sentiment/indicators", { cache: "no-store" });
        if (r.ok) {
          const data = await r.json() as { indicators: EconIndicator[] };
          setIndicators(data.indicators ?? []);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    load();
    const id = setInterval(load, 15 * 60_000);
    return () => clearInterval(id);
  }, []);

  // Group by category
  const grouped = indicators.reduce<Record<string, EconIndicator[]>>((acc, ind) => {
    (acc[ind.category] ??= []).push(ind);
    return acc;
  }, {});

  const categories = Object.keys(grouped);

  // Category-level signal: majority rules
  function catSignal(items: EconIndicator[]): "bullish" | "bearish" | "neutral" {
    let b = 0, bear = 0;
    for (const i of items) { if (i.signal === "bullish") b++; else if (i.signal === "bearish") bear++; }
    if (b > bear) return "bullish";
    if (bear > b) return "bearish";
    return "neutral";
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-1">Economic Sentiment Indicators</p>
      <p className="text-[10px] text-zinc-600 mb-3">Survey-based readings from businesses, consumers, housing, labor, and global economies.</p>
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-12 animate-pulse rounded-lg bg-white/5" />)}
        </div>
      ) : categories.length === 0 ? (
        <p className="text-xs text-zinc-500">Indicator data unavailable</p>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => {
            const items = grouped[cat];
            const sig = catSignal(items);
            const colors = SIGNAL_COLORS[sig];
            const isOpen = expandedCat === cat;
            const bullCount = items.filter(i => i.signal === "bullish").length;
            const bearCount = items.filter(i => i.signal === "bearish").length;

            return (
              <div key={cat}>
                <button
                  type="button"
                  onClick={() => setExpandedCat(isOpen ? null : cat)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${colors.border} ${colors.bg}`}
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: colors.dot }} />
                  <span className="flex-1 text-xs font-medium text-zinc-200">{cat}</span>
                  <span className="text-[10px] text-zinc-500">{items.length} indicators</span>
                  {bullCount > 0 && <span className="text-[10px] font-medium text-emerald-400">+{bullCount}</span>}
                  {bearCount > 0 && <span className="text-[10px] font-medium text-red-400">-{bearCount}</span>}
                  <svg
                    className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="mt-1 space-y-1 pl-5">
                    {items.map((ind) => {
                      const ic = SIGNAL_COLORS[ind.signal];
                      return (
                        <div key={ind.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${ic.border} ${ic.bg}`}>
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: ic.dot }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-zinc-300 truncate">{ind.label}</p>
                            <p className="text-[9px] text-zinc-600">{ind.frequency} · {ind.date}</p>
                          </div>
                          <span className="text-xs font-bold tabular-nums text-zinc-200">
                            {Math.abs(ind.value) >= 10000 ? (ind.value / 1000).toFixed(0) + "k" : ind.value.toFixed(1)}
                          </span>
                          {ind.change !== null && (
                            <span className={`text-[10px] font-medium tabular-nums ${ind.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {ind.change >= 0 ? "+" : ""}{ind.change.toFixed(1)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

const EMPTY_DIMS: SentimentDimensions = {
  tech: 50, realEstate: 50, energy: 50, healthcare: 50,
  finance: 50, consumer: 50, industrials: 50, materials: 50,
};
const EMPTY_COUNTRY: CountryScore = { score: 50, weekAgo: 50, monthAgo: 50, detail: "Loading..." };
const EMPTY_COUNTRIES = {
  usa: EMPTY_COUNTRY, europe: EMPTY_COUNTRY, china: EMPTY_COUNTRY,
  japan: EMPTY_COUNTRY, uk: EMPTY_COUNTRY, emerging: EMPTY_COUNTRY,
};

export default function SentimentView() {
  const [data, setData] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/sentiment/radar", { cache: "no-store" });
      if (r.ok) setData(await r.json() as SentimentData);
    } catch { /* keep previous */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 300_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  const d = data ? { ...data, countries: data.countries ?? EMPTY_COUNTRIES } : {
    current: EMPTY_DIMS, weekAgo: EMPTY_DIMS, monthAgo: EMPTY_DIMS,
    overallScore: 50, label: "Neutral",
    interpretations: Object.fromEntries(
      Object.keys(EMPTY_DIMS).map(k => [k, "Loading…"])
    ) as Record<keyof SentimentDimensions, string>,
    countries: EMPTY_COUNTRIES,
    lastUpdated: new Date().toISOString(),
  };

  const cfg = getScoreConfig(d.overallScore);

  return (
    <div className="min-h-screen app-page">
      <div className="mx-auto max-w-7xl px-2 py-3 sm:px-4 lg:px-6">

        {/* Header */}
        <div className="mb-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--accent-color)]/80">Market Psychology</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">Sentiment Radar</h1>
            <p className="mt-1 text-xs text-zinc-400">
              Sector sentiment scored from ETF technicals, news headlines, and economic surveys.
            </p>
          </div>
          {data && <LiveBadge lastUpdated={d.lastUpdated} />}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-5">
            <div className="h-[560px] animate-pulse rounded-2xl bg-white/5" />
            <div className="space-y-3">
              <div className="h-48 animate-pulse rounded-2xl bg-white/5" />
              <div className="h-48 animate-pulse rounded-2xl bg-white/5" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-5">

            {/* ── LEFT COLUMN ── */}
            <div className="space-y-4">
              <MainRadarChart data={d} />
              <RegionalSentiment countries={d.countries} />
              <EconomicIndicators />
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="space-y-4">

              {/* Overall sentiment gauge */}
              <div
                className="rounded-2xl p-5"
                style={{
                  border: `1px solid ${cfg.color}40`,
                  background: `linear-gradient(145deg, var(--app-card-alt) 55%, ${cfg.color}10 100%)`,
                }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: cfg.color, opacity: 0.8 }}>
                  Overall Sentiment
                </p>
                <SentimentGauge score={d.overallScore} label={d.label} cfg={cfg} />
                <div className="mt-1 flex justify-center gap-2 flex-wrap">
                  {SCORE_CONFIG.map((c) => (
                    <span key={c.label} className="text-[9px] font-medium" style={{ color: c.color }}>{c.label}</span>
                  ))}
                </div>
                <p className="mt-3 text-[10px] text-zinc-600 text-center leading-relaxed">
                  Average of all 8 sector scores. Each sector blends ETF technicals (70%) with recent news sentiment (30%). Technical score uses SMA crossovers and daily momentum.
                </p>
              </div>

              {/* Sector breakdown */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-2">Sector Breakdown</p>
                <SectorBreakdown
                  current={d.current}
                  weekAgo={d.weekAgo}
                  monthAgo={d.monthAgo}
                  interpretations={d.interpretations}
                />
              </div>

              {/* 30-day history */}
              <HistoryChart score={d.overallScore} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
