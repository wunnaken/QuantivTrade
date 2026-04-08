"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockQuote {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  prevClose: number | null;
}

interface PpiSeries {
  current: number | null;
  asOf: string | null;
  momChange: number | null;
  yoyChange: number | null;
  history: { date: string; value: number }[];
}

interface MortgageHistoryPoint {
  date: string;
  r30: number | null;
  r15: number | null;
  r5: number | null;
  ff: number | null;
}

interface MarketRatesData {
  mortgageRates: {
    current: {
      rate30: number | null;
      rate15: number | null;
      rate5arm: number | null;
      asOf: string | null;
      asOf5arm: string | null;
    };
    history: MortgageHistoryPoint[];
  };
  keyRates: {
    fedFunds: { value: number | null; asOf: string | null };
    prime: { value: number | null; asOf: string | null };
  };
  ppi: {
    lumber: PpiSeries;
    steel: PpiSeries;
    copper: PpiSeries;
  };
  stocks: {
    homebuilders: StockQuote[];
    homeImprovement: StockQuote[];
    materials: StockQuote[];
  };
}

interface CandleGroup {
  group: string;
  color: string;
  points: { date: string; pct: number | null }[];
}

interface CandleData {
  range: string;
  groups: CandleGroup[];
  hasData?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null, decimals = 2): string {
  if (v === null || v === undefined) return "—";
  return v.toFixed(decimals);
}

function fmtPct(v: number | null): string {
  if (v === null || v === undefined) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function changeColor(v: number | null, inverse = false): string {
  if (v === null) return "text-zinc-400";
  const positive = inverse ? v < 0 : v > 0;
  return positive ? "text-emerald-400" : v === 0 ? "text-zinc-400" : "text-red-400";
}

function filterPpiByYears(history: { date: string; value: number }[], years: number) {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return history.filter((d) => d.date >= cutoffStr);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_STYLE = {
  background: "transparent",
  fontSize: 11,
  fontFamily: "inherit",
};

const TOOLTIP_STYLE = {
  backgroundColor: "var(--app-card)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  fontSize: 12,
  color: "#e4e4e7",
};

type Tab = "rates" | "materials" | "stocks" | "gas";
type PpiRange = "1Y" | "3Y" | "5Y";
type StockRange = "1W" | "1M" | "3M" | "YTD" | "1Y";
type GasRange = "3M" | "6M" | "1Y" | "4Y";

// ─── Sub-components ───────────────────────────────────────────────────────────

function RateCard({
  label,
  value,
  unit = "%",
  sub,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${accent ? "text-[var(--accent-color)]" : "text-zinc-50"}`}
      >
        {value}
        {value !== "—" && <span className="ml-1 text-sm font-normal text-zinc-400">{unit}</span>}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-500">{sub}</p>}
    </div>
  );
}

function PpiCard({ label, data }: { label: string; data: PpiSeries }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-zinc-50">
        {fmt(data.current, 1)}
        <span className="ml-1 text-sm font-normal text-zinc-400">index</span>
      </p>
      <div className="mt-2 flex gap-4 text-xs">
        <span>
          <span className="text-zinc-500">MoM </span>
          <span className={changeColor(data.momChange, true)}>{fmtPct(data.momChange)}</span>
        </span>
        <span>
          <span className="text-zinc-500">YoY </span>
          <span className={changeColor(data.yoyChange, true)}>{fmtPct(data.yoyChange)}</span>
        </span>
      </div>
      {data.asOf && <p className="mt-1 text-[10px] text-zinc-600">As of {fmtDate(data.asOf)}</p>}
    </div>
  );
}

function StockCard({ stock }: { stock: StockQuote }) {
  const up = stock.changePercent !== null && stock.changePercent >= 0;
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-zinc-50">{stock.symbol}</p>
          <p className="truncate text-[10px] text-zinc-500">{stock.name}</p>
        </div>
        {stock.changePercent !== null && (
          <span
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${up ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}
          >
            {fmtPct(stock.changePercent)}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-lg font-bold tabular-nums text-zinc-50">
        {stock.price !== null ? `$${stock.price.toFixed(2)}` : "—"}
      </p>
      {stock.change !== null && (
        <p className={`text-[10px] tabular-nums ${up ? "text-emerald-400" : "text-red-400"}`}>
          {stock.change >= 0 ? "+" : ""}
          {stock.change.toFixed(2)} today
        </p>
      )}
    </div>
  );
}

function TimeframeToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-lg border border-white/10 bg-white/5 p-0.5">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors ${
            value === o
              ? "bg-[var(--accent-color)]/20 text-[var(--accent-color)]"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

// ─── Stock Performance Chart ──────────────────────────────────────────────────

function StockPerformanceChart() {
  const [range, setRange] = useState<StockRange>("1M");
  const [data, setData] = useState<CandleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setFetchError(false);
    fetch(`/api/market-rates/candles?range=${range}`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("bad response");
        return r.json();
      })
      .then((d: CandleData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setFetchError(true);
        setLoading(false);
      });
  }, [range]);

  // Merge group series into a single chart-compatible array
  const chartData = useMemo(() => {
    if (!data?.groups) return [];
    const allDates = [...new Set(data.groups.flatMap((g) => g.points.map((p) => p.date)))].sort();
    const maps = Object.fromEntries(
      data.groups.map((g) => [g.group, Object.fromEntries(g.points.map((p) => [p.date, p.pct]))]),
    );
    return allDates.map((date) => ({
      date,
      Homebuilders: maps["Homebuilders"]?.[date] ?? null,
      "Home Improvement": maps["Home Improvement"]?.[date] ?? null,
      Materials: maps["Materials"]?.[date] ?? null,
    }));
  }, [data]);

  const noData = !loading && !fetchError && chartData.length === 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] px-4 pb-4 pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Sector Performance (% Change)
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-600">
            Indexed to 0% at period start · ITB, XHB (Homebuilders) · HD, LOW (Home Improvement) ·
            XLB, MLM (Materials)
          </p>
        </div>
        <TimeframeToggle
          options={["1W", "1M", "3M", "YTD", "1Y"] as StockRange[]}
          value={range}
          onChange={setRange}
        />
      </div>
      {loading ? (
        <div className="flex h-[240px] items-center justify-center text-xs text-zinc-500">
          Loading performance data...
        </div>
      ) : fetchError ? (
        <div className="flex h-[240px] items-center justify-center text-xs text-zinc-500">
          Could not load candle data — market may be closed or API key limited.
        </div>
      ) : noData ? (
        <div className="flex h-[240px] items-center justify-center text-xs text-zinc-500">
          No trading data available for this range. Try a different timeframe.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} style={CHART_STYLE}>
            <CartesianGrid stroke="#334155" strokeOpacity={0.25} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#71717a" }}
              tickFormatter={fmtShortDate}
              interval="preserveStartEnd"
              label={{ value: "Date", position: "insideBottom", offset: -2, fontSize: 10, fill: "#52525b" }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#71717a" }}
              tickFormatter={(v) => `${(v as number) >= 0 ? "+" : ""}${(v as number).toFixed(1)}%`}
              width={62}
              label={{ value: "% Change", angle: -90, position: "insideLeft", offset: 14, dx: -10, fontSize: 10, fill: "#52525b" }}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={(v) => fmtDate(v as string)}
              formatter={(v: unknown, name: unknown) => [
                `${(v as number) >= 0 ? "+" : ""}${(v as number).toFixed(2)}%`,
                name as string,
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {data?.groups.map((g) => (
              <Line
                key={g.group}
                type="monotone"
                dataKey={g.group}
                stroke={g.color}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Gas Prices Tab ───────────────────────────────────────────────────────────

interface GasGrade {
  id: string; label: string; color: string;
  current: number | null; asOf: string | null;
  wowChange: number | null; yoyChange: number | null; yoyPct: number | null;
  hi52: number | null; lo52: number | null;
  history: { date: string; value: number }[];
}

interface GasData {
  grades: GasGrade[];
  allGradesHistory: { date: string; regular: number | null; midgrade: number | null; premium: number | null; diesel: number | null; crude: number | null }[];
  latestCrudePerGal: number | null;
  pumpSpread: number | null;
  source: string;
  updateSchedule: string;
}

function filterGasHistory<T extends { date: string }>(history: T[], range: GasRange): T[] {
  const months = range === "3M" ? 3 : range === "6M" ? 6 : range === "1Y" ? 12 : 48;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return history.filter((h) => h.date >= cutoffStr);
}

function GasPricesTab() {
  const [data, setData] = useState<GasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<GasRange>("4Y");

  useEffect(() => {
    fetch("/api/market-rates/gas", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d: GasData) => setData(d))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex min-h-[300px] items-center justify-center text-sm text-zinc-500">Loading gas prices…</div>;
  if (error || !data) return <div className="flex min-h-[200px] items-center justify-center text-sm text-zinc-500">{error ?? "No data"}</div>;

  const regular  = data.grades.find((g) => g.id === "GASREGCOVW");
  const midgrade = data.grades.find((g) => g.id === "GASMIDCOVW");
  const premium  = data.grades.find((g) => g.id === "GASPRMCOVW");
  const diesel   = data.grades.find((g) => g.id === "GASDESW");

  const premSpread = premium?.current != null && regular?.current != null
    ? Math.round((premium.current - regular.current) * 1000) / 1000 : null;
  const dslSpread = diesel?.current != null && regular?.current != null
    ? Math.round((diesel.current - regular.current) * 1000) / 1000 : null;

  const filteredHistory = filterGasHistory(data.allGradesHistory, range);

  function GradeCard({ g }: { g: GasGrade | undefined }) {
    if (!g) return null;
    const rangeWidth = g.hi52 != null && g.lo52 != null && g.hi52 !== g.lo52 && g.current != null
      ? Math.round(((g.current - g.lo52) / (g.hi52 - g.lo52)) * 100) : null;
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">{g.label} Gasoline</p>
        <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight" style={{ color: g.color }}>
          {g.current !== null ? `$${g.current.toFixed(3)}` : "—"}
          <span className="ml-1 text-sm font-normal text-zinc-400">/ gal</span>
        </p>
        <div className="mt-2 flex gap-3 text-xs">
          {g.wowChange !== null && (
            <span>
              <span className="text-zinc-500">WoW </span>
              <span className={g.wowChange >= 0 ? "text-red-400" : "text-emerald-400"}>
                {g.wowChange >= 0 ? "+" : ""}{g.wowChange.toFixed(3)}
              </span>
            </span>
          )}
          {g.yoyPct !== null && (
            <span>
              <span className="text-zinc-500">YoY </span>
              <span className={g.yoyPct >= 0 ? "text-red-400" : "text-emerald-400"}>
                {g.yoyPct >= 0 ? "+" : ""}{g.yoyPct.toFixed(1)}%
              </span>
            </span>
          )}
        </div>
        {rangeWidth !== null && g.lo52 != null && g.hi52 != null && (
          <div className="mt-2.5">
            <div className="mb-1 flex justify-between text-[9px] text-zinc-600">
              <span>52W Lo ${g.lo52.toFixed(2)}</span>
              <span>52W Hi ${g.hi52.toFixed(2)}</span>
            </div>
            <div className="relative h-1.5 w-full rounded-full bg-white/10">
              <div className="h-full rounded-full" style={{ width: `${rangeWidth}%`, background: g.color, opacity: 0.7 }} />
              <div className="absolute top-1/2 h-2.5 w-1 -translate-y-1/2 rounded-sm" style={{ left: `${rangeWidth}%`, background: g.color }} />
            </div>
          </div>
        )}
        {g.asOf && <p className="mt-1.5 text-[10px] text-zinc-600">Week of {g.asOf}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* All 4 grade cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <GradeCard g={regular} />
        <GradeCard g={midgrade} />
        <GradeCard g={premium} />
        <GradeCard g={diesel} />
      </div>

      {/* Context + spread banner */}
      {regular && regular.current !== null && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-xs text-zinc-500">National avg regular </span>
              <span className="font-bold text-zinc-50">${regular.current.toFixed(3)}</span>
              {regular.yoyPct !== null && (
                <span className={`ml-2 text-xs font-medium ${regular.yoyPct >= 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {regular.yoyPct >= 0 ? "▲" : "▼"} {Math.abs(regular.yoyPct).toFixed(1)}% YoY
                </span>
              )}
            </div>
            {data.latestCrudePerGal !== null && (
              <div>
                <span className="text-xs text-zinc-500">WTI crude equiv. </span>
                <span className="font-bold text-zinc-50">${data.latestCrudePerGal.toFixed(3)}</span>
                <span className="ml-1 text-xs text-zinc-600">/gal</span>
              </div>
            )}
            {data.pumpSpread !== null && (
              <div>
                <span className="text-xs text-zinc-500">Pump markup over crude </span>
                <span className="font-bold text-amber-400">${data.pumpSpread.toFixed(3)}</span>
                <span className="ml-1 text-xs text-zinc-600">/gal</span>
              </div>
            )}
            {premSpread !== null && (
              <div>
                <span className="text-xs text-zinc-500">Premium over regular </span>
                <span className="font-bold text-zinc-50">+${premSpread.toFixed(3)}</span>
              </div>
            )}
            {dslSpread !== null && (
              <div>
                <span className="text-xs text-zinc-500">Diesel over regular </span>
                <span className="font-bold text-zinc-50">+${dslSpread.toFixed(3)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* All grades + crude trend chart with timeframe toggle */}
      {data.allGradesHistory.length > 1 && (
        <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] px-4 pb-4 pt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                All Grades + Crude — Price Trend
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-600">
                Weekly US avg retail price ($/gal) · Crude = WTI ÷ 42 per-gal equiv · {data.source}
              </p>
            </div>
            <TimeframeToggle
              options={["3M", "6M", "1Y", "4Y"] as GasRange[]}
              value={range}
              onChange={setRange}
            />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={filteredHistory} style={CHART_STYLE}>
              <CartesianGrid stroke="#334155" strokeOpacity={0.2} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }}
                tickFormatter={fmtShortDate} interval="preserveStartEnd" />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "#71717a" }}
                tickFormatter={(v) => `$${(v as number).toFixed(2)}`} width={46} />
              <Tooltip contentStyle={TOOLTIP_STYLE}
                labelFormatter={(v) => `Week of ${v}`}
                formatter={(v: unknown, name: unknown) => [
                  `$${(v as number).toFixed(3)}${name === "crude" ? "/gal equiv." : "/gal"}`,
                  ({ regular: "Regular", midgrade: "Midgrade", premium: "Premium", diesel: "Diesel", crude: "WTI Crude (÷42)" } as Record<string, string>)[name as string] ?? String(name),
                ]} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(v) => (({ regular: "Regular", midgrade: "Midgrade", premium: "Premium", diesel: "Diesel", crude: "WTI Crude (÷42)" } as Record<string, string>)[v] ?? v)} />
              <Line type="monotone" dataKey="crude"    stroke="#71717a" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls name="crude" />
              <Line type="monotone" dataKey="regular"  stroke="#e8846a" strokeWidth={2}   dot={false} connectNulls name="regular" />
              <Line type="monotone" dataKey="midgrade" stroke="#a78bfa" strokeWidth={1.5} dot={false} connectNulls name="midgrade" />
              <Line type="monotone" dataKey="premium"  stroke="#f59e0b" strokeWidth={1.5} dot={false} connectNulls name="premium" />
              <Line type="monotone" dataKey="diesel"   stroke="#f97316" strokeWidth={2}   dot={false} connectNulls name="diesel" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* What drives pump prices */}
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">What Drives Pump Prices</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg bg-white/[0.07] px-4 py-3">
            <p className="mb-1.5 text-sm font-semibold text-zinc-200">Crude Oil <span className="font-normal text-zinc-500">(~55%)</span></p>
            <p className="text-xs leading-relaxed text-zinc-400">The largest component. WTI and Brent benchmarks set the global floor. A $10/barrel move in crude shifts pump prices by roughly <span className="font-medium text-zinc-200">$0.24/gal</span>.</p>
          </div>
          <div className="rounded-lg bg-white/[0.07] px-4 py-3">
            <p className="mb-1.5 text-sm font-semibold text-zinc-200">Refining <span className="font-normal text-zinc-500">(~15%)</span></p>
            <p className="text-xs leading-relaxed text-zinc-400">Cost to convert crude into finished gasoline. Refinery outages, seasonal blend switches (summer blend starts March), and low utilization rates all push this higher.</p>
          </div>
          <div className="rounded-lg bg-white/[0.07] px-4 py-3">
            <p className="mb-1.5 text-sm font-semibold text-zinc-200">Distribution <span className="font-normal text-zinc-500">(~15%)</span></p>
            <p className="text-xs leading-relaxed text-zinc-400">Pipeline, terminal storage, and retailer margin. Varies by region — landlocked states and islands pay more. The diesel premium over regular mostly lives here.</p>
          </div>
          <div className="rounded-lg bg-white/[0.07] px-4 py-3">
            <p className="mb-1.5 text-sm font-semibold text-zinc-200">Taxes <span className="font-normal text-zinc-500">(~15%)</span></p>
            <p className="text-xs leading-relaxed text-zinc-400">Federal excise tax of <span className="font-medium text-zinc-200">$0.184/gal</span> plus state taxes averaging ~$0.31/gal. California ($0.68/gal) and Illinois are consistently the most expensive.</p>
          </div>
        </div>
        <p className="mt-3 text-[10px] text-zinc-600">{data.updateSchedule}</p>
      </div>

      {/* How Gas Prices Connect to the Other Tabs */}
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">How Gas Prices Connect to the Other Tabs</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-white/[0.07] px-4 py-3">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">Mortgage &amp; Rates</span>
              <span className="text-[10px] text-zinc-500">Indirect / Delayed</span>
            </div>
            <p className="text-xs leading-relaxed text-zinc-400">Gas prices don&apos;t move mortgage rates directly. But sustained energy inflation is a major input to CPI, which pressures the Fed to hold or raise the funds rate — and that rate anchors the 10-year Treasury yield that mortgages track. Prolonged high gas prices historically precede Fed tightening cycles by 2–4 quarters.</p>
          </div>
          <div className="rounded-lg bg-white/[0.07] px-4 py-3">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">Building Materials</span>
              <span className="text-[10px] text-zinc-500">Moderate / Direct</span>
            </div>
            <p className="text-xs leading-relaxed text-zinc-400">Diesel fuel is a key cost for heavy trucking that moves lumber, steel, and aggregate. Petrochemical feedstocks from crude also flow into construction adhesives and plastics. A $0.50/gal diesel spike typically adds 2–5% to finished material delivery costs over the following quarter — visible in PPI data with a 1–2 month lag.</p>
          </div>
          <div className="rounded-lg bg-white/[0.07] px-4 py-3">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">Construction Stocks</span>
              <span className="text-[10px] text-zinc-500">Lagged / Negative</span>
            </div>
            <p className="text-xs leading-relaxed text-zinc-400">Higher fuel costs compress homebuilder and materials company margins — equipment fleets, delivery, and site operations all run on diesel. High gas prices also reduce consumer disposable income, which can slow housing demand. The effect typically surfaces in earnings guidance 1–2 quarters after a prolonged spike rather than immediately in the stock price.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MarketRatesView() {
  const [data, setData] = useState<MarketRatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("rates");
  const [ppiRange, setPpiRange] = useState<PpiRange>("3Y");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/market-rates", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as MarketRatesData;
      setData(json);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  // ── Derived chart data ──────────────────────────────────────────────────

  // Downsample long mortgage history for chart readability
  const mortHistory = useMemo(() => {
    if (!data) return [];
    const h = data.mortgageRates.history;
    // Keep every other weekly point to smooth the chart
    return h.filter((_, i) => i % 2 === 0 || i === h.length - 1);
  }, [data]);

  // Merged PPI history for the combined trend chart, filtered by selected range
  const ppiHistory = useMemo(() => {
    if (!data) return [];
    const years = ppiRange === "1Y" ? 1 : ppiRange === "3Y" ? 3 : 5;
    const lf = filterPpiByYears(data.ppi.lumber.history, years);
    const sf = filterPpiByYears(data.ppi.steel.history, years);
    const cf = filterPpiByYears(data.ppi.copper.history, years);
    const dates = [...new Set([...lf.map((d) => d.date), ...sf.map((d) => d.date), ...cf.map((d) => d.date)])].sort();
    const lm = Object.fromEntries(lf.map((d) => [d.date, d.value]));
    const sm = Object.fromEntries(sf.map((d) => [d.date, d.value]));
    const cm = Object.fromEntries(cf.map((d) => [d.date, d.value]));
    return dates.map((date) => ({
      date,
      lumber: lm[date] ?? null,
      steel: sm[date] ?? null,
      copper: cm[date] ?? null,
    }));
  }, [data, ppiRange]);

  // ── Loading / error states ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-sm text-zinc-500">
        Loading rates data...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-sm text-zinc-500">
        <p>{error ?? "No data available"}</p>
        <button
          onClick={() => void load()}
          className="rounded-lg border border-white/10 px-4 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
        >
          Retry
        </button>
      </div>
    );
  }

  const { mortgageRates, keyRates, ppi, stocks } = data;

  const TABS: { id: Tab; label: string }[] = [
    { id: "rates", label: "Mortgage & Rates" },
    { id: "materials", label: "Building Materials" },
    { id: "gas", label: "Gas Prices" },
    { id: "stocks", label: "Construction Stocks" },
  ];

  return (
    <div className="space-y-4">
      {/* Tab Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t.id
                  ? "bg-[var(--accent-color)]/20 text-[var(--accent-color)]"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {lastUpdated && (
          <p className="text-[10px] text-zinc-600">
            Updated{" "}
            {lastUpdated.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>

      {/* ── TAB: MORTGAGE & RATES ─────────────────────────────────────────── */}
      {tab === "rates" && (
        <div className="space-y-4">
          {/* Headline rate cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <RateCard
              label="30-Yr Fixed"
              value={fmt(mortgageRates.current.rate30)}
              sub={`As of ${fmtDate(mortgageRates.current.asOf)}`}
              accent
            />
            <RateCard
              label="15-Yr Fixed"
              value={fmt(mortgageRates.current.rate15)}
              sub="Freddie Mac survey"
            />
            <RateCard
              label="5/1 ARM"
              value={fmt(mortgageRates.current.rate5arm)}
              sub={
                mortgageRates.current.asOf5arm
                  ? `Last: ${fmtDate(mortgageRates.current.asOf5arm)}`
                  : "Discontinued Nov 2022"
              }
            />
            <RateCard
              label="Fed Funds"
              value={fmt(keyRates.fedFunds.value)}
              sub={`As of ${fmtDate(keyRates.fedFunds.asOf)}`}
            />
            <RateCard
              label="Prime Rate"
              value={fmt(keyRates.prime.value)}
              sub="Bank prime loan rate"
            />
          </div>

          {/* Spread callout */}
          {mortgageRates.current.rate30 !== null && keyRates.fedFunds.value !== null && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
                <div>
                  <span className="text-zinc-500">30yr Mortgage </span>
                  <span className="font-semibold text-zinc-50">
                    {fmt(mortgageRates.current.rate30)}%
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Fed Funds </span>
                  <span className="font-semibold text-zinc-50">
                    {fmt(keyRates.fedFunds.value)}%
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Spread </span>
                  <span className="font-semibold text-[var(--accent-color)]">
                    +
                    {(
                      (mortgageRates.current.rate30 ?? 0) - (keyRates.fedFunds.value ?? 0)
                    ).toFixed(2)}
                    %
                  </span>
                </div>
                {mortgageRates.current.rate15 !== null && (
                  <div>
                    <span className="text-zinc-500">30/15 Spread </span>
                    <span className="font-semibold text-zinc-300">
                      +
                      {(
                        (mortgageRates.current.rate30 ?? 0) -
                        (mortgageRates.current.rate15 ?? 0)
                      ).toFixed(2)}
                      %
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mortgage rate history chart */}
          <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] px-4 pb-4 pt-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Mortgage Rate History (Since 2020)
            </p>
            <p className="mb-1 text-[10px] text-zinc-500">
              Weekly average rates from Freddie Mac&apos;s Primary Mortgage Market Survey, via FRED.
              The <span className="text-amber-400">5/1 ARM</span> was discontinued by Freddie Mac in November 2022 — it correctly
              ends mid-chart. The <span className="text-red-400">Fed Funds</span> line shows the actual stepped path of rate changes
              by the Federal Reserve.
            </p>
            <p className="mb-4 text-[10px] text-zinc-600">
              Source: Freddie Mac / Federal Reserve via FRED (St. Louis Fed)
            </p>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={mortHistory} style={CHART_STYLE}>
                <CartesianGrid stroke="#334155" strokeOpacity={0.25} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#71717a" }}
                  tickFormatter={fmtShortDate}
                  interval="preserveStartEnd"
                  label={{ value: "Date", position: "insideBottom", offset: -2, fontSize: 10, fill: "#52525b" }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#71717a" }}
                  domain={[0, "auto"]}
                  tickFormatter={(v) => `${v}%`}
                  width={42}
                  label={{ value: "Rate (%)", angle: -90, position: "insideLeft", offset: 10, fontSize: 10, fill: "#52525b" }}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(v) => fmtDate(v as string)}
                  formatter={(v: unknown, name: unknown) => {
                    const labels: Record<string, string> = {
                      r30: "30-Yr Fixed",
                      r15: "15-Yr Fixed",
                      r5: "5/1 ARM",
                      ff: "Fed Funds",
                    };
                    return [`${(v as number).toFixed(2)}%`, labels[name as string] ?? (name as string)];
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(v) => {
                    const labels: Record<string, string> = {
                      r30: "30-Yr Fixed",
                      r15: "15-Yr Fixed",
                      r5: "5/1 ARM (disc. Nov 2022)",
                      ff: "Fed Funds Rate",
                    };
                    return labels[v] ?? v;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="r30"
                  stroke="#00c896"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  name="r30"
                />
                <Line
                  type="monotone"
                  dataKey="r15"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  name="r15"
                />
                <Line
                  type="monotone"
                  dataKey="r5"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  connectNulls
                  name="r5"
                />
                <Line
                  type="stepAfter"
                  dataKey="ff"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  dot={false}
                  connectNulls
                  name="ff"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Key benchmark rates panel */}
          <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] px-4 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Key Benchmark Rates
            </p>
            <div className="flex flex-wrap items-start gap-6">
              <div>
                <p className="text-[10px] text-zinc-500">Federal Funds Rate</p>
                <p className="text-xl font-bold text-[var(--accent-color)]">
                  {fmt(keyRates.fedFunds.value)}%
                </p>
                <p className="text-[10px] text-zinc-600">{fmtDate(keyRates.fedFunds.asOf)}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500">Bank Prime Rate</p>
                <p className="text-xl font-bold text-zinc-50">{fmt(keyRates.prime.value)}%</p>
                <p className="text-[10px] text-zinc-600">{fmtDate(keyRates.prime.asOf)}</p>
              </div>
              {keyRates.fedFunds.value !== null && mortgageRates.current.rate30 !== null && (
                <div>
                  <p className="text-[10px] text-zinc-500">Mortgage Premium over Fed Funds</p>
                  <p className="text-xl font-bold text-amber-400">
                    +
                    {(
                      (mortgageRates.current.rate30 ?? 0) - (keyRates.fedFunds.value ?? 0)
                    ).toFixed(2)}
                    %
                  </p>
                  <p className="text-[10px] text-zinc-600">30yr over Fed Funds</p>
                </div>
              )}
            </div>

            {/* Explanations */}
            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-white/10 pt-4 sm:grid-cols-3">
              <div className="rounded-lg bg-white/5 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-[var(--accent-color)]">
                  Federal Funds Rate
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-zinc-400">
                  The overnight interest rate at which banks lend reserves to each other. Set by
                  the Federal Reserve&apos;s FOMC. It&apos;s the foundational short-term rate in
                  the U.S. economy — when it moves, nearly all other borrowing rates follow.
                </p>
              </div>
              <div className="rounded-lg bg-white/5 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-blue-400">Bank Prime Rate</p>
                <p className="mt-1 text-[10px] leading-relaxed text-zinc-400">
                  The base rate banks use when pricing loans to their most creditworthy customers.
                  Historically tracks Fed Funds + 3%. It directly sets the floor for home equity
                  lines of credit (HELOCs), credit cards, and variable-rate small business loans.
                </p>
              </div>
              <div className="rounded-lg bg-white/5 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-amber-400">Mortgage Premium</p>
                <p className="mt-1 text-[10px] leading-relaxed text-zinc-400">
                  The spread between the 30-yr fixed mortgage rate and the Fed Funds rate. In
                  normal markets this runs ~1.5–2%. When lenders perceive more risk — economic
                  uncertainty, MBS market illiquidity — this spread widens, raising mortgage
                  costs even when the Fed hasn&apos;t moved rates.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: BUILDING MATERIALS ───────────────────────────────────────── */}
      {tab === "materials" && (
        <div className="space-y-4">
          {/* PPI headline cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <PpiCard label="Lumber & Wood Products (PPI)" data={ppi.lumber} />
            <PpiCard label="Iron & Steel (PPI)" data={ppi.steel} />
            <PpiCard label="Copper & Products (PPI)" data={ppi.copper} />
          </div>

          {/* PPI explanation */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-[11px] leading-relaxed text-amber-400/80">
            <span className="font-semibold">Producer Price Index (PPI)</span> measures average
            change in prices received by domestic producers. Base = 100 in the reference period
            (1982 for WPS series). Higher values mean producers are charging more, which flows
            through to construction costs. Source: Bureau of Labor Statistics via FRED.
          </div>

          {/* Combined trend chart with timeframe toggle */}
          <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] px-4 pb-4 pt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                  Building Material Price Trends
                </p>
                <p className="mt-0.5 text-[10px] text-zinc-600">
                  Monthly PPI — Lumber (WPS0811), Iron &amp; Steel (WPS1013/PCU331110), Copper (WPS1322)
                </p>
              </div>
              <TimeframeToggle
                options={["1Y", "3Y", "5Y"] as PpiRange[]}
                value={ppiRange}
                onChange={setPpiRange}
              />
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={ppiHistory} style={CHART_STYLE}>
                <CartesianGrid stroke="#334155" strokeOpacity={0.25} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#71717a" }}
                  tickFormatter={fmtShortDate}
                  interval="preserveStartEnd"
                  label={{ value: "Month", position: "insideBottom", offset: -2, fontSize: 10, fill: "#52525b" }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#71717a" }}
                  domain={["auto", "auto"]}
                  width={52}
                  label={{ value: "PPI Index", angle: -90, position: "insideLeft", offset: 10, fontSize: 10, fill: "#52525b" }}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(v) => fmtDate(v as string)}
                  formatter={(v: unknown, name: unknown) => [
                    (v as number).toFixed(1),
                    name === "lumber" ? "Lumber & Wood" : name === "steel" ? "Iron & Steel" : "Copper",
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(v) =>
                    v === "lumber" ? "Lumber & Wood" : v === "steel" ? "Iron & Steel" : "Copper"
                  }
                />
                <Line
                  type="monotone"
                  dataKey="lumber"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  name="lumber"
                />
                <Line
                  type="monotone"
                  dataKey="steel"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  name="steel"
                />
                <Line
                  type="monotone"
                  dataKey="copper"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  name="copper"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Individual sparkline charts with axes */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(
              [
                { key: "lumber" as const, label: "Lumber & Wood Products", color: "#f59e0b", unit: "WPS0811" },
                { key: "steel" as const, label: "Iron & Steel", color: "#94a3b8", unit: "WPS1013" },
                { key: "copper" as const, label: "Copper & Products", color: "#f97316", unit: "WPS1322" },
              ] as const
            ).map(({ key, label, color, unit }) => {
              const series = ppi[key];
              const recentHistory = series.history.slice(-24);
              return (
                <div
                  key={key}
                  className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] px-4 pb-4 pt-4"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold text-zinc-300">{label}</p>
                      <p className="text-[10px] text-zinc-600">{unit} · 24-month</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold tabular-nums text-zinc-50">
                        {fmt(series.current, 1)}
                      </p>
                      <p className={`text-[10px] tabular-nums ${changeColor(series.momChange, true)}`}>
                        MoM {fmtPct(series.momChange)}
                      </p>
                    </div>
                  </div>
                  {recentHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={140}>
                      <LineChart data={recentHistory} style={CHART_STYLE} margin={{ left: 4, right: 4, top: 4, bottom: 16 }}>
                        <CartesianGrid stroke="#334155" strokeOpacity={0.2} />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 9, fill: "#71717a" }}
                          tickFormatter={fmtShortDate}
                          interval="preserveStartEnd"
                          label={{ value: "Month", position: "insideBottom", offset: -4, fontSize: 9, fill: "#52525b" }}
                        />
                        <YAxis
                          tick={{ fontSize: 9, fill: "#71717a" }}
                          domain={["auto", "auto"]}
                          width={38}
                          tickFormatter={(v) => (v as number).toFixed(0)}
                          label={{ value: "Index", angle: -90, position: "insideLeft", offset: 8, fontSize: 9, fill: "#52525b" }}
                        />
                        <Tooltip
                          contentStyle={TOOLTIP_STYLE}
                          labelFormatter={(v) => fmtDate(v as string)}
                          formatter={(v: unknown) => [(v as number).toFixed(1), "PPI Index"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={color}
                          strokeWidth={1.5}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[140px] items-center justify-center text-[10px] text-zinc-600">
                      No data available
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB: CONSTRUCTION STOCKS ──────────────────────────────────────── */}
      {tab === "stocks" && (
        <div className="space-y-6">
          {/* Homebuilders */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                Homebuilders
              </p>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {stocks.homebuilders.map((s) => (
                <StockCard key={s.symbol} stock={s} />
              ))}
            </div>
          </div>

          {/* Home Improvement */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                Home Improvement &amp; Distribution
              </p>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stocks.homeImprovement.map((s) => (
                <StockCard key={s.symbol} stock={s} />
              ))}
            </div>
          </div>

          {/* Materials & Equipment */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                Materials, Aggregates &amp; Equipment
              </p>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {stocks.materials.map((s) => (
                <StockCard key={s.symbol} stock={s} />
              ))}
            </div>
          </div>

          {/* Sector summary */}
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Sector Snapshot
            </p>
            <div className="grid grid-cols-3 gap-4 text-xs">
              {(
                [
                  { label: "Homebuilders", items: stocks.homebuilders },
                  { label: "Home Improvement", items: stocks.homeImprovement },
                  { label: "Materials & Equipment", items: stocks.materials },
                ] as const
              ).map(({ label, items }) => {
                const valid = items.filter((s) => s.changePercent !== null);
                const avg =
                  valid.length > 0
                    ? valid.reduce((a, b) => a + (b.changePercent ?? 0), 0) / valid.length
                    : null;
                const gainers = valid.filter((s) => (s.changePercent ?? 0) > 0).length;
                const losers = valid.filter((s) => (s.changePercent ?? 0) < 0).length;
                return (
                  <div key={label}>
                    <p className="font-medium text-zinc-300">{label}</p>
                    <p className={`mt-1 font-bold ${changeColor(avg)}`}>{fmtPct(avg)} avg</p>
                    <p className="text-zinc-500">
                      {gainers} up · {losers} down
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stock performance chart */}
          <StockPerformanceChart />
        </div>
      )}

      {/* ── TAB: GAS PRICES ───────────────────────────────────────────────── */}
      {tab === "gas" && <GasPricesTab />}
    </div>
  );
}
