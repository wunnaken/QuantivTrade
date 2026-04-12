"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ArchiveBook, ArchiveVideo } from "../api/archive/resources/route";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { ARCHIVE_CATEGORIES, PREBUILT_TERMS, slugify } from "../../lib/archive-prebuilt";
import { TypewriterText } from "../../components/TypewriterText";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArticleContent {
  definition: string;
  howItWorks: string;
  keyComponents: string[];
  tradingApplication: string;
  example: string;
  advantages: string[];
  disadvantages: string[];
  commonMistakes: string[];
  relatedConcepts: string[];
  brokerNote?: string;
  regulatoryNote?: string;
  proTip: string;
}

interface Article {
  slug: string;
  title: string;
  category: string;
  summary: string;
  content: ArticleContent;
  related_terms: string[];
  tags: string[];
  is_prebuilt: boolean;
  source?: "wikipedia" | "ai";
  source_url?: string;
  view_count: number;
  created_at: string;
}

interface SearchResult {
  slug: string;
  title: string;
  category: string;
  summary: string;
  tags: string[];
  is_prebuilt: boolean;
  view_count: number;
  needs_generation?: boolean;
  is_ai_suggestion?: boolean;
}

interface PopularData {
  topArticles: SearchResult[];
  recentArticles: SearchResult[];
  categoryCounts: { category: string; icon: string; color: string; total: number; generated: number }[];
  totalTerms: number;
  totalGenerated: number;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function Icon({ name, size = 14, className = "" }: { name: string; size?: number; className?: string }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className };
  switch (name) {
    case "trending-up":   return <svg {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
    case "activity":      return <svg {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
    case "dollar-sign":   return <svg {...p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>;
    case "landmark":      return <svg {...p}><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>;
    case "list":          return <svg {...p}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
    case "layers":        return <svg {...p}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;
    case "circle-dollar": return <svg {...p}><circle cx="12" cy="12" r="10"/><path d="M14.5 9H11a2 2 0 000 4h2a2 2 0 010 4H9"/><line x1="12" y1="6" x2="12" y2="9"/><line x1="12" y1="17" x2="12" y2="20"/></svg>;
    case "bar-chart-2":   return <svg {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>;
    case "shield":        return <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
    case "scale":         return <svg {...p}><line x1="12" y1="3" x2="12" y2="20"/><line x1="3" y1="20" x2="21" y2="20"/><path d="M5 9a4 4 0 008 0"/><path d="M11 9a4 4 0 008 0"/><line x1="5" y1="9" x2="12" y2="3"/><line x1="19" y1="9" x2="12" y2="3"/></svg>;
    case "alert-triangle":return <svg {...p}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case "zap":           return <svg {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
    case "book-open":     return <svg {...p}><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>;
    case "bar-chart":     return <svg {...p}><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>;
    case "search":        return <svg {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
    case "globe":         return <svg {...p}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>;
    case "play":          return <svg {...p} fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
    default:              return <svg {...p}><circle cx="12" cy="12" r="5"/></svg>;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const GENERATION_STEPS = [
  "Verifying sources...",
  "Gathering trading context...",
  "Writing explanation...",
  "Adding examples...",
  "Done!",
];

function categoryColor(cat: string): string {
  return ARCHIVE_CATEGORIES.find((c) => c.id === cat)?.color ?? "#6366f1";
}

function categoryIcon(cat: string): string {
  return ARCHIVE_CATEGORIES.find((c) => c.id === cat)?.icon ?? "bar-chart-2";
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function useRecentlyViewed() {
  const [recent, setRecent] = useState<{ slug: string; title: string }[]>([]);

  useEffect(() => {
    // Load from localStorage immediately, then sync from DB
    try {
      const raw = localStorage.getItem("archive_recent");
      if (raw) setRecent(JSON.parse(raw));
    } catch {}
    fetch("/api/profile/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { archive_recent?: { slug: string; title: string }[] } | null) => {
        if (Array.isArray(data?.archive_recent) && data.archive_recent.length > 0) {
          setRecent(data.archive_recent);
          try { localStorage.setItem("archive_recent", JSON.stringify(data.archive_recent)); } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const add = useCallback((slug: string, title: string) => {
    setRecent((prev) => {
      const filtered = prev.filter((r) => r.slug !== slug);
      const next = [{ slug, title }, ...filtered].slice(0, 10);
      try { localStorage.setItem("archive_recent", JSON.stringify(next)); } catch {}
      // Sync to DB
      fetch("/api/profile/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ archive_recent: next.map((r) => ({ slug: r.slug, title: r.title })) }),
      }).catch(() => {});
      return next;
    });
  }, []);

  return { recent, add };
}

// ─── Demo Chart Data ──────────────────────────────────────────────────────────

function generateDemoChart(slug: string) {
  const seed = slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = (i: number) => Math.sin(seed * 0.1 + i * 0.7) * 0.5 + Math.sin(i * 0.3) * 0.3;

  const prices: { day: number; price: number; indicator?: number }[] = [];
  let price = 100;
  for (let i = 0; i < 50; i++) {
    price = price + rng(i) * 3;
    const period = prices.slice(Math.max(0, i - 13));
    const avg = period.reduce((s, p) => s + p.price, 0) / (period.length || 1);

    let indicator: number | undefined;
    if (slug.includes("rsi")) {
      indicator = 50 + rng(i) * 25 + (price > avg ? 15 : -15);
      indicator = Math.max(10, Math.min(90, indicator));
    } else if (slug.includes("macd")) {
      indicator = (price - avg) * 0.5;
    } else if (slug.includes("moving") || slug.includes("ema") || slug.includes("sma")) {
      indicator = avg;
    }
    prices.push({ day: i + 1, price: Math.round(price * 100) / 100, indicator });
  }
  return prices;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CategoryBadge({ category, size = "sm" }: { category: string; size?: "sm" | "xs" }) {
  const color = categoryColor(category);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"}`}
      style={{ background: color + "20", color, border: `1px solid ${color}30` }}
    >
      <Icon name={categoryIcon(category)} size={size === "xs" ? 10 : 11} />
      {category}
    </span>
  );
}

function ArticleCard({
  article,
  onClick,
}: {
  article: SearchResult;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4 text-left transition-all duration-200 hover:border-white/20 hover:bg-white/5"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <CategoryBadge category={article.category} size="xs" />
        {article.view_count > 0 && (
          <span className="text-[10px] text-zinc-600">{article.view_count.toLocaleString()} views</span>
        )}
      </div>
      <p className="mb-1.5 text-sm font-semibold text-zinc-100 group-hover:text-white">{article.title}</p>
      <p className="mb-3 line-clamp-2 text-xs text-zinc-500">{article.summary}</p>
      <div className="flex flex-wrap gap-1">
        {(article.tags ?? []).slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-full bg-zinc-800/60 px-2 py-0.5 text-[9px] text-zinc-500">{tag}</span>
        ))}
      </div>
      <p className="mt-3 text-[10px] font-medium text-[var(--accent-color)] opacity-0 transition-opacity group-hover:opacity-100">
        {article.needs_generation ? "Generate Article →" : "Read Article →"}
      </p>
    </button>
  );
}

function GeneratingLoader({ term, ready }: { term: string; ready: boolean }) {
  const lastStep = GENERATION_STEPS.length - 1;
  const [step, setStep] = useState(0);

  // Advance automatically but stop one before "Done!" — only reach Done when ready
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, lastStep - 1)), 1200);
    return () => clearInterval(id);
  }, [lastStep]);

  // Jump to Done only when the fetch actually completed
  useEffect(() => {
    if (ready) setStep(lastStep);
  }, [ready, lastStep]);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className={`mb-6 h-12 w-12 rounded-full border-2 border-zinc-700 border-t-[var(--accent-color)] ${ready ? "" : "animate-spin"}`} />
      <p className="mb-2 text-base font-semibold text-zinc-100">Writing article about &ldquo;{term}&rdquo;</p>
      <p className="mb-6 text-xs text-zinc-500">Verifying sources and writing · ~10 seconds</p>
      <div className="space-y-2">
        {GENERATION_STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 text-xs">
            <span className={`h-1.5 w-1.5 rounded-full ${i < step ? "bg-[var(--accent-color)]" : i === step ? "animate-pulse bg-[var(--accent-color)]" : "bg-zinc-700"}`} />
            <span className={i <= step ? "text-zinc-300" : "text-zinc-600"}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoChart({ slug }: { slug: string }) {
  const showChart = slug.includes("rsi") || slug.includes("macd") || slug.includes("moving") || slug.includes("bollinger") || slug.includes("vwap") || slug.includes("stochastic");
  if (!showChart) return null;
  const data = generateDemoChart(slug);
  const isOscillator = slug.includes("rsi") || slug.includes("stochastic");

  return (
    <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/50 p-4">
      <p className="mb-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Concept Visualization (Demo Data)</p>
      {isOscillator ? (
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-[10px] text-zinc-600">Price</p>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
                <XAxis hide />
                <YAxis hide domain={["auto", "auto"]} />
                <Line type="monotone" dataKey="price" stroke="#6366f1" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="mb-1 text-[10px] text-zinc-600">{slug.includes("rsi") ? "RSI" : "Stochastic"}</p>
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                <XAxis hide />
                <YAxis hide domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }} formatter={(v: unknown) => [(typeof v === "number" ? v.toFixed(1) : String(v)), slug.includes("rsi") ? "RSI" : "Stochastic"]} />
                <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 2" />
                <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="3 2" />
                <Line type="monotone" dataKey="indicator" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-1 flex justify-between text-[9px] text-zinc-600">
              <span style={{ color: "#ef4444" }}>Overbought (70)</span>
              <span style={{ color: "#22c55e" }}>Oversold (30)</span>
            </div>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
            <XAxis dataKey="day" tick={{ fill: "#52525b", fontSize: 10 }} />
            <YAxis tick={{ fill: "#52525b", fontSize: 10 }} width={40} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }} />
            <Line type="monotone" dataKey="price" stroke="#6366f1" strokeWidth={2} dot={false} name="Price" />
            {data[0]?.indicator !== undefined && (
              <Line type="monotone" dataKey="indicator" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name={slug.includes("macd") ? "MACD" : "MA"} />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
      <p className="mt-2 text-[9px] text-zinc-700">Demo visualization only — not real market data</p>
    </div>
  );
}

function ArticleView({
  article,
  onBack,
  onNavigate,
  animate = false,
}: {
  article: Article;
  onBack: () => void;
  onNavigate: (slug: string, title?: string) => void;
  animate?: boolean;
}) {
  const c = article.content;
  const catColor = categoryColor(article.category);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-xs text-zinc-500">
        <button onClick={onBack} className="hover:text-zinc-300 transition-colors">Archive</button>
        <span>/</span>
        <span style={{ color: catColor }}>{article.category}</span>
        <span>/</span>
        <span className="text-zinc-300 truncate">{article.title}</span>
      </div>

      <div className="flex gap-6">
        {/* Main content */}
        <div className="min-w-0 flex-1 space-y-6">
          {/* Header */}
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <CategoryBadge category={article.category} />
              {article.is_prebuilt ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  Verified Content
                </span>
              ) : article.source === "wikipedia" ? (
                <a
                  href={article.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400 hover:bg-blue-500/20 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Icon name="globe" size={10} /> Wikipedia source
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                  Always verify with official sources
                </span>
              )}
              {article.view_count > 0 && (
                <span className="text-[10px] text-zinc-600">{article.view_count.toLocaleString()} views</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-zinc-50 leading-tight">{article.title}</h1>
            <p className="mt-2 text-sm text-zinc-300 leading-relaxed">{article.summary}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(article.tags ?? []).map((tag) => (
                <span key={tag} className="rounded-full bg-zinc-800/60 px-2 py-0.5 text-[10px] text-zinc-500">{tag}</span>
              ))}
            </div>
          </div>

          {/* Demo Chart */}
          <DemoChart slug={article.slug} />

          {/* Definition */}
          {c.definition && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">Definition</h2>
              <p className="text-sm text-zinc-300 leading-relaxed">
                {animate ? <TypewriterText text={c.definition} startDelay={0} /> : c.definition}
              </p>
            </section>
          )}

          {/* How It Works */}
          {c.howItWorks && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">How It Works</h2>
              <p className="text-sm text-zinc-300 leading-relaxed">
                {animate ? <TypewriterText text={c.howItWorks} startDelay={600} /> : c.howItWorks}
              </p>
            </section>
          )}

          {/* Key Components */}
          {c.keyComponents?.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Key Components</h2>
              <ul className="space-y-2">
                {c.keyComponents.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <span className="mt-0.5 shrink-0 text-[var(--accent-color)]">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Trading Application */}
          {c.tradingApplication && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">Trading Application</h2>
              <p className="text-sm text-zinc-300 leading-relaxed">
                {animate ? <TypewriterText text={c.tradingApplication} startDelay={1200} /> : c.tradingApplication}
              </p>
            </section>
          )}

          {/* Example */}
          {c.example && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Real-World Example</h2>
              <div className="border-l-4 border-amber-500 bg-amber-500/5 pl-4 py-3 rounded-r-xl">
                <p className="text-sm text-zinc-200 leading-relaxed">
                  {animate ? <TypewriterText text={c.example} startDelay={1800} /> : c.example}
                </p>
              </div>
            </section>
          )}

          {/* Advantages / Disadvantages */}
          <div className="grid gap-4 sm:grid-cols-2">
            {c.advantages?.length > 0 && (
              <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-emerald-400">Advantages</h2>
                <ul className="space-y-1.5">
                  {c.advantages.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                      <span className="mt-0.5 shrink-0 text-emerald-400">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {c.disadvantages?.length > 0 && (
              <section className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-red-400">Disadvantages</h2>
                <ul className="space-y-1.5">
                  {c.disadvantages.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                      <span className="mt-0.5 shrink-0 text-red-400">✗</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Common Mistakes */}
          {c.commonMistakes?.length > 0 && (
            <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400"><Icon name="alert-triangle" size={12} /> Common Mistakes</h2>
              <ul className="space-y-1.5">
                {c.commonMistakes.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                    <span className="mt-0.5 shrink-0 text-amber-400">!</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Broker Note */}
          {c.brokerNote && (
            <section className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
              <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-400"><Icon name="landmark" size={12} /> Broker Note</h2>
              <p className="text-xs text-zinc-300 leading-relaxed">{c.brokerNote}</p>
            </section>
          )}

          {/* Regulatory Note */}
          {c.regulatoryNote && (
            <section className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
              <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-purple-400"><Icon name="scale" size={12} /> Regulatory Note</h2>
              <p className="text-xs text-zinc-300 leading-relaxed">{c.regulatoryNote}</p>
            </section>
          )}

          {/* Pro Tip */}
          {c.proTip && (
            <section className="rounded-xl border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/5 p-4">
              <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--accent-color)]"><Icon name="zap" size={12} /> Pro Tip</h2>
              <p className="text-sm text-zinc-200 leading-relaxed">
                {animate ? <TypewriterText text={c.proTip} startDelay={2400} /> : c.proTip}
              </p>
            </section>
          )}

          {/* Real books + videos */}
          <ResourcesPanel title={article.title} />
        </div>

        {/* Right sidebar */}
        <aside className="hidden w-64 shrink-0 space-y-5 xl:block">
          {/* Related Terms */}
          {article.related_terms?.length > 0 && (
            <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/50 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Related Terms</h3>
              <ul className="space-y-1.5">
                {article.related_terms.slice(0, 5).map((term) => {
                  const prebuilt = PREBUILT_TERMS.find((t) => t.title.toLowerCase() === term.toLowerCase() || t.slug === slugify(term));
                  return (
                    <li key={term}>
                      <button
                        onClick={() => onNavigate(prebuilt?.slug ?? slugify(term), term)}
                        className="w-full text-left text-xs text-zinc-400 hover:text-[var(--accent-color)] transition-colors py-1"
                      >
                        → {term}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* In This Category */}
          <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/50 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">In This Category</h3>
            <ul className="space-y-1.5">
              {PREBUILT_TERMS.filter((t) => t.category === article.category && t.slug !== article.slug)
                .slice(0, 5)
                .map((t) => (
                  <li key={t.slug}>
                    <button
                      onClick={() => onNavigate(t.slug, t.title)}
                      className="w-full text-left text-xs text-zinc-400 hover:text-[var(--accent-color)] transition-colors py-1"
                    >
                      → {t.title}
                    </button>
                  </li>
                ))}
            </ul>
          </div>

          {/* Quick Reference */}
          <QuickReference slug={article.slug} category={article.category} />

          {/* Try It */}
          <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/50 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Try It</h3>
            <div className="space-y-2">
              <a href="/backtest" className="flex items-center gap-2 rounded-lg bg-zinc-800/60 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700/60 transition-colors">
                <Icon name="bar-chart" size={12} /> Backtest this strategy →
              </a>
              <a href="/screener" className="flex items-center gap-2 rounded-lg bg-zinc-800/60 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700/60 transition-colors">
                <Icon name="search" size={12} /> Screen for this →
              </a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function QuickReference({ slug, category }: { slug: string; category: string }) {
  const refs: { label: string; value: string }[] = [];

  if (slug.includes("rsi")) {
    refs.push({ label: "Overbought", value: "> 70" }, { label: "Oversold", value: "< 30" }, { label: "Period", value: "14 days (default)" }, { label: "Formula", value: "100 - 100/(1+RS)" });
  } else if (slug.includes("macd")) {
    refs.push({ label: "Fast EMA", value: "12 periods" }, { label: "Slow EMA", value: "26 periods" }, { label: "Signal", value: "9-period EMA" }, { label: "Bullish", value: "MACD crosses above signal" });
  } else if (slug.includes("bollinger")) {
    refs.push({ label: "Middle Band", value: "20-day SMA" }, { label: "Upper Band", value: "SMA + 2σ" }, { label: "Lower Band", value: "SMA − 2σ" }, { label: "Squeeze", value: "Bands < 10% width" });
  } else if (slug.includes("pe-ratio")) {
    refs.push({ label: "S&P 500 avg", value: "~17×" }, { label: "Value", value: "< 15×" }, { label: "Growth", value: "25–40×" }, { label: "Formula", value: "Price ÷ EPS" });
  } else if (slug.includes("sharpe")) {
    refs.push({ label: "Excellent", value: "> 2.0" }, { label: "Good", value: "1.0–2.0" }, { label: "Acceptable", value: "0.5–1.0" }, { label: "Formula", value: "(Rp−Rf) / σp" });
  } else if (slug.includes("risk-reward")) {
    refs.push({ label: "Minimum", value: "1:1.5" }, { label: "Good", value: "1:2" }, { label: "Excellent", value: "1:3+" }, { label: "Win rate needed @1:1", value: "> 50%" });
  } else if (category === "Options") {
    refs.push({ label: "Delta range", value: "0 to ±1" }, { label: "Theta", value: "Time decay / day" }, { label: "IV Rank", value: "0–100%" }, { label: "Break-even", value: "Strike ± premium" });
  }

  if (refs.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/50 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Quick Reference</h3>
      <dl className="space-y-2">
        {refs.map((r) => (
          <div key={r.label} className="flex justify-between gap-2">
            <dt className="text-[10px] text-zinc-500">{r.label}</dt>
            <dd className="text-[10px] font-mono font-semibold text-zinc-200">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─── Resources Panel ──────────────────────────────────────────────────────────

function ResourcesPanel({ title }: { title: string }) {
  const [books, setBooks] = useState<ArchiveBook[]>([]);
  const [videos, setVideos] = useState<ArchiveVideo[]>([]);
  const [youtubeSearch, setYoutubeSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    fetch(`/api/archive/resources?term=${encodeURIComponent(title)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        setBooks(d.books ?? []);
        setVideos(d.videos ?? []);
        setYoutubeSearch(d.youtubeSearch ?? "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [title]);

  const hasContent = books.length > 0 || videos.length > 0;

  if (loading) {
    return (
      <div className="border-t border-white/5 pt-6 mt-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-4">Related Resources</p>
        <div className="flex gap-3">
          {[1,2,3].map((i) => <div key={i} className="h-24 w-32 shrink-0 animate-pulse rounded-xl bg-zinc-800/40" />)}
        </div>
      </div>
    );
  }

  if (!hasContent && !youtubeSearch) return null;

  return (
    <div className="border-t border-white/5 pt-6 mt-2 space-y-6">
      {/* Books */}
      {books.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Icon name="book-open" size={13} className="text-zinc-500" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Books</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {books.map((book, i) => (
              <a
                key={i}
                href={book.previewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col gap-2 rounded-xl border border-white/8 bg-white/[0.02] p-3 hover:border-white/15 hover:bg-white/[0.04] transition-all"
              >
                {book.thumbnail ? (
                  <img
                    src={book.thumbnail}
                    alt={book.title}
                    className="h-20 w-14 rounded object-cover shadow-md self-center"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="h-20 w-14 rounded bg-zinc-800 flex items-center justify-center self-center">
                    <Icon name="book-open" size={20} className="text-zinc-600" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-zinc-200 leading-snug line-clamp-2 group-hover:text-white">{book.title}</p>
                  {book.authors.length > 0 && (
                    <p className="text-[10px] text-zinc-600 mt-0.5 truncate">{book.authors[0]}{book.publishedDate ? ` · ${book.publishedDate}` : ""}</p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Videos */}
      {videos.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icon name="play" size={13} className="text-zinc-500" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Videos</p>
            </div>
            {youtubeSearch && (
              <a href={youtubeSearch} target="_blank" rel="noopener noreferrer" className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
                More on YouTube →
              </a>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {videos.map((vid) => (
              <a
                key={vid.id}
                href={vid.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3 hover:border-white/15 hover:bg-white/[0.04] transition-all"
              >
                <div className="relative shrink-0">
                  {vid.thumbnail ? (
                    <img src={vid.thumbnail} alt={vid.title} className="h-16 w-28 rounded-lg object-cover" />
                  ) : (
                    <div className="h-16 w-28 rounded-lg bg-zinc-800 flex items-center justify-center">
                      <Icon name="play" size={20} className="text-zinc-600" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Icon name="play" size={18} className="text-white" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-zinc-200 leading-snug line-clamp-2 group-hover:text-white">{vid.title}</p>
                  <p className="text-[10px] text-zinc-600 mt-1 truncate">{vid.channelTitle}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      ) : youtubeSearch ? (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Icon name="play" size={13} className="text-zinc-500" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Videos</p>
          </div>
          <a
            href={youtubeSearch}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-xs text-zinc-400 hover:border-white/15 hover:text-zinc-200 transition-all"
          >
            <Icon name="play" size={13} />
            Search YouTube for &ldquo;{title}&rdquo; tutorials →
          </a>
        </div>
      ) : null}
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function ArchiveView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null);
  const [generatingTerm, setGeneratingTerm] = useState<string | null>(null);
  const [articleReady, setArticleReady] = useState(false);
  const [justGenerated, setJustGenerated] = useState(false);
  const [offTopicTerm, setOffTopicTerm] = useState<string | null>(null);
  const [popularData, setPopularData] = useState<PopularData | null>(null);
  const [loadingPopular, setLoadingPopular] = useState(true);

  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(searchQuery, 300);
  const { recent, add: addRecent } = useRecentlyViewed();

  // Load popular on mount
  useEffect(() => {
    fetch("/api/archive/popular")
      .then((r) => r.json())
      .then((d) => { setPopularData(d); setLoadingPopular(false); })
      .catch(() => setLoadingPopular(false));
  }, []);

  // Search
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    fetch(`/api/archive/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((d) => {
        setSearchResults(d.results ?? []);
        setShowDropdown(true);
      })
      .catch(() => {});
  }, [debouncedQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const loadArticle = useCallback(async (slug: string, title?: string) => {
    setShowDropdown(false);
    setSearchQuery("");
    setCurrentArticle(null);

    const displayTerm = title ?? slug.replace(/-/g, " ");
    setGeneratingTerm(displayTerm);
    setArticleReady(false);
    setOffTopicTerm(null);

    const params = new URLSearchParams({ slug });
    if (title && !PREBUILT_TERMS.find((t) => t.slug === slug)) {
      params.set("term", title);
    }

    try {
      const fetchStart = Date.now();
      const res = await fetch(`/api/archive/article?${params}`);
      const elapsed = Date.now() - fetchStart;
      const data = await res.json() as { article?: Article; error?: string; message?: string };
      if (data.error === "off_topic") {
        setOffTopicTerm(displayTerm);
        setGeneratingTerm(null);
      } else if (data.article) {
        setArticleReady(true);
        setJustGenerated(elapsed > 1500); // generated fresh if took > 1.5s
        await new Promise((r) => setTimeout(r, 600));
        setCurrentArticle(data.article);
        addRecent(data.article.slug, data.article.title);
        setGeneratingTerm(null);
      } else {
        setGeneratingTerm(null);
      }
    } catch {
      setGeneratingTerm(null);
    }
  }, [addRecent]);

  const handleSearchSelect = useCallback((result: SearchResult) => {
    if (result.is_ai_suggestion) {
      loadArticle(result.slug, result.title);
    } else {
      loadArticle(result.slug, result.title);
    }
  }, [loadArticle]);

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    if (searchResults.length > 0 && !searchResults[0].is_ai_suggestion) {
      handleSearchSelect(searchResults[0]);
    } else {
      const slug = slugify(searchQuery);
      loadArticle(slug, searchQuery);
    }
  }, [searchQuery, searchResults, handleSearchSelect, loadArticle]);

  const handleBack = useCallback(() => {
    setCurrentArticle(null);
    setGeneratingTerm(null);
    setOffTopicTerm(null);
    setActiveCategory(null);
  }, []);

  // Filtered browse list
  const browseList = activeCategory
    ? PREBUILT_TERMS.filter((t) => t.category === activeCategory)
    : (popularData?.topArticles ?? []);

  const trendingTerms = (popularData?.topArticles ?? []).slice(0, 5);

  return (
    <div>
      {/* Search */}
      <div className="relative mb-8" ref={dropdownRef}>
        <form onSubmit={handleSearchSubmit}>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              ref={searchRef}
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              placeholder="Search any trading term, strategy, broker, or concept..."
              className="w-full rounded-2xl border border-zinc-700/50 bg-zinc-900/60 py-4 pl-12 pr-4 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all focus:border-[var(--accent-color)]/50 focus:bg-zinc-900"
            />
          </div>
        </form>

        {/* Search dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-white/10 bg-[var(--app-bg)] shadow-xl">
            {searchResults.map((result) => (
              <button
                key={result.slug}
                onClick={() => handleSearchSelect(result)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
              >
                <span className="mt-0.5 shrink-0" style={{ color: categoryColor(result.category) }}><Icon name={categoryIcon(result.category)} size={15} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-100">{result.title}</p>
                    {result.is_ai_suggestion && (
                      <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-400">AI Generate</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 truncate">{result.summary}</p>
                </div>
                <CategoryBadge category={result.category} size="xs" />
              </button>
            ))}
          </div>
        )}

        <p className="mt-2 text-xs text-zinc-500">
          Can&apos;t find what you&apos;re looking for?{" "}
          <button
            onClick={() => searchQuery && loadArticle(slugify(searchQuery), searchQuery)}
            className="text-[var(--accent-color)] hover:underline"
          >
            Our AI will generate it instantly →
          </button>
        </p>

        {/* Trending */}
        {trendingTerms.length > 0 && !searchQuery && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wide">Trending:</span>
            {trendingTerms.map((t) => (
              <button
                key={t.slug}
                onClick={() => loadArticle(t.slug, t.title)}
                className="rounded-full border border-zinc-700/50 bg-zinc-800/40 px-2.5 py-1 text-[11px] text-zinc-400 hover:border-[var(--accent-color)]/30 hover:text-zinc-200 transition-colors"
              >
                {t.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Article view or generating */}
      {generatingTerm ? (
        <GeneratingLoader term={generatingTerm} ready={articleReady} />
      ) : offTopicTerm ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 text-zinc-500"><Icon name="book-open" size={40} /></div>
          <p className="mb-2 text-base font-semibold text-zinc-100">Not a trading topic</p>
          <p className="mb-6 max-w-md text-sm text-zinc-500">
            &ldquo;{offTopicTerm}&rdquo; doesn&apos;t appear to be a trading or finance topic. The Archive covers trading strategies, indicators, brokers, order types, options, crypto, economic indicators, risk management, and regulations.
          </p>
          <button
            onClick={handleBack}
            className="rounded-xl border border-zinc-700/50 bg-zinc-800/40 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700/40 transition-colors"
          >
            ← Back to Archive
          </button>
        </div>
      ) : currentArticle ? (
        <ArticleView article={currentArticle} onBack={handleBack} onNavigate={loadArticle} animate={justGenerated} />
      ) : (
        <>
          {/* Category grid */}
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(popularData?.categoryCounts ?? ARCHIVE_CATEGORIES.map((c) => ({
              category: c.id, icon: c.icon, color: c.color,
              total: PREBUILT_TERMS.filter((t) => t.category === c.id).length,
              generated: 0,
            }))).map((cat) => (
              <button
                key={cat.category}
                onClick={() => setActiveCategory(activeCategory === cat.category ? null : cat.category)}
                className={`rounded-2xl border p-4 text-left transition-all duration-200 ${
                  activeCategory === cat.category
                    ? "border-[var(--accent-color)]/40 bg-[var(--accent-color)]/10"
                    : "border-white/10 bg-[var(--app-card-alt)] hover:border-white/20 hover:bg-white/5"
                }`}
              >
                <span style={{ color: cat.color }}><Icon name={cat.icon} size={20} /></span>
                <p className="mt-2 text-xs font-semibold text-zinc-200 leading-snug">{cat.category}</p>
                <p className="mt-0.5 text-[10px] text-zinc-600">{cat.total} articles</p>
              </button>
            ))}
          </div>

          {/* Featured — top viewed */}
          {!activeCategory && (popularData?.topArticles?.length ?? 0) > 0 && (
            <div className="mb-8">
              <h2 className="mb-4 text-sm font-semibold text-zinc-400 uppercase tracking-wide">Most Popular</h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {(popularData!.topArticles ?? []).slice(0, 5).map((a) => (
                  <button
                    key={a.slug}
                    onClick={() => loadArticle(a.slug, a.title)}
                    className="group w-56 shrink-0 rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-4 text-left transition-all hover:border-white/20 hover:bg-white/5"
                  >
                    <CategoryBadge category={a.category} size="xs" />
                    <p className="mt-2 text-sm font-semibold text-zinc-100 leading-snug group-hover:text-white">{a.title}</p>
                    <p className="mt-1 line-clamp-2 text-[10px] text-zinc-500">{a.summary}</p>
                    <p className="mt-3 text-[10px] font-medium text-[var(--accent-color)] opacity-0 group-hover:opacity-100 transition-opacity">Read →</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Browse */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
                {activeCategory ? activeCategory : "Browse All Topics"}
              </h2>
              {activeCategory && (
                <button onClick={() => setActiveCategory(null)} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                  Clear filter ×
                </button>
              )}
            </div>

            {loadingPopular && !activeCategory ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-40 animate-pulse rounded-2xl bg-zinc-800/40" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeCategory
                  ? browseList.map((t) => (
                      <ArticleCard
                        key={t.slug}
                        article={{
                          slug: t.slug,
                          title: t.title,
                          category: t.category,
                          summary: `Comprehensive guide to ${t.title}. Click to read.`,
                          tags: (t as { tags?: string[] }).tags ?? [],
                          is_prebuilt: true,
                          view_count: 0,
                        }}
                        onClick={() => loadArticle(t.slug, t.title)}
                      />
                    ))
                  : PREBUILT_TERMS.slice(0, 18).map((t) => (
                      <ArticleCard
                        key={t.slug}
                        article={{
                          slug: t.slug,
                          title: t.title,
                          category: t.category,
                          summary: `Comprehensive guide to ${t.title}. Click to generate a full article.`,
                          tags: t.tags,
                          is_prebuilt: true,
                          view_count: 0,
                        }}
                        onClick={() => loadArticle(t.slug, t.title)}
                      />
                    ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Recently Viewed */}
      {recent.length > 0 && !generatingTerm && (
        <div className="mt-10 border-t border-zinc-800/60 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">Recently viewed:</span>
            {recent.map((r) => (
              <button
                key={r.slug}
                onClick={() => loadArticle(r.slug, r.title)}
                className="rounded-full border border-zinc-700/50 bg-zinc-800/30 px-2.5 py-1 text-[11px] text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 transition-colors"
              >
                {r.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
