"use client";

export const UPDATES: {
  date: string;
  time: string;
  label: string;
  items: { type: "new" | "improved" | "fixed"; text: string }[];
}[] = [
  {
    date: "April 13, 2025",
    time: "11:45 PM",
    label: "Backtester Overhaul & Profile Dropdown",
    items: [
      { type: "new",      text: "Backtester reworked — 16 strategies including MACD, Bollinger Bands, Stochastic, CCI, Williams %R, ADX, Parabolic SAR, Ichimoku Cloud, Volume/VWAP, and Order Flow (OHLCV proxies)" },
      { type: "new",      text: "Timeframe selector added to backtester: 1m, 5m, 15m, 1h, 4h, daily, weekly" },
      { type: "new",      text: "Trailing and ATR-based stop loss types" },
      { type: "new",      text: "Multiple take-profit targets with configurable exit sizes" },
      { type: "new",      text: "Direction control — long only, short only, or both" },
      { type: "new",      text: "Leverage support up to 20×" },
      { type: "new",      text: "Position sizing — % of portfolio, fixed dollar amount, or Kelly Criterion" },
      { type: "new",      text: "Slippage modeling in basis points" },
      { type: "new",      text: "WMA, DEMA, TEMA added as MA types" },
      { type: "new",      text: "Sortino ratio, Expectancy, VaR (95%), consecutive win/loss streaks added to results" },
      { type: "new",      text: "Save and name strategies, load them from Step 1" },
      { type: "new",      text: "Export trades as CSV" },
      { type: "new",      text: "Ticker presets for portfolio optimizer (Mag 7, Financials, Crypto, etc.)" },
      { type: "new",      text: "Strategy category filter (Trend, Momentum, Volatility, Volume, Derivatives)" },
      { type: "new",      text: "Profile dropdown now shows your badges (plan tier, verified, founder)" },
      { type: "new",      text: "Help Center and What's New added to profile dropdown" },
      { type: "improved", text: "Profile dropdown shows Settings and Plans links" },
      { type: "fixed",    text: "Elite plan accounts now bypass all plan gates via founder status" },
    ],
  },
];

const TYPE_STYLES = {
  new:      "bg-[var(--accent-color)]/10 text-[var(--accent-color)] border-[var(--accent-color)]/30",
  improved: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  fixed:    "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};

const TYPE_LABELS = { new: "New", improved: "Improved", fixed: "Fixed" };

export function WhatsNewTimeline() {
  return (
    <div className="space-y-8">
      {UPDATES.map((update, i) => (
        <div key={i} className="relative pl-6">
          {i < UPDATES.length - 1 && (
            <div className="absolute left-[7px] top-6 h-full w-px bg-white/10" />
          )}
          <div className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--accent-color)] bg-[var(--app-bg)]" />

          <div className="rounded-2xl border border-white/10 bg-[var(--app-card)] p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-zinc-100">{update.label}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {update.date} &middot; {update.time}
                </p>
              </div>
              {i === 0 && (
                <span className="rounded-full bg-[var(--accent-color)] px-2.5 py-0.5 text-[10px] font-bold text-[#020308]">
                  LATEST
                </span>
              )}
            </div>

            <ul className="space-y-2.5">
              {update.items.map((item, j) => (
                <li key={j} className="flex items-start gap-2.5">
                  <span className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${TYPE_STYLES[item.type]}`}>
                    {TYPE_LABELS[item.type]}
                  </span>
                  <span className="text-sm leading-relaxed text-zinc-300">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
