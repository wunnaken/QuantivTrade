"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { AnalyzeTickerResponse } from "../../api/analyze-ticker/route";
import {
  addToWatchlistApi,
  fetchWatchlist,
  isTickerInWatchlist,
  removeFromWatchlistApi,
} from "../../../lib/watchlist-api";

const CARD_BG = "#0F1520";

function seededRandom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h << 5) - h + seed.charCodeAt(i);
  return Math.abs((h >>> 0) % 1000) / 1000;
}

function useWatchingCount(ticker: string) {
  const [count, setCount] = useState(() => {
    const r = seededRandom(ticker || "X");
    return Math.floor(80 + r * 320);
  });
  useEffect(() => {
    const t = setInterval(() => {
      setCount((c) => Math.max(50, Math.min(500, c + Math.floor((seededRandom(ticker + Date.now()) - 0.5) * 20))));
    }, 60000);
    return () => clearInterval(t);
  }, [ticker]);
  return count;
}

type QuoteData = {
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  high: number | null;
  low: number | null;
};

function TickerDataPanel({
  ticker,
  inWatchlist,
  onWatchlistChange,
  watchingCount,
  quote,
  quoteLoading,
}: {
  ticker: string;
  inWatchlist: boolean;
  onWatchlistChange: () => void;
  watchingCount: number;
  quote: QuoteData | null;
  quoteLoading: boolean;
}) {
  const name = ticker.length <= 4 ? `${ticker}` : ticker;
  const price = quote?.price;
  const changePercent = quote?.changePercent ?? null;
  const volume = quote?.volume;
  const high = quote?.high;
  const low = quote?.low;
  const hasPrice = price != null && !Number.isNaN(price);
  const hasChange = changePercent != null && !Number.isNaN(changePercent);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">{ticker}</h1>
        <p className="mt-1 text-sm text-zinc-400">{name}</p>
        <p className="mt-1 text-xs text-zinc-500">👁 {watchingCount} Xchange members watching {ticker} today</p>
      </div>
      {quoteLoading ? (
        <div className="flex items-baseline gap-2">
          <div className="h-8 w-24 animate-pulse rounded bg-white/10" />
          <div className="h-5 w-12 animate-pulse rounded bg-white/10" />
        </div>
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-zinc-100">
            {hasPrice ? (price >= 1 ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${price.toFixed(4)}`) : "—"}
          </span>
          {hasChange && (
            <span className={changePercent >= 0 ? "text-emerald-400" : "text-red-400"}>
              {changePercent >= 0 ? "+" : ""}{changePercent.toFixed(2)}%
            </span>
          )}
        </div>
      )}
      <div
        className="flex h-48 items-center justify-center rounded-xl border border-white/10"
        style={{ backgroundColor: CARD_BG }}
      >
        <p className="text-sm text-zinc-500">Live chart coming soon</p>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-1">
        {[
          { label: "Volume", value: volume != null ? (volume >= 1e6 ? `${(volume / 1e6).toFixed(1)}M` : volume >= 1e3 ? `${(volume / 1e3).toFixed(1)}K` : String(volume)) : "—" },
          { label: "High", value: high != null ? `$${high.toFixed(2)}` : "—" },
          { label: "Low", value: low != null ? `$${low.toFixed(2)}` : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2">
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd className="text-sm font-medium text-zinc-200">{value}</dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={onWatchlistChange}
        className={`w-full rounded-full py-2.5 text-sm font-semibold transition-colors ${
          inWatchlist
            ? "border border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20"
            : "bg-[var(--accent-color)] text-[#020308] hover:opacity-90"
        }`}
      >
        {inWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
      </button>
    </div>
  );
}

function AIAnalysisSkeleton() {
  return (
    <div className="space-y-4 rounded-2xl border border-[var(--accent-color)]/30 bg-[#0F1520]/80 p-6">
      <div className="search-skeleton h-8 w-32 rounded" />
      <div className="search-skeleton h-4 w-full rounded" />
      <div className="search-skeleton h-4 w-4/5 rounded" />
      <div className="search-skeleton h-20 w-full rounded-xl" />
      <div className="search-skeleton h-20 w-full rounded-xl" />
      <div className="search-skeleton h-6 w-24 rounded" />
    </div>
  );
}

function AIAnalysisCard({ data }: { data: AnalyzeTickerResponse }) {
  const riskBarColor =
    data.riskRating <= 3 ? "var(--accent-color)" : data.riskRating <= 6 ? "#eab308" : "#ef4444";
  const riskBarWidth = Math.min(100, (data.riskRating / 10) * 100);

  return (
    <div
      className="rounded-2xl border-2 p-6"
      style={{
        animation: "fadeIn 0.4s ease-out forwards",
        borderImage: "linear-gradient(135deg, var(--accent-color-40), var(--accent-color-10)) 1",
        backgroundColor: "rgba(15, 21, 32, 0.9)",
      }}
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="text-lg">✨</span>
        <h2 className="text-lg font-semibold text-zinc-100">AI Analysis</h2>
      </div>

      <section className="mb-6">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-zinc-100">{data.riskRating}/10</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              data.riskColor === "green"
                ? "bg-[var(--accent-color)]/20 text-[var(--accent-color)]"
                : data.riskColor === "yellow"
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-red-500/20 text-red-400"
            }`}
          >
            {data.riskLabel}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${riskBarWidth}%`, backgroundColor: riskBarColor }}
          />
        </div>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-sm font-semibold text-zinc-300">Summary</h3>
        <p className="text-sm leading-relaxed text-zinc-400">{data.summary}</p>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-sm font-semibold text-zinc-300">Bull case 📈</h3>
        <div className="border-l-4 border-[var(--accent-color)] bg-[var(--accent-color)]/5 px-4 py-3 rounded-r-lg">
          <p className="text-sm text-zinc-300">{data.bullCase}</p>
        </div>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-sm font-semibold text-zinc-300">Bear case 📉</h3>
        <div className="border-l-4 border-red-500 bg-red-500/5 px-4 py-3 rounded-r-lg">
          <p className="text-sm text-zinc-300">{data.bearCase}</p>
        </div>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-sm font-semibold text-zinc-300">Suitable for</h3>
        <Link
          href="/profiles"
          className="inline-flex items-center gap-1 rounded-full border border-[var(--accent-color)]/40 bg-[var(--accent-color)]/10 px-3 py-1.5 text-sm font-medium text-[var(--accent-color)] hover:bg-[var(--accent-color)]/20"
        >
          {data.suitableFor}
        </Link>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-sm font-semibold text-zinc-300">Key factors</h3>
        <ul className="list-inside list-disc space-y-1 text-sm text-zinc-400">
          {data.keyFactors.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </section>

      <p className="text-xs italic text-zinc-500">{data.disclaimer}</p>
    </div>
  );
}

const AI_CACHE_PREFIX = "ai-analysis-";
const AI_CACHE_HOURS = 6;

function getCachedAnalysis(ticker: string): AnalyzeTickerResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const hour = Math.floor(now.getHours() / AI_CACHE_HOURS) * AI_CACHE_HOURS;
    const key = `${AI_CACHE_PREFIX}${ticker}-${date}-${hour}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as AnalyzeTickerResponse;
  } catch {
    return null;
  }
}

function setCachedAnalysis(ticker: string, data: AnalyzeTickerResponse) {
  if (typeof window === "undefined") return;
  try {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const hour = Math.floor(now.getHours() / AI_CACHE_HOURS) * AI_CACHE_HOURS;
    const key = `${AI_CACHE_PREFIX}${ticker}-${date}-${hour}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export default function TickerPage() {
  const params = useParams();
  const ticker = typeof params.ticker === "string" ? params.ticker.toUpperCase() : "";
  const [inWatchlist, setInWatchlist] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeTickerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const watchingCount = useWatchingCount(ticker || "");

  const refreshWatchlist = useCallback(async () => {
    try {
      const items = await fetchWatchlist();
      setInWatchlist(isTickerInWatchlist(items, ticker));
    } catch {
      setInWatchlist(false);
    }
  }, [ticker]);

  useEffect(() => {
    queueMicrotask(() => refreshWatchlist());
  }, [refreshWatchlist]);

  useEffect(() => {
    if (!ticker) return;
    setQuoteLoading(true);
    fetch(`/api/ticker-quote?ticker=${encodeURIComponent(ticker)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setQuote({
          price: data.price ?? null,
          change: data.change ?? null,
          changePercent: data.changePercent ?? null,
          volume: data.volume ?? null,
          high: data.high ?? null,
          low: data.low ?? null,
        });
      })
      .catch(() => setQuote(null))
      .finally(() => setQuoteLoading(false));
  }, [ticker]);

  useEffect(() => {
    if (!ticker) return;
    const cached = getCachedAnalysis(ticker);
    if (cached) {
      setAnalysis(cached);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/analyze-ticker?ticker=${encodeURIComponent(ticker)}`)
      .then((res) => {
        if (!res.ok) return res.json().then((b) => Promise.reject(new Error((b as { error?: string }).error || res.statusText)));
        return res.json() as Promise<AnalyzeTickerResponse>;
      })
      .then((data) => {
        setAnalysis(data);
        setCachedAnalysis(ticker, data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load analysis"))
      .finally(() => setLoading(false));
  }, [ticker]);

  const handleWatchlistToggle = async () => {
    try {
      if (inWatchlist) {
        await removeFromWatchlistApi(ticker);
      } else {
        await addToWatchlistApi({ ticker, name: ticker });
      }
      await refreshWatchlist();
    } catch {
      // ignore
    }
  };

  if (!ticker) {
    return (
      <div className="min-h-screen app-page flex items-center justify-center px-4">
        <p className="text-zinc-400">Invalid ticker.</p>
        <Link href="/search" className="ml-2 text-[var(--accent-color)] hover:underline">
          Search
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-page font-[&quot;Times_New_Roman&quot;,serif]">
      <div className="border-b border-white/5 px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/search" className="text-sm text-zinc-400 hover:text-[var(--accent-color)]">
            ← Search
          </Link>
          <Link href="/feed" className="text-sm text-zinc-400 hover:text-[var(--accent-color)]">
            Feed
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr,1.1fr]">
          <div
            className="rounded-2xl border border-white/10 p-6 transition-colors"
            style={{ backgroundColor: CARD_BG }}
          >
            <TickerDataPanel
              ticker={ticker}
              inWatchlist={inWatchlist}
              onWatchlistChange={handleWatchlistToggle}
              watchingCount={watchingCount}
              quote={quote}
              quoteLoading={quoteLoading}
            />
          </div>

          <div>
            {loading && <AIAnalysisSkeleton />}
            {error && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-300">
                {error}. Add <code className="rounded bg-black/20 px-1">ANTHROPIC_API_KEY</code> to .env.local to enable AI analysis.
              </div>
            )}
            {!loading && !error && analysis && <AIAnalysisCard data={analysis} />}
          </div>
        </div>
      </div>
    </div>
  );
}
