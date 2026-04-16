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

type Mode = "landing" | "chat" | "manual-setup" | "manual-strategy" | "manual-params" | "running" | "results";

type StrategyType =
  | "ma_crossover" | "rsi" | "breakout" | "macd" | "bollinger_bands"
  | "stochastic" | "cci" | "williams_r" | "adx" | "parabolic_sar"
  | "volume" | "ichimoku" | "orderflow" | "options" | "portfolio_optimizer" | "custom";

type Setup = {
  ticker: string;
  tickers: string;
  assetType: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  commission: number;
  slippage: number;
  timeframe: string;
  direction: "long" | "short" | "both";
  leverage: number;
  positionSizingType: "pct" | "fixed_dollar" | "kelly";
  fixedDollarSize: number;
};

type TPTarget = { pct: number; size: number };

type Params = {
  fastPeriod: number; slowPeriod: number; maType: "sma" | "ema" | "wma" | "dema" | "tema";
  rsiPeriod: number; oversold: number; overbought: number;
  lookbackPeriod: number; volumeConfirmation: boolean; atrMultiplier: number;
  macdFast: number; macdSlow: number; macdSignal: number;
  bbPeriod: number; bbStdDev: number;
  stochK: number; stochD: number; stochOverbought: number; stochOversold: number;
  cciPeriod: number; cciOverbought: number; cciOversold: number;
  williamsRPeriod: number; williamsROverbought: number; williamsROversold: number;
  adxPeriod: number; adxThreshold: number;
  sarStep: number; sarMax: number;
  ichimokuTenkan: number; ichimokuKijun: number; ichimokuSenkou: number;
  vwapPeriod: number; obvMaPeriod: number; orderFlowThreshold: number;
  optionStrategy: string; expiryDays: number; deltaTarget: number;
  useStopLoss: boolean; stopLossType: "fixed" | "trailing" | "atr"; stopLossPct: number; stopLossAtrMultiplier: number;
  useTakeProfit: boolean; takeProfitPct: number; useMultipleTP: boolean; takeProfitTargets: TPTarget[];
  walkForward: boolean; monteCarlo: boolean; monteCarloRuns: number;
  positionSize: number;
};

type Trade = {
  entry_date: string; exit_date: string; entry_price: number; exit_price: number;
  return_pct: number; hold_days: number; direction?: "long" | "short";
};

type BacktestMetrics = {
  total_return: number; annualized_return: number; sharpe_ratio: number; sortino_ratio: number;
  calmar_ratio: number; max_drawdown: number; max_drawdown_duration_days: number;
  win_rate: number; profit_factor: number; avg_win: number; avg_loss: number;
  best_trade: number; worst_trade: number; total_trades: number; avg_hold_time_days: number;
  beta: number; alpha: number; expectancy?: number; var_95?: number;
  max_consecutive_wins?: number; max_consecutive_losses?: number;
  monthly_returns: Record<string, number>;
  equity_curve: { date: string; value: number }[];
  drawdown_curve: { date: string; drawdown: number }[];
  trades: Trade[];
};

type BacktestResult = {
  ticker: string; strategy_type: string; params: Record<string, unknown>;
  metrics: BacktestMetrics;
  walk_forward: {
    splits: { split: number; in_sample_sharpe: number; oos_sharpe: number; efficiency_ratio: number | null; best_params: Record<string, unknown> }[];
    avg_in_sample_sharpe: number; avg_oos_sharpe: number; avg_efficiency_ratio: number | null; verdict: string;
  } | null;
  monte_carlo: {
    n_runs: number; n_trades: number; trade_labels: number[];
    percentile_curves: Record<string, number[]>;
    final_equity: { p5: number; p25: number; p50: number; p75: number; p95: number; mean: number; std: number };
    probability_metrics: { prob_profit: number; prob_loss_10pct: number; prob_loss_25pct: number; prob_double: number };
  } | null;
  ai_analysis: string; error?: string;
};

type SavedStrategy = {
  id: string; name: string; strategyType: StrategyType;
  setup: Setup; params: Params; result: BacktestResult | null; savedAt: string;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_SETUP: Setup = {
  ticker: "AAPL", tickers: "AAPL,MSFT,GOOGL,AMZN", assetType: "stock",
  startDate: "2020-01-01", endDate: "2024-12-31", initialCapital: 10000,
  commission: 0.1, slippage: 5, timeframe: "1d", direction: "long",
  leverage: 1, positionSizingType: "pct", fixedDollarSize: 1000,
};

const DEFAULT_PARAMS: Params = {
  fastPeriod: 10, slowPeriod: 30, maType: "sma",
  rsiPeriod: 14, oversold: 30, overbought: 70,
  lookbackPeriod: 20, volumeConfirmation: true, atrMultiplier: 1.5,
  macdFast: 12, macdSlow: 26, macdSignal: 9,
  bbPeriod: 20, bbStdDev: 2,
  stochK: 14, stochD: 3, stochOverbought: 80, stochOversold: 20,
  cciPeriod: 20, cciOverbought: 100, cciOversold: -100,
  williamsRPeriod: 14, williamsROverbought: -20, williamsROversold: -80,
  adxPeriod: 14, adxThreshold: 25,
  sarStep: 0.02, sarMax: 0.2,
  ichimokuTenkan: 9, ichimokuKijun: 26, ichimokuSenkou: 52,
  vwapPeriod: 20, obvMaPeriod: 20, orderFlowThreshold: 0.6,
  optionStrategy: "covered_call", expiryDays: 30, deltaTarget: 0.30,
  useStopLoss: false, stopLossType: "fixed", stopLossPct: 5, stopLossAtrMultiplier: 2,
  useTakeProfit: false, takeProfitPct: 10, useMultipleTP: false,
  takeProfitTargets: [{ pct: 5, size: 50 }, { pct: 10, size: 30 }, { pct: 20, size: 20 }],
  walkForward: false, monteCarlo: false, monteCarloRuns: 1000, positionSize: 0.95,
};

// ─── Strategy catalogue ───────────────────────────────────────────────────────

const STRATEGIES: { type: StrategyType; name: string; desc: string; category: string }[] = [
  { type: "ma_crossover",       name: "MA Crossover",        desc: "SMA/EMA/WMA/DEMA/TEMA fast/slow crossover signals",       category: "Trend" },
  { type: "macd",               name: "MACD",                desc: "Signal line crossover and histogram momentum shifts",       category: "Trend" },
  { type: "ichimoku",           name: "Ichimoku Cloud",      desc: "Tenkan/Kijun cross with cloud support & resistance",       category: "Trend" },
  { type: "parabolic_sar",      name: "Parabolic SAR",       desc: "Trailing stop-and-reverse for trend following entries",    category: "Trend" },
  { type: "adx",                name: "ADX / DI",            desc: "Enter trending markets using ADX strength + DI crossover", category: "Trend" },
  { type: "rsi",                name: "RSI",                 desc: "Buy oversold, sell overbought with divergence detection",  category: "Momentum" },
  { type: "stochastic",         name: "Stochastic",          desc: "%K/%D crossover in oversold/overbought zones",            category: "Momentum" },
  { type: "cci",                name: "CCI",                 desc: "Commodity Channel Index mean-reversion strategy",          category: "Momentum" },
  { type: "williams_r",         name: "Williams %R",         desc: "Fast momentum oscillator overbought/oversold reversals",  category: "Momentum" },
  { type: "bollinger_bands",    name: "Bollinger Bands",     desc: "Mean-reversion entries on band touch with squeeze filter", category: "Volatility" },
  { type: "breakout",           name: "Breakout + ATR",      desc: "Price breakout with volume confirmation and ATR sizing",   category: "Volatility" },
  { type: "volume",             name: "Volume / VWAP",       desc: "OBV trend + VWAP deviation momentum entries",             category: "Volume" },
  { type: "orderflow",          name: "Order Flow",          desc: "CVD, volume delta & VWAP pressure proxies from OHLCV",    category: "Volume" },
  { type: "options",            name: "Options",             desc: "Covered calls, spreads, straddles with Black-Scholes",    category: "Derivatives" },
  { type: "portfolio_optimizer", name: "Portfolio Optimizer", desc: "Modern portfolio theory optimal weight allocation",       category: "Portfolio" },
  { type: "custom",             name: "Custom",              desc: "Combine multiple indicators with AND/OR logic",           category: "Custom" },
];

const TICKER_PRESETS: { label: string; tickers: string }[] = [
  { label: "Mag 7",        tickers: "AAPL,MSFT,GOOGL,AMZN,NVDA,META,TSLA" },
  { label: "S&P Leaders",  tickers: "SPY,QQQ,IWM,DIA,VTI" },
  { label: "Financials",   tickers: "JPM,GS,BAC,WFC,MS,C" },
  { label: "Energy",       tickers: "XOM,CVX,COP,SLB,PSX" },
  { label: "Crypto",       tickers: "BTC-USD,ETH-USD,SOL-USD,BNB-USD" },
  { label: "FAANG+",       tickers: "META,AAPL,AMZN,NFLX,GOOGL,MSFT" },
];

const TIMEFRAMES = [
  { value: "1m",  label: "1 Min" },  { value: "5m",  label: "5 Min" },
  { value: "15m", label: "15 Min" }, { value: "1h",  label: "1 Hour" },
  { value: "4h",  label: "4 Hour" }, { value: "1d",  label: "Daily" },
  { value: "1wk", label: "Weekly" },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const STATUS_MESSAGES = [
  "Fetching historical data...",
  "Calculating indicators...",
  "Simulating trades...",
  "Calculating metrics...",
  "Running AI analysis...",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPct(n: number | undefined | null, decimals = 1): string {
  if (n == null) return "\u2014";
  const v = n.toFixed(decimals);
  return n >= 0 ? `+${v}%` : `${v}%`;
}
function fmtNum(n: number | undefined | null, decimals = 2): string {
  if (n == null) return "\u2014";
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
  if (m.total_return > 50) score += 25; else if (m.total_return > 20) score += 18; else if (m.total_return > 5) score += 12; else if (m.total_return > 0) score += 6;
  if (m.sharpe_ratio > 2) score += 30; else if (m.sharpe_ratio > 1.5) score += 24; else if (m.sharpe_ratio > 1) score += 18; else if (m.sharpe_ratio > 0.5) score += 10;
  if (m.win_rate > 70) score += 25; else if (m.win_rate > 60) score += 20; else if (m.win_rate > 50) score += 14; else if (m.win_rate > 40) score += 8;
  const dd = Math.abs(m.max_drawdown);
  if (dd < 10) score += 20; else if (dd < 15) score += 15; else if (dd < 20) score += 10; else if (dd < 30) score += 5;
  if (score >= 85) return { grade: "A+", color: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10" };
  if (score >= 75) return { grade: "A",  color: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10" };
  if (score >= 65) return { grade: "B+", color: "text-[var(--accent-color)] border-[var(--accent-color)]/40 bg-[var(--accent-color)]/10" };
  if (score >= 55) return { grade: "B",  color: "text-[var(--accent-color)] border-[var(--accent-color)]/40 bg-[var(--accent-color)]/10" };
  if (score >= 45) return { grade: "B-", color: "text-[var(--accent-color)] border-[var(--accent-color)]/40 bg-[var(--accent-color)]/10" };
  if (score >= 35) return { grade: "C+", color: "text-amber-400 border-amber-400/40 bg-amber-400/10" };
  if (score >= 25) return { grade: "C",  color: "text-amber-400 border-amber-400/40 bg-amber-400/10" };
  return { grade: "F", color: "text-red-400 border-red-400/40 bg-red-400/10" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function NumInput({ label, value, onChange, min, max, step = 1, suffix }: {
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
          min={min} max={max} step={step}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none"
        />
        {suffix && <span className="text-xs text-zinc-500">{suffix}</span>}
      </div>
    </div>
  );
}

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
  const [mode, setMode] = useState<Mode>("landing");
  const [setup, setSetup] = useState<Setup>(DEFAULT_SETUP);
  const [strategy, setStrategy] = useState<StrategyType>("ma_crossover");
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [compareResult, setCompareResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [riskOpen, setRiskOpen] = useState(true);
  const [savedStrategies, setSavedStrategies] = useState<SavedStrategy[]>([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [showSaved, setShowSaved] = useState(false);
  const [stratCategory, setStratCategory] = useState<string>("All");

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Load saved strategies
  useEffect(() => {
    try {
      const raw = localStorage.getItem("bt_saved_strategies");
      if (raw) setSavedStrategies(JSON.parse(raw) as SavedStrategy[]);
    } catch { /* ignore */ }
  }, []);


  // ── Live price fetch ──
  const fetchPrice = useCallback(async (ticker: string) => {
    if (!ticker.trim()) return;
    setLoadingPrice(true);
    try {
      const res = await fetch(`/api/backtest/data/price?ticker=${encodeURIComponent(ticker)}&period=5d`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) setCurrentPrice(data[data.length - 1].close);
      }
    } catch { /* ignore */ } finally { setLoadingPrice(false); }
  }, []);

  // ── Loading animation ──
  useEffect(() => {
    if (mode !== "running") return;
    setProgress(0); setStatusIdx(0);
    const progInterval = setInterval(() => setProgress((p) => Math.min(p + 0.8, 95)), 400);
    const msgInterval = setInterval(() => setStatusIdx((i) => Math.min(i + 1, STATUS_MESSAGES.length - 1)), 6000);
    return () => { clearInterval(progInterval); clearInterval(msgInterval); };
  }, [mode]);

  // ── Build strategy params for API ──
  function buildStrategyParams(): Record<string, unknown> {
    const p = params;
    switch (strategy) {
      case "ma_crossover":   return { fast_period: p.fastPeriod, slow_period: p.slowPeriod, ma_type: p.maType };
      case "rsi":            return { rsi_period: p.rsiPeriod, oversold: p.oversold, overbought: p.overbought };
      case "breakout":       return { lookback_period: p.lookbackPeriod, volume_confirmation: p.volumeConfirmation, atr_multiplier: p.atrMultiplier };
      case "macd":           return { fast_period: p.macdFast, slow_period: p.macdSlow, signal_period: p.macdSignal };
      case "bollinger_bands":return { period: p.bbPeriod, std_dev: p.bbStdDev };
      case "stochastic":     return { k_period: p.stochK, d_period: p.stochD, overbought: p.stochOverbought, oversold: p.stochOversold };
      case "cci":            return { period: p.cciPeriod, overbought: p.cciOverbought, oversold: p.cciOversold };
      case "williams_r":     return { period: p.williamsRPeriod, overbought: p.williamsROverbought, oversold: p.williamsROversold };
      case "adx":            return { period: p.adxPeriod, threshold: p.adxThreshold };
      case "parabolic_sar":  return { step: p.sarStep, max_step: p.sarMax };
      case "ichimoku":       return { tenkan_period: p.ichimokuTenkan, kijun_period: p.ichimokuKijun, senkou_period: p.ichimokuSenkou };
      case "volume":         return { vwap_period: p.vwapPeriod, obv_ma_period: p.obvMaPeriod };
      case "orderflow":      return { threshold: p.orderFlowThreshold, vwap_period: p.vwapPeriod };
      case "options":        return { strategy_type: p.optionStrategy, expiry_days: p.expiryDays, delta_target: p.deltaTarget };
      default:               return { fast_period: p.fastPeriod, slow_period: p.slowPeriod, ma_type: p.maType };
    }
  }

  // ── Run backtest (manual mode) ──
  async function runBacktest() {
    setMode("running"); setError(null); setResult(null);
    const isPortfolio = strategy === "portfolio_optimizer";

    const body = isPortfolio
      ? { tickers: setup.tickers.split(",").map((t) => t.trim().toUpperCase()), start_date: setup.startDate, end_date: setup.endDate }
      : {
          ticker: setup.ticker.toUpperCase(),
          start_date: setup.startDate, end_date: setup.endDate,
          initial_capital: setup.initialCapital,
          strategy_type: strategy === "custom" ? "ma_crossover" : strategy,
          commission: setup.commission / 100, slippage: setup.slippage / 10000,
          timeframe: setup.timeframe, direction: setup.direction,
          leverage: setup.leverage, position_sizing_type: setup.positionSizingType,
          fixed_dollar_size: setup.fixedDollarSize, position_size: params.positionSize,
          use_stop_loss: params.useStopLoss, stop_loss_type: params.stopLossType,
          stop_loss_pct: params.stopLossPct / 100, stop_loss_atr_multiplier: params.stopLossAtrMultiplier,
          use_take_profit: params.useTakeProfit, take_profit_pct: params.takeProfitPct / 100,
          use_multiple_tp: params.useMultipleTP, take_profit_targets: params.takeProfitTargets,
          walk_forward: params.walkForward, monte_carlo: params.monteCarlo,
          monte_carlo_runs: params.monteCarloRuns, params: buildStrategyParams(),
        };

    const endpoint = isPortfolio ? "/api/backtest/optimize" : "/api/backtest/run";

    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error ?? "Backtest failed"); setMode("manual-params"); return; }
      setResult(data);
      setProgress(100);
      setTimeout(() => setMode("results"), 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setMode("manual-params");
    }
  }

  // ── Run backtest from AI chat config ──
  async function runBacktestFromConfig(config: Record<string, unknown>) {
    setMode("running"); setError(null); setResult(null);

    const isPortfolio = config.strategy_type === "portfolio_optimizer";
    const endpoint = isPortfolio ? "/api/backtest/optimize" : "/api/backtest/run";

    // The config from Claude already has the right shape for the API
    const body = isPortfolio
      ? { tickers: (config.ticker as string).split(",").map((t: string) => t.trim().toUpperCase()), start_date: config.start_date, end_date: config.end_date }
      : config;

    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error ?? "Backtest failed"); setMode("chat"); return; }
      setResult(data);
      setProgress(100);
      setTimeout(() => setMode("results"), 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setMode("chat");
    }
  }

  // ── Chat send ──
  async function sendChatMessage() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const newMessages: ChatMessage[] = [...chatMessages, { role: "user", content: text }];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/backtest/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();

      if (!res.ok) {
        setChatMessages([...newMessages, { role: "assistant", content: data.error ?? "Something went wrong. Please try again." }]);
        setChatLoading(false);
        return;
      }

      // Strip the JSON block from the displayed reply
      const displayReply = data.reply.replace(/```json[\s\S]*?```/g, "").trim();
      const finalReply = displayReply || "Got it! Setting up your backtest now...";
      setChatMessages([...newMessages, { role: "assistant", content: finalReply }]);

      if (data.config) {
        // Claude returned a ready config, run the backtest
        setTimeout(() => runBacktestFromConfig(data.config), 800);
      }
    } catch {
      setChatMessages([...newMessages, { role: "assistant", content: "Network error. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  }

  // ── Save strategy ──
  function saveStrategy() {
    if (!saveName.trim() || !result) return;
    const entry: SavedStrategy = {
      id: Date.now().toString(), name: saveName.trim(), strategyType: strategy,
      setup, params, result, savedAt: new Date().toISOString(),
    };
    const updated = [entry, ...savedStrategies].slice(0, 20);
    setSavedStrategies(updated);
    try { localStorage.setItem("bt_saved_strategies", JSON.stringify(updated)); } catch { /* ignore */ }
    setSaveModalOpen(false);
    setSaveName("");
  }

  function loadSaved(s: SavedStrategy) {
    setStrategy(s.strategyType); setSetup(s.setup); setParams(s.params); setResult(s.result);
    setShowSaved(false);
    if (s.result) setMode("results"); else setMode("manual-setup");
  }

  function deleteSaved(id: string) {
    const updated = savedStrategies.filter((s) => s.id !== id);
    setSavedStrategies(updated);
    try { localStorage.setItem("bt_saved_strategies", JSON.stringify(updated)); } catch { /* ignore */ }
  }

  function exportCSV() {
    if (!result?.metrics.trades?.length) return;
    const headers = ["Entry Date","Exit Date","Entry Price","Exit Price","Return %","Hold Days","Direction"];
    const rows = result.metrics.trades.map((t) =>
      [t.entry_date, t.exit_date, t.entry_price, t.exit_price, t.return_pct.toFixed(2), t.hold_days, t.direction ?? "long"].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `backtest_${result.ticker}_${result.strategy_type}_trades.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  function exportJSON() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `backtest_${result.ticker}_${result.strategy_type}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  // ─── Landing ──────────────────────────────────────────────────────────────────

  function renderLanding() {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-100">Backtester</h1>
          <p className="mt-2 text-sm text-zinc-500">Test your trading strategies against historical data.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* AI Chat option */}
          <button
            onClick={() => { setMode("chat"); setChatMessages([]); setChatInput(""); }}
            className="group flex flex-col gap-4 rounded-2xl border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/5 p-6 text-left transition hover:border-[var(--accent-color)]/60 hover:bg-[var(--accent-color)]/10"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/10">
              <svg className="h-6 w-6 text-[var(--accent-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-100 group-hover:text-[var(--accent-color)] transition">Describe Your Strategy</p>
              <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                Tell Claude what you want to test in plain English. It will ask the right questions and set everything up for you.
              </p>
            </div>
            <span className="mt-auto rounded-full border border-[var(--accent-color)]/30 px-3 py-1 text-[10px] font-semibold text-[var(--accent-color)] uppercase tracking-wider">
              Recommended
            </span>
          </button>

          {/* Manual option */}
          <button
            onClick={() => setMode("manual-setup")}
            className="group flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-white/20 hover:bg-white/10"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5">
              <svg className="h-6 w-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-100 group-hover:text-zinc-50 transition">Select Strategy Manually</p>
              <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                Choose from 16 built-in strategies and configure every parameter yourself. Full control over all settings.
              </p>
            </div>
            <span className="mt-auto rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Advanced
            </span>
          </button>
        </div>

        {/* Saved strategies */}
        {savedStrategies.length > 0 && (
          <div>
            <button
              onClick={() => setShowSaved(!showSaved)}
              className="mb-3 text-xs text-zinc-500 hover:text-zinc-300 transition"
            >
              Saved Strategies ({savedStrategies.length}) {showSaved ? "\u25B2" : "\u25BC"}
            </button>
            {showSaved && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                {savedStrategies.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                    <div>
                      <p className="text-sm text-zinc-200">{s.name}</p>
                      <p className="text-[10px] text-zinc-500">{s.strategyType} / {s.setup.ticker} / saved {new Date(s.savedAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => loadSaved(s)} className="rounded border border-[var(--accent-color)]/30 px-2 py-1 text-[10px] text-[var(--accent-color)] hover:bg-[var(--accent-color)]/10 transition">Load</button>
                      <button onClick={() => deleteSaved(s.id)} className="rounded border border-red-500/30 px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/10 transition">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── AI Chat ──────────────────────────────────────────────────────────────────

  function renderChat() {
    return (
      <div className="flex flex-col" style={{ height: "calc(100vh - 200px)", minHeight: "500px" }}>
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setMode("landing")} className="text-xs text-zinc-500 hover:text-zinc-300 transition">&larr; Back</button>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Describe Your Backtest</h2>
              <p className="text-xs text-zinc-500">Tell Claude what you want to test. It will handle the rest.</p>
            </div>
          </div>
          <button
            onClick={() => { setChatMessages([]); setChatInput(""); setError(null); }}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-500 hover:bg-white/5 transition"
          >
            New Chat
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
          {chatMessages.length === 0 && !chatLoading && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--accent-color)]/20 bg-[var(--accent-color)]/5">
                <svg className="h-7 w-7 text-[var(--accent-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-300">What would you like to backtest?</p>
                <p className="mt-1 text-xs text-zinc-600 max-w-sm">
                  Describe your strategy in plain English. For example:
                </p>
              </div>
              <div className="grid gap-2 w-full max-w-md">
                {[
                  "Test an RSI strategy on AAPL from 2020 to 2024 with $10k",
                  "Backtest a MACD crossover on BTC-USD with a 5% stop loss",
                  "I want to test buying SPY when it crosses above the 50-day moving average",
                ].map((example) => (
                  <button
                    key={example}
                    onClick={() => { setChatInput(example); chatInputRef.current?.focus(); }}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-left text-xs text-zinc-400 transition hover:border-[var(--accent-color)]/30 hover:text-zinc-300"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 text-zinc-200"
                  : "bg-white/5 border border-white/10 text-zinc-300"
              }`}>
                {msg.role === "assistant" && (
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-[var(--accent-color)] uppercase tracking-wider">Claude</span>
                  </div>
                )}
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}

          {chatLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="mt-3 flex gap-2">
          <textarea
            ref={chatInputRef}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
            }}
            placeholder="Describe your strategy..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
          />
          <button
            onClick={sendChatMessage}
            disabled={!chatInput.trim() || chatLoading}
            className="rounded-xl bg-[var(--accent-color)] px-5 py-3 text-sm font-semibold text-[#020308] transition hover:opacity-90 disabled:opacity-40"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // ─── Manual Step 1: Setup ─────────────────────────────────────────────────────

  function renderManualSetup() {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setMode("landing")} className="text-xs text-zinc-500 hover:text-zinc-300 transition">&larr; Back</button>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Strategy Setup</h2>
              <p className="mt-0.5 text-xs text-zinc-500">Configure instrument, dates, and execution model.</p>
            </div>
          </div>
          {savedStrategies.length > 0 && (
            <button onClick={() => setShowSaved(!showSaved)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/10 transition">
              Saved ({savedStrategies.length})
            </button>
          )}
        </div>

        {showSaved && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Saved Strategies</p>
            {savedStrategies.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                <div>
                  <p className="text-sm text-zinc-200">{s.name}</p>
                  <p className="text-[10px] text-zinc-500">{s.strategyType} / {s.setup.ticker} / saved {new Date(s.savedAt).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => loadSaved(s)} className="rounded border border-[var(--accent-color)]/30 px-2 py-1 text-[10px] text-[var(--accent-color)] hover:bg-[var(--accent-color)]/10 transition">Load</button>
                  <button onClick={() => deleteSaved(s.id)} className="rounded border border-red-500/30 px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/10 transition">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Instrument */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Instrument</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Ticker Symbol</label>
              <div className="relative">
                <input type="text" value={setup.ticker}
                  onChange={(e) => setSetup({ ...setup, ticker: e.target.value.toUpperCase() })}
                  onBlur={() => fetchPrice(setup.ticker)} placeholder="AAPL"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pr-20 text-sm text-zinc-200 uppercase focus:border-[var(--accent-color)]/50 focus:outline-none" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                  {loadingPrice ? "..." : currentPrice ? `$${currentPrice.toFixed(2)}` : ""}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Asset Type</label>
              <select value={setup.assetType} onChange={(e) => setSetup({ ...setup, assetType: e.target.value })}
                className="rounded-lg border border-white/10 bg-[var(--app-card-alt)] px-3 py-2 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none">
                <option value="stock">Stock / Equity</option>
                <option value="etf">ETF</option>
                <option value="crypto">Crypto</option>
                <option value="index">Index</option>
                <option value="forex">Forex</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Timeframe</label>
              <select value={setup.timeframe} onChange={(e) => setSetup({ ...setup, timeframe: e.target.value })}
                className="rounded-lg border border-white/10 bg-[var(--app-card-alt)] px-3 py-2 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none">
                {TIMEFRAMES.map((tf) => <option key={tf.value} value={tf.value}>{tf.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Date Range</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Start Date</label>
              <input type="date" value={setup.startDate} onChange={(e) => setSetup({ ...setup, startDate: e.target.value })}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none [color-scheme:dark]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">End Date</label>
              <input type="date" value={setup.endDate} onChange={(e) => setSetup({ ...setup, endDate: e.target.value })}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none [color-scheme:dark]" />
            </div>
          </div>
        </div>

        {/* Capital & Direction */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Capital & Execution</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Initial Capital</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
                <input type="number" value={setup.initialCapital} onChange={(e) => setSetup({ ...setup, initialCapital: Number(e.target.value) })} min={100} step={1000}
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-7 pr-3 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Direction</label>
              <select value={setup.direction} onChange={(e) => setSetup({ ...setup, direction: e.target.value as Setup["direction"] })}
                className="rounded-lg border border-white/10 bg-[var(--app-card-alt)] px-3 py-2 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none">
                <option value="long">Long Only</option>
                <option value="short">Short Only</option>
                <option value="both">Long & Short</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Leverage</label>
              <div className="relative">
                <input type="number" value={setup.leverage} onChange={(e) => setSetup({ ...setup, leverage: Math.max(1, Number(e.target.value)) })} min={1} max={20} step={0.5}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pr-7 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">&times;</span>
              </div>
            </div>
          </div>

          {/* Position sizing */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Position Sizing</label>
              <select value={setup.positionSizingType} onChange={(e) => setSetup({ ...setup, positionSizingType: e.target.value as Setup["positionSizingType"] })}
                className="rounded-lg border border-white/10 bg-[var(--app-card-alt)] px-3 py-2 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none">
                <option value="pct">% of Portfolio</option>
                <option value="fixed_dollar">Fixed Dollar Amount</option>
                <option value="kelly">Kelly Criterion</option>
              </select>
            </div>
            {setup.positionSizingType === "pct" && (
              <NumInput label="Position Size %" value={Math.round(params.positionSize * 100)}
                onChange={(v) => setParams({ ...params, positionSize: v / 100 })} min={5} max={100} step={5} suffix="%" />
            )}
            {setup.positionSizingType === "fixed_dollar" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">Fixed $ Per Trade</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
                  <input type="number" value={setup.fixedDollarSize} onChange={(e) => setSetup({ ...setup, fixedDollarSize: Number(e.target.value) })} min={100} step={100}
                    className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-7 pr-3 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none" />
                </div>
              </div>
            )}
            {setup.positionSizingType === "kelly" && (
              <p className="flex items-end text-xs text-zinc-500 pb-2">Kelly fraction calculated from win rate and avg win/loss of the selected strategy.</p>
            )}
          </div>
        </div>

        {/* Cost modeling */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Cost Modeling</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Commission per Trade</label>
              <div className="relative">
                <input type="number" value={setup.commission} onChange={(e) => setSetup({ ...setup, commission: Number(e.target.value) })} min={0} max={5} step={0.01}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pr-7 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">%</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Slippage</label>
              <div className="relative">
                <input type="number" value={setup.slippage} onChange={(e) => setSetup({ ...setup, slippage: Number(e.target.value) })} min={0} max={100} step={1}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pr-10 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">bps</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={() => setMode("manual-strategy")} disabled={!setup.ticker.trim()}
            className="rounded-lg bg-[var(--accent-color)] px-5 py-2 text-sm font-semibold text-[#020308] transition hover:opacity-90 disabled:opacity-40">
            Continue &rarr;
          </button>
        </div>
      </div>
    );
  }

  // ─── Manual Step 2: Strategy ──────────────────────────────────────────────────

  function renderManualStrategy() {
    const categories = ["All", ...Array.from(new Set(STRATEGIES.map((s) => s.category)))];
    const filtered = stratCategory === "All" ? STRATEGIES : STRATEGIES.filter((s) => s.category === stratCategory);
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Select Strategy</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Choose the trading logic to backtest.</p>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button key={cat} onClick={() => setStratCategory(cat)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                stratCategory === cat ? "border-[var(--accent-color)]/60 bg-[var(--accent-color)]/10 text-[var(--accent-color)]" : "border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-300"
              }`}>
              {cat}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <button key={s.type} onClick={() => setStrategy(s.type)}
              className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition hover:border-[var(--accent-color)]/40 ${
                strategy === s.type ? "border-[var(--accent-color)]/60 bg-[var(--accent-color)]/5" : "border-white/10 bg-white/5"
              }`}>
              <div className="flex w-full items-center justify-between">
                <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] text-zinc-500">{s.category}</span>
              </div>
              <div>
                <p className={`text-sm font-semibold ${strategy === s.type ? "text-[var(--accent-color)]" : "text-zinc-200"}`}>{s.name}</p>
                <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed">{s.desc}</p>
              </div>
              {strategy === s.type && (
                <span className="text-[10px] font-bold text-[var(--accent-color)] border border-[var(--accent-color)]/30 rounded-full px-2 py-0.5">SELECTED</span>
              )}
            </button>
          ))}
        </div>

        {/* Portfolio tickers / presets */}
        {strategy === "portfolio_optimizer" && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Portfolio Tickers</p>
            <div className="flex flex-wrap gap-2">
              {TICKER_PRESETS.map((preset) => (
                <button key={preset.label} onClick={() => setSetup({ ...setup, tickers: preset.tickers })}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400 hover:border-[var(--accent-color)]/40 hover:text-[var(--accent-color)] transition">
                  {preset.label}
                </button>
              ))}
            </div>
            <input type="text" value={setup.tickers} onChange={(e) => setSetup({ ...setup, tickers: e.target.value.toUpperCase() })}
              placeholder="AAPL, MSFT, GOOGL, AMZN"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none" />
            <p className="text-xs text-zinc-600">Enter 2-10 tickers. Modern portfolio theory finds optimal allocation weights.</p>
          </div>
        )}

        {strategy === "orderflow" && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-xs text-amber-400 font-medium">OHLCV-based proxies</p>
            <p className="text-xs text-zinc-500 mt-0.5">True Level 2 tape data is unavailable for backtesting. This strategy approximates order flow using volume delta, CVD, and VWAP deviation derived from daily/hourly OHLCV candles.</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button onClick={() => setMode("manual-setup")} className="text-xs text-zinc-500 hover:text-zinc-300 transition">&larr; Back</button>
          <button onClick={() => setMode("manual-params")} className="rounded-lg bg-[var(--accent-color)] px-5 py-2 text-sm font-semibold text-[#020308] transition hover:opacity-90">Continue &rarr;</button>
        </div>
      </div>
    );
  }

  // ─── Manual Step 3: Parameters ────────────────────────────────────────────────

  function renderManualParams() {
    const p = params;
    const set = (updates: Partial<Params>) => setParams({ ...p, ...updates });

    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Strategy Parameters</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Fine-tune your strategy settings.</p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        {/* Strategy-specific params */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            {STRATEGIES.find((s) => s.type === strategy)?.name} Parameters
          </p>

          {strategy === "ma_crossover" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <NumInput label="Fast Period" value={p.fastPeriod} onChange={(v) => set({ fastPeriod: v })} min={2} max={50} />
              <NumInput label="Slow Period" value={p.slowPeriod} onChange={(v) => set({ slowPeriod: v })} min={10} max={200} />
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">MA Type</label>
                <select value={p.maType} onChange={(e) => set({ maType: e.target.value as Params["maType"] })}
                  className="rounded-lg border border-white/10 bg-[var(--app-card-alt)] px-3 py-2 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none">
                  <option value="sma">SMA</option><option value="ema">EMA</option><option value="wma">WMA</option>
                  <option value="dema">DEMA</option><option value="tema">TEMA</option>
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

          {strategy === "macd" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <NumInput label="Fast Period" value={p.macdFast} onChange={(v) => set({ macdFast: v })} min={5} max={50} />
              <NumInput label="Slow Period" value={p.macdSlow} onChange={(v) => set({ macdSlow: v })} min={10} max={100} />
              <NumInput label="Signal Period" value={p.macdSignal} onChange={(v) => set({ macdSignal: v })} min={3} max={20} />
            </div>
          )}

          {strategy === "bollinger_bands" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <NumInput label="Period" value={p.bbPeriod} onChange={(v) => set({ bbPeriod: v })} min={5} max={50} />
              <NumInput label="Std Deviation" value={p.bbStdDev} onChange={(v) => set({ bbStdDev: v })} min={1} max={4} step={0.1} />
            </div>
          )}

          {strategy === "stochastic" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <NumInput label="%K Period" value={p.stochK} onChange={(v) => set({ stochK: v })} min={5} max={30} />
              <NumInput label="%D Smoothing" value={p.stochD} onChange={(v) => set({ stochD: v })} min={1} max={10} />
              <NumInput label="Overbought" value={p.stochOverbought} onChange={(v) => set({ stochOverbought: v })} min={70} max={90} />
              <NumInput label="Oversold" value={p.stochOversold} onChange={(v) => set({ stochOversold: v })} min={10} max={30} />
            </div>
          )}

          {strategy === "cci" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <NumInput label="Period" value={p.cciPeriod} onChange={(v) => set({ cciPeriod: v })} min={10} max={50} />
              <NumInput label="Overbought" value={p.cciOverbought} onChange={(v) => set({ cciOverbought: v })} min={80} max={200} />
              <NumInput label="Oversold" value={p.cciOversold} onChange={(v) => set({ cciOversold: v })} min={-200} max={-80} />
            </div>
          )}

          {strategy === "williams_r" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <NumInput label="Period" value={p.williamsRPeriod} onChange={(v) => set({ williamsRPeriod: v })} min={5} max={30} />
              <NumInput label="Overbought" value={p.williamsROverbought} onChange={(v) => set({ williamsROverbought: v })} min={-30} max={-5} />
              <NumInput label="Oversold" value={p.williamsROversold} onChange={(v) => set({ williamsROversold: v })} min={-95} max={-70} />
            </div>
          )}

          {strategy === "adx" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <NumInput label="ADX Period" value={p.adxPeriod} onChange={(v) => set({ adxPeriod: v })} min={7} max={30} />
              <NumInput label="ADX Threshold" value={p.adxThreshold} onChange={(v) => set({ adxThreshold: v })} min={15} max={50} />
            </div>
          )}

          {strategy === "parabolic_sar" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <NumInput label="Acceleration Step" value={p.sarStep} onChange={(v) => set({ sarStep: v })} min={0.01} max={0.1} step={0.01} />
              <NumInput label="Max Acceleration" value={p.sarMax} onChange={(v) => set({ sarMax: v })} min={0.1} max={0.5} step={0.05} />
            </div>
          )}

          {strategy === "ichimoku" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <NumInput label="Tenkan (Conversion)" value={p.ichimokuTenkan} onChange={(v) => set({ ichimokuTenkan: v })} min={5} max={20} />
              <NumInput label="Kijun (Base)" value={p.ichimokuKijun} onChange={(v) => set({ ichimokuKijun: v })} min={20} max={60} />
              <NumInput label="Senkou Span B" value={p.ichimokuSenkou} onChange={(v) => set({ ichimokuSenkou: v })} min={40} max={100} />
            </div>
          )}

          {strategy === "volume" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <NumInput label="VWAP Lookback Period" value={p.vwapPeriod} onChange={(v) => set({ vwapPeriod: v })} min={5} max={50} />
              <NumInput label="OBV MA Period" value={p.obvMaPeriod} onChange={(v) => set({ obvMaPeriod: v })} min={5} max={50} />
            </div>
          )}

          {strategy === "orderflow" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <NumInput label="Volume Delta Threshold" value={p.orderFlowThreshold} onChange={(v) => set({ orderFlowThreshold: v })} min={0.1} max={1} step={0.05} />
              <NumInput label="VWAP Period" value={p.vwapPeriod} onChange={(v) => set({ vwapPeriod: v })} min={5} max={50} />
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
                <select value={p.optionStrategy} onChange={(e) => set({ optionStrategy: e.target.value })}
                  className="rounded-lg border border-white/10 bg-[var(--app-card-alt)] px-3 py-2 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none">
                  <option value="covered_call">Covered Call</option><option value="cash_secured_put">Cash Secured Put</option>
                  <option value="bull_call_spread">Bull Call Spread</option><option value="bear_put_spread">Bear Put Spread</option>
                  <option value="iron_condor">Iron Condor</option><option value="straddle">Straddle</option>
                  <option value="strangle">Strangle</option><option value="butterfly">Butterfly Spread</option>
                </select>
              </div>
              <NumInput label="Expiry Days" value={p.expiryDays} onChange={(v) => set({ expiryDays: v })} min={7} max={180} />
              <NumInput label="Delta Target" value={p.deltaTarget} onChange={(v) => set({ deltaTarget: v })} min={0.1} max={0.5} step={0.05} />
            </div>
          )}

          {strategy === "portfolio_optimizer" && (
            <p className="text-xs text-zinc-500">Portfolio optimization uses modern portfolio theory. Configure your tickers in Step 2.</p>
          )}

          {strategy === "custom" && (
            <p className="text-xs text-zinc-500">Custom strategies use MA Crossover as the execution engine. Full condition builder coming soon.</p>
          )}
        </div>

        {/* Risk management */}
        {strategy !== "portfolio_optimizer" && (
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            <button onClick={() => setRiskOpen(!riskOpen)} className="flex w-full items-center justify-between p-4 text-left">
              <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Risk Management</span>
              <svg className={`h-4 w-4 text-zinc-500 transition-transform ${riskOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {riskOpen && (
              <div className="border-t border-white/10 p-4 space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-zinc-300 font-medium">Stop Loss</label>
                    <Toggle value={p.useStopLoss} onChange={(v) => set({ useStopLoss: v })} />
                  </div>
                  {p.useStopLoss && (
                    <div className="space-y-3 pl-2 border-l border-white/10">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-zinc-400">Stop Loss Type</label>
                        <select value={p.stopLossType} onChange={(e) => set({ stopLossType: e.target.value as Params["stopLossType"] })}
                          className="rounded-lg border border-white/10 bg-[var(--app-card-alt)] px-3 py-2 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none">
                          <option value="fixed">Fixed %</option><option value="trailing">Trailing %</option><option value="atr">ATR-Based</option>
                        </select>
                      </div>
                      {(p.stopLossType === "fixed" || p.stopLossType === "trailing") && (
                        <NumInput label={p.stopLossType === "trailing" ? "Trailing Stop %" : "Stop Loss %"} value={p.stopLossPct}
                          onChange={(v) => set({ stopLossPct: v })} min={0.5} max={50} step={0.5} suffix="%" />
                      )}
                      {p.stopLossType === "atr" && (
                        <NumInput label="ATR Multiplier" value={p.stopLossAtrMultiplier}
                          onChange={(v) => set({ stopLossAtrMultiplier: v })} min={0.5} max={8} step={0.25} />
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-zinc-300 font-medium">Take Profit</label>
                    <Toggle value={p.useTakeProfit} onChange={(v) => set({ useTakeProfit: v })} />
                  </div>
                  {p.useTakeProfit && (
                    <div className="space-y-3 pl-2 border-l border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-400">Multiple Targets</span>
                        <Toggle value={p.useMultipleTP} onChange={(v) => set({ useMultipleTP: v })} />
                      </div>
                      {!p.useMultipleTP && (
                        <NumInput label="Take Profit %" value={p.takeProfitPct} onChange={(v) => set({ takeProfitPct: v })} min={1} max={500} step={1} suffix="%" />
                      )}
                      {p.useMultipleTP && (
                        <div className="space-y-2">
                          <p className="text-[10px] text-zinc-600">Target % / Size to exit (sizes must total 100%)</p>
                          {p.takeProfitTargets.map((t, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <input type="number" value={t.pct} onChange={(e) => {
                                const tgts = [...p.takeProfitTargets]; tgts[i] = { ...t, pct: Number(e.target.value) }; set({ takeProfitTargets: tgts });
                              }} min={1} placeholder="%" className="w-20 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-200" />
                              <span className="text-xs text-zinc-600">%</span>
                              <input type="number" value={t.size} onChange={(e) => {
                                const tgts = [...p.takeProfitTargets]; tgts[i] = { ...t, size: Number(e.target.value) }; set({ takeProfitTargets: tgts });
                              }} min={1} max={100} placeholder="size%" className="w-20 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-200" />
                              <span className="text-xs text-zinc-600">% exit</span>
                              {p.takeProfitTargets.length > 1 && (
                                <button onClick={() => set({ takeProfitTargets: p.takeProfitTargets.filter((_, j) => j !== i) })}
                                  className="text-xs text-red-400 hover:text-red-300">&times;</button>
                              )}
                            </div>
                          ))}
                          {p.takeProfitTargets.length < 5 && (
                            <button onClick={() => set({ takeProfitTargets: [...p.takeProfitTargets, { pct: 15, size: 25 }] })}
                              className="text-xs text-[var(--accent-color)] hover:opacity-80">+ Add target</button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Advanced */}
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <button onClick={() => setAdvancedOpen(!advancedOpen)} className="flex w-full items-center justify-between p-4 text-left">
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Advanced Options</span>
            <svg className={`h-4 w-4 text-zinc-500 transition-transform ${advancedOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {advancedOpen && (
            <div className="border-t border-white/10 p-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-300">Walk-Forward Analysis</p>
                      <p className="text-[10px] text-zinc-600">In/out-of-sample overfitting detection</p>
                    </div>
                    <Toggle value={p.walkForward} onChange={(v) => set({ walkForward: v })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-300">Monte Carlo Simulation</p>
                      <p className="text-[10px] text-zinc-600">Resample trades to estimate outcome range</p>
                    </div>
                    <Toggle value={p.monteCarlo} onChange={(v) => set({ monteCarlo: v })} />
                  </div>
                  {p.monteCarlo && (
                    <NumInput label="Simulation Runs" value={p.monteCarloRuns}
                      onChange={(v) => set({ monteCarloRuns: Math.min(5000, Math.max(100, v)) })} min={100} max={5000} step={100} />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={() => setMode("manual-strategy")} className="text-xs text-zinc-500 hover:text-zinc-300 transition">&larr; Back</button>
          <button onClick={runBacktest} className="rounded-lg bg-[var(--accent-color)] px-6 py-2 text-sm font-semibold text-[#020308] transition hover:opacity-90">
            Run Backtest &rarr;
          </button>
        </div>
      </div>
    );
  }

  // ─── Running ──────────────────────────────────────────────────────────────────

  function renderRunning() {
    return (
      <div className="flex flex-col items-center justify-center gap-8 py-20">
        <div className="relative">
          <div className="h-20 w-20 rounded-full border-2 border-[var(--accent-color)]/20 border-t-[var(--accent-color)] animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="h-8 w-8 text-[var(--accent-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
        </div>
        <div className="w-full max-w-sm space-y-3 text-center">
          <p className="text-sm font-medium text-zinc-200">{STATUS_MESSAGES[statusIdx]}</p>
          <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-[var(--accent-color)] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-zinc-600">{Math.round(progress)}% complete</p>
        </div>
      </div>
    );
  }

  // ─── Results ──────────────────────────────────────────────────────────────────

  function renderResults() {
    if (!result) return null;
    const m = result.metrics;
    const { grade, color: gradeColor } = gradeFromMetrics(m);

    const ddAreas: { x1: string; x2: string }[] = [];
    let ddStart: string | null = null;
    m.drawdown_curve?.forEach((d) => {
      if (d.drawdown < -2 && !ddStart) ddStart = d.date;
      if (d.drawdown >= -2 && ddStart) { ddAreas.push({ x1: ddStart, x2: d.date }); ddStart = null; }
    });

    const monthlyYears: Record<string, Record<number, number>> = {};
    Object.entries(m.monthly_returns ?? {}).forEach(([key, val]) => {
      const [year, mon] = key.split("-");
      if (!monthlyYears[year]) monthlyYears[year] = {};
      monthlyYears[year][parseInt(mon)] = val;
    });
    const years = Object.keys(monthlyYears).sort();

    const chartData = (m.equity_curve ?? []).map((pt) => ({ date: pt.date, Portfolio: pt.value }));
    const compareChartData = compareResult?.metrics.equity_curve?.map((pt) => ({ date: pt.date, Compare: pt.value })) ?? [];
    const mergedChart = chartData.map((pt) => {
      const cmp = compareChartData.find((c) => c.date === pt.date);
      return { ...pt, ...(cmp ?? {}) };
    });

    const mcData = result.monte_carlo?.trade_labels.map((i) => {
      const obj: Record<string, unknown> = { trade: i };
      Object.entries(result.monte_carlo!.percentile_curves).forEach(([k, arr]) => { obj[k] = arr[i]; });
      return obj;
    }) ?? [];

    const expectancy = m.expectancy ?? (
      m.win_rate != null && m.avg_win != null && m.avg_loss != null
        ? (m.win_rate / 100) * m.avg_win - (1 - m.win_rate / 100) * Math.abs(m.avg_loss)
        : null
    );

    return (
      <div className="space-y-5">

        {/* Save modal */}
        {saveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-6 shadow-2xl">
              <p className="mb-4 text-sm font-semibold text-zinc-100">Save Strategy</p>
              <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g. AAPL MACD Bull Run"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none"
                onKeyDown={(e) => { if (e.key === "Enter") saveStrategy(); }} autoFocus />
              <div className="mt-4 flex gap-3">
                <button onClick={() => setSaveModalOpen(false)} className="flex-1 rounded-lg border border-white/10 py-2 text-sm text-zinc-400 hover:bg-white/5 transition">Cancel</button>
                <button onClick={saveStrategy} disabled={!saveName.trim()} className="flex-1 rounded-lg bg-[var(--accent-color)] py-2 text-sm font-semibold text-[#020308] hover:opacity-90 transition disabled:opacity-40">Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-5">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest">
              {result.ticker} / {result.strategy_type.replace(/_/g, " ")} / {setup.timeframe} / {setup.direction}
            </p>
            <p className={`mt-1 text-4xl font-bold ${retColor(m.total_return)}`}>{fmtPct(m.total_return, 1)}</p>
            <p className="mt-1 text-xs text-zinc-500">{setup.startDate} &rarr; {setup.endDate}</p>
          </div>
          <div className="ml-4 flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Alpha vs SPY</span>
            <span className={`text-lg font-semibold ${retColor(m.alpha)}`}>
              {m.alpha != null ? `${m.alpha >= 0 ? "+" : ""}${m.alpha.toFixed(1)}%` : "\u2014"}
            </span>
            {m.beta != null && <span className="text-xs text-zinc-600">&beta; {m.beta.toFixed(2)}</span>}
          </div>
          <div className={`ml-auto flex h-16 w-16 items-center justify-center rounded-full border-2 text-2xl font-black ${gradeColor}`}>
            {grade}
          </div>
        </div>

        {/* Core metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Annualized Return", value: fmtPct(m.annualized_return), color: retColor(m.annualized_return) },
            { label: "Sharpe Ratio",      value: fmtNum(m.sharpe_ratio),      color: m.sharpe_ratio > 1 ? "text-emerald-400" : m.sharpe_ratio > 0 ? "text-amber-400" : "text-red-400" },
            { label: "Sortino Ratio",     value: fmtNum(m.sortino_ratio),     color: m.sortino_ratio > 1 ? "text-emerald-400" : m.sortino_ratio > 0 ? "text-amber-400" : "text-red-400" },
            { label: "Calmar Ratio",      value: fmtNum(m.calmar_ratio),      color: m.calmar_ratio > 1 ? "text-emerald-400" : m.calmar_ratio > 0 ? "text-amber-400" : "text-red-400" },
            { label: "Max Drawdown",      value: fmtPct(m.max_drawdown),      color: "text-red-400" },
            { label: "Win Rate",          value: m.win_rate != null ? `${m.win_rate.toFixed(1)}%` : "\u2014", color: m.win_rate > 50 ? "text-emerald-400" : "text-red-400" },
            { label: "Profit Factor",     value: fmtNum(m.profit_factor),     color: m.profit_factor > 1 ? "text-emerald-400" : "text-red-400" },
            { label: "Expectancy",        value: expectancy != null ? fmtPct(expectancy) : "\u2014", color: retColor(expectancy) },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/10 bg-[var(--app-card-alt)] p-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{item.label}</p>
              <p className={`mt-1 text-lg font-semibold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Secondary metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Trades",    value: m.total_trades?.toString() ?? "\u2014",    color: "text-zinc-200" },
            { label: "Avg Hold Time",   value: m.avg_hold_time_days != null ? `${m.avg_hold_time_days.toFixed(1)}d` : "\u2014", color: "text-zinc-200" },
            { label: "Avg Win",         value: fmtPct(m.avg_win),                    color: "text-emerald-400" },
            { label: "Avg Loss",        value: fmtPct(m.avg_loss),                   color: "text-red-400" },
            { label: "Best Trade",      value: fmtPct(m.best_trade),                 color: "text-emerald-400" },
            { label: "Worst Trade",     value: fmtPct(m.worst_trade),                color: "text-red-400" },
            { label: "Max Consec. Wins",  value: m.max_consecutive_wins?.toString() ?? "\u2014",   color: "text-emerald-400" },
            { label: "Max Consec. Losses", value: m.max_consecutive_losses?.toString() ?? "\u2014", color: "text-red-400" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/10 bg-[var(--app-card-alt)] p-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{item.label}</p>
              <p className={`mt-1 text-base font-semibold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Risk metrics */}
        {(m.var_95 != null || m.max_drawdown_duration_days != null) && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {m.var_95 != null && (
              <div className="rounded-xl border border-white/10 bg-[var(--app-card-alt)] p-3">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Value at Risk (95%)</p>
                <p className="mt-1 text-base font-semibold text-red-400">{fmtPct(m.var_95)}</p>
              </div>
            )}
            {m.max_drawdown_duration_days != null && (
              <div className="rounded-xl border border-white/10 bg-[var(--app-card-alt)] p-3">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Max DD Duration</p>
                <p className="mt-1 text-base font-semibold text-amber-400">{m.max_drawdown_duration_days}d</p>
              </div>
            )}
          </div>
        )}

        {/* Equity curve */}
        {chartData.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-200">Equity Curve</p>
              {compareResult && (
                <div className="flex items-center gap-2">
                  <span className="h-2 w-4 rounded bg-[var(--accent-color)]" />
                  <span className="text-xs text-zinc-500">{result.ticker}</span>
                  <span className="h-2 w-4 rounded bg-amber-400" />
                  <span className="text-xs text-zinc-500">{compareResult.ticker}</span>
                  <button onClick={() => setCompareResult(null)} className="text-xs text-red-400 hover:text-red-300">&times; Clear</button>
                </div>
              )}
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={mergedChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: "#52525b", fontSize: 10 }} tickFormatter={(v: string) => v?.slice(0, 7) ?? ""} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "#52525b", fontSize: 10 }} tickFormatter={(v: number) => fmtDollars(v)} width={60} />
                <Tooltip content={<ChartTooltipContent />} />
                {ddAreas.map((a, i) => <ReferenceArea key={i} x1={a.x1} x2={a.x2} fill="rgba(239,68,68,0.08)" />)}
                <Line type="monotone" dataKey="Portfolio" stroke="var(--accent-color)" dot={false} strokeWidth={2} />
                {compareResult && <Line type="monotone" dataKey="Compare" stroke="#f59e0b" dot={false} strokeWidth={2} strokeDasharray="4 2" />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Drawdown */}
        {m.drawdown_curve?.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
            <p className="mb-4 text-sm font-semibold text-zinc-200">Drawdown</p>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={m.drawdown_curve}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: "#52525b", fontSize: 10 }} tickFormatter={(v: string) => v?.slice(0, 7) ?? ""} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "#52525b", fontSize: 10 }} tickFormatter={(v: number) => v.toFixed(0) + "%"} width={40} />
                <Tooltip formatter={(v: unknown) => [typeof v === "number" ? v.toFixed(2) + "%" : String(v), "Drawdown"] as [string, string]}
                  contentStyle={{ background: "var(--app-card-alt)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: "#71717a" }} />
                <Area type="monotone" dataKey="drawdown" stroke="#ef4444" fill="rgba(239,68,68,0.2)" dot={false} strokeWidth={1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Monthly heatmap */}
        {years.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
            <p className="mb-4 text-sm font-semibold text-zinc-200">Monthly Returns Heatmap</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-center text-[10px]">
                <thead>
                  <tr>
                    <th className="py-1 pr-3 text-left text-zinc-500">Year</th>
                    {MONTHS.map((mo) => <th key={mo} className="py-1 text-zinc-500 font-normal">{mo}</th>)}
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
                                  {val == null ? "\u2014" : val.toFixed(1)}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                        <td className={`py-1 px-1 font-semibold ${retColor(yearTotal)}`}>{yearTotal.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Trade log */}
        {m.trades?.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
            <p className="mb-4 text-sm font-semibold text-zinc-200">Trade Log ({m.trades.length} trades)</p>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full min-w-[580px] text-xs">
                <thead className="sticky top-0 bg-[var(--app-card-alt)]">
                  <tr className="border-b border-white/10 text-left">
                    <th className="pb-2 pr-4 font-medium text-zinc-500">Entry</th>
                    <th className="pb-2 pr-4 font-medium text-zinc-500">Exit</th>
                    <th className="pb-2 pr-4 font-medium text-zinc-500">Entry $</th>
                    <th className="pb-2 pr-4 font-medium text-zinc-500">Exit $</th>
                    <th className="pb-2 pr-4 font-medium text-zinc-500">Return</th>
                    <th className="pb-2 pr-4 font-medium text-zinc-500">Hold</th>
                    <th className="pb-2 font-medium text-zinc-500">Dir</th>
                  </tr>
                </thead>
                <tbody>
                  {m.trades.map((t, i) => (
                    <tr key={i} className={`border-b border-white/5 ${t.return_pct >= 0 ? "bg-emerald-500/5" : "bg-red-500/5"}`}>
                      <td className="py-1.5 pr-4 text-zinc-400">{t.entry_date}</td>
                      <td className="py-1.5 pr-4 text-zinc-400">{t.exit_date}</td>
                      <td className="py-1.5 pr-4 text-zinc-300">${t.entry_price?.toFixed(2)}</td>
                      <td className="py-1.5 pr-4 text-zinc-300">${t.exit_price?.toFixed(2)}</td>
                      <td className={`py-1.5 pr-4 font-medium ${t.return_pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtPct(t.return_pct, 2)}</td>
                      <td className="py-1.5 pr-4 text-zinc-500">{t.hold_days}d</td>
                      <td className={`py-1.5 text-[10px] font-medium ${t.direction === "short" ? "text-red-400" : "text-emerald-400"}`}>{t.direction ?? "L"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Walk-forward */}
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
                <Tooltip contentStyle={{ background: "var(--app-card-alt)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} labelStyle={{ color: "#71717a" }} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#71717a" }} />
                <Line type="monotone" dataKey="in_sample_sharpe" name="In-Sample Sharpe" stroke="var(--accent-color)" dot strokeWidth={2} />
                <Line type="monotone" dataKey="oos_sharpe" name="Out-of-Sample Sharpe" stroke="#ef4444" dot strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div><p className="text-[10px] text-zinc-500">Avg In-Sample Sharpe</p><p className="text-sm font-semibold text-zinc-200">{result.walk_forward.avg_in_sample_sharpe}</p></div>
              <div><p className="text-[10px] text-zinc-500">Avg OOS Sharpe</p><p className="text-sm font-semibold text-zinc-200">{result.walk_forward.avg_oos_sharpe}</p></div>
              <div>
                <p className="text-[10px] text-zinc-500">Efficiency Ratio</p>
                <p className={`text-sm font-semibold ${result.walk_forward.avg_efficiency_ratio != null && result.walk_forward.avg_efficiency_ratio > 0.5 ? "text-emerald-400" : "text-amber-400"}`}>
                  {result.walk_forward.avg_efficiency_ratio?.toFixed(2) ?? "\u2014"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Monte Carlo */}
        {result.monte_carlo && mcData.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4">
            <p className="mb-1 text-sm font-semibold text-zinc-200">Monte Carlo Simulation</p>
            <p className="mb-4 text-xs text-zinc-500">{result.monte_carlo.n_runs.toLocaleString()} simulations / {result.monte_carlo.n_trades} trades</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={mcData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="trade" tick={{ fill: "#52525b", fontSize: 10 }} />
                <YAxis tick={{ fill: "#52525b", fontSize: 10 }} tickFormatter={(v: number) => fmtDollars(v)} width={60} />
                <Tooltip contentStyle={{ background: "var(--app-card-alt)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} labelStyle={{ color: "#71717a" }} formatter={(v: unknown) => typeof v === "number" ? fmtDollars(v) : String(v)} />
                <Area type="monotone" dataKey="p95" name="95th %ile" stroke="rgba(255,255,255,0.1)" fill="rgba(255,255,255,0.04)" dot={false} />
                <Area type="monotone" dataKey="p75" name="75th %ile" stroke="rgba(255,255,255,0.15)" fill="rgba(255,255,255,0.05)" dot={false} />
                <Area type="monotone" dataKey="p50" name="Median" stroke="var(--accent-color)" fill="rgba(var(--accent-rgb),0.1)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="p25" name="25th %ile" stroke="rgba(239,68,68,0.4)" fill="rgba(239,68,68,0.05)" dot={false} />
                <Area type="monotone" dataKey="p5" name="5th %ile" stroke="rgba(239,68,68,0.6)" fill="rgba(239,68,68,0.1)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
              {[
                { label: "Prob. Profit",  value: `${result.monte_carlo.probability_metrics.prob_profit}%`,      color: "text-emerald-400" },
                { label: "Prob. -10%",    value: `${result.monte_carlo.probability_metrics.prob_loss_10pct}%`,  color: "text-amber-400" },
                { label: "Prob. -25%",    value: `${result.monte_carlo.probability_metrics.prob_loss_25pct}%`,  color: "text-red-400" },
                { label: "Prob. 2x",      value: `${result.monte_carlo.probability_metrics.prob_double}%`,      color: "text-emerald-400" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/10 p-2">
                  <p className="text-[10px] text-zinc-500">{item.label}</p>
                  <p className={`text-sm font-semibold ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Analysis */}
        {result.ai_analysis && (
          <div className="rounded-2xl border border-[var(--accent-color)]/20 bg-[var(--accent-color)]/5 p-5">
            <div className="mb-3 flex items-center gap-2">
              <svg className="h-5 w-5 text-[var(--accent-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
              <p className="text-sm font-semibold text-zinc-200">AI Strategy Analysis</p>
              <span className="rounded-full border border-[var(--accent-color)]/30 px-2 py-0.5 text-[10px] font-medium text-[var(--accent-color)]">Claude AI</span>
            </div>
            <div className="text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">
              <Typewriter text={result.ai_analysis} />
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="flex flex-wrap gap-3">
          <button onClick={() => { setMode("landing"); setResult(null); setError(null); setChatMessages([]); }}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/10">
            &larr; New Backtest
          </button>
          <button onClick={() => setSaveModalOpen(true)}
            className="rounded-lg border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/10 px-4 py-2 text-sm font-medium text-[var(--accent-color)] transition hover:bg-[var(--accent-color)]/20">
            Save Strategy
          </button>
          <button onClick={exportCSV}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/10">
            Export CSV
          </button>
          <button onClick={exportJSON}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/10">
            Export JSON
          </button>
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl">
      {mode === "landing" && renderLanding()}
      {mode === "chat" && renderChat()}
      {mode === "manual-setup" && renderManualSetup()}
      {mode === "manual-strategy" && renderManualStrategy()}
      {mode === "manual-params" && renderManualParams()}
      {mode === "running" && renderRunning()}
      {mode === "results" && renderResults()}
    </div>
  );
}
