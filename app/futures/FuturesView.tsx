"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine,
} from "recharts";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FuturesContract {
  symbol: string;
  name: string;
  exchange: string;
  ticker: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  volume: number | null;
  sparkline: number[];
}

interface FuturesData {
  equity: FuturesContract[];
  energy: FuturesContract[];
  metals: FuturesContract[];
  agriculture: FuturesContract[];
  bonds: FuturesContract[];
  forex: FuturesContract[];
  crypto: FuturesContract[];
  livestock: FuturesContract[];
  fetchedAt: string;
}

interface TermPoint { label: string; price: number; }
interface TermData {
  oil: { points: TermPoint[]; status: string };
  gold: { points: TermPoint[]; status: string };
  gas: { points: TermPoint[]; status: string };
}

interface COTMarket {
  name: string;
  symbol: string;
  commercialNet: number | null;
  nonCommNet: number | null;
  weeklyChange: number | null;
  reportDate: string | null;
}

type TabKey = "equity" | "energy" | "metals" | "agriculture" | "bonds" | "forex" | "crypto" | "livestock";
type SortKey = "name" | "price" | "changePercent" | "volume";

// ─── Constants ─────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: "equity",      label: "Equity"      },
  { key: "energy",      label: "Energy"      },
  { key: "metals",      label: "Metals"      },
  { key: "agriculture", label: "Agriculture" },
  { key: "bonds",       label: "Bonds"       },
  { key: "forex",       label: "Forex"       },
  { key: "crypto",      label: "Crypto"      },
  { key: "livestock",   label: "Livestock"   },
];

const EXCHANGE_COLORS: Record<string, string> = {
  CME:   "#3b82f6",
  NYMEX: "#f59e0b",
  COMEX: "#eab308",
  CBOT:  "#10b981",
  ICE:   "#8b5cf6",
  CBOE:  "#ef4444",
  EUREX: "#06b6d4",
};

const TV_SYMBOLS: Record<string, string> = {
  "ES=F":  "CME:ES1!",   "NQ=F":  "CME:NQ1!",   "YM=F":  "CBOT:YM1!",
  "RTY=F": "CME:RTY1!",  "VX=F":  "CBOE:VX1!",   "NIY=F": "CME:NIY1!",
  "CL=F":  "NYMEX:CL1!", "BZ=F":  "NYMEX:BB1!",  "NG=F":  "NYMEX:NG1!",
  "RB=F":  "NYMEX:RB1!", "HO=F":  "NYMEX:HO1!",
  "GC=F":  "COMEX:GC1!", "SI=F":  "COMEX:SI1!",  "PL=F":  "NYMEX:PL1!",
  "PA=F":  "NYMEX:PA1!", "HG=F":  "COMEX:HG1!",
  "ZW=F":  "CBOT:ZW1!",  "ZC=F":  "CBOT:ZC1!",   "ZS=F":  "CBOT:ZS1!",
  "ZM=F":  "CBOT:ZM1!",  "ZL=F":  "CBOT:ZL1!",   "KC=F":  "ICEUS:KC1!",
  "SB=F":  "ICEUS:SB1!", "CT=F":  "ICEUS:CT1!",  "CC=F":  "ICEUS:CC1!",
  "ZB=F":  "CBOT:ZB1!",  "ZN=F":  "CBOT:ZN1!",   "ZF=F":  "CBOT:ZF1!",
  "ZT=F":  "CBOT:ZT1!",
  "6E=F":  "CME:6E1!",   "6J=F":  "CME:6J1!",    "6B=F":  "CME:6B1!",
  "6C=F":  "CME:6C1!",   "6A=F":  "CME:6A1!",    "6S=F":  "CME:6S1!",
  "DX=F":  "ICEUS:DX1!",
  "BTC=F": "CME:BTC1!",  "ETH=F": "CME:ETH1!",   "MBT=F": "CME:MBT1!",
  "LE=F":  "CME:LE1!",   "GF=F":  "CME:GF1!",    "HE=F":  "CME:HE1!",
};

const TOP_BAR_SYMBOLS = ["ES=F", "NQ=F", "CL=F", "GC=F", "ZN=F", "BTC=F"];

// Market hours (UTC)
const MARKET_HOURS = [
  { name: "CME Globex",    open: 22, close: 21, days: "Sun–Fri", note: "Equity & Forex" },
  { name: "NYMEX/COMEX",  open: 22, close: 21, days: "Sun–Fri", note: "Energy & Metals" },
  { name: "CBOT",          open: 22, close: 21, days: "Sun–Fri", note: "Grains & Bonds"  },
  { name: "ICE",           open: 22, close: 21, days: "Mon–Fri", note: "Brent & Soft"    },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt(p: number | null, decimals = 2): string {
  if (p === null) return "—";
  if (Math.abs(p) >= 10000) return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (Math.abs(p) >= 1) return p.toFixed(decimals);
  return p.toFixed(5);
}

function fmtSmart(p: number | null): string {
  if (p === null) return "—";
  if (Math.abs(p) >= 10000) return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (Math.abs(p) >= 100) return p.toFixed(2);
  if (Math.abs(p) >= 1) return p.toFixed(3);
  return p.toFixed(5);
}

function fmtVol(v: number | null): string {
  if (v === null) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toString();
}

function fmtLarge(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${n < 0 ? "-" : ""}${(abs / 1_000).toFixed(0)}K`;
  return n.toString();
}

function changeColor(v: number | null): string {
  if (v === null) return "text-zinc-500";
  return v >= 0 ? "text-emerald-400" : "text-red-400";
}

function thirdFriday(year: number, month: number): Date {
  const d = new Date(year, month, 1);
  const dow = d.getDay();
  const toFri = dow <= 5 ? 5 - dow : 12 - dow;
  d.setDate(1 + toFri + 14);
  return d;
}

function lastBizDay(year: number, month: number): Date {
  const d = new Date(year, month + 1, 0); // last day of month
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d;
}

function computeCalendar() {
  const now = new Date();
  const entries: Array<{ contract: string; name: string; type: string; expiry: Date }> = [];

  // Equity quarterly — 3rd Friday of Mar/Jun/Sep/Dec
  for (let yr = now.getFullYear(); yr <= now.getFullYear() + 1; yr++) {
    for (const m of [2, 5, 8, 11]) {
      const expiry = thirdFriday(yr, m);
      if (expiry > now && entries.filter(e => e.contract === "ES").length < 2) {
        entries.push({ contract: "ES", name: "S&P 500 E-mini", type: "Equity", expiry });
        entries.push({ contract: "NQ", name: "Nasdaq E-mini", type: "Equity", expiry });
        entries.push({ contract: "YM", name: "Dow Jones Mini", type: "Equity", expiry });
      }
    }
  }

  // Energy (CL) — approx 20th of prior month
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 20);
    if (d > now) entries.push({ contract: "CL", name: "WTI Crude Oil", type: "Energy", expiry: d });
  }

  // Metals (GC) — last biz day of delivery month
  for (let i = 0; i < 3; i++) {
    const d = lastBizDay(now.getFullYear(), now.getMonth() + i);
    if (d > now) entries.push({ contract: "GC", name: "Gold", type: "Metal", expiry: d });
  }

  // Bonds quarterly — last biz day of Mar/Jun/Sep/Dec
  for (const m of [2, 5, 8, 11]) {
    const d = lastBizDay(now.getFullYear(), m);
    if (d > now && entries.filter(e => e.contract === "ZN").length < 2) {
      entries.push({ contract: "ZN", name: "10-Year T-Note", type: "Bond", expiry: d });
      entries.push({ contract: "ZB", name: "30-Year T-Bond", type: "Bond", expiry: d });
    }
  }

  return entries
    .sort((a, b) => a.expiry.getTime() - b.expiry.getTime())
    .slice(0, 14);
}

// ─── Exchange Badge ─────────────────────────────────────────────────────────────

function ExchangeBadge({ exchange }: { exchange: string }) {
  const color = EXCHANGE_COLORS[exchange] ?? "#71717a";
  return (
    <span
      className="inline-block rounded px-1 py-0.5 text-[8px] font-bold tracking-wider"
      style={{ color, background: `${color}18`, border: `1px solid ${color}30` }}
    >
      {exchange}
    </span>
  );
}

// ─── Sparkline Cell ─────────────────────────────────────────────────────────────

function SparklineCell({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) return <div className="w-16 h-8" />;
  const pts = data.map((v, i) => ({ i, v }));
  const color = up ? "#10b981" : "#ef4444";
  return (
    <ResponsiveContainer width={64} height={32}>
      <LineChart data={pts} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Top Bar ───────────────────────────────────────────────────────────────────

function TopBar({ data }: { data: FuturesData | null }) {
  const all = data
    ? [...data.equity, ...data.energy, ...data.metals, ...data.bonds, ...data.crypto]
    : [];
  const map = new Map(all.map((c) => [c.symbol, c]));

  return (
    <div className="flex flex-wrap gap-2 mb-4 rounded-2xl border border-white/10 bg-[#050713] px-4 py-3">
      {TOP_BAR_SYMBOLS.map((sym) => {
        const c = map.get(sym);
        const up = (c?.changePercent ?? 0) >= 0;
        return (
          <div key={sym} className="flex items-center gap-3 pr-4 border-r border-white/[0.06] last:border-r-0">
            <div>
              <p className="text-[10px] font-semibold text-zinc-500 leading-none mb-0.5">{c?.ticker ?? sym.replace("=F","")}</p>
              <p className="text-sm font-bold tabular-nums text-zinc-100 leading-none">{fmtSmart(c?.price ?? null)}</p>
            </div>
            <div className={`text-[11px] font-semibold tabular-nums ${up ? "text-emerald-400" : "text-red-400"}`}>
              <div>{c?.change != null ? `${up ? "+" : ""}${fmtSmart(c.change)}` : "—"}</div>
              <div>{c?.changePercent != null ? `${up ? "+" : ""}${c.changePercent.toFixed(2)}%` : ""}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Market Hours ──────────────────────────────────────────────────────────────

function MarketHours() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const utcHour = now.getUTCHours();
  const utcDay = now.getUTCDay(); // 0=Sun, 6=Sat

  return (
    <div className="rounded-xl border border-white/10 bg-[#050713] p-3 mb-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-2">Market Sessions</p>
      <div className="grid grid-cols-2 gap-1.5">
        {MARKET_HOURS.map((m) => {
          const isWeekend = utcDay === 0 && utcHour < 22 || utcDay === 6;
          const isOpen = !isWeekend && (utcHour >= m.open || utcHour < m.close);
          return (
            <div key={m.name} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2 py-1.5">
              <div>
                <p className="text-[10px] font-medium text-zinc-300">{m.name}</p>
                <p className="text-[8px] text-zinc-600">{m.note}</p>
              </div>
              <span className={`text-[9px] font-bold rounded px-1.5 py-0.5 ${isOpen ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
                {isOpen ? "OPEN" : "CLOSED"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TradingView Chart ─────────────────────────────────────────────────────────

function TradingViewChart({ tvSymbol }: { tvSymbol: string }) {
  const src = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(tvSymbol)}&interval=D&hidesidetoolbar=1&theme=dark&style=1&locale=en&toolbar_bg=%23050713&enable_publishing=0&save_image=0`;
  return (
    <iframe
      key={tvSymbol}
      src={src}
      className="w-full rounded-xl border border-white/10"
      style={{ height: 380, border: "none" }}
      allowTransparency
    />
  );
}

// ─── Term Structure Chart ──────────────────────────────────────────────────────

function TermStructureChart({
  points,
  status,
  label,
}: {
  points: TermPoint[];
  status: string;
  label: string;
}) {
  if (points.length < 2) return <p className="text-xs text-zinc-600 py-4 text-center">Term structure data unavailable</p>;
  const isContango = status === "contango";
  return (
    <div className="rounded-xl border border-white/10 bg-[#050713] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-zinc-300">{label} — Futures Curve</p>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded ${isContango ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"}`}
        >
          {isContango ? "CONTANGO" : "BACKWARDATION"}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={points} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#71717a" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 9, fill: "#71717a" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => fmtSmart(v)}
            width={55}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{ background: "#0a0e1a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 10 }}
            formatter={(v: number) => [fmtSmart(v), "Price"]}
          />
          <Line
            type="monotone" dataKey="price"
            stroke={isContango ? "#ef4444" : "#10b981"}
            strokeWidth={2} dot={{ r: 3, fill: isContango ? "#ef4444" : "#10b981" }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-[10px] text-zinc-500 leading-relaxed">
        {isContango
          ? `${label} is in contango — front month trades at a discount to deferred contracts, typically signaling near-term oversupply or weak demand.`
          : `${label} is in backwardation — front month trades at a premium to deferred contracts, typically signaling tight near-term supply or strong spot demand.`
        }
      </p>
    </div>
  );
}

// ─── COT Card ─────────────────────────────────────────────────────────────────

function COTCard({ market }: { market: COTMarket }) {
  const cNet = market.commercialNet;
  const nNet = market.nonCommNet;
  const wChg = market.weeklyChange;
  if (cNet === null) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#050713] p-3">
        <p className="text-xs font-semibold text-zinc-300 mb-1">{market.name}</p>
        <p className="text-[10px] text-zinc-600">COT data unavailable</p>
      </div>
    );
  }
  const maxAbs = Math.max(Math.abs(cNet ?? 0), Math.abs(nNet ?? 0), 1);
  const cPct = ((cNet ?? 0) / maxAbs) * 100;
  const nPct = ((nNet ?? 0) / maxAbs) * 100;
  const cBull = (cNet ?? 0) > 0;
  const nBull = (nNet ?? 0) > 0;

  return (
    <div className="rounded-xl border border-white/10 bg-[#050713] p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-zinc-200">{market.name}</p>
        <div className="flex items-center gap-1.5">
          {wChg !== null && (
            <span className={`text-[9px] font-medium ${wChg > 0 ? "text-emerald-400" : "text-red-400"}`}>
              {wChg > 0 ? "↑" : "↓"}{fmtLarge(Math.abs(wChg))} wk
            </span>
          )}
          {market.reportDate && (
            <span className="text-[8px] text-zinc-700">{market.reportDate}</span>
          )}
        </div>
      </div>

      {/* Commercial */}
      <div className="mb-2">
        <div className="flex justify-between text-[9px] text-zinc-500 mb-0.5">
          <span>Commercials</span>
          <span className={cBull ? "text-emerald-400" : "text-red-400"}>{cBull ? "+" : ""}{fmtLarge(cNet ?? 0)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.abs(cPct)}%`,
              background: cBull ? "#10b981" : "#ef4444",
              marginLeft: cBull ? "50%" : `${50 - Math.abs(cPct)}%`,
            }}
          />
        </div>
      </div>

      {/* Non-commercial (speculators) */}
      <div className="mb-2">
        <div className="flex justify-between text-[9px] text-zinc-500 mb-0.5">
          <span>Speculators</span>
          <span className={nBull ? "text-emerald-400" : "text-red-400"}>{nBull ? "+" : ""}{fmtLarge(nNet ?? 0)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.abs(nPct)}%`,
              background: nBull ? "#10b981" : "#ef4444",
              marginLeft: nBull ? "50%" : `${50 - Math.abs(nPct)}%`,
            }}
          />
        </div>
      </div>

      <p className="text-[9px] text-zinc-600 leading-snug">
        {cBull
          ? `Commercials net long — large hedgers are bullish ${market.name}.`
          : `Commercials net short — large hedgers are bearish ${market.name}.`
        }
        {nBull !== cBull ? " Speculators positioned opposite." : ""}
      </p>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  contract,
  termData,
  onClose,
}: {
  contract: FuturesContract;
  termData: TermData | null;
  onClose: () => void;
}) {
  const tvSym = TV_SYMBOLS[contract.symbol] ?? contract.symbol;
  const up = (contract.changePercent ?? 0) >= 0;

  const termCurve =
    contract.symbol === "CL=F" || contract.symbol === "BZ=F" ? termData?.oil :
    contract.symbol === "GC=F" || contract.symbol === "SI=F" ? termData?.gold :
    contract.symbol === "NG=F" ? termData?.gas : null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto bg-[#070b16] border-l border-white/10 shadow-2xl">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#070b16] border-b border-white/10 px-5 py-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <ExchangeBadge exchange={contract.exchange} />
            <span className="text-[10px] text-zinc-500">{contract.symbol}</span>
          </div>
          <h2 className="text-base font-semibold text-zinc-100">{contract.name}</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xl font-black tabular-nums text-zinc-50">{fmtSmart(contract.price)}</span>
            <span className={`text-sm font-semibold tabular-nums ${up ? "text-emerald-400" : "text-red-400"}`}>
              {contract.change != null ? `${up ? "+" : ""}${fmtSmart(contract.change)}` : ""}{" "}
              {contract.changePercent != null ? `(${up ? "+" : ""}${contract.changePercent.toFixed(2)}%)` : ""}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-zinc-200 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* OHLV stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Open",  value: fmtSmart(contract.open) },
            { label: "High",  value: fmtSmart(contract.high) },
            { label: "Low",   value: fmtSmart(contract.low)  },
            { label: "Volume",value: fmtVol(contract.volume) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2 text-center">
              <p className="text-[9px] text-zinc-600 uppercase tracking-wider">{label}</p>
              <p className="text-xs font-semibold text-zinc-200 tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        {/* TradingView chart */}
        <TradingViewChart tvSymbol={tvSym} />

        {/* Term structure */}
        {termCurve && termCurve.points.length >= 2 && (
          <TermStructureChart
            points={termCurve.points}
            status={termCurve.status}
            label={contract.name}
          />
        )}
      </div>
    </div>
  );
}

// ─── Futures Table ─────────────────────────────────────────────────────────────

function FuturesTable({
  contracts,
  onSelect,
  selected,
}: {
  contracts: FuturesContract[];
  onSelect: (c: FuturesContract) => void;
  selected: FuturesContract | null;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("changePercent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = [...contracts].sort((a, b) => {
    const av = a[sortKey] ?? -Infinity;
    const bv = b[sortKey] ?? -Infinity;
    if (typeof av === "string" && typeof bv === "string") {
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th
      className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 text-left cursor-pointer hover:text-zinc-300 select-none"
      onClick={() => toggleSort(k)}
    >
      {children} {sortKey === k ? (sortDir === "desc" ? "↓" : "↑") : ""}
    </th>
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-[#050713] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th k="name">Contract</Th>
              <Th k="price">Price</Th>
              <Th k="changePercent">Change</Th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 text-left">O / H / L</th>
              <Th k="volume">Volume</Th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 text-left">7D</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const up = (c.changePercent ?? 0) >= 0;
              const isSelected = selected?.symbol === c.symbol;
              return (
                <tr
                  key={c.symbol}
                  onClick={() => onSelect(c)}
                  className={`border-b border-white/[0.04] cursor-pointer transition-colors ${
                    isSelected ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-[11px] font-semibold text-zinc-100">{c.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <ExchangeBadge exchange={c.exchange} />
                          <span className="text-[9px] text-zinc-600">{c.symbol}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-sm font-bold tabular-nums text-zinc-100">{fmtSmart(c.price)}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className={`font-semibold tabular-nums text-xs ${up ? "text-emerald-400" : "text-red-400"}`}>
                      <div>{c.change != null ? `${up ? "+" : ""}${fmtSmart(c.change)}` : "—"}</div>
                      <div>{c.changePercent != null ? `${up ? "+" : ""}${c.changePercent.toFixed(2)}%` : ""}</div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-[10px] tabular-nums text-zinc-500 space-y-0.5">
                      <div><span className="text-zinc-600">O </span>{fmtSmart(c.open)}</div>
                      <div><span className="text-zinc-600">H </span>{fmtSmart(c.high)}</div>
                      <div><span className="text-zinc-600">L </span>{fmtSmart(c.low)}</div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs tabular-nums text-zinc-400">{fmtVol(c.volume)}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <SparklineCell data={c.sparkline} up={up} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <svg className="h-4 w-4 text-zinc-600 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Full-width Term Structure Section ─────────────────────────────────────────

function TermStructureSection({ termData }: { termData: TermData | null }) {
  if (!termData) return null;
  const curves = [
    { label: "WTI Crude Oil", data: termData.oil },
    { label: "Gold",          data: termData.gold },
    { label: "Natural Gas",   data: termData.gas },
  ].filter(c => c.data.points.length >= 2);
  if (curves.length === 0) return null;

  return (
    <div className="mt-6">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-3">Futures Curve — Term Structure</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {curves.map(({ label, data }) => (
          <TermStructureChart key={label} points={data.points} status={data.status} label={label} />
        ))}
      </div>
    </div>
  );
}

// ─── COT Section ──────────────────────────────────────────────────────────────

function COTSection({ markets }: { markets: COTMarket[] }) {
  return (
    <div className="mt-6">
      <div className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Commitment of Traders — Institutional Positioning</p>
        <p className="text-[10px] text-zinc-700 mt-0.5">Updated weekly by the CFTC. Commercial hedgers vs. speculative funds.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {markets.map((m) => <COTCard key={m.symbol} market={m} />)}
      </div>
    </div>
  );
}

// ─── Futures Calendar ─────────────────────────────────────────────────────────

function FuturesCalendar() {
  const entries = computeCalendar();
  const now = new Date();

  const TYPE_COLORS: Record<string, string> = {
    Equity: "#3b82f6", Energy: "#f59e0b",
    Metal: "#eab308", Bond: "#10b981",
  };

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-[#050713] overflow-hidden">
      <div className="px-5 py-3 border-b border-white/[0.06]">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Upcoming Futures Expirations</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["Contract", "Name", "Type", "Expiry Date", "Days Until"].map(h => (
                <th key={h} className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => {
              const daysUntil = Math.ceil((e.expiry.getTime() - now.getTime()) / 86400000);
              const urgent = daysUntil <= 3;
              const soon = daysUntil <= 7;
              const color = TYPE_COLORS[e.type] ?? "#71717a";
              return (
                <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.03]">
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-bold text-zinc-200">{e.contract}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-zinc-400">{e.name}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color, background: `${color}18` }}>
                      {e.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs tabular-nums text-zinc-400">
                      {e.expiry.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-semibold tabular-nums ${urgent ? "text-red-400" : soon ? "text-amber-400" : "text-zinc-400"}`}>
                      {daysUntil}d
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function FuturesView() {
  const [data, setData] = useState<FuturesData | null>(null);
  const [termData, setTermData] = useState<TermData | null>(null);
  const [cotMarkets, setCotMarkets] = useState<COTMarket[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("equity");
  const [selected, setSelected] = useState<FuturesContract | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMain = useCallback(async () => {
    try {
      const r = await fetch("/api/futures");
      if (r.ok) setData(await r.json() as FuturesData);
    } catch { /* keep previous */ }
    finally { setLoading(false); }
  }, []);

  const loadSupplemental = useCallback(async () => {
    try {
      const [tRes, cRes] = await Promise.all([
        fetch("/api/futures/term-structure"),
        fetch("/api/futures/cot"),
      ]);
      if (tRes.ok) setTermData(await tRes.json() as TermData);
      if (cRes.ok) {
        const d = await cRes.json() as { markets: COTMarket[] };
        setCotMarkets(d.markets);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadMain();
    loadSupplemental();
    timerRef.current = setInterval(loadMain, 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loadMain, loadSupplemental]);

  const contracts = data?.[activeTab] ?? [];
  const showTermStructure = activeTab === "energy" || activeTab === "metals";

  return (
    <div>
      {/* Top summary bar */}
      <TopBar data={data} />

      {/* Market hours */}
      <MarketHours />

      {/* Tab bar */}
      <div className="flex gap-0.5 rounded-xl border border-white/10 bg-white/[0.02] p-1 mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setActiveTab(t.key); setSelected(null); }}
            className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === t.key ? "bg-white/10 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      ) : (
        <FuturesTable
          contracts={contracts}
          onSelect={setSelected}
          selected={selected}
        />
      )}

      {/* Term structure (Energy + Metals tabs) */}
      {showTermStructure && <TermStructureSection termData={termData} />}

      {/* COT Positioning */}
      {cotMarkets.length > 0 && <COTSection markets={cotMarkets} />}

      {/* Expiration Calendar */}
      <FuturesCalendar />

      {/* Detail panel overlay */}
      {selected && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />
          <DetailPanel
            contract={selected}
            termData={termData}
            onClose={() => setSelected(null)}
          />
        </>
      )}
    </div>
  );
}
