"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartTooltip,
  ResponsiveContainer, LineChart, Line, ReferenceLine,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type ForexPair = {
  symbol: string; base: string; quote: string;
  rate: number; bid: number; ask: number; spread: number;
  change: number; changePct: number;
  high24h: number; low24h: number;
  baseFlag: string; quoteFlag: string;
};

type ForexData = {
  majors: ForexPair[]; minors: ForexPair[];
  exotics: ForexPair[]; commodities: ForexPair[];
  dxy: { value: number; change: number; changePct: number; history: { date: string; value: number }[] } | null;
  lastUpdated: string;
};

type StrengthData = Record<string, number> & { lastUpdated: string };

type NewsArticle = {
  title: string; source: string; url: string;
  publishedAt: string; summary: string; relatedPairs: string[];
};

type EconEvent = {
  id: string; name: string; date: string; dateTimeET: string;
  impact: "HIGH" | "MEDIUM" | "LOW"; country: string;
  previous?: string; estimate?: string; actual?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD"];

const CURRENCY_FLAGS: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵",
  CHF: "🇨🇭", AUD: "🇦🇺", CAD: "🇨🇦", NZD: "🇳🇿",
};

// Sessions in UTC hours [open, close] — Sydney wraps midnight so split
const SESSIONS = [
  { name: "Sydney",   city: "Sydney",   abbr: "AEST", openUtc: 21, closeUtc: 6,  color: "#22d3ee", flag: "🇦🇺" },
  { name: "Tokyo",    city: "Tokyo",    abbr: "JST",  openUtc: 0,  closeUtc: 9,  color: "#a855f7", flag: "🇯🇵" },
  { name: "London",   city: "London",   abbr: "GMT",  openUtc: 7,  closeUtc: 16, color: "#f59e0b", flag: "🇬🇧" },
  { name: "New York", city: "New York", abbr: "EST",  openUtc: 13, closeUtc: 22, color: "#4ade80", flag: "🇺🇸" },
] as const;

// Static central bank rates (updated periodically)
const CB_RATES = [
  { flag: "🇺🇸", currency: "USD", bank: "Federal Reserve", rate: 4.33, lastChange: "Nov 2024 ↓ 0.25%", nextMeeting: "May 2025" },
  { flag: "🇪🇺", currency: "EUR", bank: "ECB",             rate: 2.65, lastChange: "Jan 2025 ↓ 0.25%", nextMeeting: "Apr 2025" },
  { flag: "🇯🇵", currency: "JPY", bank: "Bank of Japan",   rate: 0.50, lastChange: "Jan 2025 ↑ 0.25%", nextMeeting: "May 2025" },
  { flag: "🇬🇧", currency: "GBP", bank: "Bank of England", rate: 4.50, lastChange: "Feb 2025 ↓ 0.25%", nextMeeting: "May 2025" },
  { flag: "🇨🇭", currency: "CHF", bank: "SNB",             rate: 0.25, lastChange: "Mar 2025 ↓ 0.25%", nextMeeting: "Jun 2025" },
  { flag: "🇦🇺", currency: "AUD", bank: "RBA",             rate: 4.10, lastChange: "Feb 2025 ↓ 0.25%", nextMeeting: "Apr 2025" },
  { flag: "🇨🇦", currency: "CAD", bank: "Bank of Canada",  rate: 2.75, lastChange: "Mar 2025 ↓ 0.25%", nextMeeting: "Apr 2025" },
  { flag: "🇳🇿", currency: "NZD", bank: "RBNZ",            rate: 3.75, lastChange: "Feb 2025 ↓ 0.50%", nextMeeting: "Apr 2025" },
];

const FOREX_COUNTRIES = new Set(["US", "EU", "GB", "JP", "AU", "CA", "NZ", "CH", "DE", "FR"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRate(rate: number, symbol: string): string {
  const isJPY = symbol.includes("JPY");
  const isMetal = symbol.startsWith("XAU") || symbol.startsWith("XAG") || symbol.startsWith("XPT") || symbol.startsWith("XPD");
  if (isMetal) return rate.toFixed(2);
  return isJPY ? rate.toFixed(3) : rate.toFixed(5);
}

function pct(v: number): string { return (v >= 0 ? "+" : "") + v.toFixed(2) + "%"; }
function pctCls(v: number): string { return v >= 0 ? "text-emerald-400" : "text-red-400"; }

function getTVSymbol(pair: string): string {
  const [base, quote] = pair.split("/");
  if (!base || !quote) return "FX:EURUSD";
  if (base === "XAU") return "OANDA:XAUUSD";
  if (base === "XAG") return "OANDA:XAGUSD";
  if (base === "XPT") return "OANDA:XPTUSD";
  if (base === "XPD") return "OANDA:XPDUSD";
  return `FX:${base}${quote}`;
}

function isSessionOpen(session: (typeof SESSIONS)[number], utcH: number): boolean {
  if (session.openUtc < session.closeUtc) return utcH >= session.openUtc && utcH < session.closeUtc;
  return utcH >= session.openUtc || utcH < session.closeUtc; // wraps midnight (Sydney)
}

function timeSince(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ago`;
}

// ─── TradingView Widget ───────────────────────────────────────────────────────

function TradingViewWidget({ symbol }: { symbol: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      autosize: true, symbol, interval: "60", timezone: "Etc/UTC",
      theme: "dark", style: "1", locale: "en",
      backgroundColor: "rgba(5,7,19,0)", gridColor: "rgba(255,255,255,0.04)",
      hide_side_toolbar: true, allow_symbol_change: false,
      save_image: false, calendar: false,
    });
    ref.current.appendChild(script);
    return () => { if (ref.current) ref.current.innerHTML = ""; };
  }, [symbol]);

  return (
    <div
      ref={ref}
      className="tradingview-widget-container h-full w-full"
    />
  );
}

// ─── Session Bar ──────────────────────────────────────────────────────────────

function SessionBar() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const utcH = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  const utcFrac = utcH + utcMin / 60;

  // Which sessions are open
  const openSessions = SESSIONS.filter((s) => isSessionOpen(s, utcH));
  const isOverlap = openSessions.length >= 2;

  // 24h timeline: position = hour / 24 * 100%
  function pxPct(h: number) { return (h / 24) * 100; }

  return (
    <div className="border-b border-white/10 bg-[#0A0E1A] px-6 py-3">
      {/* Session indicators */}
      <div className="mb-3 flex flex-wrap gap-3">
        {SESSIONS.map((s) => {
          const open = isSessionOpen(s, utcH);
          const overlap = open && openSessions.length >= 2;
          const localTime = new Date(now.getTime() + (
            s.abbr === "AEST" ? 10 : s.abbr === "JST" ? 9 : s.abbr === "GMT" ? 0 : -5
          ) * 3600000).toUTCString().slice(17, 22);

          return (
            <div
              key={s.name}
              className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs ${
                overlap ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : open   ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                         : "border-white/5 bg-white/5 text-zinc-500"
              }`}
            >
              <span className="text-sm">{s.flag}</span>
              <div>
                <span className="font-semibold">{s.city}</span>
                <span className="ml-1 opacity-60">{s.abbr}</span>
              </div>
              <span className="font-mono tabular-nums">{localTime}</span>
              <span className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                overlap ? "bg-amber-500/20 text-amber-300"
                : open   ? "bg-emerald-500/20 text-emerald-300"
                         : "bg-zinc-700/50 text-zinc-500"
              }`}>
                {open && <span className={`h-1.5 w-1.5 rounded-full ${overlap ? "animate-pulse bg-amber-400" : "animate-pulse bg-emerald-400"}`} />}
                {overlap ? "OVERLAP" : open ? "OPEN" : "CLOSED"}
              </span>
            </div>
          );
        })}
        {isOverlap && (
          <div className="flex items-center rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-[10px] text-amber-400">
            ⚡ Highest liquidity period — {openSessions.map((s) => s.city).join(" / ")} overlap active
          </div>
        )}
      </div>

      {/* 24h timeline */}
      <div className="relative h-5 w-full overflow-hidden rounded-full bg-white/5">
        {SESSIONS.map((s) => {
          if (s.openUtc < s.closeUtc) {
            return (
              <div key={s.name} className="absolute top-0 h-full rounded-sm opacity-30"
                style={{ left: `${pxPct(s.openUtc)}%`, width: `${pxPct(s.closeUtc - s.openUtc)}%`, background: s.color }} />
            );
          }
          // Wraps midnight (Sydney: 21-24 + 0-6)
          return [
            <div key={s.name + "a"} className="absolute top-0 h-full rounded-sm opacity-30"
              style={{ left: `${pxPct(s.openUtc)}%`, width: `${pxPct(24 - s.openUtc)}%`, background: s.color }} />,
            <div key={s.name + "b"} className="absolute top-0 h-full rounded-sm opacity-30"
              style={{ left: 0, width: `${pxPct(s.closeUtc)}%`, background: s.color }} />,
          ];
        })}
        {/* Current time indicator */}
        <div className="absolute top-0 h-full w-0.5 bg-white/70"
          style={{ left: `${pxPct(utcFrac)}%` }} />
        {/* Hour labels */}
        {[0, 6, 12, 18].map((h) => (
          <span key={h} className="absolute top-0.5 text-[9px] text-white/30"
            style={{ left: `${pxPct(h)}%`, transform: "translateX(-50%)" }}>{h}:00</span>
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-3">
        {SESSIONS.map((s) => (
          <span key={s.name} className="flex items-center gap-1 text-[9px] text-zinc-600">
            <span className="h-2 w-3 rounded-sm opacity-50" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
        <span className="text-[9px] text-zinc-600">UTC time · All times approximate</span>
      </div>
    </div>
  );
}

// ─── DXY Panel ────────────────────────────────────────────────────────────────

function DXYPanel({ dxy }: { dxy: ForexData["dxy"] }) {
  if (!dxy) return null;
  const strong = dxy.changePct >= 0;

  const DXY_CORRELATIONS = [
    { pair: "EUR/USD", dir: "↓", label: "Strong negative" },
    { pair: "GBP/USD", dir: "↓", label: "Negative" },
    { pair: "Gold",    dir: "↓", label: "Negative" },
    { pair: "USD/JPY", dir: "↑", label: "Positive" },
    { pair: "EM FX",   dir: "↓", label: "Strong negative" },
    { pair: "Oil",     dir: "↓", label: "Moderate negative" },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-[#050713] p-5">
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left: value */}
        <div className="flex flex-col justify-center">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--accent-color)]/70">US Dollar Index</p>
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-black tabular-nums text-zinc-50">{dxy.value.toFixed(2)}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className={`text-lg font-bold tabular-nums ${pctCls(dxy.changePct)}`}>{pct(dxy.changePct)}</span>
            <span className={`text-sm tabular-nums ${pctCls(dxy.change)}`}>({dxy.change >= 0 ? "+" : ""}{dxy.change.toFixed(3)})</span>
          </div>
          <div className={`mt-3 rounded-xl border px-3 py-2 ${strong ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"}`}>
            <p className={`text-sm font-semibold ${strong ? "text-emerald-300" : "text-red-300"}`}>
              {strong ? "Dollar Strengthening" : "Dollar Weakening"}
            </p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-500">
              {strong
                ? "A rising DXY makes USD-priced assets more expensive for foreign buyers. EUR/USD, GBP/USD, and gold typically fall. EM currencies face pressure."
                : "A falling DXY reduces the cost of dollar-denominated assets globally. EUR/USD and commodities typically rally. EM currencies benefit."}
            </p>
          </div>
          {/* Correlation badges */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {DXY_CORRELATIONS.map((c) => (
              <span key={c.pair} className={`rounded border px-2 py-0.5 text-[10px] ${c.dir === "↓" ? "border-red-500/20 bg-red-500/10 text-red-400" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"}`}>
                {c.pair}: {c.dir} {c.label}
              </span>
            ))}
          </div>
        </div>

        {/* Center: chart */}
        <div className="lg:col-span-2">
          <p className="mb-2 text-[10px] text-zinc-600">90-day DXY history</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={dxy.history} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 8, fill: "#52525b" }} tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.08)" }} interval="preserveStartEnd"
                tickFormatter={(d: string) => d.slice(5)} height={14} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 8, fill: "#52525b" }} tickLine={false}
                axisLine={false} width={32} tickCount={4} tickFormatter={(v: number) => v.toFixed(1)} />
              <RechartTooltip
                contentStyle={{ background: "#0f1520", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                formatter={(v) => [typeof v === "number" ? v.toFixed(2) : v, "DXY"]}
              />
              <ReferenceLine y={dxy.history[0]?.value ?? 100} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="value" stroke={strong ? "#4ade80" : "#f87171"}
                dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── Pairs Table ──────────────────────────────────────────────────────────────

type SortKey = "symbol" | "rate" | "changePct" | "spread" | "high24h" | "low24h";

function PairsTable({
  pairs, selected, onSelect,
}: { pairs: ForexPair[]; selected: string; onSelect: (sym: string) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>("changePct");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(key); setSortDir(-1); }
  }

  const sorted = [...pairs].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * sortDir;
    return ((av as number) - (bv as number)) * sortDir;
  });

  function Th({ k, label }: { k: SortKey; label: string }) {
    return (
      <th className="cursor-pointer select-none py-2 pr-3 text-left text-[9px] font-medium uppercase tracking-wider text-zinc-600 hover:text-zinc-400"
        onClick={() => toggleSort(k)}>
        {label}{sortKey === k ? (sortDir === 1 ? " ↑" : " ↓") : ""}
      </th>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-white/5">
            <Th k="symbol" label="Pair" />
            <Th k="rate"   label="Rate" />
            <th className="py-2 pr-3 text-left text-[9px] font-medium uppercase tracking-wider text-zinc-600">Bid</th>
            <th className="py-2 pr-3 text-left text-[9px] font-medium uppercase tracking-wider text-zinc-600">Ask</th>
            <Th k="spread"    label="Spread" />
            <Th k="changePct" label="24h %" />
            <Th k="high24h"   label="24h Hi" />
            <Th k="low24h"    label="24h Lo" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr
              key={p.symbol}
              onClick={() => onSelect(p.symbol)}
              className={`cursor-pointer border-b border-white/5 transition-colors hover:bg-white/5 ${selected === p.symbol ? "bg-[var(--accent-color)]/5" : ""}`}
            >
              <td className="py-2 pr-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{p.baseFlag}{p.quoteFlag}</span>
                  <span className={`font-semibold ${selected === p.symbol ? "text-[var(--accent-color)]" : "text-zinc-100"}`}>{p.symbol}</span>
                </div>
              </td>
              <td className="py-2 pr-3 font-mono tabular-nums text-zinc-200">{formatRate(p.rate, p.symbol)}</td>
              <td className="py-2 pr-3 font-mono tabular-nums text-zinc-500">{formatRate(p.bid, p.symbol)}</td>
              <td className="py-2 pr-3 font-mono tabular-nums text-zinc-500">{formatRate(p.ask, p.symbol)}</td>
              <td className="py-2 pr-3 text-zinc-500">{p.spread.toFixed(1)}</td>
              <td className={`py-2 pr-3 font-medium tabular-nums ${pctCls(p.changePct)}`}>{pct(p.changePct)}</td>
              <td className="py-2 pr-3 font-mono tabular-nums text-zinc-500">{formatRate(p.high24h, p.symbol)}</td>
              <td className="py-2 font-mono tabular-nums text-zinc-500">{formatRate(p.low24h, p.symbol)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {pairs.length === 0 && (
        <p className="py-8 text-center text-xs text-zinc-600">No data available</p>
      )}
    </div>
  );
}

// ─── Currency Strength Meter ──────────────────────────────────────────────────

function StrengthMeter({ data }: { data: StrengthData | null }) {
  if (!data) return <div className="h-48 animate-pulse rounded-2xl bg-white/5" />;

  const sorted = CURRENCIES
    .filter((c) => typeof data[c] === "number")
    .map((c) => ({ currency: c, value: data[c] as number, flag: CURRENCY_FLAGS[c] ?? "" }))
    .sort((a, b) => b.value - a.value);

  if (sorted.length === 0 || sorted.every((s) => s.value === 0)) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#050713] p-4">
        <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--accent-color)]/70">Strength Index</p>
        <p className="mb-3 text-sm font-semibold text-zinc-100">Currency Strength</p>
        <p className="text-xs text-zinc-600">Strength data unavailable — market may be closed or API limit reached</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#050713] p-4">
      <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--accent-color)]/70">Strength Index</p>
      <p className="mb-3 text-sm font-semibold text-zinc-100">Currency Strength</p>
      <p className="mb-3 text-[10px] text-zinc-600">Relative strength over last 24h · 0=weakest, 100=strongest</p>
      <div className="space-y-2">
        {sorted.map(({ currency, value, flag }) => {
          const color = value >= 65 ? "#4ade80" : value <= 35 ? "#f87171" : "#71717a";
          return (
            <div key={currency} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-[10px] text-zinc-400">{flag} {currency}</span>
              <div className="relative flex-1">
                <div className="h-4 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${value}%`, background: color + "aa" }} />
                </div>
              </div>
              <span className="w-8 shrink-0 text-right text-[10px] font-bold tabular-nums" style={{ color }}>
                {value}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[9px] text-zinc-700">Updated {timeSince(data.lastUpdated)}</p>
    </div>
  );
}

// ─── Central Bank Rates ───────────────────────────────────────────────────────

function CBRatesPanel() {
  const sorted = [...CB_RATES].sort((a, b) => b.rate - a.rate);
  const maxRate = Math.max(...CB_RATES.map((r) => r.rate));
  const minRate = Math.min(...CB_RATES.map((r) => r.rate));
  const usd = CB_RATES.find((r) => r.currency === "USD")?.rate ?? 0;
  const eur = CB_RATES.find((r) => r.currency === "EUR")?.rate ?? 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#050713] p-4">
      <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--accent-color)]/70">Carry Trade</p>
      <p className="mb-3 text-sm font-semibold text-zinc-100">Central Bank Rates</p>
      <div className="space-y-1.5">
        {sorted.map((r) => {
          const isUp = r.lastChange.includes("↑");
          return (
            <div key={r.currency} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5">
              <span className="text-base">{r.flag}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-zinc-200">{r.currency}</span>
                  <span className="text-[9px] text-zinc-600">{r.bank}</span>
                </div>
                <p className="text-[9px] text-zinc-600">{r.lastChange}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums text-zinc-100">{r.rate.toFixed(2)}%</p>
                <div className="h-1 w-16 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-[var(--accent-color)]/60"
                    style={{ width: `${((r.rate - minRate) / (maxRate - minRate || 1)) * 100}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
        <p className="text-[10px] leading-relaxed text-zinc-500">
          <span className="font-medium text-zinc-300">Rate differential</span> — USD vs EUR:{" "}
          <span className="font-medium text-emerald-400">+{(usd - eur).toFixed(2)}%</span>.
          {" "}Carry traders borrow the low-yield currency (JPY/CHF) and invest in high-yield (USD/GBP/AUD).
        </p>
      </div>
    </div>
  );
}

// ─── Carry Trade Opportunities ────────────────────────────────────────────────

function CarryTradePanel({ pairs }: { pairs: ForexPair[] }) {
  const carries = CB_RATES.flatMap((high) =>
    CB_RATES
      .filter((low) => low.currency !== high.currency && high.rate - low.rate > 2)
      .map((low) => ({
        long: high.currency, short: low.currency,
        differential: Math.round((high.rate - low.rate) * 100) / 100,
        pair: `${high.currency}/${low.currency}`,
        highFlag: high.flag, lowFlag: low.flag,
        risk: high.rate - low.rate > 4 ? "High" : high.rate - low.rate > 3 ? "Medium" : "Low",
      }))
  ).sort((a, b) => b.differential - a.differential).slice(0, 4);

  const riskCls: Record<string, string> = {
    Low:    "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    Medium: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    High:   "border-red-500/30 bg-red-500/10 text-red-400",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#050713] p-4">
      <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--accent-color)]/70">Strategy</p>
      <p className="mb-1 text-sm font-semibold text-zinc-100">Carry Trade Opportunities</p>
      <p className="mb-3 text-[10px] text-zinc-600">Borrow low-yield · Invest high-yield · Profit from the rate differential</p>
      <div className="space-y-2">
        {carries.map((c) => (
          <div key={c.pair} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{c.highFlag}</span>
                <span className="text-xs font-bold text-zinc-200">Long {c.long}</span>
                <span className="text-zinc-600">/</span>
                <span className="text-xs font-bold text-zinc-200">Short {c.long === "USD" ? "JPY" : c.short}</span>
                <span className="text-sm">{c.lowFlag}</span>
              </div>
              <span className={`rounded border px-1.5 py-0.5 text-[9px] font-medium ${riskCls[c.risk] ?? ""}`}>{c.risk} Risk</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-emerald-400 text-sm font-bold">+{c.differential.toFixed(2)}% carry</span>
              <span className="text-[9px] text-zinc-600">annual rate differential</span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[9px] leading-relaxed text-zinc-600">
        Carry trades profit when the exchange rate stays stable or moves in favour of the high-yield currency.
        They unwind rapidly during risk-off events — especially JPY and CHF shorts.
      </p>
    </div>
  );
}

// ─── News Panel ───────────────────────────────────────────────────────────────

function NewsPanel({ articles }: { articles: NewsArticle[] }) {
  const PAIR_COLORS: Record<string, string> = {
    "EUR/USD": "#6366f1", "GBP/USD": "#8b5cf6", "USD/JPY": "#ec4899",
    "USD/CHF": "#06b6d4", "AUD/USD": "#f59e0b", "USD/CAD": "#f97316",
    "NZD/USD": "#14b8a6", "XAU/USD": "#eab308",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#050713] p-4">
      <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--accent-color)]/70">Market Intelligence</p>
      <p className="mb-3 text-sm font-semibold text-zinc-100">Forex News</p>
      {articles.length === 0 ? (
        <p className="text-xs text-zinc-600">No news available</p>
      ) : (
        <div className="space-y-3">
          {articles.slice(0, 6).map((a, i) => (
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
              className="block rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-colors hover:bg-white/5">
              <p className="mb-1 text-[11px] font-medium leading-snug text-zinc-200 line-clamp-2">{a.title}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[9px] text-zinc-600">{a.source}</span>
                <span className="text-zinc-700">·</span>
                <span className="text-[9px] text-zinc-600">{timeSince(a.publishedAt)}</span>
                {a.relatedPairs.map((p) => (
                  <span key={p} className="rounded px-1.5 py-0.5 text-[9px] font-medium"
                    style={{ background: (PAIR_COLORS[p] ?? "#6366f1") + "22", color: PAIR_COLORS[p] ?? "#6366f1" }}>
                    {p}
                  </span>
                ))}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Economic Calendar ────────────────────────────────────────────────────────

function localDate(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function EconCalPanel() {
  const [events, setEvents] = useState<EconEvent[]>([]);
  const today    = localDate(0);
  const tomorrow = localDate(1);

  useEffect(() => {
    fetch("/api/calendar/economic")
      .then((r) => r.json())
      .then((d: { economic?: EconEvent[] }) => {
        const todayStr = localDate(0);
        const filtered = (d.economic ?? [])
          .filter((e) => (e.impact === "HIGH" || e.impact === "MEDIUM") && FOREX_COUNTRIES.has(e.country) && e.date >= todayStr)
          .sort((a, b) => a.date.localeCompare(b.date));
        setEvents(filtered);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function groupLabel(date: string): string {
    if (date === today) return "Today";
    if (date === tomorrow) return "Tomorrow";
    return date;
  }

  const grouped = events.reduce<Record<string, EconEvent[]>>((acc, e) => {
    const key = groupLabel(e.date);
    (acc[key] ??= []).push(e);
    return acc;
  }, {});

  // Sort group keys: Today first, Tomorrow second, then chronological date order
  const groupOrder = Object.keys(grouped).sort((a, b) => {
    if (a === "Today") return -1;
    if (b === "Today") return 1;
    if (a === "Tomorrow") return -1;
    if (b === "Tomorrow") return 1;
    return a.localeCompare(b);
  });

  const COUNTRY_FLAGS: Record<string, string> = {
    US: "🇺🇸", EU: "🇪🇺", DE: "🇩🇪", FR: "🇫🇷", GB: "🇬🇧",
    JP: "🇯🇵", AU: "🇦🇺", CA: "🇨🇦", NZ: "🇳🇿", CH: "🇨🇭",
  };

  const impactCls: Record<string, string> = {
    HIGH:   "border-l-4 border-red-500",
    MEDIUM: "border-l-4 border-amber-500",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#050713] p-5">
      <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--accent-color)]/70">Upcoming</p>
      <p className="mb-1 text-base font-semibold text-zinc-100">Forex Economic Calendar</p>
      <p className="mb-4 text-xs text-zinc-500">High and medium impact events affecting forex markets · Times in ET</p>

      {Object.keys(grouped).length === 0 ? (
        <p className="text-xs text-zinc-600">Loading events…</p>
      ) : (
        <div className="space-y-5">
          {groupOrder.map((group) => { const evts = grouped[group]!; return (
            <div key={group}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{group}</p>
              <div className="space-y-1.5">
                {evts.map((e) => (
                  <div key={e.id} className={`rounded-xl bg-white/[0.02] p-3 ${impactCls[e.impact] ?? ""}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm">{COUNTRY_FLAGS[e.country] ?? "🌐"}</span>
                      <span className="text-[10px] font-mono text-zinc-500">{e.dateTimeET?.slice(11, 16) ?? "—"} ET</span>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                        e.impact === "HIGH" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
                      }`}>{e.impact}</span>
                      <span className="flex-1 text-[11px] font-medium text-zinc-200">{e.name}</span>
                    </div>
                    {(e.previous || e.estimate || e.actual) && (
                      <div className="mt-1.5 flex gap-4 text-[9px]">
                        {e.previous && <span className="text-zinc-600">Prev: <span className="text-zinc-400">{e.previous}</span></span>}
                        {e.estimate && <span className="text-zinc-600">Est: <span className="text-zinc-400">{e.estimate}</span></span>}
                        {e.actual   && <span className="text-zinc-600">Act: <span className={e.actual > (e.estimate ?? e.actual) ? "text-emerald-400" : "text-red-400"}>{e.actual}</span></span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}

// ─── Main ForexView ───────────────────────────────────────────────────────────

export default function ForexView() {
  const [data, setData]         = useState<ForexData | null>(null);
  const [strength, setStrength] = useState<StrengthData | null>(null);
  const [news, setNews]         = useState<NewsArticle[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab]   = useState<"majors" | "minors" | "exotics" | "commodities">("majors");
  const [selectedPair, setSelectedPair] = useState("EUR/USD");
  const [lastUpdated, setLastUpdated]   = useState<Date | null>(null);

  const fetchRates = useCallback(async () => {
    try {
      const res = await fetch("/api/forex/rates");
      if (res.ok) {
        const d = await res.json() as ForexData;
        setData(d);
        setLastUpdated(new Date());
      }
    } catch {}
    setLoading(false);
  }, []);

  const fetchStrength = useCallback(async () => {
    try {
      const res = await fetch("/api/forex/strength");
      if (res.ok) setStrength(await res.json() as StrengthData);
    } catch {}
  }, []);

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch("/api/forex/news");
      if (res.ok) {
        const d = await res.json() as { articles?: NewsArticle[] };
        setNews(d.articles ?? []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    void fetchRates();
    void fetchStrength();
    void fetchNews();
    const ratesInterval    = setInterval(fetchRates,    30_000);
    const strengthInterval = setInterval(fetchStrength, 300_000);
    const newsInterval     = setInterval(fetchNews,     600_000);
    return () => { clearInterval(ratesInterval); clearInterval(strengthInterval); clearInterval(newsInterval); };
  }, [fetchRates, fetchStrength, fetchNews]);

  const TABS: { key: typeof activeTab; label: string }[] = [
    { key: "majors",     label: "Majors" },
    { key: "minors",     label: "Minors" },
    { key: "exotics",    label: "Exotics" },
    { key: "commodities",label: "Commodities" },
  ];

  const activePairs = data ? data[activeTab] : [];

  return (
    <div className="space-y-0">
      {/* Session clock */}
      <SessionBar />

      <div className="space-y-5 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--accent-color)]/70">Live Data</p>
            <h1 className="text-xl font-bold text-zinc-50">Forex Markets</h1>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-zinc-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live {lastUpdated ? `· ${timeSince(lastUpdated.toISOString())}` : ""}
          </div>
        </div>

        {/* DXY */}
        {data?.dxy ? <DXYPanel dxy={data.dxy} /> : loading ? <div className="h-36 animate-pulse rounded-2xl bg-white/5" /> : null}

        {/* Main grid */}
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Left: pairs + chart + calendar */}
          <div className="flex flex-col gap-5 lg:col-span-2">
            {/* Tab bar */}
            <div className="flex gap-1">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                    activeTab === t.key ? "bg-[var(--accent-color)] text-black" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                  }`}>
                  {t.label}
                  {data && <span className="ml-1.5 text-[9px] opacity-60">({data[t.key].length})</span>}
                </button>
              ))}
            </div>

            {/* Pairs table */}
            <div className="rounded-2xl border border-white/10 bg-[#050713] p-4">
              {loading && !data ? (
                <div className="space-y-2">
                  {[...Array(6)].map((_, i) => <div key={i} className="h-8 rounded-lg bg-white/5" />)}
                </div>
              ) : (
                <PairsTable pairs={activePairs} selected={selectedPair} onSelect={(s) => setSelectedPair(s)} />
              )}
            </div>

            {/* TradingView */}
            <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#050713]" style={{ height: 672 }}>
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-100">{selectedPair}</span>
                  {data && (() => {
                    const allPairs = [...(data.majors ?? []), ...(data.minors ?? []), ...(data.exotics ?? []), ...(data.commodities ?? [])];
                    const p = allPairs.find((x) => x.symbol === selectedPair);
                    return p ? (
                      <>
                        <span className="font-mono text-sm tabular-nums text-zinc-200">{formatRate(p.rate, p.symbol)}</span>
                        <span className={`text-xs font-medium ${pctCls(p.changePct)}`}>{pct(p.changePct)}</span>
                      </>
                    ) : null;
                  })()}
                </div>
                <span className="text-[10px] text-zinc-600">1H chart · TradingView</span>
              </div>
              <div className="flex-1 min-h-0">
                <TradingViewWidget symbol={getTVSymbol(selectedPair)} />
              </div>
            </div>

            {/* Economic calendar — directly below chart, no gap */}
            <EconCalPanel />
          </div>

          {/* Right column */}
          <div className="space-y-5">
            <StrengthMeter data={strength} />
            <CBRatesPanel />
            <CarryTradePanel pairs={activePairs} />
            <NewsPanel articles={news} />
          </div>
        </div>
      </div>
    </div>
  );
}
