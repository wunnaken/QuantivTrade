"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import type { BacktestResult, ParsedStrategy } from "@/lib/backtest/engine";

// ─── Types ────────────────────────────────────────────────────────────────────

type FormState = {
  assetType: string;
  ticker: string;
  startDate: string;
  endDate: string;
  entryConditions: string;
  exitConditions: string;
  positionSizing: string;
  startingCapital: number;
};

type ApiResponse = {
  result: BacktestResult;
  strategy: ParsedStrategy;
  analysis: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPct(n: number, showPlus = true): string {
  const val = (n * 100).toFixed(1);
  if (n > 0 && showPlus) return `+${val}%`;
  return `${val}%`;
}

function fmtDollars(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtChartDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function gradeColor(grade: string): string {
  if (grade === "A+" || grade === "A") return "text-emerald-400 border-emerald-400/40 bg-emerald-400/10";
  if (grade.startsWith("B")) return "text-[var(--accent-color)] border-[var(--accent-color)]/40 bg-[var(--accent-color)]/10";
  if (grade.startsWith("C")) return "text-amber-400 border-amber-400/40 bg-amber-400/10";
  return "text-red-400 border-red-400/40 bg-red-400/10";
}

function retColor(n: number): string {
  if (n > 0) return "text-emerald-400";
  if (n < 0) return "text-red-400";
  return "text-zinc-400";
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all duration-300 ${
            i < current
              ? "bg-[var(--accent-color)] flex-1"
              : i === current
              ? "bg-[var(--accent-color)]/60 flex-[2]"
              : "bg-white/10 flex-1"
          }`}
        />
      ))}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${
        active
          ? "border-[var(--accent-color)]/60 bg-[var(--accent-color)]/15 text-[var(--accent-color)]"
          : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-300"
      }`}
    >
      {label}
    </button>
  );
}

function MetricCard({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="border border-white/10 bg-white/5 rounded-xl p-4">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className={`text-xl font-bold tracking-tight ${valueClass ?? "text-white"}`}>{value}</div>
      {sub && <div className="text-xs text-zinc-600 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function EquityTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0A0E1A] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-zinc-400 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {fmtDollars(p.value)}
        </div>
      ))}
    </div>
  );
}

function DrawdownTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0A0E1A] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-zinc-400 mb-1">{label}</div>
      <div className="text-red-400 font-medium">Drawdown: {fmtPct(payload[0].value, false)}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const ASSET_TYPES = ["Stocks", "Crypto", "ETFs", "Forex"];
const ENTRY_CHIPS = [
  "RSI below 30",
  "Price above 50-day MA",
  "MACD bullish crossover",
  "Price below Bollinger lower band",
  "Price crosses above 200-day MA",
  "EMA 20 above EMA 50",
];
const EXIT_CHIPS = [
  "10% profit target",
  "5% stop loss",
  "RSI above 70",
  "30-day time limit",
  "Price below 50-day MA",
  "15% profit target, 8% stop loss",
];
const SIZING_OPTIONS = [
  "$500 per trade",
  "$1,000 per trade",
  "$2,500 per trade",
  "5% of portfolio",
  "10% of portfolio",
];
const CAPITAL_PRESETS = [10000, 25000, 50000, 100000];

export default function BacktestPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ApiResponse | null>(null);

  const [form, setForm] = useState<FormState>({
    assetType: "Stocks",
    ticker: "",
    startDate: "",
    endDate: "",
    entryConditions: "",
    exitConditions: "",
    positionSizing: "$1,000 per trade",
    startingCapital: 10000,
  });

  const [customPeriod, setCustomPeriod] = useState(false);

  function setPresetPeriod(years: number) {
    const end = new Date();
    const start = new Date();
    start.setFullYear(end.getFullYear() - years);
    setForm((f) => ({
      ...f,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    }));
    setCustomPeriod(false);
  }

  function appendToEntry(chip: string) {
    setForm((f) => ({
      ...f,
      entryConditions: f.entryConditions ? f.entryConditions + ", " + chip : chip,
    }));
  }

  function appendToExit(chip: string) {
    setForm((f) => ({
      ...f,
      exitConditions: f.exitConditions ? f.exitConditions + ", " + chip : chip,
    }));
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Unknown error");
        setLoading(false);
        return;
      }
      setResponse(data as ApiResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    }
    setLoading(false);
  }

  function reset() {
    setResponse(null);
    setError(null);
    setStep(0);
    setForm({
      assetType: "Stocks",
      ticker: "",
      startDate: "",
      endDate: "",
      entryConditions: "",
      exitConditions: "",
      positionSizing: "$1,000 per trade",
      startingCapital: 10000,
    });
  }

  const canNext = [
    true, // step 0: asset type always valid
    form.ticker.trim().length > 0 && form.startDate && form.endDate,
    form.entryConditions.trim().length > 0,
    form.exitConditions.trim().length > 0,
    form.positionSizing.length > 0,
    form.startingCapital > 0,
  ];

  // ─── Loading State ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "#050713" }}>
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-white/10 border-t-[var(--accent-color)] animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--accent-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <div className="text-center">
            <div className="text-white font-semibold text-lg">Running backtest...</div>
            <div className="text-zinc-500 text-sm mt-1">Fetching data and analyzing your strategy</div>
          </div>
          <div className="flex gap-2">
            {["Parsing strategy", "Fetching OHLCV", "Running simulation", "AI analysis"].map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-500">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Results State ──────────────────────────────────────────────────────────

  if (response) {
    const { result, strategy, analysis } = response;
    const { metrics, grade, trades, equityCurve, benchmarkCurve } = result;

    // Merge equity + benchmark into chart data (sample every N points for perf)
    const step2 = Math.max(1, Math.floor(equityCurve.length / 300));
    const chartData = equityCurve
      .filter((_, i) => i % step2 === 0 || i === equityCurve.length - 1)
      .map((e, i) => ({
        date: fmtChartDate(e.date),
        Strategy: e.value,
        "Buy & Hold": benchmarkCurve[Math.min(i * step2, benchmarkCurve.length - 1)]?.value ?? e.value,
        drawdown: e.drawdown * 100,
      }));

    const recentTrades = [...trades].reverse().slice(0, 10);

    return (
      <div className="min-h-screen px-4 py-8 max-w-5xl mx-auto" style={{ background: "#050713" }}>
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--accent-color)" }}>
              Strategy Testing
            </div>
            <h1 className="text-3xl font-bold text-white">Backtest Results</h1>
            <p className="text-zinc-500 text-sm mt-1">
              {strategy.ticker} · {strategy.startDate} to {strategy.endDate} · {strategy.description}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`text-4xl font-black border rounded-xl px-4 py-2 ${gradeColor(grade)}`}>
              {grade}
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <MetricCard
            label="Total Return"
            value={fmtPct(metrics.totalReturn)}
            sub={`vs Buy & Hold ${fmtPct(metrics.buyHoldReturn)}`}
            valueClass={retColor(metrics.totalReturn)}
          />
          <MetricCard
            label="Alpha"
            value={fmtPct(metrics.alpha)}
            sub="vs benchmark"
            valueClass={retColor(metrics.alpha)}
          />
          <MetricCard
            label="Sharpe Ratio"
            value={metrics.sharpeRatio.toFixed(2)}
            sub="annualized"
            valueClass={metrics.sharpeRatio > 1 ? "text-emerald-400" : metrics.sharpeRatio > 0 ? "text-amber-400" : "text-red-400"}
          />
          <MetricCard
            label="Max Drawdown"
            value={fmtPct(metrics.maxDrawdown, false)}
            sub="peak to trough"
            valueClass="text-red-400"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <MetricCard label="Win Rate" value={fmtPct(metrics.winRate, false)} sub={`${metrics.totalTrades} trades`} />
          <MetricCard
            label="Profit Factor"
            value={metrics.profitFactor >= 99 ? "∞" : metrics.profitFactor.toFixed(2)}
            sub="wins / losses"
            valueClass={metrics.profitFactor > 1.5 ? "text-emerald-400" : "text-white"}
          />
          <MetricCard
            label="Avg Win / Loss"
            value={`${fmtPct(metrics.avgWin)} / ${fmtPct(metrics.avgLoss, false)}`}
            sub="per trade"
          />
          <MetricCard
            label="Avg Hold Time"
            value={`${metrics.avgHoldTime.toFixed(0)}d`}
            sub={`Best: ${fmtPct(metrics.bestTrade)}`}
          />
        </div>

        {/* Equity Chart */}
        <div className="border border-white/10 bg-white/5 rounded-xl p-5 mb-4">
          <div className="text-sm font-semibold text-white mb-4">Portfolio Value</div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="stratGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-color)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent-color)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="benchGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6B7280" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6B7280" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fill: "#6B7280", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#6B7280", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => fmtDollars(v)}
                width={70}
              />
              <Tooltip content={<EquityTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, color: "#9CA3AF" }}
              />
              <Area
                type="monotone"
                dataKey="Strategy"
                stroke="var(--accent-color)"
                strokeWidth={2}
                fill="url(#stratGrad)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="Buy & Hold"
                stroke="#6B7280"
                strokeWidth={1.5}
                fill="url(#benchGrad)"
                dot={false}
                strokeDasharray="4 2"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Drawdown Chart */}
        <div className="border border-white/10 bg-white/5 rounded-xl p-5 mb-6">
          <div className="text-sm font-semibold text-white mb-4">Drawdown</div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fill: "#6B7280", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#6B7280", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v.toFixed(0)}%`}
                width={50}
              />
              <Tooltip content={<DrawdownTooltip />} />
              <Area
                type="monotone"
                dataKey="drawdown"
                stroke="#EF4444"
                strokeWidth={1.5}
                fill="url(#ddGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Two-column: Trade History + Yearly Returns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Trade History */}
          <div className="border border-white/10 bg-white/5 rounded-xl p-5">
            <div className="text-sm font-semibold text-white mb-4">Recent Trades</div>
            {recentTrades.length === 0 ? (
              <div className="text-zinc-500 text-sm">No trades executed.</div>
            ) : (
              <div className="space-y-2">
                {recentTrades.map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="text-zinc-300 font-medium">{fmtDate(t.entryDate)} → {fmtDate(t.exitDate)}</div>
                      <div className="text-zinc-600 truncate">{t.exitReason} · {t.daysHeld}d</div>
                    </div>
                    <div className={`font-bold ml-3 shrink-0 ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {fmtPct(t.pnlPercent)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Yearly Returns */}
          <div className="border border-white/10 bg-white/5 rounded-xl p-5">
            <div className="text-sm font-semibold text-white mb-4">Yearly Returns</div>
            <div className="space-y-2">
              {Object.entries(metrics.yearlyReturns).map(([year, ret]) => (
                <div key={year} className="flex items-center gap-3">
                  <div className="text-zinc-400 text-xs w-10 shrink-0">{year}</div>
                  <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${ret >= 0 ? "bg-emerald-500/60" : "bg-red-500/60"}`}
                      style={{ width: `${Math.min(100, Math.abs(ret) * 200)}%` }}
                    />
                  </div>
                  <div className={`text-xs font-bold w-14 text-right shrink-0 ${retColor(ret)}`}>
                    {fmtPct(ret)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Analysis */}
        {analysis && (
          <div className="border border-white/10 bg-white/5 rounded-xl p-5 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-[var(--accent-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <div className="text-sm font-semibold text-white">AI Analysis</div>
            </div>
            <p className="text-zinc-400 text-sm leading-relaxed whitespace-pre-line">{analysis}</p>
          </div>
        )}

        {/* Run Another */}
        <button
          type="button"
          onClick={reset}
          className="w-full py-3 rounded-xl border border-[var(--accent-color)]/40 bg-[var(--accent-color)]/10 text-[var(--accent-color)] font-semibold text-sm hover:bg-[var(--accent-color)]/20 transition-colors"
        >
          Run Another Backtest
        </button>
      </div>
    );
  }

  // ─── Form State ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen px-4 py-10 max-w-2xl mx-auto" style={{ background: "#050713" }}>
      {/* Header */}
      <div className="mb-8">
        <div className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--accent-color)" }}>
          Strategy Testing
        </div>
        <h1 className="text-3xl font-bold text-white">Backtester</h1>
        <p className="text-zinc-500 text-sm mt-1">Test your trading strategy against real historical data</p>
      </div>

      <StepIndicator current={step} total={6} />

      {/* Error banner */}
      {error && (
        <div className="mb-6 border border-red-500/30 bg-red-500/10 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Step 0: Asset Type */}
      {step === 0 && (
        <div>
          <div className="text-white font-semibold text-lg mb-1">What are you trading?</div>
          <div className="text-zinc-500 text-sm mb-6">Select the asset class for your strategy</div>
          <div className="flex flex-wrap gap-3 mb-8">
            {ASSET_TYPES.map((t) => (
              <Chip
                key={t}
                label={t}
                active={form.assetType === t}
                onClick={() => setForm((f) => ({ ...f, assetType: t }))}
              />
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Ticker + Period */}
      {step === 1 && (
        <div>
          <div className="text-white font-semibold text-lg mb-1">Ticker & Time Period</div>
          <div className="text-zinc-500 text-sm mb-6">
            Enter the ticker symbol and select a backtest period
          </div>
          <div className="mb-5">
            <label className="block text-sm text-zinc-400 mb-2">Ticker Symbol</label>
            <input
              type="text"
              value={form.ticker}
              onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value.toUpperCase() }))}
              placeholder={form.assetType === "Crypto" ? "BTC-USD" : form.assetType === "Forex" ? "EURUSD=X" : "AAPL"}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-[var(--accent-color)]/50 transition-colors"
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm text-zinc-400 mb-2">Period</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {[1, 2, 3, 5].map((y) => (
                <Chip
                  key={y}
                  label={`${y}Y`}
                  active={!customPeriod && (() => {
                    const end = new Date();
                    const start = new Date();
                    start.setFullYear(end.getFullYear() - y);
                    return form.startDate === start.toISOString().slice(0, 10);
                  })()}
                  onClick={() => setPresetPeriod(y)}
                />
              ))}
              <Chip label="Custom" active={customPeriod} onClick={() => setCustomPeriod(true)} />
            </div>
            {customPeriod && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-zinc-500 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[var(--accent-color)]/50"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-zinc-500 mb-1">End Date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[var(--accent-color)]/50"
                  />
                </div>
              </div>
            )}
            {!customPeriod && form.startDate && (
              <div className="text-xs text-zinc-600 mt-2">
                {form.startDate} → {form.endDate}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Entry Conditions */}
      {step === 2 && (
        <div>
          <div className="text-white font-semibold text-lg mb-1">Entry Conditions</div>
          <div className="text-zinc-500 text-sm mb-6">
            Describe when to enter a trade. Be specific — e.g. "RSI below 30 and price above 50-day MA"
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {ENTRY_CHIPS.map((c) => (
              <Chip key={c} label={c} onClick={() => appendToEntry(c)} />
            ))}
          </div>
          <textarea
            value={form.entryConditions}
            onChange={(e) => setForm((f) => ({ ...f, entryConditions: e.target.value }))}
            placeholder="e.g. RSI below 30, price above 50-day moving average, MACD bullish crossover"
            rows={4}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-[var(--accent-color)]/50 resize-none transition-colors"
          />
        </div>
      )}

      {/* Step 3: Exit Conditions */}
      {step === 3 && (
        <div>
          <div className="text-white font-semibold text-lg mb-1">Exit Conditions</div>
          <div className="text-zinc-500 text-sm mb-6">
            Describe when to exit a trade. Always include a stop-loss and profit target.
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {EXIT_CHIPS.map((c) => (
              <Chip key={c} label={c} onClick={() => appendToExit(c)} />
            ))}
          </div>
          <textarea
            value={form.exitConditions}
            onChange={(e) => setForm((f) => ({ ...f, exitConditions: e.target.value }))}
            placeholder="e.g. 10% profit target, 5% stop loss, or RSI above 70"
            rows={4}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-[var(--accent-color)]/50 resize-none transition-colors"
          />
        </div>
      )}

      {/* Step 4: Position Sizing */}
      {step === 4 && (
        <div>
          <div className="text-white font-semibold text-lg mb-1">Position Sizing</div>
          <div className="text-zinc-500 text-sm mb-6">How much to allocate per trade</div>
          <div className="flex flex-wrap gap-3">
            {SIZING_OPTIONS.map((s) => (
              <Chip
                key={s}
                label={s}
                active={form.positionSizing === s}
                onClick={() => setForm((f) => ({ ...f, positionSizing: s }))}
              />
            ))}
          </div>
        </div>
      )}

      {/* Step 5: Starting Capital */}
      {step === 5 && (
        <div>
          <div className="text-white font-semibold text-lg mb-1">Starting Capital</div>
          <div className="text-zinc-500 text-sm mb-6">Your simulated portfolio starting value</div>
          <div className="flex flex-wrap gap-3 mb-5">
            {CAPITAL_PRESETS.map((c) => (
              <Chip
                key={c}
                label={`$${c.toLocaleString()}`}
                active={form.startingCapital === c}
                onClick={() => setForm((f) => ({ ...f, startingCapital: c }))}
              />
            ))}
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Or enter custom amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
              <input
                type="number"
                min={1000}
                step={1000}
                value={form.startingCapital}
                onChange={(e) => setForm((f) => ({ ...f, startingCapital: Number(e.target.value) }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white text-sm focus:outline-none focus:border-[var(--accent-color)]/50 transition-colors"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="mt-6 border border-white/10 bg-white/5 rounded-xl p-4 space-y-2 text-sm">
            <div className="text-zinc-400 font-medium mb-2">Strategy Summary</div>
            <div className="flex justify-between"><span className="text-zinc-500">Asset</span><span className="text-zinc-300">{form.assetType} · {form.ticker}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Period</span><span className="text-zinc-300">{form.startDate} → {form.endDate}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Entry</span><span className="text-zinc-300 max-w-[60%] text-right truncate">{form.entryConditions}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Exit</span><span className="text-zinc-300 max-w-[60%] text-right truncate">{form.exitConditions}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Sizing</span><span className="text-zinc-300">{form.positionSizing}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Capital</span><span className="text-zinc-300">${form.startingCapital.toLocaleString()}</span></div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 mt-8">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="flex-1 py-3 rounded-xl border border-white/10 bg-white/5 text-zinc-400 font-semibold text-sm hover:bg-white/10 transition-colors"
          >
            Back
          </button>
        )}
        {step < 5 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext[step]}
            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-colors ${
              canNext[step]
                ? "bg-[var(--accent-color)] text-white hover:opacity-90"
                : "bg-white/5 text-zinc-600 cursor-not-allowed"
            }`}
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canNext[5]}
            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-colors ${
              canNext[5]
                ? "bg-[var(--accent-color)] text-white hover:opacity-90"
                : "bg-white/5 text-zinc-600 cursor-not-allowed"
            }`}
          >
            Run Backtest
          </button>
        )}
      </div>
    </div>
  );
}
