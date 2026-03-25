import type { OHLCV } from "./fetcher";
import { sma, ema, rsi as calcRSI, bollingerBands, macd as calcMACD } from "./indicators";

export type EntryCondition =
  | { type: "rsi_below"; period: number; threshold: number }
  | { type: "rsi_above"; period: number; threshold: number }
  | { type: "price_above_sma"; period: number }
  | { type: "price_below_sma"; period: number }
  | { type: "price_above_ema"; period: number }
  | { type: "price_below_ema"; period: number }
  | { type: "price_crosses_above_sma"; period: number }
  | { type: "price_crosses_below_sma"; period: number }
  | { type: "bb_below_lower"; period?: number }
  | { type: "bb_above_upper"; period?: number }
  | { type: "macd_bullish_crossover" }
  | { type: "macd_bearish_crossover" };

export type ExitCondition =
  | { type: "profit_target"; value: number }
  | { type: "stop_loss"; value: number }
  | { type: "time_limit"; days: number }
  | { type: "rsi_above"; period: number; threshold: number }
  | { type: "rsi_below"; period: number; threshold: number }
  | { type: "price_below_sma"; period: number }
  | { type: "price_above_sma"; period: number };

export type PositionSizing =
  | { type: "fixed_amount"; value: number }
  | { type: "percent_portfolio"; value: number };

export type ParsedStrategy = {
  ticker: string;
  startDate: string;
  endDate: string;
  direction: "long";
  startingCapital: number;
  description: string;
  entryConditions: EntryCondition[];
  exitConditions: ExitCondition[];
  positionSizing: PositionSizing;
};

export type Trade = {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  pnl: number;
  pnlPercent: number;
  daysHeld: number;
  exitReason: string;
};

export type BacktestResult = {
  trades: Trade[];
  equityCurve: { date: string; value: number; drawdown: number }[];
  benchmarkCurve: { date: string; value: number }[];
  grade: string;
  metrics: {
    totalReturn: number;
    buyHoldReturn: number;
    alpha: number;
    annualizedReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    totalTrades: number;
    avgHoldTime: number;
    bestTrade: number;
    worstTrade: number;
    yearlyReturns: Record<string, number>;
  };
};

export function runBacktest(data: OHLCV[], strategy: ParsedStrategy): BacktestResult {
  const { startingCapital, entryConditions, exitConditions, positionSizing } = strategy;
  const closes = data.map((d) => d.close);
  const n = data.length;
  const SLIPPAGE = 0.001;
  const COMMISSION = 0.001;

  // Pre-compute indicators
  const indRSI: Record<number, (number | null)[]> = {};
  const indSMA: Record<number, (number | null)[]> = {};
  const indEMA: Record<number, (number | null)[]> = {};
  const indBB: Record<number, ReturnType<typeof bollingerBands>> = {};
  const indMACD = calcMACD(closes);

  const allConds = [...entryConditions, ...exitConditions];
  for (const c of allConds) {
    if ("period" in c && c.period) {
      if (c.type.includes("rsi") && !indRSI[c.period]) indRSI[c.period] = calcRSI(closes, c.period);
      if (c.type.includes("_sma") && !indSMA[c.period]) indSMA[c.period] = sma(closes, c.period);
      if (c.type.includes("_ema") && !indEMA[c.period]) indEMA[c.period] = ema(closes, c.period);
    }
    if ((c.type === "bb_below_lower" || c.type === "bb_above_upper")) {
      const p = ("period" in c && c.period) ? c.period : 20;
      if (!indBB[p]) indBB[p] = bollingerBands(closes, p);
    }
  }

  function checkEntry(cond: EntryCondition, i: number): boolean {
    const price = closes[i];
    const prev = i > 0 ? closes[i - 1] : price;
    switch (cond.type) {
      case "rsi_below": { const v = indRSI[cond.period]?.[i]; return v != null && v < cond.threshold; }
      case "rsi_above": { const v = indRSI[cond.period]?.[i]; return v != null && v > cond.threshold; }
      case "price_above_sma": { const v = indSMA[cond.period]?.[i]; return v != null && price > v; }
      case "price_below_sma": { const v = indSMA[cond.period]?.[i]; return v != null && price < v; }
      case "price_above_ema": { const v = indEMA[cond.period]?.[i]; return v != null && price > v; }
      case "price_below_ema": { const v = indEMA[cond.period]?.[i]; return v != null && price < v; }
      case "price_crosses_above_sma": {
        if (i === 0) return false;
        const cur = indSMA[cond.period]?.[i]; const pre = indSMA[cond.period]?.[i - 1];
        return cur != null && pre != null && price > cur && prev <= pre;
      }
      case "price_crosses_below_sma": {
        if (i === 0) return false;
        const cur = indSMA[cond.period]?.[i]; const pre = indSMA[cond.period]?.[i - 1];
        return cur != null && pre != null && price < cur && prev >= pre;
      }
      case "bb_below_lower": { const p = cond.period ?? 20; const b = indBB[p]?.[i]; return b?.lower != null && price < b.lower; }
      case "bb_above_upper": { const p = cond.period ?? 20; const b = indBB[p]?.[i]; return b?.upper != null && price > b.upper; }
      case "macd_bullish_crossover": {
        if (i === 0) return false;
        const c = indMACD[i]; const p2 = indMACD[i - 1];
        return c.macd != null && c.signal != null && p2.macd != null && p2.signal != null && c.macd > c.signal && p2.macd <= p2.signal;
      }
      case "macd_bearish_crossover": {
        if (i === 0) return false;
        const c = indMACD[i]; const p2 = indMACD[i - 1];
        return c.macd != null && c.signal != null && p2.macd != null && p2.signal != null && c.macd < c.signal && p2.macd >= p2.signal;
      }
      default: return false;
    }
  }

  let cash = startingCapital;
  let shares = 0;
  let entryPrice = 0;
  let entryDate = "";
  let entryDay = -1;
  let inPosition = false;
  const trades: Trade[] = [];
  const equityCurve: { date: string; value: number; drawdown: number }[] = [];
  let peak = startingCapital;

  for (let i = 0; i < n; i++) {
    const day = data[i];
    const price = day.close;

    if (inPosition) {
      const ret = (price - entryPrice) / entryPrice;
      const days = i - entryDay;
      let exitReason = "";

      for (const ec of exitConditions) {
        if (ec.type === "profit_target" && ret >= ec.value) { exitReason = `Profit target (+${(ec.value * 100).toFixed(0)}%)`; break; }
        if (ec.type === "stop_loss" && ret <= -ec.value) { exitReason = `Stop loss (-${(ec.value * 100).toFixed(0)}%)`; break; }
        if (ec.type === "time_limit" && days >= ec.days) { exitReason = `Time limit (${ec.days}d)`; break; }
        if (ec.type === "rsi_above" && "period" in ec) { const v = indRSI[ec.period]?.[i]; if (v != null && v > ec.threshold) { exitReason = `RSI>${ec.threshold}`; break; } }
        if (ec.type === "rsi_below" && "period" in ec) { const v = indRSI[ec.period]?.[i]; if (v != null && v < ec.threshold) { exitReason = `RSI<${ec.threshold}`; break; } }
        if (ec.type === "price_below_sma" && "period" in ec) { const v = indSMA[ec.period]?.[i]; if (v != null && price < v) { exitReason = `Below SMA${ec.period}`; break; } }
        if (ec.type === "price_above_sma" && "period" in ec) { const v = indSMA[ec.period]?.[i]; if (v != null && price > v) { exitReason = `Above SMA${ec.period}`; break; } }
      }
      if (!exitReason && i === n - 1) exitReason = "End of period";

      if (exitReason) {
        const ep = price * (1 - SLIPPAGE);
        const proceeds = shares * ep - shares * ep * COMMISSION;
        const pnl = proceeds - shares * entryPrice;
        trades.push({ entryDate, exitDate: day.date, entryPrice, exitPrice: ep, shares, pnl, pnlPercent: pnl / (shares * entryPrice), daysHeld: days, exitReason });
        cash += proceeds;
        shares = 0;
        inPosition = false;
      }
    }

    if (!inPosition && i < n - 1 && entryConditions.length > 0) {
      if (entryConditions.every((c) => checkEntry(c, i))) {
        const bp = price * (1 + SLIPPAGE);
        const portVal = cash;
        const size = positionSizing.type === "fixed_amount"
          ? Math.min(positionSizing.value, cash * 0.99)
          : Math.min(portVal * positionSizing.value, cash * 0.99);
        const s = Math.floor(size / bp);
        if (s > 0) {
          cash -= s * bp * (1 + COMMISSION);
          shares = s; entryPrice = bp; entryDate = day.date; entryDay = i; inPosition = true;
        }
      }
    }

    const portVal = cash + shares * price;
    peak = Math.max(peak, portVal);
    equityCurve.push({ date: day.date, value: Math.round(portVal * 100) / 100, drawdown: (portVal - peak) / peak });
  }

  // Benchmark
  const bShares = Math.floor(startingCapital / data[0].close);
  const bLeftover = startingCapital - bShares * data[0].close;
  const benchmarkCurve = data.map((d) => ({ date: d.date, value: Math.round((bShares * d.close + bLeftover) * 100) / 100 }));

  const finalVal = equityCurve[equityCurve.length - 1].value;
  const totalReturn = (finalVal - startingCapital) / startingCapital;
  const bFinal = benchmarkCurve[benchmarkCurve.length - 1].value;
  const buyHoldReturn = (bFinal - startingCapital) / startingCapital;
  const years = n / 252;
  const annualizedReturn = Math.pow(1 + totalReturn, 1 / Math.max(years, 0.1)) - 1;
  const maxDrawdown = equityCurve.length ? Math.min(...equityCurve.map((e) => e.drawdown)) : 0;

  const dailyRets = equityCurve.slice(1).map((e, i) => (e.value - equityCurve[i].value) / equityCurve[i].value);
  const avgDR = dailyRets.reduce((a, b) => a + b, 0) / (dailyRets.length || 1);
  const stdDR = Math.sqrt(dailyRets.reduce((s, r) => s + (r - avgDR) ** 2, 0) / (dailyRets.length || 1));
  const sharpeRatio = stdDR > 0 ? (avgDR / stdDR) * Math.sqrt(252) : 0;

  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const winRate = trades.length ? wins.length / trades.length : 0;
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnlPercent, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.pnlPercent, 0) / losses.length : 0;
  const totalWins = wins.reduce((s, t) => s + t.pnl, 0);
  const totalLosses = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 99 : 0;
  const avgHoldTime = trades.length ? trades.reduce((s, t) => s + t.daysHeld, 0) / trades.length : 0;
  const bestTrade = trades.length ? Math.max(...trades.map((t) => t.pnlPercent)) : 0;
  const worstTrade = trades.length ? Math.min(...trades.map((t) => t.pnlPercent)) : 0;

  const yearlyReturns: Record<string, number> = {};
  const byYear: Record<string, number[]> = {};
  equityCurve.forEach((e) => {
    const y = e.date.slice(0, 4);
    (byYear[y] = byYear[y] || []).push(e.value);
  });
  Object.entries(byYear).forEach(([y, vals]) => {
    yearlyReturns[y] = (vals[vals.length - 1] - vals[0]) / vals[0];
  });

  let score = 0;
  if (totalReturn > 0.5) score += 25; else if (totalReturn > 0.2) score += 18; else if (totalReturn > 0.05) score += 12; else if (totalReturn > 0) score += 6;
  if (sharpeRatio > 2) score += 30; else if (sharpeRatio > 1.5) score += 24; else if (sharpeRatio > 1) score += 18; else if (sharpeRatio > 0.5) score += 10;
  if (winRate > 0.7) score += 25; else if (winRate > 0.6) score += 20; else if (winRate > 0.5) score += 14; else if (winRate > 0.4) score += 8;
  if (maxDrawdown > -0.1) score += 20; else if (maxDrawdown > -0.15) score += 15; else if (maxDrawdown > -0.2) score += 10; else if (maxDrawdown > -0.3) score += 5;
  const grade = score >= 85 ? "A+" : score >= 75 ? "A" : score >= 65 ? "B+" : score >= 55 ? "B" : score >= 45 ? "B-" : score >= 35 ? "C+" : score >= 25 ? "C" : "D";

  return {
    trades,
    equityCurve,
    benchmarkCurve,
    grade,
    metrics: {
      totalReturn, buyHoldReturn, alpha: totalReturn - buyHoldReturn,
      annualizedReturn, maxDrawdown, sharpeRatio, winRate, avgWin, avgLoss,
      profitFactor, totalTrades: trades.length, avgHoldTime, bestTrade, worstTrade, yearlyReturns,
    },
  };
}
