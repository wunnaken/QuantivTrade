"use client";

import { useEffect, useState } from "react";

/** One bar = one month. Encodes:
 *    - height: |SPY monthly return %|  (or MTD for the in-progress month)
 *    - color : green if positive return, red if negative
 *    - tooltip: SPY return, avg volume, daily range %, # high/medium events,
 *               composite Activity Score
 *  The current month is outlined and labeled "MTD" so it reads as in-progress.
 *
 *  Two parallel data sources, both loaded independently so the chart paints
 *  with whatever arrives first:
 *    - /api/calendar/year-market-summary  → SPY OHLCV per month
 *    - /api/calendar/year-event-counts    → high/medium event counts per month
 *
 *  Auto-refresh every 5 min so MTD numbers update as the day progresses.
 */

type MonthSummary = {
  month: number;
  monthName: string;
  return: number | null;
  avgVolume: number | null;
  rangePct: number | null;
  tradingDays: number;
  isCurrent: boolean;
  isComplete: boolean;
};

type EventCounts = { high: number; medium: number };

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const REFRESH_MS = 5 * 60 * 1000; // poll every 5 minutes so MTD stays current

function fmtVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  return `${(v / 1e3).toFixed(0)}K`;
}

function emptyMonths(year: number): MonthSummary[] {
  const today = new Date();
  return MONTH_NAMES.map((name, i) => ({
    month: i + 1,
    monthName: name,
    return: null,
    avgVolume: null,
    rangePct: null,
    tradingDays: 0,
    isCurrent: year === today.getFullYear() && today.getMonth() === i,
    isComplete: year < today.getFullYear() || (year === today.getFullYear() && today.getMonth() > i),
  }));
}

function emptyCounts(): EventCounts[] {
  return Array.from({ length: 12 }, () => ({ high: 0, medium: 0 }));
}

/** Composite "how active was this month" score blending the visible factors.
 *  Roughly 0–10. Quiet month ~1, average ~3-5, busy/volatile/news-heavy ~8+. */
function activityScore(m: MonthSummary, c: EventCounts): number {
  const ret = Math.abs(m.return ?? 0);
  const range = m.rangePct ?? 0;
  const news = c.high * 1 + c.medium * 0.4;
  return ret * 1.0 + range * 1.2 + news * 0.35;
}

export function MonthlyActivityChart({ year }: { year: number }) {
  const [months, setMonths] = useState<MonthSummary[]>(() => emptyMonths(year));
  const [counts, setCounts] = useState<EventCounts[]>(() => emptyCounts());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();

    const loadAll = () => {
      fetch(`/api/calendar/year-market-summary?year=${year}`, {
        signal: ctrl.signal,
        cache: "no-store",
      })
        .then((r) => r.json())
        .then((d: { months?: MonthSummary[] }) => {
          if (ctrl.signal.aborted) return;
          setMonths(d.months ?? emptyMonths(year));
          setLoading(false);
        })
        .catch(() => {
          if (ctrl.signal.aborted) return;
          setLoading(false);
        });

      fetch(`/api/calendar/year-event-counts?year=${year}`, {
        signal: ctrl.signal,
        cache: "no-store",
      })
        .then((r) => r.json())
        .then((d: { monthly?: EventCounts[] }) => {
          if (ctrl.signal.aborted) return;
          if (Array.isArray(d.monthly) && d.monthly.length === 12) setCounts(d.monthly);
        })
        .catch(() => {
          /* event counts are supplementary — swallow errors, chart still works */
        });
    };

    loadAll();
    const iv = setInterval(loadAll, REFRESH_MS);
    return () => {
      clearInterval(iv);
      ctrl.abort();
    };
  }, [year]);

  const maxAbsReturn = Math.max(
    ...months.map((m) => Math.abs(m.return ?? 0)),
    1
  );

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">Monthly Market Activity</h3>
        <span className="text-[10px] text-zinc-500">SPY · {year} · auto-refresh 5m</span>
      </div>
      <p className="mb-8 text-xs text-zinc-500">
        Per-month SPY return drives each bar; tooltip combines volume, daily range, economic events, and a composite activity score.
      </p>
      {loading && months.every((m) => m.return == null) ? (
        <div className="skeleton h-44 rounded" />
      ) : (
        <>
          <div className="flex items-stretch gap-1.5 h-44 pt-6">
            {months.map((m, idx) => {
              const c = counts[idx] ?? { high: 0, medium: 0 };
              const ret = m.return ?? 0;
              const heightPct = (Math.abs(ret) / maxAbsReturn) * 90;
              const positive = ret >= 0;
              const hasData = m.return != null;
              const baseColor = !hasData
                ? "rgba(255,255,255,0.04)"
                : positive
                ? "#10b981"
                : "#ef4444";
              const score = activityScore(m, c);
              const totalEvents = c.high + c.medium;
              return (
                <div key={m.month} className="group relative flex flex-1 flex-col items-center">
                  {/* Top half: positive bar grows up from midline */}
                  <div className="relative flex w-full flex-1 items-end justify-center">
                    {hasData && positive && (
                      <>
                        <span className="absolute -top-5 text-[10px] font-semibold text-emerald-400">
                          +{ret.toFixed(1)}%
                        </span>
                        <div
                          className={`w-full rounded-t ${m.isCurrent ? "ring-1 ring-white/40" : ""}`}
                          style={{ height: `${heightPct}%`, backgroundColor: baseColor }}
                        />
                      </>
                    )}
                  </div>
                  <div className="h-px w-full bg-white/15" />
                  {/* Bottom half: negative bar grows down from midline */}
                  <div className="relative flex w-full flex-1 items-start justify-center">
                    {hasData && !positive && (
                      <>
                        <div
                          className={`w-full rounded-b ${m.isCurrent ? "ring-1 ring-white/40" : ""}`}
                          style={{ height: `${heightPct}%`, backgroundColor: baseColor }}
                        />
                        <span className="absolute bottom-[-1.25rem] text-[10px] font-semibold text-red-400">
                          {ret.toFixed(1)}%
                        </span>
                      </>
                    )}
                  </div>
                  <span className="mt-5 text-[10px] text-zinc-500">{m.monthName}</span>
                  {totalEvents > 0 && (
                    <span className="mt-0.5 text-[9px] text-zinc-500">
                      <span className="text-red-400">●</span>{c.high}
                    </span>
                  )}
                  {m.isCurrent && (
                    <span className="text-[8px] uppercase tracking-wide text-zinc-400">MTD</span>
                  )}
                  {/* Tooltip */}
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden min-w-[200px] -translate-x-1/2 rounded-lg border border-white/10 bg-[#0a0f1a] p-2.5 text-xs shadow-xl group-hover:block">
                    <p className="mb-1.5 font-semibold text-zinc-200">
                      {m.monthName} {year} {m.isCurrent && <span className="text-zinc-500">(MTD)</span>}
                    </p>
                    {m.return != null ? (
                      <p className={positive ? "text-emerald-400" : "text-red-400"}>
                        SPY: {positive ? "+" : ""}{m.return.toFixed(2)}%
                      </p>
                    ) : (
                      <p className="text-zinc-500 italic">No SPY data</p>
                    )}
                    {m.avgVolume != null && (
                      <p className="text-zinc-400">
                        Avg vol: <span className="text-zinc-200">{fmtVolume(m.avgVolume)}</span>
                      </p>
                    )}
                    {m.rangePct != null && (
                      <p className="text-zinc-400">
                        Daily range: <span className="text-zinc-200">{m.rangePct.toFixed(2)}%</span>
                      </p>
                    )}
                    <p className="text-zinc-400">
                      Trading days: <span className="text-zinc-200">{m.tradingDays}</span>
                    </p>
                    <div className="mt-1.5 border-t border-white/10 pt-1.5">
                      <p className="text-zinc-400">
                        Hi-impact events: <span className="text-zinc-200">{c.high}</span>
                      </p>
                      <p className="text-zinc-400">
                        Med-impact events: <span className="text-zinc-200">{c.medium}</span>
                      </p>
                    </div>
                    {hasData && (
                      <p className="mt-1.5 border-t border-white/10 pt-1.5 text-zinc-400">
                        Activity score: <span className="font-semibold text-[var(--accent-color)]">{score.toFixed(1)}</span>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Positive month
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-red-500" /> Negative month
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-white/10 ring-1 ring-white/40" /> Current month (MTD)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-red-400">●</span> Hi-impact event count
            </span>
          </div>
        </>
      )}
    </div>
  );
}
