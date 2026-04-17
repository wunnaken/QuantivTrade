"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Timeframe = "1D" | "1W" | "1M" | "1Y";

type HistoryPayload = {
  dates: string[];
  series: Record<string, (number | null)[]>;
  error?: string;
};

function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function pctColor(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "text-zinc-400";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-red-400";
  return "text-zinc-400";
}

/** Format raw API dates into readable labels.
 *  "2026-04-16T09:59" → "Apr 16, 9:59 AM"
 *  "2026-04-16"       → "Apr 16" */
function fmtDate(raw: string | undefined): string {
  if (!raw) return "";
  try {
    const hasTime = raw.includes("T");
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    if (hasTime) {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
        ", " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return raw;
  }
}

/** Short axis label — just month + day (no time, no year for intraday). */
function fmtAxisDate(raw: string): string {
  if (!raw) return "";
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    if (raw.includes("T")) {
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return raw;
  }
}

/** Plain label for tooltip: gain / loss vs period start. */
function gainLossLabel(v: number | null | undefined): string | null {
  if (v == null || !Number.isFinite(v)) return null;
  if (v > 0) return "Gain";
  if (v < 0) return "Loss";
  return "Flat";
}

/** Stable identity for watchlist symbols so parent re-renders (new array refs) do not retrigger fetch. */
function tickersContentKey(symbols: string[]): string {
  return [...new Set(symbols.map((t) => t.trim().toUpperCase()).filter(Boolean))].sort().join("|");
}

export default function WatchlistChart({ tickers }: { tickers: string[] }) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1M");
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<HistoryPayload | null>(null);

  const tickersKey = tickersContentKey(tickers);
  const symbols = useMemo(
    () => (tickersKey.length > 0 ? tickersKey.split("|") : []),
    [tickersKey],
  );

  useEffect(() => {
    const list = tickersKey.length > 0 ? tickersKey.split("|") : [];
    if (list.length === 0) {
      setPayload(null);
      setLoading(false);
      return;
    }

    const q = new URLSearchParams({ tickers: list.join(","), timeframe });
    let ac = new AbortController();

    const fetchData = async (showLoading: boolean) => {
      if (showLoading) setLoading(true);
      try {
        const res = await fetch(`/api/watchlist-history?${q}`, {
          cache: "no-store",
          signal: ac.signal,
        });
        const json = (await res.json()) as HistoryPayload;
        if (ac.signal.aborted) return;
        if (!res.ok) {
          setPayload({ dates: [], series: {}, error: json.error ?? "Could not load history" });
        } else {
          setPayload(json);
        }
      } catch {
        if (ac.signal.aborted) return;
        if (showLoading) setPayload({ dates: [], series: {}, error: "Failed to load" });
      } finally {
        if (!ac.signal.aborted && showLoading) setLoading(false);
      }
    };

    void fetchData(true);
    // 1D/1W: refresh every 30s (intraday data changes frequently).
    // 1M/1Y: refresh every 5 min (daily EOD data, reduces FMP 429 rate-limits).
    const refreshMs = timeframe === "1M" || timeframe === "1Y" ? 300_000 : 30_000;
    const interval = setInterval(() => void fetchData(false), refreshMs);

    return () => {
      ac.abort();
      ac = new AbortController();
      clearInterval(interval);
    };
  }, [tickersKey, timeframe]);

  const chartData = useMemo(() => {
    const dates = payload?.dates ?? [];
    const ser = payload?.series ?? {};
    const avg = ser.average ?? [];
    if (dates.length === 0) return [];
    return dates.map((date, i) => {
      const row: Record<string, string | number | null> = { date, average: avg[i] ?? null };
      for (const tk of symbols) {
        const arr = ser[tk];
        row[tk] = Array.isArray(arr) ? (arr[i] ?? null) : null;
      }
      return row;
    });
  }, [payload, symbols]);

  const lastAverageReturn = useMemo(() => {
    const avg = payload?.series?.average;
    if (!avg?.length) return null;
    for (let i = avg.length - 1; i >= 0; i--) {
      const v = avg[i];
      if (v != null && Number.isFinite(v)) return v;
    }
    return null;
  }, [payload]);

  const tfButtons: Timeframe[] = ["1D", "1W", "1M", "1Y"];

  return (
    <div className="mt-8 rounded-xl border border-white/10 bg-[var(--app-card-alt)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">WATCHLIST PERFORMANCE</p>
          <p className="mt-0.5 text-[10px] text-zinc-600">
            Average % change vs period start, across {symbols.length} symbol{symbols.length === 1 ? "" : "s"} in your watchlist
            {symbols.length <= 8 ? ` (${symbols.join(", ")})` : ""}
          </p>
        </div>
        <span className={`text-2xl font-semibold tabular-nums ${pctColor(lastAverageReturn)}`}>
          {fmtPct(lastAverageReturn)}
        </span>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {tfButtons.map((tf) => (
          <button
            key={tf}
            type="button"
            onClick={() => setTimeframe(tf)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              timeframe === tf ? "bg-white/15 text-zinc-100" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton h-[280px] rounded-lg" aria-hidden />
      ) : payload?.error || chartData.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="text-sm text-zinc-500">
            {payload?.error ?? "No chart data available for this timeframe."}
          </p>
          <p className="max-w-sm text-xs text-zinc-600">
            Stock price history uses FMP API which may be temporarily rate-limited (250 calls/day on free tier).
            Try again in a few minutes, or switch to 1D/1W which uses Finnhub quotes as fallback.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} interval="preserveStartEnd" minTickGap={24} tickFormatter={fmtAxisDate} />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
            />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
            <Tooltip
              content={({ active, label, payload: rows }) => {
                if (!active || !rows?.length) return null;
                const pt = rows[0]?.payload as Record<string, unknown> | undefined;
                if (!pt) return null;
                const avgVal = pt.average != null ? Number(pt.average) : null;
                const hasAny =
                  (avgVal != null && Number.isFinite(avgVal)) ||
                  symbols.some((tk) => {
                    const x = pt[tk];
                    return x != null && Number.isFinite(Number(x));
                  });
                if (!hasAny) return null;
                const avgGl = gainLossLabel(avgVal);
                return (
                  <div className="max-h-[min(320px,70vh)] overflow-y-auto rounded-lg border border-white/10 bg-[#0c1222] px-3 py-2 text-xs shadow-xl">
                    <p className="mb-2 font-medium text-zinc-300">{fmtDate(label as string)}</p>
                    <p className="mb-2 text-[10px] text-zinc-600">% change vs start of period</p>
                    {avgVal != null && Number.isFinite(avgVal) ? (
                      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-white/10 pb-2">
                        <span className="text-zinc-500">Watchlist avg</span>
                        <span className="flex items-baseline gap-2 font-mono tabular-nums">
                          <span className={pctColor(avgVal)}>{fmtPct(avgVal)}</span>
                          {avgGl ? (
                            <span className={`text-[10px] font-semibold uppercase tracking-wide ${pctColor(avgVal)}`}>
                              {avgGl}
                            </span>
                          ) : null}
                        </span>
                      </div>
                    ) : null}
                    <ul className="space-y-1">
                      {symbols.map((tk) => {
                        const raw = pt[tk];
                        const v = raw != null ? Number(raw) : null;
                        const gl = gainLossLabel(v);
                        return (
                          <li key={tk} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 font-mono tabular-nums">
                            <span className="text-zinc-500">{tk}</span>
                            <span className="flex items-baseline gap-2">
                              <span className={pctColor(v)}>{fmtPct(v)}</span>
                              {gl ? (
                                <span className={`text-[10px] font-semibold uppercase tracking-wide ${pctColor(v)}`}>
                                  {gl}
                                </span>
                              ) : null}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="average"
              name="Watchlist average"
              stroke="var(--accent-color)"
              strokeWidth={2.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
