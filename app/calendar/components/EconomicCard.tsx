"use client";

import type { EconomicItem } from "@/lib/calendar/types";

const CARD_BG = "var(--app-card)";

export type EconomicWithDay = EconomicItem & { dayIndex: number; description: string };

/** Approx SPY move on event day (for the "SPY avg ±X% on this event day" hint). */
const EVENT_AVG_MOVE: Record<string, number> = {
  "cpi": 1.2, "consumer price": 1.2, "core cpi": 1.2,
  "nfp": 0.8, "jobs": 0.8, "payroll": 0.8, "nonfarm": 0.8,
  "fomc": 1.5, "fed ": 1.5, "federal reserve": 1.5,
  "gdp": 0.6,
};
function getAvgMove(name: string): number {
  const n = name.toLowerCase();
  for (const [key, pct] of Object.entries(EVENT_AVG_MOVE)) {
    if (n.includes(key)) return pct;
  }
  return 0.5;
}

/** Short explanation of what an indicator measures (rendered under the card). */
function getEconomicEventBreakdown(name: string, country: string): string {
  const n = name.toLowerCase();
  const c = country ? `${country} ` : "";
  if (n.includes("cpi") || n.includes("consumer price")) return `${c}Consumer Price Index: measures inflation. Key for interest-rate expectations and equity valuations.`;
  if (n.includes("ppi") || n.includes("producer price")) return `${c}Producer Price Index: inflation at the wholesale level. Often a leading indicator for CPI.`;
  if (n.includes("fomc") || n.includes("fed ") || n.includes("federal reserve")) return `${c}Federal Reserve policy: rate decisions and guidance. Directly moves rates and risk sentiment.`;
  if (n.includes("retail sales")) return `${c}Retail sales: consumer spending strength. Drives GDP and earnings expectations.`;
  if (n.includes("jobless") || n.includes("claims") || n.includes("employment")) return `${c}Labor market data: jobless claims or employment. Affects Fed policy and recession risk views.`;
  if (n.includes("gdp")) return `${c}Gross Domestic Product: broad economic growth. Revisions and surprises move markets.`;
  if (n.includes("pmi") || n.includes("manufacturing") || n.includes("services")) return `${c}Survey-based activity indicator. Above 50 = expansion; below = contraction.`;
  if (n.includes("housing") || n.includes("home sales")) return `${c}Housing data: sector health and consumer confidence.`;
  if (n.includes("consumer sentiment") || n.includes("confidence")) return `${c}Consumer confidence/sentiment: forward-looking spending and growth indicator.`;
  if (n.includes("trade") || n.includes("balance")) return `${c}Trade balance: exports vs imports. Affects currency and growth views.`;
  return `${c}Macro release. Compare actual to estimate and previous to gauge surprise.`;
}

function consensusLabel(ev: EconomicWithDay): "BEAT" | "MISS" | "IN LINE" | null {
  if (ev.actual == null || ev.estimate == null) return null;
  const a = parseFloat(String(ev.actual).replace(/%/g, ""));
  const e = parseFloat(String(ev.estimate).replace(/%/g, ""));
  if (Number.isNaN(a) || Number.isNaN(e)) return null;
  const pct = e !== 0 ? Math.abs((a - e) / e) * 100 : 0;
  if (pct <= 0.1) return "IN LINE";
  return a > e ? "BEAT" : "MISS";
}

export function EconomicCard({
  ev,
  countdown,
  onClick,
}: {
  ev: EconomicWithDay;
  countdown: string;
  onClick: (ev: EconomicWithDay) => void;
}) {
  const consensus = consensusLabel(ev);
  const avgMove = getAvgMove(ev.name);

  return (
    <div
      className={`flex rounded-xl overflow-hidden transition-all duration-200 ${
        ev.impact === "HIGH" ? "border-l-4 border-l-red-500" : ev.impact === "MEDIUM" ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-zinc-500"
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onClick(ev)}
        onKeyDown={(e) => e.key === "Enter" && onClick(ev)}
        className="flex-1 cursor-pointer rounded-r-xl border border-t border-r border-b border-white/10 p-4 transition-colors hover:border-white/20"
        style={{ backgroundColor: CARD_BG }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-semibold text-zinc-100">{ev.name}</h4>
          <span className="text-xs text-zinc-500">{ev.dateTimeET}</span>
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-medium ${
              ev.impact === "HIGH" ? "bg-red-500/20 text-red-400" : ev.impact === "MEDIUM" ? "bg-amber-500/20 text-amber-400" : "bg-zinc-500/20 text-zinc-400"
            }`}
          >
            {ev.impact}
          </span>
          {ev.actual != null && (
            <span className="rounded px-2 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-400">
              Released
            </span>
          )}
          {consensus && (
            <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${
              consensus === "BEAT" ? "bg-emerald-500/20 text-emerald-400" : consensus === "MISS" ? "bg-red-500/20 text-red-400" : "bg-zinc-500/20 text-zinc-400"
            }`}>
              {consensus}
            </span>
          )}
        </div>
        {(ev.previous != null || ev.estimate != null || ev.actual != null) && (
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            {ev.previous != null && (
              <span>
                <span className="text-zinc-500">Prev </span>
                <span className="text-zinc-300">{ev.previous}</span>
              </span>
            )}
            {ev.estimate != null && (
              <span>
                <span className="text-zinc-500">Est </span>
                <span className="text-zinc-300">{ev.estimate}</span>
              </span>
            )}
            {ev.actual != null && (
              <span>
                <span className="text-zinc-500">Actual </span>
                <span className="text-[var(--accent-color)]">{ev.actual}</span>
              </span>
            )}
          </div>
        )}
        {ev.date && (
          <p className="mt-1 text-[10px] text-zinc-500">⏱ {countdown}</p>
        )}
        {avgMove > 0 && (
          <p className="mt-0.5 text-[10px] text-zinc-500">SPY avg ±{avgMove}% on this event day</p>
        )}
        <p className="mt-2 text-xs text-zinc-500">{ev.description}</p>
        <p className="mt-1.5 text-xs text-zinc-500 italic">{getEconomicEventBreakdown(ev.name, ev.country)}</p>
        <button type="button" onClick={(e) => { e.stopPropagation(); onClick(ev); }} className="mt-2 text-xs font-medium text-[var(--accent-color)] hover:underline">
          View 10-year history →
        </button>
      </div>
    </div>
  );
}

export { getEconomicEventBreakdown };
