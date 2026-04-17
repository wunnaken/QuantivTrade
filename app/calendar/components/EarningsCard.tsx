"use client";

import type { EarningsItem } from "@/lib/calendar/types";

const CARD_BG = "var(--app-card)";

export type EarningsWithDay = EarningsItem & { dayIndex: number };

/** Border color encodes beat/miss vs estimates. Null actuals → neutral. */
function getEarningsBorderClass(item: EarningsWithDay): string {
  const hasEps = item.epsActual != null && item.epsEstimate != null;
  const hasRev = item.revenueActual != null && item.revenueEstimate != null;
  if (!hasEps && !hasRev) return "border-white/10";
  const epsBeat = hasEps ? item.epsActual! >= item.epsEstimate! : true;
  const revBeat = hasRev ? item.revenueActual! >= item.revenueEstimate! : true;
  if (epsBeat && revBeat) return "border-emerald-400/60";
  return "border-red-400/60";
}

/** Surprise % computed against |estimate| so negative-EPS quarters render
 *  as "+12.5%" / "-8.0%" rather than relying on raw `actual >= estimate`. */
function surprisePct(item: EarningsWithDay): number | null {
  if (item.epsActual == null || item.epsEstimate == null) return null;
  if (item.epsEstimate === 0) return null;
  return ((item.epsActual - item.epsEstimate) / Math.abs(item.epsEstimate)) * 100;
}

export function EarningsCard({
  item,
  onClick,
}: {
  item: EarningsWithDay;
  onClick: (item: EarningsWithDay) => void;
}) {
  const surprise = surprisePct(item);
  const beatByPct = surprise != null ? surprise >= 0 : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(item)}
      onKeyDown={(e) => e.key === "Enter" && onClick(item)}
      className={`cursor-pointer rounded-xl border p-3 transition-all duration-200 ${getEarningsBorderClass(item)}`}
      style={{ backgroundColor: CARD_BG }}
    >
      <div className="flex items-start gap-2">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: `hsl(${(item.ticker.charCodeAt(0) * 17) % 360}, 50%, 40%)` }}
        >
          {item.ticker.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate font-semibold text-zinc-100" title={item.name}>{item.name}</p>
          <p className="truncate text-xs text-zinc-500">{item.ticker}</p>
        </div>
      </div>
      <dl className="mt-2 space-y-0.5 text-xs">
        <div className="flex justify-between">
          <span className="text-zinc-500">EPS</span>
          <span className="text-zinc-200">
            {item.epsActual != null ? `${item.epsActual.toFixed(2)}` : item.epsEstimate != null ? item.epsEstimate.toFixed(2) : "—"}
            {surprise != null && (
              <span className={beatByPct ? "text-emerald-400" : "text-red-400"}>
                {" "}({surprise >= 0 ? "+" : ""}{surprise.toFixed(1)}%)
              </span>
            )}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Rev.</span>
          <span className="text-zinc-200">
            {item.revenueActual != null ? `${(item.revenueActual / 1e9).toFixed(2)}B` : item.revenueEstimate != null ? `${(item.revenueEstimate / 1e9).toFixed(2)}B` : "—"}
            {item.revenueActual != null && item.revenueEstimate != null && (
              <span className={item.revenueActual >= item.revenueEstimate ? "text-emerald-400" : "text-red-400"}> ({item.revenueActual >= item.revenueEstimate ? "beat" : "miss"})</span>
            )}
          </span>
        </div>
      </dl>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {item.bmoAmc && (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
              item.bmoAmc === "BMO" ? "bg-blue-500/20 text-blue-300" : "bg-purple-500/20 text-purple-300"
            }`}
          >
            {item.bmoAmc}
          </span>
        )}
        {beatByPct != null && (
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${beatByPct ? "bg-[var(--accent-color)]/20 text-[var(--accent-color)]" : "bg-red-500/20 text-red-400"}`}>
            {beatByPct ? "BEAT" : "MISS"}
          </span>
        )}
      </div>
      <p className="mt-2 text-[10px] font-medium text-[var(--accent-color)] opacity-70">
        View earnings history →
      </p>
    </div>
  );
}
