"use client";

import { useEffect, useMemo, useState } from "react";
import { computePnL, formatCurrency, type JournalTrade } from "@/lib/journal";

/**
 * Year-at-a-glance trading performance heatmap.
 *
 *   - 12 mini month calendars in a responsive grid
 *   - Each day cell shaded green (positive P&L) or red (negative) with intensity
 *     proportional to |day P&L| / max day P&L for the year
 *   - Month header shows the month's total realized P&L and gets a subtle tint
 *     in the same direction
 *   - Year nav is bounded by the years actually present in the trade data so
 *     users can't page into empty years
 *
 * Realized P&L is bucketed by exit date (or entry date if the trade is still
 * open with manual P&L entered) — that's when the result actually hits the
 * journal, which is what users want to see "did I make or lose money on
 * Tuesday?".
 */

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

type DayCell = { date: string; day: number; isCurrentMonth: boolean; pnl: number; tradeCount: number };

function buildMonthGrid(
  year: number,
  month: number,
  pnlByDate: Map<string, { pnl: number; count: number }>
): DayCell[] {
  const cells: DayCell[] = [];
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Leading days from previous month so the first row aligns to weekday columns
  for (let i = startPad - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    const key = d.toISOString().slice(0, 10);
    const data = pnlByDate.get(key);
    cells.push({
      date: key,
      day: d.getDate(),
      isCurrentMonth: false,
      pnl: data?.pnl ?? 0,
      tradeCount: data?.count ?? 0,
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const data = pnlByDate.get(dateStr);
    cells.push({
      date: dateStr,
      day: d,
      isCurrentMonth: true,
      pnl: data?.pnl ?? 0,
      tradeCount: data?.count ?? 0,
    });
  }
  // Pad to 6 rows so every month has identical height (no jitter)
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = cells[cells.length - 1];
    const next = new Date(`${last.date}T00:00:00`);
    next.setDate(next.getDate() + 1);
    const key = next.toISOString().slice(0, 10);
    const data = pnlByDate.get(key);
    cells.push({
      date: key,
      day: next.getDate(),
      isCurrentMonth: false,
      pnl: data?.pnl ?? 0,
      tradeCount: data?.count ?? 0,
    });
  }
  return cells.slice(0, 42);
}

function dayBackground(pnl: number, maxAbs: number, isCurrentMonth: boolean, isLight: boolean): string {
  // Empty / non-current cells use black-tint on light backgrounds and
  // white-tint on dark — otherwise the grid disappears in light mode.
  const tintBase = isLight ? "0,0,0" : "255,255,255";
  if (!isCurrentMonth) return `rgba(${tintBase},0.04)`;
  if (pnl === 0 || maxAbs === 0) return `rgba(${tintBase},0.07)`;
  // Saturated greens/reds work in both themes; just nudge alpha higher in
  // light mode so the contrast stays high against the white surface.
  const intensity = Math.min(1, Math.abs(pnl) / maxAbs);
  const baseAlpha = isLight ? 0.28 : 0.18;
  const alpha = baseAlpha + intensity * 0.67;
  return pnl > 0 ? `rgba(16, 185, 129, ${alpha})` : `rgba(239, 68, 68, ${alpha})`;
}

/** Tracks the live value of `<html data-theme>` so the calendar repaints when
 *  the user toggles theme without needing a reload. */
function useIsLightTheme(): boolean {
  const [isLight, setIsLight] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const update = () => setIsLight(document.documentElement.dataset.theme === "light");
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return isLight;
}

export function TradePerformanceCalendar({ trades }: { trades: JournalTrade[] }) {
  // Bucket realized P&L by date (exit date if available, else entry date for
  // trades with manually-entered P&L like options).
  const pnlByDate = useMemo(() => {
    const m = new Map<string, { pnl: number; count: number }>();
    for (const t of trades) {
      const p = computePnL(t);
      if (!p) continue;
      const date = (t.exitDate ?? t.entryDate).slice(0, 10);
      const cur = m.get(date) ?? { pnl: 0, count: 0 };
      cur.pnl += p.pnlDollars;
      cur.count += 1;
      m.set(date, cur);
    }
    return m;
  }, [trades]);

  // Bounds for the year nav. We always include the current year so that a
  // brand-new year (e.g. Jan 1) starts showing immediately even before any
  // 2027 trade is logged — the user can still see "Jan" with no data and
  // navigate ← back to last year's full Jan-Dec calendar.
  const currentYear = new Date().getFullYear();
  const tradeYears = useMemo(() => {
    const ys = new Set<number>([currentYear]);
    for (const t of trades) {
      const date = (t.exitDate ?? t.entryDate).slice(0, 4);
      const y = parseInt(date, 10);
      if (Number.isFinite(y)) ys.add(y);
    }
    return Array.from(ys).sort((a, b) => a - b);
  }, [trades, currentYear]);

  const minYear = tradeYears[0];
  const maxYear = Math.max(tradeYears[tradeYears.length - 1], currentYear);
  // Default to the current year — when a new year rolls over the next page
  // load lands on the new year showing just its first month.
  const [year, setYear] = useState<number>(currentYear);
  const isLight = useIsLightTheme();

  const monthlyTotals = useMemo(() => {
    const totals = Array(12).fill(0);
    for (const [date, data] of pnlByDate) {
      if (!date.startsWith(`${year}-`)) continue;
      const mi = parseInt(date.slice(5, 7), 10) - 1;
      if (mi >= 0 && mi < 12) totals[mi] += data.pnl;
    }
    return totals;
  }, [pnlByDate, year]);

  const maxAbsDayPnl = useMemo(() => {
    let max = 0;
    for (const [date, data] of pnlByDate) {
      if (!date.startsWith(`${year}-`)) continue;
      const abs = Math.abs(data.pnl);
      if (abs > max) max = abs;
    }
    return max;
  }, [pnlByDate, year]);

  const yearTotal = monthlyTotals.reduce((a, b) => a + b, 0);

  // Only render months that have started. For the current year, cap at the
  // current month — future months get added one at a time as they begin.
  // For past years, show all 12.
  const today = new Date();
  const lastVisibleMonth =
    year < today.getFullYear() ? 11 : year === today.getFullYear() ? today.getMonth() : -1;
  const visibleMonths = MONTH_NAMES.slice(0, lastVisibleMonth + 1);

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Daily performance</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            Each cell shows that day&apos;s realized P&amp;L; month header shows the month total.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-semibold ${yearTotal >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {yearTotal >= 0 ? "+" : ""}
            {formatCurrency(yearTotal)} <span className="text-xs font-normal text-zinc-500">{year}</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setYear((y) => Math.max(minYear, y - 1))}
              disabled={year <= minYear}
              className="rounded-lg border border-white/10 px-2 py-1 text-xs text-zinc-400 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Previous year"
            >
              ←
            </button>
            <span className="w-12 text-center text-xs font-medium text-zinc-300">{year}</span>
            <button
              type="button"
              onClick={() => setYear((y) => Math.min(maxYear, y + 1))}
              disabled={year >= maxYear}
              className="rounded-lg border border-white/10 px-2 py-1 text-xs text-zinc-400 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Next year"
            >
              →
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {visibleMonths.map((name, mi) => {
          const monthTotal = monthlyTotals[mi];
          const cells = buildMonthGrid(year, mi, pnlByDate);
          const monthBg =
            monthTotal === 0
              ? "transparent"
              : monthTotal > 0
              ? `rgba(16, 185, 129, ${isLight ? 0.1 : 0.06})`
              : `rgba(239, 68, 68, ${isLight ? 0.1 : 0.06})`;
          const monthBorder =
            monthTotal === 0
              ? `rgba(${isLight ? "0,0,0" : "255,255,255"},0.1)`
              : monthTotal > 0
              ? "rgba(16, 185, 129, 0.35)"
              : "rgba(239, 68, 68, 0.35)";
          return (
            <div
              key={name}
              className="rounded-lg border p-2"
              style={{ backgroundColor: monthBg, borderColor: monthBorder }}
            >
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <span className="text-xs font-semibold text-zinc-200">{name}</span>
                <span
                  className={`text-[10px] font-semibold ${
                    monthTotal > 0
                      ? "text-emerald-400"
                      : monthTotal < 0
                      ? "text-red-400"
                      : "text-zinc-500"
                  }`}
                >
                  {monthTotal === 0
                    ? "—"
                    : `${monthTotal >= 0 ? "+" : ""}${formatCurrency(monthTotal)}`}
                </span>
              </div>
              <div className="grid grid-cols-7 gap-px text-[8px]">
                {WEEKDAYS.map((w, i) => (
                  <span key={i} className="text-center text-zinc-600">
                    {w}
                  </span>
                ))}
                {cells.map((cell) => {
                  const bg = dayBackground(cell.pnl, maxAbsDayPnl, cell.isCurrentMonth, isLight);
                  const tip =
                    cell.tradeCount > 0
                      ? `${cell.date}: ${cell.pnl >= 0 ? "+" : ""}${formatCurrency(cell.pnl)} (${cell.tradeCount} trade${cell.tradeCount === 1 ? "" : "s"})`
                      : cell.isCurrentMonth
                      ? `${cell.date}: no trades`
                      : "";
                  return (
                    <div
                      key={cell.date}
                      title={tip}
                      className={`aspect-square rounded-sm ${cell.isCurrentMonth ? "" : "opacity-40"}`}
                      style={{ backgroundColor: bg }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: "rgba(16, 185, 129, 0.7)" }} />
          Winning day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: "rgba(239, 68, 68, 0.7)" }} />
          Losing day
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-sm"
            style={{ backgroundColor: isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.07)" }}
          />
          No trades
        </span>
        <span className="ml-auto">Color intensity scales with the size of that day&apos;s P&amp;L</span>
      </div>
    </div>
  );
}
