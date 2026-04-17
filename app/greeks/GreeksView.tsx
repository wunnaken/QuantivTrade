"use client";

import React, { useState, useEffect, useCallback, useRef, useReducer, Component, type ReactNode } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip as RechartTooltip,
  ResponsiveContainer, ReferenceLine, Cell, ComposedChart, Area,
} from "recharts";

// ─── Error Boundary ──────────────────────────────────────────────────────────

class SectionErrorBoundary extends Component<{ name: string; children: ReactNode }, { hasError: boolean }> {
  constructor(props: { name: string; children: ReactNode }) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-center">
        <p className="text-xs font-medium text-red-400">Failed to render {this.props.name}</p>
        <button onClick={() => this.setState({ hasError: false })} className="mt-2 rounded-lg bg-white/10 px-3 py-1.5 text-[10px] text-zinc-300 hover:bg-white/15">Retry</button>
      </div>
    );
    return this.props.children;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ChainEntry = {
  strike: number; lastPrice: number; bid: number; ask: number;
  volume: number; oi: number; iv: number;
  delta: number; gamma: number; theta: number; vega: number; rho: number;
  itm: boolean;
};

type GreeksData = {
  ticker: string; spot: number;
  quote: { price: number; change: number; changePct: number; volume: number };
  expirations: number[];
  selectedExpiration: number;
  daysToExpiry: number;
  chain: { calls: ChainEntry[]; puts: ChainEntry[] };
  maxPain: number;
  putCallRatio: { byOI: number; byVolume: number };
  gex: Array<{ strike: number; value: number }>;
  dex: Array<{ strike: number; value: number }>;
  oiByStrike: Array<{ strike: number; callOI: number; putOI: number }>;
  ivSkew: Array<{ strike: number; callIV: number | null; putIV: number | null }>;
  termStructure: Array<{ date: string; daysOut: number; iv: number }>;
  volSurface: Array<{ date: string; daysOut: number; data: Array<{ strike: number; callIV: number | null; putIV: number | null }> }>;
  hv: { hv30: number; hv60: number; hv90: number };
  atmIV: number;
  gexFlip: number | null;
  totalCallOI: number; totalPutOI: number; totalCallVol: number; totalPutVol: number;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const POPULAR_TICKERS = ["SPY", "QQQ", "AAPL", "TSLA", "NVDA", "AMZN", "META", "MSFT", "IWM", "AMD"];

type MacroData = {
  vix: { value: number | null; change: number | null; history: Array<{ date: string; value: number }> };
  vvix: { value: number | null; change: number | null; history: Array<{ date: string; value: number }> };
  skew: { value: number | null; change: number | null; history: Array<{ date: string; value: number }> };
  vixTermStructure: Array<{ label: string; days: number; value: number }>;
  vixStructure: string;
  vixSpyChart: Array<{ date: string; vix: number; spy: number }>;
  vixSpyCorr30: number | null;
  crossAssetVol: Array<{ label: string; ticker: string; hv30: number; iv: number | null }>;
  ovx: { value: number | null; change: number | null };
  gvz: { value: number | null; change: number | null };
  tyvix: { value: number | null; change: number | null };
};

const TOOLTIP_STYLE = { background: "var(--app-card)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number, d = 2): string { return v.toFixed(d); }
function fmtK(v: number): string { return v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toString(); }
function pct(v: number): string { return (v * 100).toFixed(1) + "%"; }
function pctColor(v: number): string { return v >= 0 ? "text-emerald-400" : "text-red-400"; }
function dateFmt(ts: number): string { return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }); }

// ─── Section Header ──────────────────────────────────────────────────────────

function SH({ label, title, sub }: { label: string; title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--accent-color)]/70">{label}</p>
      <h2 className="mt-0.5 text-base font-semibold text-zinc-50">{title}</h2>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

function SectionSkeleton({ h = 200 }: { h?: number }) {
  return <div className="animate-pulse rounded-2xl bg-white/5" style={{ height: h }} />;
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
      <p className="text-[10px] text-zinc-500">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${color ?? "text-zinc-50"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-600">{sub}</p>}
    </div>
  );
}

// ─── Premium Placeholder ─────────────────────────────────────────────────────

function PremiumCard({ title, desc, provider, features }: { title: string; desc: string; provider: string; features: string[] }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/20">Premium</span>
        <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-zinc-500">{desc}</p>
      <ul className="mb-3 space-y-1">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-[11px] text-zinc-400">
            <span className="h-1 w-1 rounded-full bg-zinc-600" />
            {f}
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-zinc-600">Requires: <span className="text-zinc-400">{provider}</span></p>
    </div>
  );
}

// ─── Options Chain Table ─────────────────────────────────────────────────────

function ChainTable({ calls, puts, spot }: { calls: ChainEntry[]; puts: ChainEntry[]; spot: number }) {
  const allStrikes = [...new Set([...calls.map((c) => c.strike), ...puts.map((p) => p.strike)])].sort((a, b) => a - b);
  // Filter to ±20% of spot
  const minS = spot * 0.8, maxS = spot * 1.2;
  const strikes = allStrikes.filter((s) => s >= minS && s <= maxS);
  const callMap = new Map(calls.map((c) => [c.strike, c]));
  const putMap = new Map(puts.map((p) => [p.strike, p]));

  const hdr = "sticky top-0 z-10 bg-[var(--app-card-alt)] px-2 py-1.5 text-[9px] font-medium text-zinc-500 whitespace-nowrap";
  const td = "px-2 py-1 text-[10px] tabular-nums whitespace-nowrap";

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-white/10 bg-[var(--app-card-alt)]">
      <table className="w-full min-w-[900px] border-collapse text-right">
        <thead>
          <tr>
            <th className={`${hdr} text-left`} colSpan={9}><span className="text-emerald-400">CALLS</span></th>
            <th className={`${hdr} text-center border-x border-white/10`}>STRIKE</th>
            <th className={`${hdr} text-left`} colSpan={9}><span className="text-red-400">PUTS</span></th>
          </tr>
          <tr>
            {["Delta", "Gamma", "Theta", "Vega", "IV", "Bid", "Ask", "Vol", "OI"].map((h) => <th key={`c-${h}`} className={hdr}>{h}</th>)}
            <th className={`${hdr} text-center border-x border-white/10`}>$</th>
            {["Delta", "Gamma", "Theta", "Vega", "IV", "Bid", "Ask", "Vol", "OI"].map((h) => <th key={`p-${h}`} className={hdr}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {strikes.map((strike) => {
            const c = callMap.get(strike);
            const p = putMap.get(strike);
            const isNearAtm = Math.abs(strike - spot) / spot < 0.005;
            const rowBg = isNearAtm ? "bg-[var(--accent-color)]/5" : strike < spot ? "bg-emerald-500/[0.03]" : "";
            return (
              <tr key={strike} className={`border-t border-white/5 ${rowBg} hover:bg-white/5`}>
                {c ? (
                  <>
                    <td className={`${td} ${c.itm ? "text-zinc-300" : "text-zinc-500"}`}>{fmt(c.delta, 3)}</td>
                    <td className={`${td} text-zinc-500`}>{fmt(c.gamma, 4)}</td>
                    <td className={`${td} text-red-400/70`}>{fmt(c.theta, 3)}</td>
                    <td className={`${td} text-zinc-500`}>{fmt(c.vega, 3)}</td>
                    <td className={`${td} text-blue-400/80`}>{pct(c.iv)}</td>
                    <td className={`${td} text-zinc-500`}>{fmt(c.bid)}</td>
                    <td className={`${td} text-zinc-500`}>{fmt(c.ask)}</td>
                    <td className={`${td} ${c.volume > 1000 ? "text-yellow-400" : "text-zinc-600"}`}>{fmtK(c.volume)}</td>
                    <td className={`${td} ${c.oi > 5000 ? "text-cyan-400" : "text-zinc-600"}`}>{fmtK(c.oi)}</td>
                  </>
                ) : <td colSpan={9} />}
                <td className={`${td} text-center font-bold border-x border-white/10 ${isNearAtm ? "text-[var(--accent-color)]" : "text-zinc-300"}`}>
                  {fmt(strike)}
                </td>
                {p ? (
                  <>
                    <td className={`${td} ${p.itm ? "text-zinc-300" : "text-zinc-500"}`}>{fmt(p.delta, 3)}</td>
                    <td className={`${td} text-zinc-500`}>{fmt(p.gamma, 4)}</td>
                    <td className={`${td} text-red-400/70`}>{fmt(p.theta, 3)}</td>
                    <td className={`${td} text-zinc-500`}>{fmt(p.vega, 3)}</td>
                    <td className={`${td} text-blue-400/80`}>{pct(p.iv)}</td>
                    <td className={`${td} text-zinc-500`}>{fmt(p.bid)}</td>
                    <td className={`${td} text-zinc-500`}>{fmt(p.ask)}</td>
                    <td className={`${td} ${p.volume > 1000 ? "text-yellow-400" : "text-zinc-600"}`}>{fmtK(p.volume)}</td>
                    <td className={`${td} ${p.oi > 5000 ? "text-cyan-400" : "text-zinc-600"}`}>{fmtK(p.oi)}</td>
                  </>
                ) : <td colSpan={9} />}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── OI by Strike Chart ──────────────────────────────────────────────────────

function OIChart({ data, spot, maxPain }: { data: GreeksData["oiByStrike"]; spot: number; maxPain: number }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <XAxis dataKey="strike" tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickFormatter={(v: number) => fmt(v, 0)} />
          <YAxis tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false}
            width={45} tickFormatter={fmtK} />
          <RechartTooltip contentStyle={TOOLTIP_STYLE} />
          <ReferenceLine x={spot} stroke="var(--accent-color)" strokeDasharray="3 3" label={{ value: "Spot", fontSize: 9, fill: "var(--accent-color)" }} />
          <ReferenceLine x={maxPain} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "Max Pain", fontSize: 9, fill: "#f59e0b" }} />
          <Bar dataKey="callOI" name="Call OI" fill="#4ade80" opacity={0.7} radius={[2, 2, 0, 0]} />
          <Bar dataKey="putOI" name="Put OI" fill="#f87171" opacity={0.7} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── IV Skew Chart ───────────────────────────────────────────────────────────

function SkewChart({ data, spot }: { data: GreeksData["ivSkew"]; spot: number }) {
  const chartData = data.map((d) => ({
    strike: d.strike,
    callIV: d.callIV != null ? +(d.callIV * 100).toFixed(1) : null,
    putIV: d.putIV != null ? +(d.putIV * 100).toFixed(1) : null,
  }));
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <XAxis dataKey="strike" tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickFormatter={(v: number) => fmt(v, 0)} />
          <YAxis tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false}
            width={40} tickFormatter={(v: number) => v + "%"} />
          <RechartTooltip contentStyle={TOOLTIP_STYLE} />
          <ReferenceLine x={spot} stroke="var(--accent-color)" strokeDasharray="3 3" />
          <Line type="monotone" dataKey="callIV" name="Call IV" stroke="#4ade80" dot={false} strokeWidth={2} connectNulls />
          <Line type="monotone" dataKey="putIV" name="Put IV" stroke="#f87171" dot={false} strokeWidth={2} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Term Structure Chart ────────────────────────────────────────────────────

function TermChart({ data }: { data: GreeksData["termStructure"] }) {
  const chartData = data.map((d) => ({ ...d, ivPct: +(d.iv * 100).toFixed(1), label: `${d.daysOut}d` }));
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }} />
          <YAxis tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false}
            width={40} tickFormatter={(v: number) => v + "%"} domain={["auto", "auto"]} />
          <RechartTooltip contentStyle={TOOLTIP_STYLE} />
          <Area type="monotone" dataKey="ivPct" fill="rgba(96,165,250,0.1)" stroke="none" />
          <Line type="monotone" dataKey="ivPct" name="ATM IV" stroke="#60a5fa" dot={{ fill: "#60a5fa", r: 3 }} strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── GEX Chart ───────────────────────────────────────────────────────────────

function GEXChart({ data, spot, gexFlip }: { data: GreeksData["gex"]; spot: number; gexFlip: number | null }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <XAxis dataKey="strike" tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickFormatter={(v: number) => fmt(v, 0)} />
          <YAxis tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false} width={50} tickFormatter={fmtK} />
          <RechartTooltip contentStyle={TOOLTIP_STYLE} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
          <ReferenceLine x={spot} stroke="var(--accent-color)" strokeDasharray="3 3" label={{ value: "Spot", fontSize: 9, fill: "var(--accent-color)" }} />
          {gexFlip && <ReferenceLine x={gexFlip} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "GEX Flip", fontSize: 9, fill: "#f59e0b" }} />}
          <Bar dataKey="value" name="GEX" radius={[2, 2, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.value >= 0 ? "#4ade80" : "#f87171"} opacity={0.8} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── DEX Chart ───────────────────────────────────────────────────────────────

function DEXChart({ data, spot }: { data: GreeksData["dex"]; spot: number }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <XAxis dataKey="strike" tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickFormatter={(v: number) => fmt(v, 0)} />
          <YAxis tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false} width={50} tickFormatter={fmtK} />
          <RechartTooltip contentStyle={TOOLTIP_STYLE} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
          <ReferenceLine x={spot} stroke="var(--accent-color)" strokeDasharray="3 3" />
          <Bar dataKey="value" name="DEX" radius={[2, 2, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.value >= 0 ? "#60a5fa" : "#a855f7"} opacity={0.8} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Vol Surface Heatmap ─────────────────────────────────────────────────────

function VolSurface({ data, spot }: { data: GreeksData["volSurface"]; spot: number }) {
  if (!data.length) return <p className="text-xs text-zinc-600">No vol surface data</p>;
  // Collect all unique strikes across expirations
  const allStrikes = [...new Set(data.flatMap((row) => row.data.map((d) => d.strike)))].sort((a, b) => a - b);
  // Sample strikes to max 30 columns
  const step = Math.max(1, Math.floor(allStrikes.length / 30));
  const strikes = allStrikes.filter((_, i) => i % step === 0);

  function ivColor(iv: number | null): string {
    if (iv == null || iv <= 0) return "transparent";
    const v = Math.min(1, iv / 0.8); // 80% IV = max intensity
    // Blue (low) → Yellow → Red (high)
    if (v < 0.5) {
      const t = v * 2;
      return `rgb(${Math.round(30 + 200 * t)},${Math.round(80 + 140 * t)},${Math.round(180 - 100 * t)})`;
    }
    const t = (v - 0.5) * 2;
    return `rgb(${Math.round(230 + 25 * t)},${Math.round(220 - 180 * t)},${Math.round(80 - 60 * t)})`;
  }

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-white/10 bg-[var(--app-card-alt)]">
      <table className="border-collapse" style={{ minWidth: "max-content", fontSize: "8px" }}>
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-[var(--app-card-alt)] px-2 py-1 text-left text-[9px] text-zinc-500">Exp</th>
            {strikes.map((s) => (
              <th key={s} className="px-1 py-1 text-center text-[8px] font-normal" style={{ color: Math.abs(s - spot) / spot < 0.01 ? "var(--accent-color)" : "#52525b", minWidth: 28 }}>
                {s.toFixed(0)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const ivMap = new Map(row.data.map((d) => [d.strike, ((d.callIV ?? 0) + (d.putIV ?? 0)) / 2 || d.callIV || d.putIV]));
            return (
              <tr key={row.date}>
                <td className="sticky left-0 z-10 bg-[var(--app-card-alt)] px-2 py-0.5 text-[9px] text-zinc-400 whitespace-nowrap">
                  {row.daysOut}d
                </td>
                {strikes.map((s) => {
                  // Find nearest available strike in this row
                  const nearest = row.data.reduce((best, d) => Math.abs(d.strike - s) < Math.abs(best.strike - s) ? d : best, row.data[0]!);
                  const iv = Math.abs(nearest.strike - s) / s < 0.02 ? ((nearest.callIV ?? 0) + (nearest.putIV ?? 0)) / 2 || nearest.callIV || nearest.putIV : null;
                  return (
                    <td key={s} className="px-0 py-0" style={{ background: ivColor(iv), width: 28, height: 20 }}
                      title={iv != null ? `${row.daysOut}d · $${s} · IV: ${(iv * 100).toFixed(1)}%` : undefined}>
                      {iv != null && <span className="flex h-full items-center justify-center text-[7px] font-medium text-white/80">{(iv * 100).toFixed(0)}</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="text-[9px] text-zinc-500">Low IV</span>
        <div className="h-2 flex-1 rounded-full" style={{ background: "linear-gradient(to right, rgb(30,80,180), rgb(230,220,80), rgb(255,40,20))" }} />
        <span className="text-[9px] text-zinc-500">High IV</span>
      </div>
    </div>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex gap-2">
        {[...Array(6)].map((_, i) => <div key={i} className="h-20 flex-1 rounded-2xl bg-white/5" />)}
      </div>
      <div className="h-[400px] rounded-2xl bg-white/5" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-64 rounded-2xl bg-white/5" />
        <div className="h-64 rounded-2xl bg-white/5" />
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function GreeksView() {
  // ── Macro state ──
  const [macro, setMacro] = useState<MacroData | null>(null);
  const [macroLoading, setMacroLoading] = useState(true);

  const fetchMacro = useCallback(async () => {
    setMacroLoading(true);
    try {
      const res = await fetch("/api/greeks/macro");
      if (res.ok) setMacro(await res.json() as MacroData);
    } catch { /* ignore */ }
    finally { setMacroLoading(false); }
  }, []);

  useEffect(() => { void fetchMacro(); }, [fetchMacro]);
  useEffect(() => {
    const id = setInterval(() => void fetchMacro(), 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchMacro]);

  // ── Ticker state ──
  const [ticker, setTicker] = useState("SPY");
  const [inputVal, setInputVal] = useState("SPY");
  const [selectedExp, setSelectedExp] = useState<number | null>(null);
  const [data, setData] = useState<GreeksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (t: string, exp?: number) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/greeks?ticker=${encodeURIComponent(t)}${exp ? `&expiration=${exp}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json() as GreeksData;
      setData(json);
      if (!exp) setSelectedExp(json.selectedExpiration);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(ticker); }, [ticker, fetchData]);

  useEffect(() => {
    const id = setInterval(() => void fetchData(ticker, selectedExp ?? undefined), 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [ticker, selectedExp, fetchData]);

  const handleSearch = () => {
    const t = inputVal.trim().toUpperCase();
    if (t && t !== ticker) { setTicker(t); setSelectedExp(null); }
  };

  const handleExpChange = (exp: number) => {
    setSelectedExp(exp);
    void fetchData(ticker, exp);
  };

  const pcByOI = data ? data.putCallRatio.byOI : 0;
  const pcSentiment = pcByOI >= 1.2 ? "Bearish" : pcByOI >= 0.8 ? "Neutral" : "Bullish";
  const pcColor = pcByOI >= 1.2 ? "text-red-400" : pcByOI >= 0.8 ? "text-yellow-400" : "text-emerald-400";

  return (
    <div className="space-y-6">

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── MACRO SECTION: Market-Wide Volatility & Derivatives ──────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      {/* ── VIX Dashboard ──────────────────────────────────────────────────── */}
      <SectionErrorBoundary name="VIX Dashboard">
        {macroLoading && !macro ? <SectionSkeleton h={120} /> : macro && (
          <section>
            <SH label="Market Volatility" title="VIX & Volatility Dashboard"
              sub="Real-time fear gauge, term structure, and volatility-of-volatility metrics." />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="VIX" value={macro.vix.value != null ? fmt(macro.vix.value) : "—"}
                sub={macro.vix.change != null ? `${macro.vix.change >= 0 ? "+" : ""}${fmt(macro.vix.change)}%` : undefined}
                color={macro.vix.value != null ? (macro.vix.value >= 25 ? "text-red-400" : macro.vix.value >= 18 ? "text-yellow-400" : "text-emerald-400") : undefined} />
              <Stat label="VVIX (Vol of Vol)" value={macro.vvix.value != null ? fmt(macro.vvix.value) : "—"}
                sub={macro.vvix.change != null ? `${macro.vvix.change >= 0 ? "+" : ""}${fmt(macro.vvix.change)}%` : undefined}
                color={macro.vvix.value != null && macro.vvix.value >= 100 ? "text-amber-400" : "text-zinc-50"} />
              <Stat label="SKEW Index" value={macro.skew.value != null ? fmt(macro.skew.value, 0) : "—"}
                sub={macro.skew.value != null ? (macro.skew.value >= 140 ? "Elevated tail risk" : macro.skew.value >= 120 ? "Normal" : "Low skew") : undefined}
                color={macro.skew.value != null && macro.skew.value >= 140 ? "text-red-400" : "text-zinc-50"} />
              <Stat label="OVX (Oil Vol)" value={macro.ovx.value != null ? fmt(macro.ovx.value) : "—"}
                sub={macro.ovx.change != null ? `${macro.ovx.change >= 0 ? "+" : ""}${fmt(macro.ovx.change)}%` : undefined}
                color="text-orange-400" />
              <Stat label="GVZ (Gold Vol)" value={macro.gvz.value != null ? fmt(macro.gvz.value) : "—"}
                sub={macro.gvz.change != null ? `${macro.gvz.change >= 0 ? "+" : ""}${fmt(macro.gvz.change)}%` : undefined}
                color="text-yellow-400" />
              <Stat label="TYVIX (Bond Vol)" value={macro.tyvix.value != null ? fmt(macro.tyvix.value) : "—"}
                sub={macro.tyvix.change != null ? `${macro.tyvix.change >= 0 ? "+" : ""}${fmt(macro.tyvix.change)}%` : undefined}
                color="text-blue-400" />
            </div>
          </section>
        )}
      </SectionErrorBoundary>

      {/* ── VIX Term Structure ─────────────────────────────────────────────── */}
      <SectionErrorBoundary name="VIX Term Structure">
        {macro && macro.vixTermStructure.length > 1 && (
          <section>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <p className="text-xs font-medium text-zinc-300">VIX Term Structure</p>
                  <span className={`rounded border px-1.5 py-0.5 text-[9px] font-medium ${
                    macro.vixStructure === "Backwardation" ? "bg-red-500/15 text-red-300 border-red-500/30" : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  }`}>{macro.vixStructure}</span>
                </div>
                <p className="mb-2 text-[10px] text-zinc-600">
                  {macro.vixStructure === "Contango" ? "Normal: longer-dated vol > near-term. Market expects calm." : "Inverted: near-term vol > longer-dated. Market is stressed NOW."}
                </p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={macro.vixTermStructure} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#71717a" }} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} />
                      <YAxis tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false} width={35} domain={["auto", "auto"]} />
                      <RechartTooltip contentStyle={TOOLTIP_STYLE} />
                      <Area type="monotone" dataKey="value" fill="rgba(239,68,68,0.08)" stroke="none" />
                      <Line type="monotone" dataKey="value" name="IV Level" stroke="#ef4444" dot={{ fill: "#ef4444", r: 4 }} strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
                <p className="mb-2 text-xs font-medium text-zinc-300">VIX vs S&P 500 — 90 Day</p>
                <p className="mb-2 text-[10px] text-zinc-600">
                  30-day correlation: <span className={`font-bold ${(macro.vixSpyCorr30 ?? 0) < -0.5 ? "text-emerald-400" : "text-yellow-400"}`}>
                    {macro.vixSpyCorr30 != null ? fmt(macro.vixSpyCorr30, 3) : "—"}
                  </span> {(macro.vixSpyCorr30 ?? 0) < -0.5 ? "(strong inverse — normal)" : "(weakened inverse — unusual)"}
                </p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={macro.vixSpyChart} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 8, fill: "#52525b" }} tickLine={false}
                        axisLine={{ stroke: "rgba(255,255,255,0.08)" }} interval="preserveStartEnd" tickFormatter={(d: string) => d.slice(5)} />
                      <YAxis yAxisId="vix" orientation="left" tick={{ fontSize: 9, fill: "#ef444499" }} tickLine={false} axisLine={false} width={30} domain={["auto", "auto"]} />
                      <YAxis yAxisId="spy" orientation="right" tick={{ fontSize: 9, fill: "#4ade8099" }} tickLine={false} axisLine={false} width={40} domain={["auto", "auto"]} />
                      <RechartTooltip contentStyle={TOOLTIP_STYLE} />
                      <Line yAxisId="vix" type="monotone" dataKey="vix" name="VIX" stroke="#ef4444" dot={false} strokeWidth={1.5} />
                      <Line yAxisId="spy" type="monotone" dataKey="spy" name="SPY" stroke="#4ade80" dot={false} strokeWidth={1.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-1 flex justify-center gap-4 text-[9px] text-zinc-500">
                  <span className="flex items-center gap-1"><span className="inline-block h-1 w-3 rounded bg-red-500" /> VIX (left)</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-1 w-3 rounded bg-emerald-500" /> SPY (right)</span>
                </div>
              </div>
            </div>
          </section>
        )}
      </SectionErrorBoundary>

      {/* ── Cross-Asset Volatility ─────────────────────────────────────────── */}
      <SectionErrorBoundary name="Cross-Asset Vol">
        {macro && (
          <section>
            <SH label="Cross-Asset Volatility" title="Realized & Implied Vol Across Markets"
              sub="30-day historical volatility for major asset classes. IV shown where a dedicated vol index exists." />
            <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
              <div className="space-y-2.5">
                {macro.crossAssetVol.map(({ label, ticker: t, hv30, iv }) => (
                  <div key={t} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-[11px] text-zinc-300">{label}</span>
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="w-8 text-[9px] text-zinc-500">HV30</span>
                        <div className="relative flex-1 h-3 rounded bg-white/5">
                          <div className="h-full rounded bg-blue-500/60" style={{ width: `${Math.min(100, hv30 * 200)}%` }} />
                        </div>
                        <span className="w-12 text-right text-[10px] font-medium tabular-nums text-blue-400">{(hv30 * 100).toFixed(1)}%</span>
                      </div>
                      {iv != null && (
                        <div className="flex items-center gap-2">
                          <span className="w-8 text-[9px] text-zinc-500">IV</span>
                          <div className="relative flex-1 h-3 rounded bg-white/5">
                            <div className="h-full rounded bg-amber-500/60" style={{ width: `${Math.min(100, iv * 200)}%` }} />
                          </div>
                          <span className="w-12 text-right text-[10px] font-medium tabular-nums text-amber-400">{(iv * 100).toFixed(1)}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[10px] leading-relaxed text-zinc-500">
              <span className="font-medium text-zinc-300">HV30</span> = annualized 30-day historical (realized) volatility from daily returns.{" "}
              <span className="font-medium text-zinc-300">IV</span> = implied volatility from dedicated CBOE indices (VIX for equities, GVZ for gold, TYVIX for bonds).{" "}
              When IV {">"} HV, the market is pricing in more future risk than recently realized — options are relatively expensive.
            </div>
          </section>
        )}
      </SectionErrorBoundary>

      {/* ── SKEW & VVIX Sparklines ─────────────────────────────────────────── */}
      <SectionErrorBoundary name="Tail Risk">
        {macro && (macro.skew.history.length > 5 || macro.vvix.history.length > 5) && (
          <section>
            <SH label="Tail Risk & Vol Regime" title="SKEW Index & VVIX — 60 Day"
              sub="SKEW measures demand for tail-risk hedging (OTM puts). VVIX measures how volatile VIX itself is expected to be." />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {macro.skew.history.length > 5 && (
                <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
                  <p className="mb-2 text-xs font-medium text-zinc-300">CBOE SKEW Index</p>
                  <p className="mb-2 text-[10px] text-zinc-600">{">"} 140 = elevated tail risk hedging. {">"} 150 = extreme. Normal range: 110–130.</p>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={macro.skew.history} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 8, fill: "#52525b" }} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                          interval="preserveStartEnd" tickFormatter={(d: string) => d.slice(5)} />
                        <YAxis tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false} width={35} domain={["auto", "auto"]} />
                        <RechartTooltip contentStyle={TOOLTIP_STYLE} />
                        <ReferenceLine y={140} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "140", fontSize: 8, fill: "#f59e0b" }} />
                        <Line type="monotone" dataKey="value" name="SKEW" stroke="#a78bfa" dot={false} strokeWidth={1.5} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {macro.vvix.history.length > 5 && (
                <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
                  <p className="mb-2 text-xs font-medium text-zinc-300">VVIX — Volatility of VIX</p>
                  <p className="mb-2 text-[10px] text-zinc-600">{">"} 120 = VIX expected to swing sharply. Spikes precede regime changes.</p>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={macro.vvix.history} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 8, fill: "#52525b" }} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                          interval="preserveStartEnd" tickFormatter={(d: string) => d.slice(5)} />
                        <YAxis tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false} width={35} domain={["auto", "auto"]} />
                        <RechartTooltip contentStyle={TOOLTIP_STYLE} />
                        <ReferenceLine y={120} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "120", fontSize: 8, fill: "#f59e0b" }} />
                        <Line type="monotone" dataKey="value" name="VVIX" stroke="#f97316" dot={false} strokeWidth={1.5} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </SectionErrorBoundary>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── TICKER-SPECIFIC SECTION ──────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      {/* ── Ticker Search ──────────────────────────────────────────────────── */}
      <div className="border-t border-white/5 pt-6">
        <SH label="Ticker Analysis" title="Single-Name Options & Greeks"
          sub="Search any optionable ticker for full chain, greeks, exposure, and volatility analysis." />
        <TickerSearchBar value={inputVal} onChange={setInputVal} onSearch={handleSearch}
          onQuick={(t) => { setInputVal(t); setTicker(t); setSelectedExp(null); }} />
      </div>

      {loading && !data ? <SectionSkeleton h={200} /> : error && !data ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <p className="mb-1 text-sm font-medium text-red-400">No options data available</p>
          <p className="mb-4 text-xs text-zinc-600">{error}</p>
          <button onClick={() => fetchData(ticker)} className="rounded-lg bg-white/10 px-4 py-2 text-xs text-zinc-300 hover:bg-white/20">Retry</button>
        </div>
      ) : !data ? null : (<>

      {/* ── Overview Cards ──────────────────────────────────────────────────── */}
      <SectionErrorBoundary name="Overview">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label={`${data.ticker} Spot`} value={`$${fmt(data.spot)}`}
            sub={`${data.quote.change >= 0 ? "+" : ""}${fmt(data.quote.change)} (${fmt(data.quote.changePct)}%)`}
            color={data.quote.change >= 0 ? "text-emerald-400" : "text-red-400"} />
          <Stat label="ATM IV" value={pct(data.atmIV)}
            sub={`HV30: ${pct(data.hv.hv30)}`}
            color={data.atmIV > data.hv.hv30 ? "text-amber-400" : "text-blue-400"} />
          <Stat label="IV vs HV30" value={data.atmIV > 0 && data.hv.hv30 > 0 ? `${((data.atmIV / data.hv.hv30 - 1) * 100).toFixed(0)}%` : "—"}
            sub={data.atmIV > data.hv.hv30 ? "IV premium" : "HV premium"}
            color={data.atmIV > data.hv.hv30 ? "text-amber-400" : "text-emerald-400"} />
          <Stat label="P/C Ratio (OI)" value={fmt(pcByOI)}
            sub={pcSentiment} color={pcColor} />
          <Stat label="Max Pain" value={`$${fmt(data.maxPain)}`}
            sub={`${((data.maxPain / data.spot - 1) * 100).toFixed(1)}% from spot`}
            color="text-yellow-400" />
          <Stat label="GEX Flip" value={data.gexFlip ? `$${fmt(data.gexFlip)}` : "—"}
            sub={data.gexFlip ? (data.spot > data.gexFlip ? "Above flip → positive gamma" : "Below flip → negative gamma") : "No flip detected"}
            color="text-violet-400" />
        </div>
      </SectionErrorBoundary>

      {/* ── HV Bars ───────────────────────────────────────────────────────── */}
      <SectionErrorBoundary name="Volatility Comparison">
        <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
          <p className="mb-3 text-xs font-medium text-zinc-300">Implied vs Historical Volatility</p>
          <div className="space-y-2">
            {[
              { label: "ATM IV", value: data.atmIV, color: "#f59e0b" },
              { label: "HV 30d", value: data.hv.hv30, color: "#60a5fa" },
              { label: "HV 60d", value: data.hv.hv60, color: "#818cf8" },
              { label: "HV 90d", value: data.hv.hv90, color: "#a78bfa" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-[10px] text-zinc-400">{label}</span>
                <div className="relative flex-1 h-4 rounded bg-white/5">
                  <div className="h-full rounded" style={{ width: `${Math.min(100, value * 200)}%`, background: color, opacity: 0.8 }} />
                </div>
                <span className="w-12 shrink-0 text-right text-[10px] font-medium tabular-nums" style={{ color }}>{pct(value)}</span>
              </div>
            ))}
          </div>
        </div>
      </SectionErrorBoundary>

      {/* ── Expiration Selector + Chain ─────────────────────────────────────── */}
      <SectionErrorBoundary name="Options Chain">
        <section>
          <SH label="Options Chain" title={`${data.ticker} Greeks by Strike`}
            sub={`${data.daysToExpiry} DTE · ${data.chain.calls.length} calls · ${data.chain.puts.length} puts`} />
          <div className="mb-3 flex flex-wrap gap-1">
            {data.expirations.slice(0, 12).map((exp) => (
              <button key={exp} onClick={() => handleExpChange(exp)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  (selectedExp ?? data.selectedExpiration) === exp
                    ? "bg-[var(--accent-color)] text-black" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                }`}>
                {dateFmt(exp)}
              </button>
            ))}
          </div>
          {loading ? <SectionSkeleton h={300} /> : <ChainTable calls={data.chain.calls} puts={data.chain.puts} spot={data.spot} />}
          <div className="mt-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[10px] leading-relaxed text-zinc-500">
            <span className="font-medium text-zinc-300">Greeks computed via Black-Scholes.</span>{" "}
            Delta (directional exposure), Gamma (delta sensitivity), Theta (daily time decay), Vega (vol sensitivity), Rho (rate sensitivity).
            ATM row highlighted. Yellow volume = high activity. Cyan OI = high open interest.
          </div>
        </section>
      </SectionErrorBoundary>

      {/* ── Volatility Section ─────────────────────────────────────────────── */}
      <SectionErrorBoundary name="Volatility">
        <section>
          <SH label="Volatility Analysis" title="Skew, Term Structure & Surface"
            sub="How implied volatility varies across strikes and expirations." />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
              <p className="mb-2 text-xs font-medium text-zinc-300">IV Skew — {dateFmt(selectedExp ?? data.selectedExpiration)}</p>
              <p className="mb-2 text-[10px] text-zinc-600">Call IV vs Put IV across strikes. Put skew = downside fear premium.</p>
              <SkewChart data={data.ivSkew} spot={data.spot} />
            </div>
            <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
              <p className="mb-2 text-xs font-medium text-zinc-300">Term Structure — ATM IV by Expiration</p>
              <p className="mb-2 text-[10px] text-zinc-600">Normal = upward slope (longer dates = higher IV). Inverted = near-term fear.</p>
              {data.termStructure.length > 1 ? <TermChart data={data.termStructure} /> :
                <div className="flex h-56 items-center justify-center text-xs text-zinc-600">Not enough expirations</div>}
            </div>
          </div>
          <div className="mt-4">
            <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
              <p className="mb-2 text-xs font-medium text-zinc-300">Volatility Surface</p>
              <p className="mb-2 text-[10px] text-zinc-600">IV across strikes (columns) and expirations (rows). Reveals where the market prices the most uncertainty.</p>
              <VolSurface data={data.volSurface} spot={data.spot} />
            </div>
          </div>
        </section>
      </SectionErrorBoundary>

      {/* ── Flow & Positioning ─────────────────────────────────────────────── */}
      <SectionErrorBoundary name="Flow & Positioning">
        <section>
          <SH label="Flow & Positioning" title="Open Interest, Max Pain & Volume"
            sub="Where the money is positioned and where it hurts most at expiry." />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
              <p className="mb-2 text-xs font-medium text-zinc-300">Open Interest by Strike</p>
              <OIChart data={data.oiByStrike} spot={data.spot} maxPain={data.maxPain} />
            </div>
            <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
              <p className="mb-3 text-xs font-medium text-zinc-300">Flow Summary</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500">Total Call OI</span>
                  <span className="text-sm font-bold text-emerald-400 tabular-nums">{data.totalCallOI.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500">Total Put OI</span>
                  <span className="text-sm font-bold text-red-400 tabular-nums">{data.totalPutOI.toLocaleString()}</span>
                </div>
                <div className="h-3 flex rounded-full overflow-hidden bg-white/5">
                  <div className="h-full bg-emerald-500/60" style={{ width: `${data.totalCallOI / (data.totalCallOI + data.totalPutOI) * 100}%` }} />
                  <div className="h-full bg-red-500/60" style={{ width: `${data.totalPutOI / (data.totalCallOI + data.totalPutOI) * 100}%` }} />
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-emerald-400">Calls {((data.totalCallOI / (data.totalCallOI + data.totalPutOI)) * 100).toFixed(0)}%</span>
                  <span className="text-red-400">Puts {((data.totalPutOI / (data.totalCallOI + data.totalPutOI)) * 100).toFixed(0)}%</span>
                </div>
                <div className="border-t border-white/5 pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">P/C Ratio (OI)</span>
                    <span className={`text-sm font-bold tabular-nums ${pcColor}`}>{fmt(data.putCallRatio.byOI)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">P/C Ratio (Volume)</span>
                    <span className="text-sm font-bold tabular-nums text-zinc-300">{fmt(data.putCallRatio.byVolume)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">Max Pain</span>
                    <span className="text-sm font-bold tabular-nums text-yellow-400">${fmt(data.maxPain)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">Total Volume (calls)</span>
                    <span className="text-sm font-bold tabular-nums text-zinc-300">{data.totalCallVol.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">Total Volume (puts)</span>
                    <span className="text-sm font-bold tabular-nums text-zinc-300">{data.totalPutVol.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <p className="text-[10px] leading-relaxed text-zinc-500">
              <span className="font-medium text-zinc-300">Max Pain</span> is the strike where the most options expire worthless — where option sellers (market makers) profit most. Price often gravitates toward max pain as expiration approaches, especially in high-OI names.
            </p>
          </div>
        </section>
      </SectionErrorBoundary>

      {/* ── Gamma & Delta Exposure ─────────────────────────────────────────── */}
      <SectionErrorBoundary name="Exposure Analysis">
        <section>
          <SH label="Dealer Exposure" title="Gamma & Delta Exposure by Strike"
            sub="Estimated market maker hedging pressure. Positive gamma = dealers sell rallies/buy dips (stabilizing). Negative gamma = dealers amplify moves." />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
              <div className="mb-2 flex items-center gap-2">
                <p className="text-xs font-medium text-zinc-300">GEX — Gamma Exposure</p>
                {data.gexFlip && (
                  <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-[9px] text-yellow-400 border border-yellow-500/20">
                    Flip: ${fmt(data.gexFlip)}
                  </span>
                )}
              </div>
              <GEXChart data={data.gex} spot={data.spot} gexFlip={data.gexFlip} />
            </div>
            <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
              <p className="mb-2 text-xs font-medium text-zinc-300">DEX — Delta Exposure</p>
              <DEXChart data={data.dex} spot={data.spot} />
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <p className="text-[10px] leading-relaxed text-zinc-500">
              <span className="font-medium text-zinc-300">GEX Flip</span> is the strike where aggregate gamma crosses zero. Above the flip, dealers are long gamma (stabilizing — they sell into rallies and buy dips). Below, they{"'"}re short gamma (destabilizing — forced to sell into selloffs). The flip level acts as a key support/resistance zone.
            </p>
          </div>
        </section>
      </SectionErrorBoundary>

      </>)}

      {/* ── Premium / Subscription Features ────────────────────────────────── */}
      <section>
        <SH label="Advanced Analytics" title="Premium Features"
          sub="These features will activate once the required data subscriptions are connected." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <PremiumCard title="Unusual Options Activity"
            desc="Real-time feed of large, unusual options trades — sweeps, blocks, and multi-leg strategies that signal institutional positioning."
            provider="Unusual Whales (~$50/mo) or Tradier"
            features={["Large block trades", "Sweep detection", "Multi-leg strategy identification", "Bullish/bearish sentiment tagging", "Smart money flow direction"]} />
          <PremiumCard title="IV Rank & IV Percentile"
            desc="Where current implied volatility sits relative to its 52-week range. IV Rank and IV Percentile help identify cheap or expensive options."
            provider="Polygon.io (~$79/mo) or Tradier"
            features={["52-week IV range with current position", "IV Rank (0–100 scale)", "IV Percentile (% of days below current)", "Historical IV time series chart", "IV crush detection around earnings"]} />
          <PremiumCard title="Vanna & Charm Exposure"
            desc="Second-order greeks that drive price movement around expirations and as volatility shifts. Critical for understanding OPEX dynamics."
            provider="OptionMetrics or custom computation"
            features={["Vanna exposure by strike (dDelta/dVol)", "Charm exposure (dDelta/dTime)", "OPEX week flow predictions", "Vol-weighted vanna maps", "Expiration pin risk analysis"]} />
          <PremiumCard title="Dark Pool & Short Interest"
            desc="Off-exchange trading volume and short positioning data that reveals institutional activity not visible in lit markets."
            provider="Ortex (~$49/mo) or S3 Partners"
            features={["Dark pool volume as % of total", "Short interest ratio (days to cover)", "Cost to borrow rate", "Short squeeze risk scoring", "Dark pool print aggregation"]} />
          <PremiumCard title="Options Flow Heatmap"
            desc="Visual heatmap of real-time options flow by strike and expiration, weighted by premium spent. Shows where big money is betting."
            provider="Unusual Whales or CBOE DataShop"
            features={["Premium-weighted flow heatmap", "Net call vs put flow per strike", "Time-series flow accumulation", "Sector-level flow aggregation", "Earnings play detection"]} />
          <PremiumCard title="Historical P/C Ratio"
            desc="Put/Call ratio time series for individual tickers and indices. Extreme readings historically signal sentiment reversals."
            provider="CBOE DataShop or Polygon.io"
            features={["Daily P/C ratio time series", "Equity-only vs index P/C", "5-day moving average overlay", "Extreme reading alerts", "Correlation with subsequent returns"]} />
        </div>
      </section>
    </div>
  );
}

// ─── Ticker Search Bar (extracted for reuse in error state) ──────────────────

function TickerSearchBar({ value, onChange, onSearch, onQuick }: {
  value: string; onChange: (v: string) => void; onSearch: () => void; onQuick: (t: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          placeholder="Search ticker..."
          className="w-40 rounded-lg border border-white/10 bg-white/5 pl-8 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-[var(--accent-color)]/50 focus:ring-1 focus:ring-[var(--accent-color)]/30"
        />
        <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <div className="flex flex-wrap gap-1">
        {POPULAR_TICKERS.map((t) => (
          <button key={t} onClick={() => onQuick(t)}
            className="rounded px-2 py-1 text-[10px] font-medium bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-colors">
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
