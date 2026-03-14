"use client";

import { useState, useMemo, useEffect } from "react";
import type { EarningsItem as ApiEarnings, EconomicItem as ApiEconomic } from "../api/calendar/route";

const CARD_BG = "#0F1520";

type EarningsWithDay = ApiEarnings & { dayIndex: number };
type EconomicWithDay = ApiEconomic & { dayIndex: number; description: string };

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
  const d = new Date(dateStr);
  const diff = Math.floor((d.getTime() - monday.getTime()) / (24 * 60 * 60 * 1000));
  if (diff < 0 || diff > 4) return -1;
  return diff;
}

export default function CalendarPage() {
  const [activeTab, setActiveTab] = useState<"earnings" | "economic">("earnings");
  const [weekOffset, setWeekOffset] = useState(0);
  const [earnings, setEarnings] = useState<EarningsWithDay[]>([]);
  const [economic, setEconomic] = useState<EconomicWithDay[]>([]);
  const [loading, setLoading] = useState(true);

  const monday = useMemo(() => {
    const today = new Date();
    const baseMonday = getMondayOfWeek(today);
    const m = new Date(baseMonday);
    m.setDate(baseMonday.getDate() + weekOffset * 7);
    return m;
  }, [weekOffset]);

  const weekDates = useMemo(() => getWeekDates(monday), [monday]);
  const fromStr = useMemo(() => monday.toISOString().slice(0, 10), [monday]);
  const toDate = useMemo(() => {
    const t = new Date(monday);
    t.setDate(t.getDate() + 6);
    return t;
  }, [monday]);
  const toStr = useMemo(() => toDate.toISOString().slice(0, 10), [toDate]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/calendar?from=${fromStr}&to=${toStr}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { earnings?: ApiEarnings[]; economic?: ApiEconomic[] }) => {
        const m = monday;
        const earn: EarningsWithDay[] = (data.earnings ?? []).map((e) => ({
          ...e,
          dayIndex: parseDateToDayIndex(e.date, m),
        }));
        const econ: EconomicWithDay[] = (data.economic ?? []).map((e) => ({
          ...e,
          dayIndex: parseDateToDayIndex(e.date, m),
          description: `${e.country ? e.country + " — " : ""}${e.previous != null ? `Prev ${e.previous}. ` : ""}${e.estimate != null ? `Est ${e.estimate}.` : ""}`,
        }));
        setEarnings(earn.filter((e) => e.dayIndex >= 0 && e.dayIndex < 5));
        setEconomic(econ.filter((e) => e.dayIndex >= 0 && e.dayIndex < 5));
      })
      .catch(() => {
        setEarnings([]);
        setEconomic([]);
      })
      .finally(() => setLoading(false));
  }, [fromStr, toStr, monday]);

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
  const anticipatedEvents = economic.filter((e) => e.impact === "HIGH").slice(0, 3);

  return (
    <div className="flex">
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
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWeekOffset((o) => o - 1)}
                  className="rounded-lg border border-white/10 p-2 text-zinc-400 transition-colors hover:border-[var(--accent-color)]/30 hover:bg-white/5 hover:text-[var(--accent-color)]"
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
                  onClick={() => setWeekOffset((o) => o + 1)}
                  className="rounded-lg border border-white/10 p-2 text-zinc-400 transition-colors hover:border-[var(--accent-color)]/30 hover:bg-white/5 hover:text-[var(--accent-color)]"
                  aria-label="Next week"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {activeTab === "earnings" && (
              <>
                {loading && (
                  <p className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-zinc-400">
                    Loading earnings…
                  </p>
                )}
                {!loading && totalEarnings === 0 && (
                  <p className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-zinc-400">
                    No major events scheduled for this week.
                  </p>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
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
                          <div
                            key={item.id}
                            className="rounded-xl border border-white/10 p-3 transition-all duration-200 hover:border-[var(--accent-color)]/40"
                            style={{ backgroundColor: CARD_BG }}
                          >
                            <div className="flex items-start gap-2">
                              <div
                                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                style={{ backgroundColor: `hsl(${(item.ticker.charCodeAt(0) * 17) % 360}, 50%, 40%)` }}
                              >
                                {item.ticker.slice(0, 2)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-zinc-100">{item.name}</p>
                                <p className="text-xs text-zinc-500">{item.ticker}</p>
                              </div>
                            </div>
                            <dl className="mt-2 space-y-0.5 text-xs">
                              <div className="flex justify-between">
                                <span className="text-zinc-500">EPS est.</span>
                                <span className="text-zinc-200">{item.epsEstimate != null ? item.epsEstimate.toFixed(2) : "—"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Rev. est.</span>
                                <span className="text-zinc-200">{item.revenueEstimate != null ? `${(item.revenueEstimate / 1e9).toFixed(2)}B` : "—"}</span>
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
                              {item.epsActual != null && (
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${item.epsActual >= (item.epsEstimate ?? 0) ? "bg-[var(--accent-color)]/20 text-[var(--accent-color)]" : "bg-red-500/20 text-red-400"}`}>
                                  {item.epsActual >= (item.epsEstimate ?? 0) ? "BEAT" : "MISS"}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
                </div>
              </>
            )}

            {activeTab === "economic" && (
              <div className="space-y-6">
                {!loading && economic.length === 0 && (
                  <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-zinc-400">
                    No major events scheduled for this week.
                  </p>
                )}
                {weekDates.map((d, dayIndex) => {
                  const events = eventsByDay[dayIndex];
                  if (events.length === 0) return null;
                  return (
                    <section key={dayIndex}>
                      <h3 className="mb-3 text-sm font-semibold text-zinc-300">
                        {formatDayShort(d)} — {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </h3>
                      <div className="space-y-3">
                        {events.map((ev) => (
                          <div
                            key={ev.id}
                            className={`rounded-xl border border-white/10 p-4 transition-all duration-200 hover:border-white/20 ${
                              ev.impact === "HIGH" ? "border-l-4 border-l-red-500" : ev.impact === "MEDIUM" ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-zinc-500"
                            }`}
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
                            <p className="mt-2 text-xs text-zinc-400">{ev.description}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
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
              <ul className="mt-1 space-y-1 text-xs text-zinc-400">
                {anticipatedEvents.map((e) => (
                  <li key={e.id}>
                    {e.name} — {e.dateTimeET}
                  </li>
                ))}
              </ul>
            </section>
            <section
              className="rounded-2xl border border-white/10 p-4 transition-colors duration-200"
              style={{ backgroundColor: CARD_BG }}
            >
              <h2 className="text-sm font-semibold text-zinc-100">Market Moving Events</h2>
              <ul className="mt-3 space-y-3 text-xs text-zinc-400">
                <li>
                  <span className="font-medium text-red-400">Core CPI</span> — Sets tone for rates; beats/misses drive equity and bond volatility.
                </li>
                <li>
                  <span className="font-medium text-red-400">FOMC Minutes</span> — Traders look for hints on cut timing and balance-sheet plans.
                </li>
                <li>
                  <span className="font-medium text-amber-400">Nike (NKE)</span> — AMC Thursday; consumer and China exposure in focus.
                </li>
              </ul>
            </section>
          </div>
        </aside>
    </div>
  );
}
