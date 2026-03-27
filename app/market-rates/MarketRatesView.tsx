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
  backgroundColor: "#0F1520",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  fontSize: 12,
  color: "#e4e4e7",
};

type Tab = "rates" | "materials" | "stocks";
type PpiRange = "1Y" | "3Y" | "5Y";
type StockRange = "1W" | "1M" | "3M" | "YTD" | "1Y";

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
    <div className="rounded-2xl border border-white/10 bg-[#050713] px-4 pb-4 pt-4">
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
          <div className="rounded-2xl border border-white/10 bg-[#050713] px-4 pb-4 pt-4">
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
          <div className="rounded-2xl border border-white/10 bg-[#050713] px-4 py-4">
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
          <div className="rounded-2xl border border-white/10 bg-[#050713] px-4 pb-4 pt-4">
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
                  className="rounded-2xl border border-white/10 bg-[#050713] px-4 pb-4 pt-4"
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
    </div>
  );
}
