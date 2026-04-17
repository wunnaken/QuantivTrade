"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import type { EarningsItem as ApiEarnings, EconomicItem as ApiEconomic } from "../api/calendar/route";
import { EconomicDetailModal } from "./EconomicDetailModal";
import { EarningsDetailModal } from "./EarningsDetailModal";
import { MonthlyActivityChart } from "./components/MonthlyActivityChart";
import { EarningsCard, type EarningsWithDay } from "./components/EarningsCard";
import { EconomicCard, getEconomicEventBreakdown, type EconomicWithDay } from "./components/EconomicCard";
import { CalendarSkeleton } from "./components/CalendarSkeleton";

const CARD_BG = "var(--app-card)";

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDates(monday: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatWeekRange(dates: Date[]): string {
  const m = dates[0];
  const f = dates[4];
  return `${m.toLocaleDateString("en-US", { month: "short" })} ${m.getDate()} – ${f.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function formatDayShort(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function parseDateToDayIndex(dateStr: string, monday: Date): number {
  if (!dateStr || !monday) return -1;
  const trimmed = dateStr.trim();
  // Parse YYYY-MM-DD as local midnight (not UTC) so dates don't shift backward
  // for users in negative timezones. e.g. "2026-04-09" → local Apr 9, not Apr 8.
  const isoDay = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const d = isoDay ? new Date(`${trimmed}T00:00:00`) : new Date(trimmed);
  if (Number.isNaN(d.getTime())) return -1;
  const m = new Date(monday);
  m.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - m.getTime()) / (24 * 60 * 60 * 1000));
  if (diff < 0 || diff > 4) return -1;
  return diff;
}

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function describeEconomic(e: ApiEconomic): string {
  return `${e.country ? e.country + " — " : ""}${e.previous != null ? `Prev ${e.previous}. ` : ""}${e.estimate != null ? `Est ${e.estimate}.` : ""}`;
}

export default function CalendarView() {
  const [activeTab, setActiveTab] = useState<"earnings" | "economic" | "year">("earnings");
  const [selectedEconomicEvent, setSelectedEconomicEvent] = useState<EconomicWithDay | null>(null);
  const [selectedEarning, setSelectedEarning] = useState<EarningsWithDay | null>(null);
  // Year view is locked to the current year — no nav, no separate FRED fetch.
  // The bar chart fetches its own SPY-driven data, which is fast and self-contained.
  const yearViewYear = useMemo(() => new Date().getFullYear(), []);
  const [weekOffset, setWeekOffset] = useState(0);
  const [earnings, setEarnings] = useState<EarningsWithDay[]>([]);
  const [economic, setEconomic] = useState<EconomicWithDay[]>([]);
  const [dataSource, setDataSource] = useState<string>("");
  const [economicError, setEconomicError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const monday = useMemo(() => {
    const today = new Date();
    const baseMonday = getMondayOfWeek(today);
    const m = new Date(baseMonday);
    m.setDate(baseMonday.getDate() + weekOffset * 7);
    return m;
  }, [weekOffset]);

  const weekDates = useMemo(() => getWeekDates(monday), [monday]);
  const toFriday = useMemo(() => {
    const t = new Date(monday);
    t.setDate(monday.getDate() + 4);
    return t;
  }, [monday]);
  const fromStr = useMemo(() => ymdLocal(monday), [monday]);
  const toStr = useMemo(() => ymdLocal(toFriday), [toFriday]);

  // Per-week cache so navigating back to a previously-viewed week is instant
  // and doesn't show a "Loading…" flash. Refresh in background to update beat/miss.
  type CachedWeek = {
    earnings: EarningsWithDay[];
    economic: EconomicWithDay[];
    dataSource: string;
    economicError: string | null;
  };
  const weekCacheRef = useRef<Map<string, CachedWeek>>(new Map());
  // Tracks which week the UI is currently showing. In-flight fetches always
  // populate the per-week cache, but only apply to setState if their week key
  // still matches — prevents a slow week-N+1 response from clobbering week N
  // after the user has already navigated back.
  const currentKeyRef = useRef<string>(`${fromStr}__${toStr}`);
  useEffect(() => {
    currentKeyRef.current = `${fromStr}__${toStr}`;
  }, [fromStr, toStr]);

  const transformResponse = useCallback(
    (data: { earnings?: ApiEarnings[]; economic?: ApiEconomic[]; dataSource?: string; economicError?: string }, m: Date) => {
      const earn: EarningsWithDay[] = (data.earnings ?? []).map((e) => ({
        ...e,
        dayIndex: parseDateToDayIndex(e.date, m),
      }));
      const econ: EconomicWithDay[] = (data.economic ?? []).map((e) => ({
        ...e,
        dayIndex: parseDateToDayIndex(e.date, m),
        description: describeEconomic(e),
      }));
      return {
        earnings: earn.filter((e) => e.dayIndex >= 0 && e.dayIndex < 5),
        economic: econ.filter((e) => e.dayIndex >= 0 && e.dayIndex < 5),
        dataSource: data.dataSource ?? "",
        economicError: data.economicError ?? null,
      };
    },
    []
  );

  const fetchCalendar = useCallback(
    async (opts: { background: boolean }) => {
      const cacheKey = `${fromStr}__${toStr}`;
      if (!opts.background) {
        const cached = weekCacheRef.current.get(cacheKey);
        if (cached) {
          setEarnings(cached.earnings);
          setEconomic(cached.economic);
          setDataSource(cached.dataSource);
          setEconomicError(cached.economicError);
          setLoading(false);
        } else {
          setLoading(true);
          setEarnings([]);
          setEconomic([]);
          setEconomicError(null);
        }
      }
      try {
        const res = await fetch(`/api/calendar?from=${fromStr}&to=${toStr}`, { cache: "no-store" });
        const data = await res.json();
        const result = transformResponse(data, monday);
        // Always populate the cache for this week — a future navigation here
        // will hit it instantly.
        weekCacheRef.current.set(cacheKey, result);
        // Only apply to UI state if the user is still on this week. Otherwise
        // the response is stale (e.g. user clicked +1 then back to 0 before
        // the +1 request completed) and would clobber the displayed week.
        if (currentKeyRef.current === cacheKey) {
          setEarnings(result.earnings);
          setEconomic(result.economic);
          setDataSource(result.dataSource);
          setEconomicError(result.economicError);
          if (!opts.background) setLoading(false);
        }
      } catch {
        if (!opts.background && currentKeyRef.current === cacheKey) {
          setEarnings([]);
          setEconomic([]);
          setDataSource("");
          setEconomicError("Unable to load events");
          setLoading(false);
        }
      }
    },
    [fromStr, toStr, monday, transformResponse]
  );

  // Initial fetch / week change — uses cache when available
  useEffect(() => {
    fetchCalendar({ background: false });
  }, [fetchCalendar]);

  // Background refresh every 2 minutes — silently updates beat/miss without
  // flashing the loading state or wiping current data. Skip for past weeks
  // (data won't change) to avoid wasted API calls.
  useEffect(() => {
    if (weekOffset < 0) return;
    const interval = setInterval(() => fetchCalendar({ background: true }), 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchCalendar, weekOffset]);

  // Prefetch adjacent weeks so arrow clicks feel instant. Runs after the
  // current week has loaded; prefetched weeks land in the same in-memory cache.
  useEffect(() => {
    if (loading) return;
    const adjacents = [-1, 1].map((delta) => {
      const m = new Date(monday);
      m.setDate(monday.getDate() + delta * 7);
      const f = new Date(m);
      f.setDate(m.getDate() + 4);
      return { monday: m, fromStr: ymdLocal(m), toStr: ymdLocal(f), delta };
    });
    const ctrl = new AbortController();
    for (const adj of adjacents) {
      const newOffset = weekOffset + adj.delta;
      if (newOffset < -1 || newOffset > 1) continue;
      const cacheKey = `${adj.fromStr}__${adj.toStr}`;
      if (weekCacheRef.current.has(cacheKey)) continue;
      fetch(`/api/calendar?from=${adj.fromStr}&to=${adj.toStr}`, { cache: "no-store", signal: ctrl.signal })
        .then((r) => r.json())
        .then((data) => {
          if (ctrl.signal.aborted) return;
          weekCacheRef.current.set(cacheKey, transformResponse(data, adj.monday));
        })
        .catch(() => {
          /* ignore — best-effort prefetch */
        });
    }
    return () => ctrl.abort();
  }, [monday, weekOffset, loading, transformResponse]);

  const refetchCalendar = useCallback(() => {
    weekCacheRef.current.delete(`${fromStr}__${toStr}`);
    fetchCalendar({ background: false });
  }, [fetchCalendar, fromStr, toStr]);

  // (Year-events FRED fetch removed — was the slow path. The MonthlyActivityChart
  //  loads its own SPY data via /api/calendar/year-market-summary which is one
  //  fast FMP call, no FRED pagination needed.)

  const earningsByDay = useMemo(() => {
    const byDay: EarningsWithDay[][] = [[], [], [], [], []];
    for (const e of earnings) {
      if (e.dayIndex >= 0 && e.dayIndex < 5) byDay[e.dayIndex].push(e);
    }
    return byDay;
  }, [earnings]);

  const eventsByDay = useMemo(() => {
    const byDay: EconomicWithDay[][] = [[], [], [], [], []];
    for (const ev of economic) {
      if (ev.dayIndex >= 0 && ev.dayIndex < 5) byDay[ev.dayIndex].push(ev);
    }
    return byDay;
  }, [economic]);

  const totalEarnings = earnings.length;
  const highImpactCount = economic.filter((e) => e.impact === "HIGH").length;
  const anticipatedEvents = economic.filter((e) => e.impact === "HIGH").slice(0, 5);

  const marketMovers = useMemo(() => {
    const result: { name: string; description: string; impact: "HIGH" | "MEDIUM" | "earnings" }[] = [];
    for (const ev of economic.filter((e) => e.impact === "HIGH").slice(0, 4)) {
      result.push({ name: ev.name, description: getEconomicEventBreakdown(ev.name, ev.country), impact: "HIGH" });
    }
    if (result.length < 4) {
      for (const ev of economic.filter((e) => e.impact === "MEDIUM").slice(0, 4 - result.length)) {
        result.push({ name: ev.name, description: getEconomicEventBreakdown(ev.name, ev.country), impact: "MEDIUM" });
      }
    }
    if (result.length < 3) {
      for (const e of earnings.slice(0, 3 - result.length)) {
        const bmoAmc = e.bmoAmc ? ` (${e.bmoAmc})` : "";
        const eps = e.epsEstimate != null ? ` EPS est. $${e.epsEstimate.toFixed(2)}.` : "";
        result.push({
          name: `${e.name}${bmoAmc}`,
          description: `Earnings release${eps}`,
          impact: "earnings",
        });
      }
    }
    return result;
  }, [economic, earnings]);

  /** Countdown for upcoming event (updates every minute) */
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const countdownTo = useCallback(
    (dateStr: string): string => {
      // Use local-date Y-M-D, NOT now.toISOString() (that's UTC and can be off by
      // a day in evening hours for negative-TZ users).
      const todayStr = ymdLocal(now);
      if (dateStr < todayStr) return "Released";
      if (dateStr === todayStr) return "Today";
      const eventDate = new Date(dateStr + "T00:00:00");
      const todayMidnight = new Date(todayStr + "T00:00:00");
      const days = Math.round((eventDate.getTime() - todayMidnight.getTime()) / (24 * 60 * 60 * 1000));
      if (days === 1) return "Tomorrow";
      return `In ${days}d`;
    },
    [now]
  );

  const showEarningsSkeleton = loading && earnings.length === 0 && !economicError;
  const showEconomicSkeleton = loading && economic.length === 0 && !economicError;

  return (
    <div className="flex">
      {selectedEconomicEvent && (
        <EconomicDetailModal
          event={{
            id: selectedEconomicEvent.id,
            name: selectedEconomicEvent.name,
            description: selectedEconomicEvent.description,
            date: selectedEconomicEvent.date,
            previous: selectedEconomicEvent.previous,
            estimate: selectedEconomicEvent.estimate,
            actual: selectedEconomicEvent.actual,
          }}
          onClose={() => setSelectedEconomicEvent(null)}
        />
      )}
      {selectedEarning && (
        <EarningsDetailModal
          key={selectedEarning.ticker}
          ticker={selectedEarning.ticker}
          companyName={selectedEarning.name}
          onClose={() => setSelectedEarning(null)}
        />
      )}
      <main className="min-h-screen flex-1">
          <div className="mx-auto max-w-5xl px-4 py-6">
            {/* Tabs + Week selector */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("earnings")}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === "earnings" ? "bg-[var(--accent-color)]/20 text-[var(--accent-color)]" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Earnings
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("economic")}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === "economic" ? "bg-[var(--accent-color)]/20 text-[var(--accent-color)]" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Economic Events
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("year")}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === "year" ? "bg-[var(--accent-color)]/20 text-[var(--accent-color)]" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Year View
                </button>
              </div>

              {/* Week selector only applies to earnings/economic tabs — year view
                  shows a 12-month chart that doesn't take a weekly window. */}
              {activeTab !== "year" && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setWeekOffset((o) => Math.max(o - 1, -1))}
                    disabled={weekOffset <= -1}
                    className="rounded-lg border border-white/10 p-2 text-zinc-400 transition-colors hover:border-[var(--accent-color)]/30 hover:bg-white/5 hover:text-[var(--accent-color)] disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Previous week"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="min-w-[200px] text-center text-sm font-medium text-zinc-200">
                    {formatWeekRange(weekDates)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setWeekOffset((o) => Math.min(o + 1, 1))}
                    disabled={weekOffset >= 1}
                    className="rounded-lg border border-white/10 p-2 text-zinc-400 transition-colors hover:border-[var(--accent-color)]/30 hover:bg-white/5 hover:text-[var(--accent-color)] disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Next week"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {activeTab === "year" && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-zinc-100">{yearViewYear} at a glance</h2>
                <MonthlyActivityChart key={yearViewYear} year={yearViewYear} />
              </div>
            )}

            {activeTab === "earnings" && (
              <>
                {showEarningsSkeleton ? (
                  <CalendarSkeleton tab="earnings" />
                ) : (
                  <>
                    {!loading && totalEarnings === 0 && (
                      <p className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-zinc-400">
                        No major events scheduled for this week.
                      </p>
                    )}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                      {weekDates.map((d, dayIndex) => (
                        <div key={dayIndex} className="flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-3">
                          <h3 className="mb-3 text-center text-sm font-semibold text-zinc-300">
                            {formatDayShort(d)}
                            <span className="ml-1 text-zinc-500">{d.getDate()}</span>
                          </h3>
                          <div className="flex flex-1 flex-col gap-3">
                            {earningsByDay[dayIndex].length === 0 ? (
                              <p className="py-4 text-center text-xs text-zinc-500">No major earnings</p>
                            ) : (
                              earningsByDay[dayIndex].map((item) => (
                                <EarningsCard key={item.id} item={item} onClick={setSelectedEarning} />
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {activeTab === "economic" && (
              <div className="space-y-6">
                {economicError && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-center">
                    <p className="text-sm text-zinc-200">Unable to load events — please refresh to try again.</p>
                    <p className="mt-1 text-xs text-zinc-400">{economicError}</p>
                    <button
                      type="button"
                      onClick={refetchCalendar}
                      className="mt-3 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/20"
                    >
                      Refresh
                    </button>
                  </div>
                )}
                {!economicError && (
                  showEconomicSkeleton ? (
                    <CalendarSkeleton tab="economic" />
                  ) : (
                    <>
                      {!loading && economic.length === 0 && (
                        <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-zinc-400">
                          No economic events scheduled for this week.
                        </p>
                      )}
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                        {weekDates.map((d, dayIndex) => {
                          const events = eventsByDay[dayIndex];
                          return (
                            <div key={dayIndex} className="flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-3">
                              <h3 className="mb-3 text-center text-sm font-semibold text-zinc-300">
                                {formatDayShort(d)}
                                <span className="ml-1 text-zinc-500">{d.getDate()}</span>
                              </h3>
                              <div className="flex flex-1 flex-col gap-3">
                                {events.length === 0 ? (
                                  <p className="py-4 text-center text-xs text-zinc-500">No events this day</p>
                                ) : (
                                  events.map((ev) => (
                                    <EconomicCard
                                      key={ev.id}
                                      ev={ev}
                                      countdown={countdownTo(ev.date)}
                                      onClick={setSelectedEconomicEvent}
                                    />
                                  ))
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )
                )}
                {dataSource === "Financial Modeling Prep" && (
                  <p className="mt-4 text-center text-xs text-zinc-500">
                    Data: Financial Modeling Prep
                  </p>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Right panel */}
        <aside className="hidden w-80 flex-shrink-0 border-l border-white/5 lg:block">
          <div className="sticky top-0 space-y-6 p-4">
            <section
              className="rounded-2xl border border-white/10 p-4 transition-colors duration-200"
              style={{ backgroundColor: CARD_BG }}
            >
              <h2 className="text-sm font-semibold text-zinc-100">This Week at a Glance</h2>
              <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                <li>Total earnings: {totalEarnings} companies</li>
                <li>High impact events: {highImpactCount}</li>
              </ul>
              <p className="mt-3 text-xs font-medium text-zinc-400">Most anticipated</p>
              <ul className="mt-1 space-y-1.5 text-xs text-zinc-400">
                {anticipatedEvents.length === 0 ? (
                  <li className="italic text-zinc-500">No high-impact events this week</li>
                ) : (
                  anticipatedEvents.map((e, idx) => (
                    <li key={e.id} className="flex gap-1.5">
                      <span className="flex-shrink-0 font-bold text-zinc-500">{idx + 1}.</span>
                      <span>
                        <span className="text-zinc-200">{e.name}</span>
                        <span className="ml-1 text-zinc-500">{e.date}</span>
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </section>
            <section
              className="rounded-2xl border border-white/10 p-4 transition-colors duration-200"
              style={{ backgroundColor: CARD_BG }}
            >
              <h2 className="text-sm font-semibold text-zinc-100">Market Moving Events</h2>
              <ul className="mt-3 space-y-3 text-xs text-zinc-400">
                {marketMovers.length === 0 ? (
                  <li className="italic text-zinc-500">
                    {loading ? "Loading…" : "No notable events this week"}
                  </li>
                ) : (
                  marketMovers.map((m, i) => (
                    <li key={i}>
                      <span
                        className={`font-medium ${
                          m.impact === "HIGH"
                            ? "text-red-400"
                            : m.impact === "MEDIUM"
                            ? "text-amber-400"
                            : "text-[var(--accent-color)]"
                        }`}
                      >
                        {m.name}
                      </span>{" "}
                      — {m.description}
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>
        </aside>
    </div>
  );
}
