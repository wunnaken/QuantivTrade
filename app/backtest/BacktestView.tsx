"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceArea,
  CartesianGrid,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5;

type StrategyType = "ma_crossover" | "rsi" | "breakout" | "options" | "portfolio_optimizer" | "custom";

type Setup = {
  ticker: string;
  tickers: string; // comma-separated for portfolio optimizer
  assetType: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  commission: number;
};

type Params = {
  // MA Crossover
  fastPeriod: number;
  slowPeriod: number;
  maType: "sma" | "ema";
  // RSI
  rsiPeriod: number;
  oversold: number;
  overbought: number;
  // Breakout
  lookbackPeriod: number;
  volumeConfirmation: boolean;
  atrMultiplier: number;
  // Options
  optionStrategy: string;
  expiryDays: number;
  deltaTarget: number;
  // Risk management
  useStopLoss: boolean;
  stopLossPct: number;
  useTakeProfit: boolean;
  takeProfitPct: number;
  // Advanced
  walkForward: boolean;
  monteCarlo: boolean;
  monteCarloRuns: number;
  positionSize: number;
};

type Trade = {
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  return_pct: number;
  hold_days: number;
};

type BacktestMetrics = {
  total_return: number;
  annualized_return: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  calmar_ratio: number;
  max_drawdown: number;
  max_drawdown_duration_days: number;
  win_rate: number;
  profit_factor: number;
  avg_win: number;
  avg_loss: number;
  best_trade: number;
  worst_trade: number;
  total_trades: number;
  avg_hold_time_days: number;
  beta: number;
  alpha: number;
  monthly_returns: Record<string, number>;
  equity_curve: { date: string; value: number }[];
  drawdown_curve: { date: string; drawdown: number }[];
  trades: Trade[];
};

type BacktestResult = {
  ticker: string;
  strategy_type: string;
  params: Record<string, unknown>;
  metrics: BacktestMetrics;
  walk_forward: {
    splits: { split: number; in_sample_sharpe: number; oos_sharpe: number; efficiency_ratio: number | null; best_params: Record<string, unknown> }[];
    avg_in_sample_sharpe: number;
    avg_oos_sharpe: number;
    avg_efficiency_ratio: number | null;
    verdict: string;
  } | null;
  monte_carlo: {
    n_runs: number;
    n_trades: number;
    trade_labels: number[];
    percentile_curves: Record<string, number[]>;
    final_equity: { p5: number; p25: number; p50: number; p75: number; p95: number; mean: number; std: number };
    probability_metrics: { prob_profit: number; prob_loss_10pct: number; prob_loss_25pct: number; prob_double: number };
  } | null;
  ai_analysis: string;
  error?: string;
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_SETUP: Setup = {
  ticker: "AAPL",
  tickers: "AAPL,MSFT,GOOGL,AMZN",
  assetType: "stock",
  startDate: "2020-01-01",
  endDate: "2024-12-31",
  initialCapital: 10000,
  commission: 0.1,
};

const DEFAULT_PARAMS: Params = {
  fastPeriod: 10,
  slowPeriod: 30,
  maType: "sma",
  rsiPeriod: 14,
  oversold: 30,
  overbought: 70,
  lookbackPeriod: 20,
  volumeConfirmation: true,
  atrMultiplier: 1.5,
  optionStrategy: "covered_call",
  expiryDays: 30,
  deltaTarget: 0.30,
  useStopLoss: false,
  stopLossPct: 5,
  useTakeProfit: false,
  takeProfitPct: 10,
  walkForward: false,
  monteCarlo: false,
  monteCarloRuns: 1000,
  positionSize: 0.95,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPct(n: number | undefined | null, decimals = 1): string {
  if (n == null) return "—";
  const v = n.toFixed(decimals);
  return n >= 0 ? `+${v}%` : `${v}%`;
}

function fmtNum(n: number | undefined | null, decimals = 2): string {
  if (n == null) return "—";
  return n.toFixed(decimals);
}

function fmtDollars(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function retColor(n: number | null | undefined): string {
  if (n == null) return "text-zinc-400";
  if (n > 0) return "text-emerald-400";
  if (n < 0) return "text-red-400";
  return "text-zinc-400";
}

function gradeFromMetrics(m: BacktestMetrics): { grade: string; color: string } {
  let score = 0;
  if (m.total_return > 50) score += 25;
  else if (m.total_return > 20) score += 18;
  else if (m.total_return > 5) score += 12;
  else if (m.total_return > 0) score += 6;

  if (m.sharpe_ratio > 2) score += 30;
  else if (m.sharpe_ratio > 1.5) score += 24;
  else if (m.sharpe_ratio > 1) score += 18;
  else if (m.sharpe_ratio > 0.5) score += 10;

  if (m.win_rate > 70) score += 25;
  else if (m.win_rate > 60) score += 20;
  else if (m.win_rate > 50) score += 14;
  else if (m.win_rate > 40) score += 8;

  const dd = Math.abs(m.max_drawdown);
  if (dd < 10) score += 20;
  else if (dd < 15) score += 15;
  else if (dd < 20) score += 10;
  else if (dd < 30) score += 5;

  if (score >= 85) return { grade: "A+", color: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10" };
  if (score >= 75) return { grade: "A", color: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10" };
  if (score >= 65) return { grade: "B+", color: "text-[var(--accent-color)] border-[var(--accent-color)]/40 bg-[var(--accent-color)]/10" };
  if (score >= 55) return { grade: "B", color: "text-[var(--accent-color)] border-[var(--accent-color)]/40 bg-[var(--accent-color)]/10" };
  if (score >= 45) return { grade: "B-", color: "text-[var(--accent-color)] border-[var(--accent-color)]/40 bg-[var(--accent-color)]/10" };
  if (score >= 35) return { grade: "C+", color: "text-amber-400 border-amber-400/40 bg-amber-400/10" };
  if (score >= 25) return { grade: "C", color: "text-amber-400 border-amber-400/40 bg-amber-400/10" };
  return { grade: "F", color: "text-red-400 border-red-400/40 bg-red-400/10" };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STATUS_MESSAGES = [
  "Fetching historical data…",
  "Calculating indicators…",
  "Simulating trades…",
  "Calculating metrics…",
  "Running AI analysis…",
];

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepBar({ step }: { step: Step }) {
  const labels = ["Setup", "Strategy", "Parameters", "Running", "Results"];
  return (
    <div className="mb-8 flex items-center gap-2">
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const done = step > n;
        const active = step === n;
        return (
          <div key={n} className="flex items-center gap-2">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold transition-all ${
              done ? "border-[var(--accent-color)] bg-[var(--accent-color)] text-[#020308]"
              : active ? "border-[var(--accent-color)] text-[var(--accent-color)]"
              : "border-white/10 text-zinc-600"
            }`}>
              {done ? "✓" : n}
            </div>
            {!active && done ? null : (
              <span className={`hidden text-xs sm:block ${active ? "text-zinc-200 font-medium" : done ? "text-zinc-500" : "text-zinc-600"}`}>
                {label}
              </span>
            )}
            {done && !active && (
              <span className="hidden text-xs text-zinc-500 sm:block">{label}</span>
            )}
            {i < 4 && <div className={`h-px w-6 ${done ? "bg-[var(--accent-color)]/50" : "bg-white/10"}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Strategy cards ───────────────────────────────────────────────────────────

const STRATEGIES: { type: StrategyType; name: string; desc: string; icon: string }[] = [
  { type: "ma_crossover", name: "MA Crossover", desc: "Buy when fast MA crosses above slow MA", icon: "📈" },
  { type: "rsi", name: "RSI Strategy", desc: "Buy oversold, sell overbought conditions", icon: "📊" },
  { type: "breakout", name: "Breakout", desc: "Enter on price breakouts with volume confirmation", icon: "🚀" },
  { type: "options", name: "Options", desc: "Simulate options strategies with Black-Scholes pricing", icon: "⚡" },
  { type: "portfolio_optimizer", name: "Portfolio Optimizer", desc: "Find optimal weights across multiple assets", icon: "🎯" },
  { type: "custom", name: "Custom", desc: "Define your own entry/exit conditions", icon: "🔧" },
];

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative h-5 w-9 rounded-full border transition-colors ${value ? "border-[var(--accent-color)]/50 bg-[var(--accent-color)]/20" : "border-white/10 bg-white/5"}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${value ? "bg-[var(--accent-color)]" : "bg-zinc-600"}`}
        style={{ left: value ? "18px" : "2px" }}
      />
    </button>
  );
}

// ─── Number input ─────────────────────────────────────────────────────────────

function NumInput({
  label, value, onChange, min, max, step = 1, suffix,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-400">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none"
        />
        {suffix && <span className="text-xs text-zinc-500">{suffix}</span>}
      </div>
    </div>
  );
}

// ─── Typewriter ───────────────────────────────────────────────────────────────

function Typewriter({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");
  const idx = useRef(0);

  useEffect(() => {
    idx.current = 0;
    setDisplayed("");
    const interval = setInterval(() => {
      idx.current += 2;
      setDisplayed(text.slice(0, idx.current));
      if (idx.current >= text.length) clearInterval(interval);
    }, 12);
    return () => clearInterval(interval);
  }, [text]);

  return <span>{displayed}</span>;
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function ChartTooltipContent({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[var(--app-card-alt)] p-2 text-xs shadow-xl">
      <p className="mb-1 text-zinc-500">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? (p.name.toLowerCase().includes("drawdown") ? p.value.toFixed(2) + "%" : "$" + p.value.toLocaleString()) : p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BacktestView() {
  const [step, setStep] = useState<Step>(1);
  const [setup, setSetup] = useState<Setup>(DEFAULT_SETUP);
  const [strategy, setStrategy] = useState<StrategyType>("ma_crossover");
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // ── Live price fetch on ticker blur ──
  const fetchPrice = useCallback(async (ticker: string) => {
    if (!ticker.trim()) return;
    setLoadingPrice(true);
    try {
      const res = await fetch(`/api/backtest/data/price?ticker=${encodeURIComponent(ticker)}&period=5d`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCurrentPrice(data[data.length - 1].close);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingPrice(false);
    }
  }, []);

  // ── Loading animation ──
  useEffect(() => {
    if (step !== 4) return;
    setProgress(0);
    setStatusIdx(0);
    const progInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 0.8, 95));
    }, 400);
    const msgInterval = setInterval(() => {
      setStatusIdx((i) => Math.min(i + 1, STATUS_MESSAGES.length - 1));
    }, 6000);
    return () => {
      clearInterval(progInterval);
      clearInterval(msgInterval);
    };
  }, [step]);

  // ── Submit backtest ──
  async function runBacktest() {
    setStep(4);
    setError(null);
    setResult(null);

    const isPortfolio = strategy === "portfolio_optimizer";
    const isCustom = strategy === "custom";

    const body = isPortfolio
      ? {
          tickers: setup.tickers.split(",").map((t) => t.trim().toUpperCase()),
          start_date: setup.startDate,
          end_date: setup.endDate,
        }
      : {
          ticker: setup.ticker.toUpperCase(),
          start_date: setup.startDate,
          end_date: setup.endDate,
          initial_capital: setup.initialCapital,
          strategy_type: isCustom ? "ma_crossover" : strategy,
          commission: setup.commission / 100,
          position_size: params.positionSize,
          use_stop_loss: params.useStopLoss,
          stop_loss_pct: params.stopLossPct / 100,
          use_take_profit: params.useTakeProfit,
          take_profit_pct: params.takeProfitPct / 100,
          walk_forward: params.walkForward,
          monte_carlo: params.monteCarlo,
          monte_carlo_runs: params.monteCarloRuns,
          params: buildStrategyParams(),
        };

    const endpoint = isPortfolio ? "/api/backtest/optimize" : "/api/backtest/run";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Backtest failed");
        setStep(3);
        return;
      }
      setResult(data);
      setProgress(100);
      setTimeout(() => setStep(5), 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setStep(3);
    }
  }

  function buildStrategyParams(): Record<string, unknown> {
    if (strategy === "ma_crossover") {
      return { fast_period: params.fastPeriod, slow_period: params.slowPeriod, ma_type: params.maType };
    }
    if (strategy === "rsi") {
      return { rsi_period: params.rsiPeriod, oversold: params.oversold, overbought: params.overbought };
    }
    if (strategy === "breakout") {
      return {
        lookback_period: params.lookbackPeriod,
        volume_confirmation: params.volumeConfirmation,
        atr_multiplier: params.atrMultiplier,
      };
    }
    if (strategy === "options") {
      return {
        strategy_type: params.optionStrategy,
        expiry_days: params.expiryDays,
        delta_target: params.deltaTarget,
      };
    }
    return {};
  }

  function exportResults() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backtest_${result.ticker}_${result.strategy_type}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Step 1: Setup ─────────────────────────────────────────────────────────

  function renderStep1() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Strategy Setup</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Configure your backtest parameters.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Ticker */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-400">Ticker Symbol</label>
            <div className="relative">
              <input
                type="text"
                value={setup.ticker}
                onChange={(e) => setSetup({ ...setup, ticker: e.target.value.toUpperCase() })}
                onBlur={() => fetchPrice(setup.ticker)}
                placeholder="AAPL"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pr-20 text-sm text-zinc-200 uppercase focus:border-[var(--accent-color)]/50 focus:outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                {loadingPrice ? "…" : currentPrice ? `$${currentPrice.toFixed(2)}` : ""}
              </span>
            </div>
          </div>

          {/* Asset type auto-label */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-400">Asset Type</label>
            <select
              value={setup.assetType}
              onChange={(e) => setSetup({ ...setup, assetType: e.target.value })}
              className="rounded-lg border border-white/10 bg-[var(--app-card-alt)] px-3 py-2 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none"
            >
              <option value="stock">Stock / Equity</option>
              <option value="etf">ETF</option>
              <option value="crypto">Crypto</option>
              <option value="index">Index</option>
              <option value="forex">Forex</option>
            </select>
          </div>

          {/* Start date */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-400">Start Date</label>
            <input
              type="date"
              value={setup.startDate}
              onChange={(e) => setSetup({ ...setup, startDate: e.target.value })}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none [color-scheme:dark]"
            />
          </div>

          {/* End date */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-400">End Date</label>
            <input
              type="date"
              value={setup.endDate}
              onChange={(e) => setSetup({ ...setup, endDate: e.target.value })}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none [color-scheme:dark]"
            />
          </div>

          {/* Capital */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-400">Initial Capital</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
              <input
                type="number"
                value={setup.initialCapital}
                onChange={(e) => setSetup({ ...setup, initialCapital: Number(e.target.value) })}
                min={100}
                step={1000}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-7 pr-3 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Commission */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-400">Commission per Trade</label>
            <div className="relative">
              <input
                type="number"
                value={setup.commission}
                onChange={(e) => setSetup({ ...setup, commission: Number(e.target.value) })}
                min={0}
                max={5}
                step={0.01}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pr-7 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">%</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => setStep(2)}
            disabled={!setup.ticker.trim()}
            className="rounded-lg bg-[var(--accent-color)] px-5 py-2 text-sm font-semibold text-[#020308] transition hover:opacity-90 disabled:opacity-40"
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  // ─── Step 2: Strategy selection ────────────────────────────────────────────

  function renderStep2() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Select Strategy</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Choose the trading strategy to backtest.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STRATEGIES.map((s) => (
            <button
              key={s.type}
              onClick={() => setStrategy(s.type)}
              className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition hover:border-[var(--accent-color)]/40 ${
                strategy === s.type
                  ? "border-[var(--accent-color)]/60 bg-[var(--accent-color)]/5"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <span className="text-2xl">{s.icon}</span>
              <div>
                <p className={`text-sm font-semibold ${strategy === s.type ? "text-[var(--accent-color)]" : "text-zinc-200"}`}>
                  {s.name}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed">{s.desc}</p>
              </div>
              {strategy === s.type && (
                <span className="text-[10px] font-bold text-[var(--accent-color)] border border-[var(--accent-color)]/30 rounded-full px-2 py-0.5">
                  SELECTED
                </span>
              )}
            </button>
          ))}
        </div>

        {strategy === "portfolio_optimizer" && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <label className="text-xs text-zinc-400">Tickers (comma-separated)</label>
            <input
              type="text"
              value={setup.tickers}
              onChange={(e) => setSetup({ ...setup, tickers: e.target.value.toUpperCase() })}
              placeholder="AAPL, MSFT, GOOGL, AMZN"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none"
            />
            <p className="mt-1 text-xs text-zinc-600">Enter 2–10 tickers to find optimal allocation weights.</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button onClick={() => setStep(1)} className="text-xs text-zinc-500 hover:text-zinc-300 transition">
            ← Back
          </button>
          <button
            onClick={() => setStep(3)}
            className="rounded-lg bg-[var(--accent-color)] px-5 py-2 text-sm font-semibold text-[#020308] transition hover:opacity-90"
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  // ─── Step 3: Parameters ────────────────────────────────────────────────────

  function renderStep3() {
    const p = params;
    const set = (updates: Partial<Params>) => setParams({ ...p, ...updates });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Strategy Parameters</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Fine-tune your strategy settings.</p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Strategy-specific params */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            {STRATEGIES.find((s) => s.type === strategy)?.name ?? strategy} Parameters
          </p>

          {strategy === "ma_crossover" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <NumInput label="Fast Period" value={p.fastPeriod} onChange={(v) => set({ fastPeriod: v })} min={2} max={50} />
              <NumInput label="Slow Period" value={p.slowPeriod} onChange={(v) => set({ slowPeriod: v })} min={10} max={200} />
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">MA Type</label>
                <select
                  value={p.maType}
                  onChange={(e) => set({ maType: e.target.value as "sma" | "ema" })}
                  className="rounded-lg border border-white/10 bg-[var(--app-card-alt)] px-3 py-2 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none"
                >
                  <option value="sma">SMA</option>
                  <option value="ema">EMA</option>
                </select>
              </div>
            </div>
          )}

          {strategy === "rsi" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <NumInput label="RSI Period" value={p.rsiPeriod} onChange={(v) => set({ rsiPeriod: v })} min={5} max={30} />
              <NumInput label="Oversold Level" value={p.oversold} onChange={(v) => set({ oversold: v })} min={20} max={40} />
              <NumInput label="Overbought Level" value={p.overbought} onChange={(v) => set({ overbought: v })} min={60} max={80} />
            </div>
          )}

          {strategy === "breakout" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <NumInput label="Lookback Period" value={p.lookbackPeriod} onChange={(v) => set({ lookbackPeriod: v })} min={10} max={50} />
              <NumInput label="ATR Multiplier" value={p.atrMultiplier} onChange={(v) => set({ atrMultiplier: v })} min={0.5} max={5} step={0.1} />
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">Volume Confirmation</label>
                <div className="flex items-center gap-3 pt-2">
                  <Toggle value={p.volumeConfirmation} onChange={(v) => set({ volumeConfirmation: v })} />
                  <span className="text-xs text-zinc-400">{p.volumeConfirmation ? "Enabled" : "Disabled"}</span>
                </div>
              </div>
            </div>
          )}

          {strategy === "options" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">Options Strategy</label>
                <select
                  value={p.optionStrategy}
                  onChange={(e) => set({ optionStrategy: e.target.value })}
                  className="rounded-lg border border-white/10 bg-[var(--app-card-alt)] px-3 py-2 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none"
                >
                  <option value="covered_call">Covered Call</option>
                  <option value="cash_secured_put">Cash Secured Put</option>
                  <option value="bull_call_spread">Bull Call Spread</option>
                  <option value="bear_put_spread">Bear Put Spread</option>
                  <option value="iron_condor">Iron Condor</option>
                  <option value="straddle">Straddle</option>
                </select>
              </div>
              <NumInput label="Expiry Days" value={p.expiryDays} onChange={(v) => set({ expiryDays: v })} min={7} max={180} />
              <NumInput label="Delta Target" value={p.deltaTarget} onChange={(v) => set({ deltaTarget: v })} min={0.1} max={0.5} step={0.05} />
            </div>
          )}

          {strategy === "portfolio_optimizer" && (
            <p className="text-xs text-zinc-500">
              Portfolio optimization uses modern portfolio theory to find efficient allocations. No additional parameters needed — configure your tickers in Step 2.
            </p>
          )}

          {strategy === "custom" && (
            <p className="text-xs text-zinc-500">
              Custom strategies currently use MA Crossover as the execution engine. Full custom condition building coming soon.
            </p>
          )}
        </div>

        {/* Risk management */}
        {strategy !== "portfolio_optimizer" && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Risk Management</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-zinc-400">Stop Loss</label>
                  <Toggle value={p.useStopLoss} onChange={(v) => set({ useStopLoss: v })} />
                </div>
                {p.useStopLoss && (
                  <NumInput label="Stop Loss %" value={p.stopLossPct} onChange={(v) => set({ stopLossPct: v })} min={0.5} max={50} step={0.5} suffix="%" />
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-zinc-400">Take Profit</label>
                  <Toggle value={p.useTakeProfit} onChange={(v) => set({ useTakeProfit: v })} />
                </div>
                {p.useTakeProfit && (
                  <NumInput label="Take Profit %" value={p.takeProfitPct} onChange={(v) => set({ takeProfitPct: v })} min={1} max={200} step={1} suffix="%" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Advanced options */}
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <button
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="flex w-full items-center justify-between p-4 text-left"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Advanced Options</span>
            <svg
              className={`h-4 w-4 text-zinc-500 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {advancedOpen && (
            <div className="border-t border-white/10 p-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-300">Walk-Forward Analysis</p>
                      <p className="text-[10px] text-zinc-600">Tests for overfitting using in/out-of-sample windows</p>
                    </div>
                    <Toggle value={p.walkForward} onChange={(v) => set({ walkForward: v })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-300">Monte Carlo Simulation</p>
                      <p className="text-[10px] text-zinc-600">Resample trade returns to estimate outcome distribution</p>
                    </div>
                    <Toggle value={p.monteCarlo} onChange={(v) => set({ monteCarlo: v })} />
                  </div>
                  {p.monteCarlo && (
                    <NumInput label="Simulation Runs" value={p.monteCarloRuns} onChange={(v) => set({ monteCarloRuns: Math.min(5000, Math.max(100, v)) })} min={100} max={5000} step={100} />
                  )}
                </div>
              </div>
              <NumInput label="Position Size (% of capital)" value={Math.round(p.positionSize * 100)} onChange={(v) => set({ positionSize: v / 100 })} min={10} max={100} step={5} suffix="%" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={() => setStep(2)} className="text-xs text-zinc-500 hover:text-zinc-300 transition">
            ← Back
          </button>
          <button
            onClick={runBacktest}
            className="rounded-lg bg-[var(--accent-color)] px-6 py-2 text-sm font-semibold text-[#020308] transition hover:opacity-90"
          >
            Run Backtest →
          </button>
        </div>
      </div>
    );
  }

  // ─── Step 4: Loading ───────────────────────────────────────────────────────

  function renderStep4() {
    return (
      <div className="flex flex-col items-center justify-center gap-8 py-20">
        <div className="relative">
          <div className="h-20 w-20 rounded-full border-2 border-[var(--accent-color)]/20 border-t-[var(--accent-color)] animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl">📊</span>
          </div>
        </div>
        <div className="w-full max-w-sm space-y-3 text-center">
          <p className="text-sm font-medium text-zinc-200">{STATUS_MESSAGES[statusIdx]}</p>
          <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent-color)] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-zinc-600">{Math.round(progress)}% complete</p>
        </div>
        <p className="text-xs text-zinc-600 max-w-xs text-center">
          Fetching {setup.ticker} historical data from {setup.startDate} to {setup.endDate} and running the simulation…
        </p>
      </div>
    );
  }

  // ─── Step 5: Results ───────────────────────────────────────────────────────

  function renderStep5() {
    if (!result) return null;
    const m = result.metrics;
    const { grade, color: gradeColor } = gradeFromMetrics(m);

    // Drawdown reference areas (consecutive negative periods)
    const ddAreas: { x1: string; x2: string }[] = [];
    if (m.equity_curve?.length) {
      let ddStart: string | null = null;
      m.drawdown_curve?.forEach((d) => {
        if (d.drawdown < -2 && !ddStart) ddStart = d.date;
        if (d.drawdown >= -2 && ddStart) {
          ddAreas.push({ x1: ddStart, x2: d.date });
          ddStart = null;
        }
      });
    }

    // Monthly returns grid
    const monthlyYears: Record<string, Record<number, number>> = {};
    Object.entries(m.monthly_returns ?? {}).forEach(([key, val]) => {
      const [year, mon] = key.split("-");
      if (!monthlyYears[year]) monthlyYears[year] = {};
      monthlyYears[year][parseInt(mon)] = val;
    });
    const years = Object.keys(monthlyYears).sort();

    // Build benchmark merge for chart
    const chartData = (m.equity_curve ?? []).map((pt) => ({
      date: pt.date,
      Portfolio: pt.value,
    }));

    // Monte Carlo chart data
    const mcData = result.monte_carlo?.trade_labels.map((i) => {
      const obj: Record<string, unknown> = { trade: i };
      Object.entries(result.monte_carlo!.percentile_curves).forEach(([k, arr]) => {
        obj[k] = arr[i];
      });
      return obj;
    }) ?? [];

    return (
      <div className="space-y-6">
        {/* ── Header row ── */}
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-5">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest">{result.ticker} · {result.strategy_type.replace("_", " ")}</p>
            <p className={`mt-1 text-4xl font-bold ${retColor(m.total_return)}`}>
              {fmtPct(m.total_return, 1)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {setup.startDate} → {setup.endDate}
            </p>
          </div>
          <div className="ml-4 flex flex-col gap-1">
            <span className="text-xs text-zinc-500">vs Buy & Hold</span>
            <span className={`text-lg font-semibold ${retColor((m.total_return ?? 0) - 0)}`}>
              {m.alpha != null ? `${m.alpha >= 0 ? "+" : ""}${m.alpha.toFixed(1)}% alpha` : "—"}
            </span>
          </div>
          <div className={`ml-auto flex h-16 w-16 items-center justify-center rounded-full border-2 text-2xl font-black ${gradeColor}`}>
            {grade}
          </div>
        </div>

        {/* ── Metrics grid ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Annualized Return", value: fmtPct(m.annualized_return), color: retColor(m.annualized_return) },
            { label: "Sharpe Ratio", value: fmtNum(m.sharpe_ratio), color: m.sharpe_ratio > 1 ? "text-emerald-400" : m.sharpe_ratio > 0 ? "text-amber-400" : "text-red-400" },
            { label: "Max Drawdown", value: fmtPct(m.max_drawdown), color: "text-red-400" },
            { label: "Win Rate", value: m.win_rate != null ? `${m.win_rate.toFixed(1)}%` : "—", color: m.win_rate > 50 ? "text-emerald-400" : "text-red-400" },
            { label: "Profit Factor", value: fmtNum(m.profit_factor), color: m.profit_factor > 1 ? "text-emerald-400" : "text-red-400" },
            { label: "Total Trades", value: m.total_trades?.toString() ?? "—", color: "text-zinc-200" },
            { label: "Avg Hold Time", value: m.avg_hold_time_days != null ? `${m.avg_hold_time_days.toFixed(1)}d` : "—", color: "text-zinc-200" },
            { label: "Calmar Ratio", value: fmtNum(m.calmar_ratio), color: m.calmar_ratio > 1 ? "text-emerald-400" : m.calmar_ratio > 0 ? "text-amber-400" : "text-red-400" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/10 bg-[var(--app-card-alt)] p-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{item.label}</p>
              <p className={`mt-1 text-lg font-semibold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* ── Equity curve ── */}
        {chartData.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
            <p className="mb-4 text-sm font-semibold text-zinc-200">Equity Curve</p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#52525b", fontSize: 10 }}
                  tickFormatter={(v: string) => v?.slice(0, 7) ?? ""}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "#52525b", fontSize: 10 }}
                  tickFormatter={(v: number) => fmtDollars(v)}
                  width={60}
                />
                <Tooltip content={<ChartTooltipContent />} />
                {ddAreas.map((a, i) => (
                  <ReferenceArea key={i} x1={a.x1} x2={a.x2} fill="rgba(239,68,68,0.08)" />
                ))}
                <Line
                  type="monotone"
                  dataKey="Portfolio"
                  stroke="var(--accent-color)"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Drawdown chart ── */}
        {m.drawdown_curve?.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
            <p className="mb-4 text-sm font-semibold text-zinc-200">Drawdown</p>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={m.drawdown_curve}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: "#52525b", fontSize: 10 }} tickFormatter={(v: string) => v?.slice(0, 7) ?? ""} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "#52525b", fontSize: 10 }} tickFormatter={(v: number) => v.toFixed(0) + "%"} width={40} />
                <Tooltip
                  formatter={(v: unknown) => [typeof v === "number" ? v.toFixed(2) + "%" : String(v), "Drawdown"] as [string, string]}
                  contentStyle={{ background: "var(--app-card-alt)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: "#71717a" }}
                />
                <Area type="monotone" dataKey="drawdown" stroke="#ef4444" fill="rgba(239,68,68,0.2)" dot={false} strokeWidth={1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Monthly returns heatmap ── */}
        {years.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
            <p className="mb-4 text-sm font-semibold text-zinc-200">Monthly Returns</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-center text-[10px]">
                <thead>
                  <tr>
                    <th className="py-1 pr-3 text-left text-zinc-500">Year</th>
                    {MONTHS.map((m) => <th key={m} className="py-1 text-zinc-500 font-normal">{m}</th>)}
                    <th className="py-1 text-zinc-500 font-normal">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map((year) => {
                    const yearData = monthlyYears[year];
                    const yearTotal = Object.values(yearData).reduce((a, b) => a + b, 0);
                    return (
                      <tr key={year}>
                        <td className="py-1 pr-3 text-left text-zinc-400 font-medium">{year}</td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const val = yearData[i + 1];
                          const bg = val == null ? "bg-white/5" : val > 5 ? "bg-emerald-500/40" : val > 2 ? "bg-emerald-500/25" : val > 0 ? "bg-emerald-500/15" : val < -5 ? "bg-red-500/40" : val < -2 ? "bg-red-500/25" : "bg-red-500/15";
                          return (
                            <td key={i} className="py-0.5 px-0.5">
                              <div className={`rounded px-1 py-1 ${bg}`}>
                                <span className={val == null ? "text-zinc-700" : val >= 0 ? "text-emerald-300" : "text-red-300"}>
                                  {val == null ? "—" : val.toFixed(1)}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                        <td className={`py-1 px-1 font-semibold ${retColor(yearTotal)}`}>
                          {yearTotal.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Trade list ── */}
        {m.trades?.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
            <p className="mb-4 text-sm font-semibold text-zinc-200">Trade History ({m.trades.length} trades)</p>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full min-w-[560px] text-xs">
                <thead className="sticky top-0 bg-[var(--app-card-alt)]">
                  <tr className="border-b border-white/10 text-left">
                    <th className="pb-2 pr-4 font-medium text-zinc-500">Entry</th>
                    <th className="pb-2 pr-4 font-medium text-zinc-500">Exit</th>
                    <th className="pb-2 pr-4 font-medium text-zinc-500">Entry $</th>
                    <th className="pb-2 pr-4 font-medium text-zinc-500">Exit $</th>
                    <th className="pb-2 pr-4 font-medium text-zinc-500">Return</th>
                    <th className="pb-2 font-medium text-zinc-500">Hold</th>
                  </tr>
                </thead>
                <tbody>
                  {m.trades.map((t, i) => (
                    <tr key={i} className={`border-b border-white/5 ${t.return_pct >= 0 ? "bg-emerald-500/5" : "bg-red-500/5"}`}>
                      <td className="py-1.5 pr-4 text-zinc-400">{t.entry_date}</td>
                      <td className="py-1.5 pr-4 text-zinc-400">{t.exit_date}</td>
                      <td className="py-1.5 pr-4 text-zinc-300">${t.entry_price?.toFixed(2)}</td>
                      <td className="py-1.5 pr-4 text-zinc-300">${t.exit_price?.toFixed(2)}</td>
                      <td className={`py-1.5 pr-4 font-medium ${t.return_pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {fmtPct(t.return_pct, 2)}
                      </td>
                      <td className="py-1.5 text-zinc-500">{t.hold_days}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Walk-forward ── */}
        {result.walk_forward && (
          <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
            <p className="mb-1 text-sm font-semibold text-zinc-200">Walk-Forward Analysis</p>
            <p className={`mb-4 text-xs ${result.walk_forward.avg_efficiency_ratio != null && result.walk_forward.avg_efficiency_ratio > 0.5 ? "text-emerald-400" : "text-amber-400"}`}>
              {result.walk_forward.verdict}
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={result.walk_forward.splits}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="split" tick={{ fill: "#52525b", fontSize: 10 }} />
                <YAxis tick={{ fill: "#52525b", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "var(--app-card-alt)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: "#71717a" }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "#71717a" }} />
                <Line type="monotone" dataKey="in_sample_sharpe" name="In-Sample Sharpe" stroke="var(--accent-color)" dot strokeWidth={2} />
                <Line type="monotone" dataKey="oos_sharpe" name="Out-of-Sample Sharpe" stroke="#ef4444" dot strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] text-zinc-500">Avg In-Sample Sharpe</p>
                <p className="text-sm font-semibold text-zinc-200">{result.walk_forward.avg_in_sample_sharpe}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500">Avg OOS Sharpe</p>
                <p className="text-sm font-semibold text-zinc-200">{result.walk_forward.avg_oos_sharpe}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500">Efficiency Ratio</p>
                <p className={`text-sm font-semibold ${result.walk_forward.avg_efficiency_ratio != null && result.walk_forward.avg_efficiency_ratio > 0.5 ? "text-emerald-400" : "text-amber-400"}`}>
                  {result.walk_forward.avg_efficiency_ratio?.toFixed(2) ?? "—"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Monte Carlo ── */}
        {result.monte_carlo && mcData.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
            <p className="mb-1 text-sm font-semibold text-zinc-200">Monte Carlo Simulation</p>
            <p className="mb-4 text-xs text-zinc-500">{result.monte_carlo.n_runs.toLocaleString()} simulations of {result.monte_carlo.n_trades} trades</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={mcData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="trade" tick={{ fill: "#52525b", fontSize: 10 }} />
                <YAxis tick={{ fill: "#52525b", fontSize: 10 }} tickFormatter={(v: number) => fmtDollars(v)} width={60} />
                <Tooltip
                  contentStyle={{ background: "var(--app-card-alt)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: "#71717a" }}
                  formatter={(v: unknown) => typeof v === "number" ? fmtDollars(v) : String(v)}
                />
                <Area type="monotone" dataKey="p95" name="95th %ile" stroke="rgba(255,255,255,0.1)" fill="rgba(255,255,255,0.04)" dot={false} />
                <Area type="monotone" dataKey="p75" name="75th %ile" stroke="rgba(255,255,255,0.15)" fill="rgba(255,255,255,0.05)" dot={false} />
                <Area type="monotone" dataKey="p50" name="Median" stroke="var(--accent-color)" fill="rgba(var(--accent-rgb),0.1)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="p25" name="25th %ile" stroke="rgba(239,68,68,0.4)" fill="rgba(239,68,68,0.05)" dot={false} />
                <Area type="monotone" dataKey="p5" name="5th %ile" stroke="rgba(239,68,68,0.6)" fill="rgba(239,68,68,0.1)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
              {[
                { label: "Prob. Profit", value: `${result.monte_carlo.probability_metrics.prob_profit}%`, color: "text-emerald-400" },
                { label: "Prob. -10%", value: `${result.monte_carlo.probability_metrics.prob_loss_10pct}%`, color: "text-amber-400" },
                { label: "Prob. -25%", value: `${result.monte_carlo.probability_metrics.prob_loss_25pct}%`, color: "text-red-400" },
                { label: "Prob. 2×", value: `${result.monte_carlo.probability_metrics.prob_double}%`, color: "text-emerald-400" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/10 p-2">
                  <p className="text-[10px] text-zinc-500">{item.label}</p>
                  <p className={`text-sm font-semibold ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AI Analysis ── */}
        {result.ai_analysis && (
          <div className="rounded-2xl border border-[var(--accent-color)]/20 bg-[var(--accent-color)]/5 p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <p className="text-sm font-semibold text-zinc-200">AI Strategy Analysis</p>
              <span className="rounded-full border border-[var(--accent-color)]/30 px-2 py-0.5 text-[10px] font-medium text-[var(--accent-color)]">
                Claude AI
              </span>
            </div>
            <div className="text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">
              <Typewriter text={result.ai_analysis} />
            </div>
          </div>
        )}

        {/* ── Action buttons ── */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => { setStep(1); setResult(null); setError(null); }}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/10"
          >
            ↩ Run Again
          </button>
          <button
            onClick={exportResults}
            className="rounded-lg border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/10 px-4 py-2 text-sm font-medium text-[var(--accent-color)] transition hover:bg-[var(--accent-color)]/20"
          >
            ↓ Export JSON
          </button>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl">
      {step !== 4 && step !== 5 && <StepBar step={step} />}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
      {step === 5 && renderStep5()}
    </div>
  );
}
