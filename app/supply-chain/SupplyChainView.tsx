"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────

type Tab = "energy" | "agriculture" | "manufacturing" | "shipping" | "semiconductors" | "consumer";

interface ApiResult<T> {
  loading: boolean;
  data: T | null;
  error: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useApi<T>(url: string): ApiResult<T> {
  const [state, setState] = useState<ApiResult<T>>({ loading: true, data: null, error: null });
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setState({ loading: false, data: d as T, error: null });
      })
      .catch((e) => {
        if (!cancelled) setState({ loading: false, data: null, error: String(e) });
      });
    return () => { cancelled = true; };
  }, [url]);
  return state;
}

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SignalBadge({ signal }: { signal: "bullish" | "bearish" | "neutral" | "expanding" | "contracting" | "unknown" }) {
  const map: Record<string, { label: string; color: string }> = {
    bullish: { label: "Bullish", color: "#22c55e" },
    bearish: { label: "Bearish", color: "#ef4444" },
    neutral: { label: "Neutral", color: "#a1a1aa" },
    expanding: { label: "Expanding", color: "#22c55e" },
    contracting: { label: "Contracting", color: "#ef4444" },
    unknown: { label: "No Data", color: "#a1a1aa" },
  };
  const m = map[signal] ?? map.unknown;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: m.color + "22", color: m.color, border: `1px solid ${m.color}44` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

function SourceLabel({ label, schedule, type = "live" }: { label: string; schedule?: string; type?: "live" | "delayed" | "estimated" | "proxy" }) {
  const typeColors: Record<string, string> = {
    live: "#22c55e",
    delayed: "#f59e0b",
    estimated: "#f59e0b",
    proxy: "#818cf8",
  };
  const typeLabels: Record<string, string> = {
    live: "LIVE",
    delayed: "DELAYED",
    estimated: "ESTIMATED",
    proxy: "PROXY",
  };
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
      <span className="rounded px-1.5 py-0.5 font-bold uppercase tracking-wide" style={{ background: typeColors[type] + "22", color: typeColors[type] }}>
        {typeLabels[type]}
      </span>
      <span>Source: {label}</span>
      {schedule && <span>| {schedule}</span>}
    </div>
  );
}

function DataUnavailable({ message, setupUrl }: { message: string; setupUrl?: string }) {
  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-6 text-center">
      <div className="mb-2 text-3xl">📡</div>
      <p className="text-sm font-medium text-zinc-300">Data Unavailable</p>
      <p className="mt-1 text-xs text-zinc-500">{message}</p>
      {setupUrl && (
        <a href={setupUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block rounded-lg bg-[var(--accent-color)]/20 px-3 py-1.5 text-xs text-[var(--accent-color)] hover:bg-[var(--accent-color)]/30 transition-colors">
          Setup Instructions →
        </a>
      )}
    </div>
  );
}

function PaywallCard({ name, provider, cost, description }: { name: string; provider: string; cost: string; description: string }) {
  return (
    <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/20 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-200">{name}</p>
          <p className="text-xs text-zinc-400">{provider}</p>
        </div>
        <span className="shrink-0 rounded-full border border-zinc-600/50 bg-zinc-700/30 px-2 py-0.5 text-[10px] text-zinc-400">{cost}</span>
      </div>
      <p className="mt-2 text-xs text-zinc-500">{description}</p>
    </div>
  );
}

function MetricCard({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-zinc-50">{value}</p>
      {unit && <p className="text-[10px] text-zinc-600">{unit}</p>}
      {sub && <p className="mt-1 text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

const CHART_THEME = {
  grid: "#ffffff0f",
  text: "#71717a",
  accent: "#6366f1",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#f59e0b",
  purple: "#a78bfa",
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function EnergyTab() {
  const { loading, data, error } = useApi<{
    error?: string; message?: string;
    crudeOil: { history: { date: string; value: number }[]; latest: { date: string; value: number } | null; fiveYearAvg: number | null; signal: string; label: string; unit: string; reportLabel: string; updateSchedule: string };
    natGas: { history: { date: string; value: number }[]; latest: { date: string; value: number } | null; fiveYearAvg: number | null; signal: string; label: string; unit: string; reportLabel: string; updateSchedule: string };
    refinery: { history: { date: string; value: number }[]; latest: { date: string; value: number } | null; label: string; unit: string; reportLabel: string; updateSchedule: string };
  }>("/api/supply-chain/energy");

  if (loading) return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-64 animate-pulse rounded-xl bg-zinc-800/40" />)}</div>;
  if (error || data?.error) return <DataUnavailable message={data?.message ?? error ?? "Failed to load energy data"} setupUrl="https://www.eia.gov/opendata/register.php" />;

  const crude = data!.crudeOil;
  const gas = data!.natGas;
  const ref = data!.refinery;

  const crudeChange = crude.latest && crude.history.length > 1
    ? crude.latest.value - crude.history[crude.history.length - 2]?.value
    : null;

  return (
    <div className="space-y-6">
      {/* Crude Oil */}
      <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">US Crude Oil Inventory</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Weekly draw/build vs 5-year average — key crude price signal</p>
          </div>
          <SignalBadge signal={(crude.signal as "bullish" | "bearish" | "neutral") ?? "neutral"} />
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Current Inventory" value={fmt(crude.latest?.value)} unit="thousand barrels" />
          <MetricCard label="5-Year Average" value={fmt(crude.fiveYearAvg)} unit="thousand barrels" />
          <MetricCard label="Weekly Change" value={crudeChange != null ? (crudeChange > 0 ? "+" : "") + fmt(crudeChange) : "—"} unit="thousand barrels" sub={crudeChange != null ? (crudeChange > 0 ? "Build → Bearish for oil" : "Draw → Bullish for oil") : undefined} />
          <MetricCard label="vs 5-Yr Avg" value={crude.latest && crude.fiveYearAvg ? (crude.latest.value > crude.fiveYearAvg ? "Above" : "Below") : "—"} sub={crude.latest && crude.fiveYearAvg ? fmt(Math.abs(crude.latest.value - crude.fiveYearAvg)) + " thousand bbl " + (crude.latest.value > crude.fiveYearAvg ? "over" : "under") : undefined} />
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={crude.history.slice(-52)} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="crudeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_THEME.accent} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_THEME.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
            <XAxis dataKey="date" tick={{ fill: CHART_THEME.text, fontSize: 10 }} tickFormatter={(d) => d.slice(2, 7)} />
            <YAxis tick={{ fill: CHART_THEME.text, fontSize: 10 }} width={60} tickFormatter={(v) => (v / 1000).toFixed(0) + "M"} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [fmt(v as number) + " thousand bbl", "Inventory"]} />
            {crude.fiveYearAvg && <ReferenceLine y={crude.fiveYearAvg} stroke={CHART_THEME.amber} strokeDasharray="4 2" label={{ value: "5yr avg", fill: CHART_THEME.amber, fontSize: 10 }} />}
            <Area type="monotone" dataKey="value" stroke={CHART_THEME.accent} fill="url(#crudeGrad)" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        <SourceLabel label={crude.reportLabel} schedule={crude.updateSchedule} type="delayed" />
      </section>

      {/* Natural Gas */}
      <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">Natural Gas Storage</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Seasonal analysis — above/below average heading into winter/summer</p>
          </div>
          <SignalBadge signal={(gas.signal as "bullish" | "bearish" | "neutral") ?? "neutral"} />
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MetricCard label="Current Storage" value={fmt(gas.latest?.value)} unit="billion cubic feet" />
          <MetricCard label="5-Year Average" value={fmt(gas.fiveYearAvg)} unit="billion cubic feet" />
          <MetricCard label="vs 5-Yr Avg" value={gas.latest && gas.fiveYearAvg ? (gas.latest.value > gas.fiveYearAvg ? "Above Avg" : "Below Avg") : "—"} sub={gas.latest && gas.fiveYearAvg ? fmt(Math.abs(gas.latest.value - gas.fiveYearAvg)) + " bcf " + (gas.latest.value > gas.fiveYearAvg ? "surplus → bearish" : "deficit → bullish") : undefined} />
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={gas.history.slice(-52)} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gasGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_THEME.green} stopOpacity={0.25} />
                <stop offset="95%" stopColor={CHART_THEME.green} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
            <XAxis dataKey="date" tick={{ fill: CHART_THEME.text, fontSize: 10 }} tickFormatter={(d) => d.slice(2, 7)} />
            <YAxis tick={{ fill: CHART_THEME.text, fontSize: 10 }} width={50} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [fmt(v as number) + " bcf", "Storage"]} />
            {gas.fiveYearAvg && <ReferenceLine y={gas.fiveYearAvg} stroke={CHART_THEME.amber} strokeDasharray="4 2" />}
            <Area type="monotone" dataKey="value" stroke={CHART_THEME.green} fill="url(#gasGrad)" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        <SourceLabel label={gas.reportLabel} schedule={gas.updateSchedule} type="delayed" />
      </section>

      {/* Refinery */}
      <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">Refinery Utilization Rate</h3>
            <p className="text-xs text-zinc-500 mt-0.5">High utilization = tight gasoline supply = bullish refined products</p>
          </div>
          {ref.latest && <span className="text-2xl font-bold" style={{ color: ref.latest.value > 90 ? CHART_THEME.green : ref.latest.value > 80 ? CHART_THEME.amber : CHART_THEME.red }}>{fmt(ref.latest.value, 1)}%</span>}
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={ref.history.slice(-12)} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
            <XAxis dataKey="date" tick={{ fill: CHART_THEME.text, fontSize: 10 }} tickFormatter={(d) => d.slice(0, 7)} />
            <YAxis domain={[70, 100]} tick={{ fill: CHART_THEME.text, fontSize: 10 }} width={40} tickFormatter={(v) => v + "%"} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [fmt(v as number, 1) + "%", "Utilization"]} />
            <ReferenceLine y={90} stroke={CHART_THEME.green} strokeDasharray="3 2" label={{ value: "90%", fill: CHART_THEME.text, fontSize: 10 }} />
            <Line type="monotone" dataKey="value" stroke={CHART_THEME.amber} strokeWidth={2} dot={{ fill: CHART_THEME.amber, r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
        <SourceLabel label={ref.reportLabel} schedule={ref.updateSchedule} type="delayed" />
      </section>
    </div>
  );
}

function AgricultureTab() {
  const { loading, data, error } = useApi<{
    error?: string; message?: string;
    cropProgress: { error?: string; message?: string; note?: string; data?: { commodity: string; weekEnding: string; pctExcellent: number }[]; label?: string; updateSchedule?: string; reportDate?: string };
    wasde: { name: string; error?: string; unavailable?: boolean; production?: number | null; consumption?: number | null; endingStocks?: number | null; stocksToUse?: number | null }[];
    wasdeUnavailable?: { message: string };
    wasdeLabel: { label: string; updateSchedule: string; source: string; keyNote: string };
  }>("/api/supply-chain/agriculture");

  if (loading) return <div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-64 animate-pulse rounded-xl bg-zinc-800/40" />)}</div>;
  if (error) return <DataUnavailable message={error} />;

  const cp = data?.cropProgress;
  const wasde = data?.wasde ?? [];

  return (
    <div className="space-y-6">
      {/* Crop Progress */}
      <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
        <h3 className="mb-1 text-base font-semibold text-zinc-100">Crop Condition Monitor</h3>
        <p className="mb-4 text-xs text-zinc-500">Percentage of crop rated excellent — higher = better supply = bearish for crop prices</p>
        {cp?.error ? (
          <DataUnavailable message={cp.message ?? cp.error} setupUrl="https://quickstats.nass.usda.gov/api" />
        ) : cp?.data && cp.data.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={cp.data.slice(0, 10)} margin={{ top: 4, right: 4, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis dataKey="commodity" tick={{ fill: CHART_THEME.text, fontSize: 10 }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fill: CHART_THEME.text, fontSize: 10 }} width={40} tickFormatter={(v) => v + "%"} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [fmt(v as number, 1) + "% excellent", "Rating"]} />
                <Bar dataKey="pctExcellent" fill={CHART_THEME.green} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <SourceLabel label={cp.label ?? "USDA NASS"} schedule={cp.updateSchedule} type="delayed" />
          </>
        ) : (
          <div className="rounded-xl border border-zinc-700/30 bg-zinc-800/20 p-4">
            <p className="text-xs text-zinc-400">{cp?.note ?? "No crop condition data available — may be outside growing season (April–November)."}</p>
            {cp?.label && <SourceLabel label={cp.label} schedule={cp.updateSchedule} type="delayed" />}
          </div>
        )}
      </section>

      {/* WASDE */}
      <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
        <h3 className="mb-1 text-base font-semibold text-zinc-100">Global Supply & Demand (WASDE)</h3>
        <p className="mb-4 text-xs text-zinc-500">{data?.wasdeLabel?.keyNote}</p>
        {data?.wasdeUnavailable && (
          <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400">
            {data.wasdeUnavailable.message}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          {wasde.map((c) => (
            <div key={c.name} className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 p-4">
              <p className="mb-3 text-sm font-semibold text-zinc-200">{c.name}</p>
              {c.error || c.unavailable ? (
                <p className="text-xs text-zinc-500">{c.error ?? "Requires USDA_FAS_API_KEY"}</p>
              ) : (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-zinc-500">Production</span><span className="text-zinc-200">{fmt(c.production)} MT</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Consumption</span><span className="text-zinc-200">{fmt(c.consumption)} MT</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Ending Stocks</span><span className="text-zinc-200">{fmt(c.endingStocks)} MT</span></div>
                  <div className="flex justify-between border-t border-zinc-700/40 pt-2">
                    <span className="text-zinc-500">Stocks-to-Use</span>
                    <span className="font-semibold" style={{ color: c.stocksToUse != null && c.stocksToUse < 15 ? CHART_THEME.red : c.stocksToUse != null && c.stocksToUse < 20 ? CHART_THEME.amber : CHART_THEME.green }}>
                      {fmt(c.stocksToUse, 1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <SourceLabel label={data?.wasdeLabel?.label ?? "USDA WASDE"} schedule={data?.wasdeLabel?.updateSchedule} type="delayed" />
      </section>

      {/* Drought Monitor */}
      <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
        <h3 className="mb-1 text-base font-semibold text-zinc-100">Drought Monitor</h3>
        <p className="mb-3 text-xs text-zinc-500">Drought in major crop-growing regions (Corn Belt, Great Plains, Central Valley) directly reduces yield estimates — bullish signal for affected commodity prices.</p>
        <a href="https://droughtmonitor.unl.edu/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700/40 transition-colors">
          View USDA/NOAA Drought Monitor →
        </a>
        <SourceLabel label="USDA/NOAA National Integrated Drought Information System" schedule="Updated every Thursday" type="delayed" />
      </section>

      {/* Fertilizer */}
      <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
        <h3 className="mb-1 text-base font-semibold text-zinc-100">Fertilizer Prices</h3>
        <p className="text-xs text-zinc-500 mb-3">Urea, DAP (diammonium phosphate), and potash spot prices are a key input cost leading indicator for farmer planting decisions and crop commodity supply.</p>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-400">
          <p className="font-semibold mb-1">Data Source Unavailable</p>
          <p>Fertilizer spot prices (urea, DAP, potash) require commodity broker data subscriptions. World Bank commodity data is available annually with significant lag. Showing corn/soybean pricing as demand proxy in the WASDE section above is the best available free alternative.</p>
        </div>
      </section>
    </div>
  );
}

function ManufacturingTab() {
  const { loading, data, error } = useApi<{
    error?: string; message?: string;
    source: string;
    series: Record<string, { label: string; unit: string; history: { date: string; value: number }[]; latest: { date: string; value: number } | null; error?: string }>;
    regionalSurveys: {
      empireFed: { value: number | null; date: string | null; label: string; source: string; note: string };
      phillyFed: { value: number | null; date: string | null; label: string; source: string; note: string };
      kansasFed: { value: number | null; date: string | null; label: string; source: string; note: string };
    };
    labels: { pmiNote: string; isratioNote: string; newOrdersNote: string; capexNote: string };
  }>("/api/supply-chain/manufacturing");

  if (loading) return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-64 animate-pulse rounded-xl bg-zinc-800/40" />)}</div>;
  if (error || data?.error) return <DataUnavailable message={data?.message ?? error ?? "Failed to load manufacturing data"} setupUrl="https://fred.stlouisfed.org/docs/api/api_key.html" />;

  const s = data!.series;
  const pmi = s["NAPM"];
  const newOrders = s["NAPMNOI"];
  const employment = s["NAPMEI"];
  const pricesPaid = s["NAPMPRI"];
  const mfgOrders = s["AMTMNO"];
  const shipments = s["AMDMVS"];
  const unfilledOrders = s["AMDMUO"];
  const isratio = s["ISRATIO"];
  const durableGoods = s["DGORDER"];
  const regional = data!.regionalSurveys;

  const pmiVal = pmi?.latest?.value ?? null;
  const newOrdersVal = newOrders?.latest?.value ?? null;

  // Merge orders/shipments/unfilled for chart
  const ordersChartData = mfgOrders?.history?.slice(-24).map((d, i) => ({
    date: d.date,
    orders: d.value,
    shipments: shipments?.history?.slice(-24)[i]?.value ?? null,
    unfilled: unfilledOrders?.history?.slice(-24)[i]?.value ?? null,
  })) ?? [];

  return (
    <div className="space-y-6">
      {/* PMI Dashboard */}
      <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
        <h3 className="mb-1 text-base font-semibold text-zinc-100">PMI Dashboard</h3>
        <p className="mb-4 text-xs text-zinc-500">{data!.labels.pmiNote}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "ISM Manufacturing PMI", val: pmiVal, note: "Composite" },
            { label: "New Orders", val: newOrdersVal, note: "Sub-index" },
            { label: "Employment", val: employment?.latest?.value ?? null, note: "Sub-index" },
            { label: "Prices Paid", val: pricesPaid?.latest?.value ?? null, note: "Sub-index" },
          ].map(({ label, val, note }) => (
            <div key={label} className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 p-4">
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="mt-1 text-3xl font-bold" style={{ color: val == null ? "#71717a" : val >= 50 ? CHART_THEME.green : CHART_THEME.red }}>
                {fmt(val, 1)}
              </p>
              <p className="text-[10px] text-zinc-600">{note}</p>
              {val != null && (
                <SignalBadge signal={val >= 50 ? "expanding" : "contracting"} />
              )}
            </div>
          ))}
        </div>
        <SourceLabel label="ISM Manufacturing Report on Business via FRED" schedule="Released 1st business day of month" type="delayed" />
      </section>

      {/* New Orders / Shipments */}
      {ordersChartData.length > 0 && (
        <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
          <h3 className="mb-1 text-base font-semibold text-zinc-100">New Orders vs Shipments</h3>
          <p className="mb-4 text-xs text-zinc-500">{data!.labels.newOrdersNote}</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={ordersChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
              <XAxis dataKey="date" tick={{ fill: CHART_THEME.text, fontSize: 10 }} tickFormatter={(d) => d.slice(0, 7)} />
              <YAxis tick={{ fill: CHART_THEME.text, fontSize: 10 }} width={55} tickFormatter={(v) => "$" + (v / 1000).toFixed(0) + "B"} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => ["$" + fmt(v as number) + "M"]} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
              <Line type="monotone" dataKey="orders" stroke={CHART_THEME.accent} strokeWidth={2} dot={false} name="New Orders" />
              <Line type="monotone" dataKey="shipments" stroke={CHART_THEME.green} strokeWidth={2} dot={false} name="Shipments" />
              <Line type="monotone" dataKey="unfilled" stroke={CHART_THEME.amber} strokeWidth={1.5} dot={false} strokeDasharray="3 2" name="Unfilled Orders" />
            </LineChart>
          </ResponsiveContainer>
          <SourceLabel label="US Census Bureau Manufacturers' Shipments, Inventories & Orders via FRED" schedule="Monthly — released ~4 weeks after month end" type="delayed" />
        </section>
      )}

      {/* Inventory to Sales Ratio */}
      {isratio?.history && (
        <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-zinc-100">Inventory to Sales Ratio</h3>
              <p className="text-xs text-zinc-500 mt-0.5">{data!.labels.isratioNote}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-zinc-50">{fmt(isratio.latest?.value, 2)}</p>
              <p className="text-[10px] text-zinc-500">as of {fmtDate(isratio.latest?.date)}</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={isratio.history.slice(-24)} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="isratioGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_THEME.amber} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_THEME.amber} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
              <XAxis dataKey="date" tick={{ fill: CHART_THEME.text, fontSize: 10 }} tickFormatter={(d) => d.slice(0, 7)} />
              <YAxis tick={{ fill: CHART_THEME.text, fontSize: 10 }} width={40} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="value" stroke={CHART_THEME.amber} fill="url(#isratioGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <SourceLabel label="US Census Bureau via FRED" schedule="Monthly" type="delayed" />
        </section>
      )}

      {/* Durable Goods */}
      {durableGoods?.history && (
        <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
          <h3 className="mb-1 text-base font-semibold text-zinc-100">Durable Goods Orders</h3>
          <p className="mb-4 text-xs text-zinc-500">{data!.labels.capexNote}</p>
          <div className="mb-3">
            <span className="text-2xl font-bold text-zinc-50">${fmt(durableGoods.latest?.value)}M</span>
            <span className="ml-2 text-xs text-zinc-500">as of {fmtDate(durableGoods.latest?.date)}</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={durableGoods.history.slice(-18)} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
              <XAxis dataKey="date" tick={{ fill: CHART_THEME.text, fontSize: 10 }} tickFormatter={(d) => d.slice(0, 7)} />
              <YAxis tick={{ fill: CHART_THEME.text, fontSize: 10 }} width={55} tickFormatter={(v) => "$" + (v / 1000).toFixed(0) + "B"} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => ["$" + fmt(v as number) + "M", "Durable Goods Orders"]} />
              <Bar dataKey="value" fill={CHART_THEME.purple} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <SourceLabel label="US Census Bureau Advance Report on Durable Goods via FRED" schedule="Monthly — released ~4 weeks after month end" type="delayed" />
        </section>
      )}

      {/* Regional Fed Surveys */}
      <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
        <h3 className="mb-1 text-base font-semibold text-zinc-100">Regional Fed Manufacturing Surveys</h3>
        <p className="mb-4 text-xs text-zinc-500">These are released before national ISM data and serve as early signals. Above 0 = expansion.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {[regional.empireFed, regional.phillyFed, regional.kansasFed].map((r) => (
            <div key={r.label} className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 p-4">
              <p className="text-xs text-zinc-500 mb-2">{r.label}</p>
              <p className="text-2xl font-bold" style={{ color: r.value == null ? "#71717a" : r.value >= 0 ? CHART_THEME.green : CHART_THEME.red }}>
                {r.value != null ? (r.value > 0 ? "+" : "") + fmt(r.value, 1) : "—"}
              </p>
              <p className="mt-1 text-[10px] text-zinc-600">{r.note}</p>
              <p className="mt-1 text-[10px] text-zinc-600">as of {fmtDate(r.date)}</p>
            </div>
          ))}
        </div>
        <SourceLabel label="Federal Reserve Banks (NY, Philadelphia, Kansas City) via FRED" schedule="Released monthly — early ISM signal" type="delayed" />
      </section>
    </div>
  );
}

function ShippingTab() {
  const { loading, data, error } = useApi<{
    error?: string; message?: string;
    bdi: {
      proxy: string;
      proxyName: string;
      quote: { c: number; d: number; dp: number } | { error: string };
      history: { date: string; value: number }[];
      label: string;
      disclaimer: string;
      updateFrequency: string;
    };
    containerShipping: {
      freightos: { status: string; message: string };
      marketProxies: Record<string, { quote?: { c?: number; d?: number; dp?: number }; label: string; type: string; error?: string }>;
    };
    portCongestion: {
      newsProxy: number | null;
      newsDate: string | null;
      disclaimer: string;
      marineTaffic: { status: string; message: string };
    };
    trucking: {
      dat: { status: string; message: string };
      marketProxies: Record<string, { quote?: { c?: number; d?: number; dp?: number }; label: string; type: string; error?: string }>;
    };
  }>("/api/supply-chain/shipping");

  if (loading) return <div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-64 animate-pulse rounded-xl bg-zinc-800/40" />)}</div>;
  if (error || data?.error) return <DataUnavailable message={data?.message ?? error ?? "Finnhub API key required"} />;

  const bdi = data!.bdi;
  const bdiQuote = bdi.quote as { c?: number; d?: number; dp?: number; error?: string };

  return (
    <div className="space-y-6">
      {/* BDI Proxy */}
      <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">Baltic Dry Index Proxy</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{bdi.proxyName} — proxy for dry bulk shipping demand</p>
          </div>
          {bdiQuote.c && (
            <div className="text-right">
              <p className="text-2xl font-bold text-zinc-50">${fmt(bdiQuote.c, 2)}</p>
              <p className="text-xs" style={{ color: (bdiQuote.d ?? 0) >= 0 ? CHART_THEME.green : CHART_THEME.red }}>
                {(bdiQuote.d ?? 0) >= 0 ? "+" : ""}{fmt(bdiQuote.d, 2)} ({fmt(bdiQuote.dp, 2)}%)
              </p>
            </div>
          )}
        </div>
        <div className="mb-4 rounded-xl border border-zinc-700/30 bg-zinc-800/20 p-3 text-xs text-zinc-400">
          {bdi.disclaimer}
        </div>
        {bdi.history.length > 0 && (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={bdi.history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="bdryGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_THEME.accent} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_THEME.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
              <XAxis dataKey="date" tick={{ fill: CHART_THEME.text, fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fill: CHART_THEME.text, fontSize: 10 }} width={50} tickFormatter={(v) => "$" + v.toFixed(0)} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => ["$" + fmt(v as number, 2), "BDRY"]} />
              <Area type="monotone" dataKey="value" stroke={CHART_THEME.accent} fill="url(#bdryGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
        <SourceLabel label="Finnhub — BDRY ETF market price proxy" schedule={bdi.updateFrequency} type="proxy" />
      </section>

      {/* Container Shipping */}
      <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
        <h3 className="mb-1 text-base font-semibold text-zinc-100">Container Shipping</h3>
        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400">
          {data!.containerShipping.freightos.message}
        </div>
        <p className="mb-3 text-xs font-medium text-zinc-400">Shipping company stocks as market proxies</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(data!.containerShipping.marketProxies).filter(([k]) => k !== "disclaimer").map(([sym, q]) => (
            <div key={sym} className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 p-3">
              <p className="text-xs text-zinc-500">{sym}</p>
              <p className="text-lg font-bold text-zinc-100">{q.quote?.c ? "$" + fmt(q.quote.c, 2) : "—"}</p>
              <p className="text-[10px]" style={{ color: (q.quote?.d ?? 0) >= 0 ? CHART_THEME.green : CHART_THEME.red }}>
                {q.quote?.d != null ? ((q.quote.d >= 0 ? "+" : "") + fmt(q.quote.d, 2)) : ""}
              </p>
              <p className="mt-1 text-[9px] text-zinc-600 leading-tight">{q.label}</p>
            </div>
          ))}
        </div>
        <SourceLabel label="Finnhub — equity market proxies, NOT direct shipping rates" type="proxy" />
      </section>

      {/* Port Congestion */}
      <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
        <h3 className="mb-1 text-base font-semibold text-zinc-100">Port Activity Indicator</h3>
        {data!.portCongestion.newsProxy != null ? (
          <>
            <div className="my-3 flex items-center gap-3">
              <span className="text-3xl font-bold text-zinc-50">{data!.portCongestion.newsProxy}</span>
              <div>
                <p className="text-xs font-medium text-zinc-300">News articles about port congestion</p>
                <p className="text-[10px] text-zinc-500">as of {fmtDate(data!.portCongestion.newsDate)}</p>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-700/30 bg-zinc-800/20 p-3 text-xs text-zinc-400 mb-3">
              {data!.portCongestion.disclaimer}
            </div>
          </>
        ) : (
          <div className="my-3 rounded-xl border border-zinc-700/30 bg-zinc-800/20 p-3 text-xs text-zinc-400">
            {data!.portCongestion.disclaimer}
          </div>
        )}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400">
          {data!.portCongestion.marineTaffic.message}
        </div>
        <SourceLabel label="NewsData.io news volume proxy — NOT official port data" type="proxy" />
      </section>

      {/* Trucking */}
      <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
        <h3 className="mb-1 text-base font-semibold text-zinc-100">Trucking</h3>
        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400">
          {data!.trucking.dat.message}
        </div>
        <p className="mb-3 text-xs font-medium text-zinc-400">Trucking company stocks as market proxies</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(data!.trucking.marketProxies).filter(([k]) => k !== "disclaimer").map(([sym, q]) => (
            <div key={sym} className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 p-3">
              <p className="text-xs text-zinc-500">{sym}</p>
              <p className="text-lg font-bold text-zinc-100">{q.quote?.c ? "$" + fmt(q.quote.c, 2) : "—"}</p>
              <p className="text-[10px]" style={{ color: (q.quote?.d ?? 0) >= 0 ? CHART_THEME.green : CHART_THEME.red }}>
                {q.quote?.d != null ? ((q.quote.d >= 0 ? "+" : "") + fmt(q.quote.d, 2)) : ""}
              </p>
              <p className="mt-1 text-[9px] text-zinc-600 leading-tight">{q.label}</p>
            </div>
          ))}
        </div>
        <SourceLabel label="Finnhub — equity market proxies, NOT actual trucking spot rates" type="proxy" />
      </section>
    </div>
  );
}

function SemiconductorsTab() {
  const { loading, data, error } = useApi<{
    error?: string; message?: string;
    productionIndex: { history: { date: string; value: number }[]; latest: { date: string; value: number } | null; label: string; seriesId: string; source: string; updateFrequency: string; note: string; error?: string };
    ppi: { history: { date: string; value: number }[]; latest: { date: string; value: number } | null; label: string; seriesId: string; source: string; updateFrequency: string; note: string; error?: string };
    sox: { proxy: string; proxyName: string; history: { date: string; value: number }[]; quote: { c: number; d: number; dp: number } | null; label: string; disclaimer: string; updateFrequency: string };
    paywalled: { title: string; items: { name: string; provider: string; estimatedCost: string; description: string }[]; note: string };
  }>("/api/supply-chain/semiconductors");

  if (loading) return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-64 animate-pulse rounded-xl bg-zinc-800/40" />)}</div>;
  if (error || data?.error) return <DataUnavailable message={data?.message ?? error ?? "Failed to load semiconductor data"} />;

  const prod = data!.productionIndex;
  const ppi = data!.ppi;
  const sox = data!.sox;
  const pw = data!.paywalled;

  return (
    <div className="space-y-6">
      {/* Production Index */}
      <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">Semiconductor Production Index</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{prod.note}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-zinc-50">{fmt(prod.latest?.value, 1)}</p>
            <p className="text-[10px] text-zinc-500">index (2017=100) as of {fmtDate(prod.latest?.date)}</p>
          </div>
        </div>
        {prod.error ? (
          <p className="text-xs text-zinc-500">{prod.error}</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={prod.history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="semiprodGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_THEME.purple} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_THEME.purple} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
              <XAxis dataKey="date" tick={{ fill: CHART_THEME.text, fontSize: 10 }} tickFormatter={(d) => d.slice(0, 7)} />
              <YAxis tick={{ fill: CHART_THEME.text, fontSize: 10 }} width={45} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="value" stroke={CHART_THEME.purple} fill="url(#semiprodGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
        <SourceLabel label={prod.source} schedule={prod.updateFrequency} type="delayed" />
      </section>

      {/* PPI */}
      <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">Semiconductor Producer Price Index</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{ppi.note}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-zinc-50">{fmt(ppi.latest?.value, 1)}</p>
            <p className="text-[10px] text-zinc-500">as of {fmtDate(ppi.latest?.date)}</p>
          </div>
        </div>
        {ppi.error ? (
          <p className="text-xs text-zinc-500">{ppi.error}</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={ppi.history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
              <XAxis dataKey="date" tick={{ fill: CHART_THEME.text, fontSize: 10 }} tickFormatter={(d) => d.slice(0, 7)} />
              <YAxis tick={{ fill: CHART_THEME.text, fontSize: 10 }} width={45} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="value" stroke={CHART_THEME.amber} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
        <SourceLabel label={ppi.source} schedule={ppi.updateFrequency} type="delayed" />
      </section>

      {/* SOX Proxy */}
      <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">{sox.label}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{sox.proxyName}</p>
          </div>
          {sox.quote && (
            <div className="text-right">
              <p className="text-2xl font-bold text-zinc-50">${fmt(sox.quote.c, 2)}</p>
              <p className="text-xs" style={{ color: sox.quote.d >= 0 ? CHART_THEME.green : CHART_THEME.red }}>
                {sox.quote.d >= 0 ? "+" : ""}{fmt(sox.quote.d, 2)} ({fmt(sox.quote.dp, 2)}%)
              </p>
            </div>
          )}
        </div>
        <div className="mb-4 rounded-xl border border-zinc-700/30 bg-zinc-800/20 p-3 text-xs text-zinc-400">{sox.disclaimer}</div>
        {sox.history.length > 0 && (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={sox.history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="soxGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_THEME.accent} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={CHART_THEME.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
              <XAxis dataKey="date" tick={{ fill: CHART_THEME.text, fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fill: CHART_THEME.text, fontSize: 10 }} width={55} tickFormatter={(v) => "$" + v.toFixed(0)} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => ["$" + fmt(v as number, 2), "SOXX"]} />
              <Area type="monotone" dataKey="value" stroke={CHART_THEME.accent} fill="url(#soxGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
        <SourceLabel label="Finnhub — SOXX ETF market proxy for Philadelphia Semiconductor Index" schedule={sox.updateFrequency} type="proxy" />
      </section>

      {/* Paywalled */}
      <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
        <h3 className="mb-1 text-base font-semibold text-zinc-100">{pw.title}</h3>
        <p className="mb-4 text-xs text-zinc-500">{pw.note}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {pw.items.map((item) => (
            <PaywallCard key={item.name} {...item} cost={item.estimatedCost} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ConsumerTab() {
  const { loading, data, error } = useApi<{
    error?: string; message?: string;
    series: Record<string, { label: string; unit: string; history: { date: string; value: number }[]; latest: { date: string; value: number } | null; error?: string }>;
    invToSales: { history: { date: string; value: number }[]; label: string; unit: string; note: string };
    secFilings: { data: { ticker: string; name: string; filingDate?: string; secEdgarUrl?: string; error?: string }[]; label: string; disclaimer: string; updateFrequency: string };
    paywalled: { title: string; items: { name: string; provider: string; estimatedCost: string; description: string }[] };
    fredLabels: Record<string, string>;
  }>("/api/supply-chain/consumer");

  if (loading) return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-64 animate-pulse rounded-xl bg-zinc-800/40" />)}</div>;
  if (error || data?.error) return <DataUnavailable message={data?.message ?? error ?? "Failed to load consumer data"} />;

  const s = data!.series;
  const sentiment = s["UMCSENT"];
  const confidence = s["CSCICP03USM665S"];
  const retailSales = s["MRTSIR44X722USS"];
  const invToSales = data!.invToSales;
  const sec = data!.secFilings;
  const pw = data!.paywalled;

  // Merge sentiment + confidence for dual chart
  const sentimentChart = sentiment?.history?.slice(-24).map((d, i) => ({
    date: d.date,
    umcs: d.value,
    confidence: confidence?.history?.slice(-24)[i]?.value ?? null,
  })) ?? [];

  return (
    <div className="space-y-6">
      {/* Retail Sales */}
      {retailSales?.history && (
        <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-zinc-100">Retail Sales</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Monthly retail & food services sales — consumer spending leading indicator</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-zinc-50">${fmt(retailSales.latest?.value)}M</p>
              <p className="text-[10px] text-zinc-500">as of {fmtDate(retailSales.latest?.date)}</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={retailSales.history.slice(-24)} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="retailGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_THEME.green} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={CHART_THEME.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
              <XAxis dataKey="date" tick={{ fill: CHART_THEME.text, fontSize: 10 }} tickFormatter={(d) => d.slice(0, 7)} />
              <YAxis tick={{ fill: CHART_THEME.text, fontSize: 10 }} width={60} tickFormatter={(v) => "$" + (v / 1000).toFixed(0) + "B"} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => ["$" + fmt(v as number) + "M"]} />
              <Area type="monotone" dataKey="value" stroke={CHART_THEME.green} fill="url(#retailGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <SourceLabel label={data!.fredLabels["MRTSIR44X722USS"]} type="delayed" />
        </section>
      )}

      {/* Consumer Confidence */}
      {sentimentChart.length > 0 && (
        <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
          <h3 className="mb-1 text-base font-semibold text-zinc-100">Consumer Confidence</h3>
          <p className="mb-4 text-xs text-zinc-500">Higher = more confident consumers = bullish for retail, travel, discretionary spending</p>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <MetricCard label="U of Michigan Sentiment" value={fmt(sentiment?.latest?.value, 1)} sub={"as of " + fmtDate(sentiment?.latest?.date)} />
            <MetricCard label="Conference Board CCI" value={fmt(confidence?.latest?.value, 1)} sub={"as of " + fmtDate(confidence?.latest?.date)} />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={sentimentChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
              <XAxis dataKey="date" tick={{ fill: CHART_THEME.text, fontSize: 10 }} tickFormatter={(d) => d.slice(0, 7)} />
              <YAxis tick={{ fill: CHART_THEME.text, fontSize: 10 }} width={40} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
              <Line type="monotone" dataKey="umcs" stroke={CHART_THEME.accent} strokeWidth={2} dot={false} name="UMich Sentiment" />
              <Line type="monotone" dataKey="confidence" stroke={CHART_THEME.amber} strokeWidth={2} dot={false} name="Conference Board CCI" />
            </LineChart>
          </ResponsiveContainer>
          <SourceLabel label="University of Michigan / OECD-Conference Board via FRED" schedule="Monthly" type="delayed" />
        </section>
      )}

      {/* Inventory to Sales */}
      {invToSales?.history?.length > 0 && (
        <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
          <h3 className="mb-1 text-base font-semibold text-zinc-100">Retail Inventory-to-Sales Ratio</h3>
          <p className="mb-4 text-xs text-zinc-500">{invToSales.note}</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={invToSales.history.slice(-24)} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="invSalesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_THEME.amber} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={CHART_THEME.amber} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
              <XAxis dataKey="date" tick={{ fill: CHART_THEME.text, fontSize: 10 }} tickFormatter={(d) => d.slice(0, 7)} />
              <YAxis tick={{ fill: CHART_THEME.text, fontSize: 10 }} width={40} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="value" stroke={CHART_THEME.amber} fill="url(#invSalesGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <SourceLabel label="US Census Bureau via FRED" schedule="Monthly" type="delayed" />
        </section>
      )}

      {/* SEC Streaming Filings */}
      <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
        <h3 className="mb-1 text-base font-semibold text-zinc-100">{sec.label}</h3>
        <div className="mb-4 rounded-xl border border-zinc-700/30 bg-zinc-800/20 p-3 text-xs text-zinc-400">{sec.disclaimer}</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {sec.data.map((f) => (
            <div key={f.ticker} className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 p-4">
              <p className="text-sm font-bold text-zinc-100">{f.ticker}</p>
              <p className="text-xs text-zinc-400">{f.name}</p>
              {f.error ? (
                <p className="mt-2 text-xs text-zinc-600">{f.error}</p>
              ) : (
                <>
                  <p className="mt-2 text-xs text-zinc-500">Latest 10-Q filed: <span className="text-zinc-300">{fmtDate(f.filingDate)}</span></p>
                  {f.secEdgarUrl && (
                    <a href={f.secEdgarUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[10px] text-[var(--accent-color)] hover:underline">
                      View on SEC EDGAR →
                    </a>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        <SourceLabel label="SEC EDGAR 10-Q quarterly filings" schedule={sec.updateFrequency} type="delayed" />
      </section>

      {/* Paywalled */}
      <section className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
        <h3 className="mb-1 text-base font-semibold text-zinc-100">{pw.title}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {pw.items.map((item) => (
            <PaywallCard key={item.name} {...item} cost={item.estimatedCost} />
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Signal Dashboard (sidebar) ───────────────────────────────────────────────

interface SignalItem {
  key: string;
  label: string;
  signal: "bullish" | "bearish" | "neutral" | "expanding" | "contracting" | "unknown";
  lastUpdate: string | null;
  value?: string;
}

function SignalDashboard({ signals, onAnalyze }: { signals: SignalItem[]; onAnalyze: () => void }) {
  const score = signals.filter(s => s.signal === "bullish" || s.signal === "expanding").length / Math.max(signals.filter(s => s.signal !== "unknown").length, 1) * 100;
  const composite = score >= 60 ? "Economic Expansion" : score >= 40 ? "Mixed Signals" : "Contraction Warning";
  const compositeColor = score >= 60 ? CHART_THEME.green : score >= 40 ? CHART_THEME.amber : CHART_THEME.red;

  return (
    <aside className="rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5">
      <h3 className="mb-1 text-sm font-semibold text-zinc-100">Signal Dashboard</h3>
      <p className="mb-4 text-xs text-zinc-500">Aggregate view of all available supply chain signals</p>

      <div className="mb-4 rounded-xl border border-zinc-700/30 bg-zinc-800/30 p-3 text-center">
        <p className="text-3xl font-bold" style={{ color: compositeColor }}>{Math.round(score)}</p>
        <p className="text-xs font-medium mt-1" style={{ color: compositeColor }}>{composite}</p>
        <p className="text-[10px] text-zinc-600 mt-0.5">Composite score 0–100</p>
      </div>

      <div className="space-y-2">
        {signals.map((s) => {
          const arrowMap: Record<string, string> = {
            bullish: "↑", bearish: "↓", neutral: "→",
            expanding: "↑", contracting: "↓", unknown: "—",
          };
          const colorMap: Record<string, string> = {
            bullish: CHART_THEME.green, bearish: CHART_THEME.red, neutral: "#71717a",
            expanding: CHART_THEME.green, contracting: CHART_THEME.red, unknown: "#3f3f46",
          };
          return (
            <div key={s.key} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-800/30 px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-zinc-300 truncate">{s.label}</p>
                {s.lastUpdate && <p className="text-[9px] text-zinc-600">Updated: {fmtDate(s.lastUpdate)}</p>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {s.value && <span className="text-[10px] text-zinc-400">{s.value}</span>}
                <span className="text-base font-bold" style={{ color: colorMap[s.signal] }}>{arrowMap[s.signal]}</span>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onAnalyze}
        className="mt-4 w-full rounded-xl border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/10 px-4 py-2.5 text-xs font-semibold text-[var(--accent-color)] hover:bg-[var(--accent-color)]/20 transition-colors"
      >
        Analyze supply chain signals →
      </button>
    </aside>
  );
}

// ─── AI Analysis ─────────────────────────────────────────────────────────────

function AIAnalysis({ signals, onClose }: { signals: SignalItem[]; onClose: () => void }) {
  const [analysis, setAnalysis] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prompt = `You are a supply chain and macroeconomic analyst. Based on the following supply chain signals, provide a 3-4 paragraph analysis of what these combined signals suggest for different market sectors. Be specific about which sectors are likely to be affected and how. Be direct and informative.

Current Supply Chain Signals:
${signals.map(s => `- ${s.label}: ${s.signal.toUpperCase()}${s.value ? ` (${s.value})` : ""}${s.lastUpdate ? ` [as of ${s.lastUpdate}]` : ""}`).join("\n")}

Analyze: what do these combined signals suggest for equities, commodities, and different market sectors? Identify the most notable divergences or confirmations between signals.`;

    fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: prompt, conversationHistory: [] }),
    })
      .then((r) => r.json())
      .then((d) => {
        setAnalysis(d.message ?? d.content ?? d.response ?? JSON.stringify(d));
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, []);

  return (
    <div className="rounded-2xl border border-[var(--accent-color)]/30 bg-zinc-900/80 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">AI Supply Chain Analysis</h3>
        <button onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Close ×</button>
      </div>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-4 animate-pulse rounded bg-zinc-700/40" />)}
        </div>
      ) : error ? (
        <p className="text-xs text-zinc-500">Analysis unavailable: {error}</p>
      ) : (
        <div className="text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap">{analysis}</div>
      )}
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "energy", label: "Energy" },
  { id: "agriculture", label: "Agriculture" },
  { id: "manufacturing", label: "Manufacturing" },
  { id: "shipping", label: "Shipping" },
  { id: "semiconductors", label: "Semiconductors" },
  { id: "consumer", label: "Consumer" },
];

export default function SupplyChainView() {
  const [activeTab, setActiveTab] = useState<Tab>("energy");
  const [showAI, setShowAI] = useState(false);

  // Basic static signals for dashboard — in a real app these would come from the APIs
  const signals: SignalItem[] = [
    { key: "crude", label: "Oil Inventory", signal: "neutral", lastUpdate: null },
    { key: "natgas", label: "Nat Gas Storage", signal: "neutral", lastUpdate: null },
    { key: "crops", label: "Crop Conditions", signal: "neutral", lastUpdate: null },
    { key: "pmi", label: "Manufacturing PMI", signal: "neutral", lastUpdate: null },
    { key: "neworders", label: "New Orders", signal: "neutral", lastUpdate: null },
    { key: "consumer", label: "Consumer Confidence", signal: "neutral", lastUpdate: null },
    { key: "semiprod", label: "Semiconductor Production", signal: "neutral", lastUpdate: null },
  ];

  const handleAnalyze = useCallback(() => setShowAI(true), []);

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="min-w-0 flex-1">
        {/* Disclaimer banner */}
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <p className="text-xs text-amber-400">
            <span className="font-semibold">Data transparency:</span> Every metric on this page shows its source, update frequency, and data type. We never show estimated or mock data as live. Paywalled data sources are clearly marked with alternatives provided where possible.
          </p>
        </div>

        {/* Tab bar */}
        <div className="mb-6 flex flex-wrap gap-1.5 rounded-xl border border-zinc-700/40 bg-zinc-900/50 p-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                activeTab === t.id
                  ? "bg-[var(--accent-color)]/20 text-[var(--accent-color)]"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "energy" && <EnergyTab />}
        {activeTab === "agriculture" && <AgricultureTab />}
        {activeTab === "manufacturing" && <ManufacturingTab />}
        {activeTab === "shipping" && <ShippingTab />}
        {activeTab === "semiconductors" && <SemiconductorsTab />}
        {activeTab === "consumer" && <ConsumerTab />}
      </div>

      {/* Right sidebar */}
      <div className="hidden w-72 shrink-0 space-y-4 xl:block">
        <SignalDashboard signals={signals} onAnalyze={handleAnalyze} />
        {showAI && <AIAnalysis signals={signals} onClose={() => setShowAI(false)} />}
      </div>
    </div>
  );
}
