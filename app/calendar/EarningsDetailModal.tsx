"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

type EarningsPoint = {
  actual?: number | null;
  estimate?: number | null;
  period?: string;
  quarter?: number;
  year?: number;
  surprise?: number | null;
  surprisePercent?: number | null;
};

type CompanyProfile = {
  name?: string;
  finnhubIndustry?: string;
  marketCapitalization?: number;
  logo?: string;
  weburl?: string;
  country?: string;
  exchange?: string;
};

type Props = {
  ticker: string;
  companyName: string;
  onClose: () => void;
};

const CARD_BG = "var(--app-card)";

function fmtMktCap(mc: number): string {
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(2)}T`;
  if (mc >= 1e3) return `$${(mc / 1e3).toFixed(1)}B`;
  return `$${mc.toFixed(0)}M`;
}

function fmtPeriod(period?: string, quarter?: number, year?: number): string {
  if (quarter && year) return `Q${quarter}'${String(year).slice(2)}`;
  if (period) return period.slice(0, 7);
  return "";
}

export function EarningsDetailModal({ ticker, companyName, onClose }: Props) {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [earningsHistory, setEarningsHistory] = useState<EarningsPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const EarningsTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; fill?: string }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ backgroundColor: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
        <p style={{ color: "#a1a1aa", marginBottom: 4 }}>{label}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.name === "actual" ? (entry.value >= 0 ? "#10b981" : "#ef4444") : "#71717a", margin: "2px 0" }}>
            {entry.name === "actual" ? "Actual EPS" : "Estimate"}: <span style={{ color: "#e4e4e7", fontWeight: 600 }}>${Number(entry.value).toFixed(2)}</span>
          </p>
        ))}
      </div>
    );
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/calendar/company-earnings?symbol=${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then((data) => {
        setProfile(data.profile ?? null);
        const sorted = ((data.earningsHistory ?? []) as EarningsPoint[]).sort(
          (a, b) => {
            const aStr =
              a.period ?? `${a.year ?? 0}-${String(a.quarter ?? 0).padStart(2, "0")}`;
            const bStr =
              b.period ?? `${b.year ?? 0}-${String(b.quarter ?? 0).padStart(2, "0")}`;
            return aStr.localeCompare(bStr);
          }
        );
        setEarningsHistory(sorted);
      })
      .catch(() => setError("Failed to load earnings data"))
      .finally(() => setLoading(false));
  }, [ticker]);

  const chartData = earningsHistory.map((e) => ({
    label: fmtPeriod(e.period, e.quarter, e.year),
    actual: e.actual ?? null,
    estimate: e.estimate ?? null,
    beat:
      e.actual != null && e.estimate != null ? e.actual >= e.estimate : null,
    surprisePct: e.surprisePercent ?? null,
  }));

  const beats = chartData.filter((d) => d.beat === true).length;
  const misses = chartData.filter((d) => d.beat === false).length;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 shadow-2xl"
        style={{ backgroundColor: CARD_BG }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            {profile?.logo && (
              <img
                src={profile.logo}
                alt=""
                className="h-10 w-10 rounded-lg bg-white/5 object-contain p-1"
              />
            )}
            <div>
              <h2 className="text-lg font-bold text-zinc-100">
                {profile?.name ?? companyName}
              </h2>
              <p className="text-sm text-zinc-400">
                {ticker}
                {profile?.exchange ? ` · ${profile.exchange}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Company meta */}
          {profile && (
            <div className="flex flex-wrap gap-4 text-sm">
              {profile.finnhubIndustry && (
                <div>
                  <span className="text-zinc-500">Industry </span>
                  <span className="text-zinc-200">{profile.finnhubIndustry}</span>
                </div>
              )}
              {profile.marketCapitalization != null &&
                profile.marketCapitalization > 0 && (
                  <div>
                    <span className="text-zinc-500">Mkt Cap </span>
                    <span className="text-zinc-200">
                      {fmtMktCap(profile.marketCapitalization)}
                    </span>
                  </div>
                )}
              {profile.country && (
                <div>
                  <span className="text-zinc-500">Country </span>
                  <span className="text-zinc-200">{profile.country}</span>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </p>
          )}

          {loading && !error && (
            <div className="flex h-48 items-center justify-center text-sm text-zinc-400">
              Loading earnings history…
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Beat / miss summary pills */}
              {chartData.length > 0 && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-400">
                    {beats} beats
                  </span>
                  <span className="rounded-full bg-red-500/20 px-3 py-1 text-red-400">
                    {misses} misses
                  </span>
                  <span className="ml-auto text-xs text-zinc-500">
                    Last {chartData.length} quarters
                  </span>
                </div>
              )}

              {/* EPS chart */}
              {chartData.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm text-zinc-500">
                  No earnings history available
                </div>
              ) : (
                <div>
                  <p className="mb-2 text-xs font-medium text-zinc-400">
                    EPS — Actual vs Estimate
                  </p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={chartData}
                      margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                      barCategoryGap="30%"
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1a2535"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "#71717a", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#71717a", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={40}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <ReferenceLine y={0} stroke="#1a2535" />
                      <Tooltip content={<EarningsTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                      {/* Gray estimate bar */}
                      <Bar
                        dataKey="estimate"
                        name="estimate"
                        radius={[3, 3, 0, 0]}
                        fill="#3f3f46"
                      />
                      {/* Colored actual bar */}
                      <Bar
                        dataKey="actual"
                        name="actual"
                        radius={[3, 3, 0, 0]}
                      >
                        {chartData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={
                              entry.beat === true
                                ? "#10b981"
                                : entry.beat === false
                                ? "#ef4444"
                                : "#6366f1"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex gap-4 text-xs text-zinc-500">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Beat
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> Miss
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-zinc-600" /> Estimate
                    </span>
                  </div>
                </div>
              )}

              {/* Surprise % table */}
              {chartData.some((d) => d.surprisePct != null) && (
                <div>
                  <p className="mb-2 text-xs font-medium text-zinc-400">
                    Earnings surprise per quarter
                  </p>
                  <div className="divide-y divide-white/5 rounded-xl border border-white/10">
                    {[...chartData].reverse().map((d, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-2 text-xs"
                      >
                        <span className="w-16 font-medium text-zinc-400">
                          {d.label}
                        </span>
                        <span className="w-16 text-zinc-200">
                          {d.actual != null
                            ? `$${d.actual.toFixed(2)}`
                            : "—"}
                        </span>
                        <span className="flex-1 text-zinc-500">
                          {d.estimate != null
                            ? `est $${d.estimate.toFixed(2)}`
                            : ""}
                        </span>
                        {d.surprisePct != null && (
                          <span
                            className={
                              d.surprisePct >= 0
                                ? "font-medium text-emerald-400"
                                : "font-medium text-red-400"
                            }
                          >
                            {d.surprisePct >= 0 ? "+" : ""}
                            {d.surprisePct.toFixed(1)}%
                          </span>
                        )}
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            d.beat === true
                              ? "bg-emerald-500/20 text-emerald-400"
                              : d.beat === false
                              ? "bg-red-500/20 text-red-400"
                              : "bg-zinc-500/20 text-zinc-400"
                          }`}
                        >
                          {d.beat === true
                            ? "BEAT"
                            : d.beat === false
                            ? "MISS"
                            : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
