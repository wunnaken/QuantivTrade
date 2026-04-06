"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { ARCHIVE_CATEGORIES, PREBUILT_TERMS, slugify } from "../../lib/archive-prebuilt";

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
  categoryCounts: { category: string; emoji: string; color: string; total: number; generated: number }[];
  totalTerms: number;
  totalGenerated: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const GENERATION_STEPS = [
  "Analyzing concept...",
  "Gathering trading context...",
  "Writing explanation...",
  "Adding examples...",
  "Done!",
];

function categoryColor(cat: string): string {
  return ARCHIVE_CATEGORIES.find((c) => c.id === cat)?.color ?? "#6366f1";
}

function categoryEmoji(cat: string): string {
  return ARCHIVE_CATEGORIES.find((c) => c.id === cat)?.emoji ?? "📄";
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
    try {
      const raw = localStorage.getItem("archive_recent");
      if (raw) setRecent(JSON.parse(raw));
    } catch {}
  }, []);

  const add = useCallback((slug: string, title: string) => {
    setRecent((prev) => {
      const filtered = prev.filter((r) => r.slug !== slug);
      const next = [{ slug, title }, ...filtered].slice(0, 10);
      try { localStorage.setItem("archive_recent", JSON.stringify(next)); } catch {}
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
  const emoji = categoryEmoji(category);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"}`}
      style={{ background: color + "20", color, border: `1px solid ${color}30` }}
    >
      <span>{emoji}</span>
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
      className="group w-full rounded-2xl border border-white/10 bg-[#050713] p-4 text-left transition-all duration-200 hover:border-white/20 hover:bg-white/5"
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

function GeneratingLoader({ term }: { term: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, GENERATION_STEPS.length - 1)), 1200);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-6 h-12 w-12 animate-spin rounded-full border-2 border-zinc-700 border-t-[var(--accent-color)]" />
      <p className="mb-2 text-base font-semibold text-zinc-100">Writing article about "{term}"</p>
      <p className="mb-6 text-xs text-zinc-500">Our AI is researching and writing this article · ~10 seconds</p>
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
}: {
  article: Article;
  onBack: () => void;
  onNavigate: (slug: string, title?: string) => void;
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
                  ✓ Verified Content
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                  ✦ AI Generated — always verify with official sources
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
              <p className="text-sm text-zinc-300 leading-relaxed">{c.definition}</p>
            </section>
          )}

          {/* How It Works */}
          {c.howItWorks && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">How It Works</h2>
              <p className="text-sm text-zinc-300 leading-relaxed">{c.howItWorks}</p>
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
              <p className="text-sm text-zinc-300 leading-relaxed">{c.tradingApplication}</p>
            </section>
          )}

          {/* Example */}
          {c.example && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Real-World Example</h2>
              <div className="border-l-4 border-amber-500 bg-amber-500/5 pl-4 py-3 rounded-r-xl">
                <p className="text-sm text-zinc-200 leading-relaxed">{c.example}</p>
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
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-400">⚠ Common Mistakes</h2>
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
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-400">🏦 Broker Note</h2>
              <p className="text-xs text-zinc-300 leading-relaxed">{c.brokerNote}</p>
            </section>
          )}

          {/* Regulatory Note */}
          {c.regulatoryNote && (
            <section className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-purple-400">⚖ Regulatory Note</h2>
              <p className="text-xs text-zinc-300 leading-relaxed">{c.regulatoryNote}</p>
            </section>
          )}

          {/* Pro Tip */}
          {c.proTip && (
            <section className="rounded-xl border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/5 p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent-color)]">🚀 Pro Tip</h2>
              <p className="text-sm text-zinc-200 leading-relaxed">{c.proTip}</p>
            </section>
          )}
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
              <a href="/backtest" className="block rounded-lg bg-zinc-800/60 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700/60 transition-colors">
                📊 Backtest this strategy →
              </a>
              <a href="/screener" className="block rounded-lg bg-zinc-800/60 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700/60 transition-colors">
                🔍 Screen for this →
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

// ─── Main View ────────────────────────────────────────────────────────────────

export default function ArchiveView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null);
  const [generatingTerm, setGeneratingTerm] = useState<string | null>(null);
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
    setOffTopicTerm(null);

    const params = new URLSearchParams({ slug });
    if (title && !PREBUILT_TERMS.find((t) => t.slug === slug)) {
      params.set("term", title);
    }

    try {
      const res = await fetch(`/api/archive/article?${params}`);
      const data = await res.json() as { article?: Article; error?: string; message?: string };
      if (data.error === "off_topic") {
        setOffTopicTerm(displayTerm);
      } else if (data.article) {
        setCurrentArticle(data.article);
        addRecent(data.article.slug, data.article.title);
      }
    } catch {}
    setGeneratingTerm(null);
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

  const trendingTerms = (popularData?.topArticles ?? []).slice(0, 8);

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
          <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#0A0E1A] shadow-xl">
            {searchResults.map((result) => (
              <button
                key={result.slug}
                onClick={() => handleSearchSelect(result)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
              >
                <span className="mt-0.5 shrink-0 text-base">{categoryEmoji(result.category)}</span>
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
        <GeneratingLoader term={generatingTerm} />
      ) : offTopicTerm ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 text-4xl">📚</div>
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
        <ArticleView article={currentArticle} onBack={handleBack} onNavigate={loadArticle} />
      ) : (
        <>
          {/* Category grid */}
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(popularData?.categoryCounts ?? ARCHIVE_CATEGORIES.map((c) => ({
              category: c.id, emoji: c.emoji, color: c.color,
              total: PREBUILT_TERMS.filter((t) => t.category === c.id).length,
              generated: 0,
            }))).map((cat) => (
              <button
                key={cat.category}
                onClick={() => setActiveCategory(activeCategory === cat.category ? null : cat.category)}
                className={`rounded-2xl border p-4 text-left transition-all duration-200 ${
                  activeCategory === cat.category
                    ? "border-[var(--accent-color)]/40 bg-[var(--accent-color)]/10"
                    : "border-white/10 bg-[#050713] hover:border-white/20 hover:bg-white/5"
                }`}
              >
                <span className="text-2xl">{cat.emoji}</span>
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
                {(popularData!.topArticles ?? []).slice(0, 6).map((a) => (
                  <button
                    key={a.slug}
                    onClick={() => loadArticle(a.slug, a.title)}
                    className="group w-56 shrink-0 rounded-2xl border border-white/10 bg-[#050713] p-4 text-left transition-all hover:border-white/20 hover:bg-white/5"
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
                {activeCategory ? `${categoryEmoji(activeCategory)} ${activeCategory}` : "Browse All Topics"}
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
