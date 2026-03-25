"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QuantivTradeLogoImage } from "./XchangeLogoImage";
import { getCachedBriefing, setCachedBriefing, clearCachedBriefing } from "../lib/briefing";
import {
  hasPreferences,
  type BriefingPreferences,
} from "../lib/briefing-preferences";
import { BriefingPreferencesForm } from "./BriefingPreferencesForm";

const BG = "#0A0E1A";

export type BriefingData = {
  headline: string;
  marketMood: string;
  moodColor: "green" | "red" | "yellow";
  overview: string;
  topStories: { title: string; impact: string; detail: string }[];
  watchlist: { asset: string; reason: string }[];
  keyLevels: { asset: string; level: string; significance: string }[];
  geopolitical: string;
  tradersEdge: string;
  oneLiner: string;
};

const LOADING_LINES = [
  "Scanning global markets...",
  "Reading overnight news...",
  "Analyzing geopolitical events...",
  "Preparing your briefing...",
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function getMarketsStatus(): { text: string } {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay();
  if (day === 0 || day === 6) return { text: "Markets closed" };
  const hours = et.getHours();
  const mins = et.getMinutes();
  const totalMins = hours * 60 + mins;
  const openMins = 9 * 60 + 30;
  const closeMins = 16 * 60;
  if (totalMins >= openMins && totalMins < closeMins) return { text: "Markets are open" };
  if (totalMins < openMins) {
    const diff = openMins - totalMins;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return { text: `Markets open in ${h}h ${m}m` };
  }
  return { text: "Markets closed" };
}

function formatBriefingTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function MorningBriefing({
  skipAnimation = false,
  onClose,
  cachedFetchedAt,
  isPremium = false,
  preferences = null,
  onPreferencesSaved,
}: {
  skipAnimation?: boolean;
  onClose: () => void;
  cachedFetchedAt?: string | null;
  isPremium?: boolean;
  /** Pass loaded preferences from the parent (DB-backed). */
  preferences?: BriefingPreferences | null;
  /** Called after the user saves preferences inside the briefing. */
  onPreferencesSaved?: (prefs: BriefingPreferences) => void;
}) {
  const router = useRouter();
  const needsSetup = isPremium && !hasPreferences(preferences);
  const [phase, setPhase] = useState<number | "loading" | "prefs" | "content">(() => {
    if (skipAnimation) return "loading";
    if (needsSetup) return "prefs";
    return 1;
  });
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loadingLineIndex, setLoadingLineIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(cachedFetchedAt ?? null);
  const [showPrefsEdit, setShowPrefsEdit] = useState(false);
  // Local copy of prefs so edits inside briefing reflect immediately
  const [activePrefs, setActivePrefs] = useState<BriefingPreferences | null>(preferences ?? null);
  const progressRef = useRef<HTMLDivElement>(null);

  const fetchBriefing = useCallback(async (forceRefresh = false, overridePrefs?: BriefingPreferences | null) => {
    if (!forceRefresh) {
      const cached = getCachedBriefing();
      if (cached?.data && typeof cached.data === "object" && "headline" in cached.data) {
        setBriefing(cached.data as BriefingData);
        setFetchedAt(cached.fetchedAt);
        setPhase("content");
        return;
      }
    } else {
      clearCachedBriefing();
    }
    try {
      const prefs = overridePrefs !== undefined ? overridePrefs : activePrefs;
      const usePrefs = isPremium && hasPreferences(prefs) ? prefs : null;
      const res = await fetch("/api/morning-briefing", {
        method: usePrefs ? "POST" : "GET",
        credentials: "include",
        cache: "no-store",
        ...(usePrefs
          ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preferences: usePrefs }) }
          : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Failed to load briefing");
        setPhase("content");
        return;
      }
      setBriefing(data);
      setFetchedAt(new Date().toISOString());
      setCachedBriefing(data);
      setPhase("content");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load briefing");
      setPhase("content");
    }
  }, [isPremium, activePrefs]);

  useLayoutEffect(() => {
    if (skipAnimation && typeof window !== "undefined") {
      const cached = getCachedBriefing();
      if (cached?.data && typeof cached.data === "object" && "headline" in cached.data) {
        setPhase("content");
        setBriefing(cached.data as BriefingData);
        setFetchedAt(cached.fetchedAt);
        return;
      }
    }
  }, [skipAnimation]);

  useEffect(() => {
    if (phase === "prefs") return;
    if (skipAnimation) {
      const cached = getCachedBriefing();
      if (cached?.data && typeof cached.data === "object" && "headline" in cached.data) return;
      fetchBriefing();
      return;
    }
    fetchBriefing();
    const t = setTimeout(() => setPhase(3), 1500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipAnimation, phase]);

  useEffect(() => {
    if (phase !== "loading" && phase !== 3) return;
    const id = setInterval(() => setLoadingLineIndex((i) => (i + 1) % LOADING_LINES.length), 500);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "loading" && phase !== 3) return;
    const el = progressRef.current;
    if (!el) return;
    const start = Date.now();
    const duration = 400;
    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(1, elapsed / duration);
      el.style.width = `${p * 100}%`;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [phase]);

  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const markets = getMarketsStatus();
  const greeting = getGreeting();

  // Preferences setup screen
  if (phase === "prefs") {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden" style={{ backgroundColor: BG }} aria-live="polite">
        <div className="flex-1 overflow-y-auto">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0A0E1A]/95 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
              <QuantivTradeLogoImage size={36} />
              <span className="font-semibold text-zinc-100">Morning Briefing</span>
            </div>
            <button type="button" onClick={onClose} className="rounded p-2 text-zinc-400 hover:bg-white/10 hover:text-zinc-200" aria-label="Close">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </header>
          <div className="mx-auto max-w-2xl px-4 py-10">
            <h1 className="text-2xl font-bold text-zinc-100">Personalize Your Briefing</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Tell us about your trading preferences and we&apos;ll tailor every morning briefing to what matters most to you.
            </p>
            <div className="mt-8">
              <BriefingPreferencesForm
                initialPrefs={activePrefs}
                onSave={(saved) => {
                  setActivePrefs(saved);
                  onPreferencesSaved?.(saved);
                  setPhase("loading");
                  fetchBriefing(true, saved);
                }}
                onCancel={() => {
                  setPhase("loading");
                  fetchBriefing();
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Content screen
  if (phase === "content" && (briefing || error)) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden" style={{ backgroundColor: BG }} aria-live="polite">
        <div className="flex-1 overflow-y-auto">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0A0E1A]/95 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
              <QuantivTradeLogoImage size={36} />
              <span className="font-semibold text-zinc-100">Morning Briefing</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-zinc-500 sm:block">{dateStr}</span>
              {fetchedAt && <span className="text-xs text-zinc-500">Updated {formatBriefingTime(fetchedAt)}</span>}
              {isPremium && (
                <button
                  type="button"
                  onClick={() => setShowPrefsEdit((v) => !v)}
                  className="rounded p-2 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                  aria-label="Edit briefing preferences"
                  title="Personalize briefing"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}
              <button type="button" onClick={onClose} className="rounded p-2 text-zinc-400 hover:bg-white/10 hover:text-zinc-200" aria-label="Close">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </header>

          {showPrefsEdit && (
            <div className="border-b border-white/10 bg-[#0F1520] px-4 py-6">
              <div className="mx-auto max-w-2xl">
                <h3 className="mb-4 text-sm font-semibold text-zinc-200">Edit Briefing Preferences</h3>
                <BriefingPreferencesForm
                  compact
                  initialPrefs={activePrefs}
                  onSave={(saved) => {
                    setActivePrefs(saved);
                    onPreferencesSaved?.(saved);
                    setShowPrefsEdit(false);
                    clearCachedBriefing();
                    setBriefing(null);
                    setError(null);
                    setPhase("loading");
                    fetchBriefing(true, saved);
                  }}
                  onCancel={() => setShowPrefsEdit(false)}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="mx-auto max-w-2xl px-4 py-12 text-center">
              <p className="text-zinc-400">{error}</p>
              <button type="button" onClick={() => { setError(null); setPhase("loading"); fetchBriefing(true); }} className="mt-4 rounded-lg bg-[var(--accent-color)] px-4 py-2 text-sm font-medium text-[#020308]">
                Retry
              </button>
            </div>
          )}

          {briefing && !error && (
            <div className="mx-auto max-w-3xl px-4 py-8" style={{ animation: "briefing-content-slide-up 0.5s ease-out" }}>
              <div className={`mb-6 rounded-lg px-6 py-4 ${briefing.moodColor === "green" ? "bg-gradient-to-r from-emerald-600/30 to-emerald-500/20" : briefing.moodColor === "red" ? "bg-gradient-to-r from-red-600/30 to-red-500/20" : "bg-gradient-to-r from-amber-600/30 to-amber-500/20"}`}>
                <p className="text-2xl font-bold text-white">{briefing.marketMood}</p>
              </div>

              <h1 className="mb-6 text-center text-2xl font-bold md:text-3xl" style={{ color: "var(--accent-color)" }}>
                {briefing.headline}
              </h1>

              <p className="mx-auto mb-10 max-w-[700px] text-center text-zinc-300 leading-relaxed">{briefing.overview}</p>

              <section className="mb-10">
                <h2 className="mb-4 text-lg font-semibold text-zinc-100">Top Stories</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  {briefing.topStories?.slice(0, 3).map((s, i) => (
                    <div key={i} className={`rounded-xl border-l-4 bg-[#0F1520] p-4 ${s.impact === "Bullish" ? "border-emerald-500" : s.impact === "Bearish" ? "border-red-500" : "border-zinc-500"}`}>
                      <span className={`text-xs font-medium ${s.impact === "Bullish" ? "text-emerald-400" : s.impact === "Bearish" ? "text-red-400" : "text-zinc-400"}`}>{s.impact}</span>
                      <p className="mt-1 font-medium text-zinc-200">{s.title}</p>
                      <p className="mt-2 text-sm text-zinc-500">{s.detail}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-lg font-semibold text-zinc-100">Assets to Watch Today</h2>
                <div className="flex flex-wrap gap-3">
                  {briefing.watchlist?.slice(0, 4).map((w, i) => (
                    <div key={i} className="rounded-xl bg-[#0F1520] px-4 py-3">
                      <span className="font-mono text-sm font-medium text-[var(--accent-color)]">{w.asset}</span>
                      <p className="mt-1 text-sm text-zinc-400">{w.reason}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-lg font-semibold text-zinc-100">Key Levels</h2>
                <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0F1520]">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-zinc-400">
                        <th className="p-3 font-medium">Asset</th>
                        <th className="p-3 font-medium">Level</th>
                        <th className="p-3 font-medium">Why it matters</th>
                      </tr>
                    </thead>
                    <tbody>
                      {briefing.keyLevels?.slice(0, 3).map((k, i) => (
                        <tr key={i} className="border-b border-white/5">
                          <td className="p-3 font-mono text-zinc-200">{k.asset}</td>
                          <td className="p-3 text-zinc-300">{k.level}</td>
                          <td className="p-3 text-zinc-500">{k.significance}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="mb-10">
                <h2 className="mb-2 text-lg font-semibold text-zinc-100">Geopolitical Pulse</h2>
                <div className="rounded-xl border border-white/10 bg-[#0F1520] p-4">
                  <p className="text-zinc-300">{briefing.geopolitical}</p>
                </div>
              </section>

              <section className="mb-10">
                <div className="rounded-xl p-[2px]" style={{ background: "linear-gradient(to right, var(--accent-color), rgba(245,158,11,0.8))" }}>
                  <div className="rounded-[10px] bg-[#0F1520] p-4">
                    <div className="text-lg font-semibold text-zinc-100">Trader&apos;s Edge</div>
                    <p className="mt-2 text-zinc-300">{briefing.tradersEdge}</p>
                  </div>
                </div>
              </section>

              <p className="text-center italic text-zinc-500">&ldquo;{briefing.oneLiner}&rdquo;</p>

              <footer className="mt-12 flex flex-col items-center gap-4 border-t border-white/10 pt-8">
                <p className="text-center text-xs text-zinc-500">AI-generated briefing based on current market data. Not financial advice.</p>
                <Link
                  href="/feed"
                  onClick={(e) => { e.preventDefault(); onClose(); router.push("/feed"); }}
                  className="rounded-full bg-[var(--accent-color)] px-6 py-2.5 font-semibold text-[#020308] transition-opacity hover:opacity-90"
                >
                  Enter QuantivTrade →
                </Link>
              </footer>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Intro / loading screens (no skip button)
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden" style={{ backgroundColor: BG }} aria-live="polite" aria-label="Morning Briefing">
      {phase === 1 && (
        <div className="flex w-full flex-col items-center px-6 transition-opacity duration-300 ease-out">
          <div className="absolute left-6 top-6">
            <QuantivTradeLogoImage size={44} />
          </div>
          <p className="text-4xl font-bold text-zinc-100 md:text-5xl">{greeting}</p>
          <p className="mt-2 text-xl text-zinc-400">{dateStr}</p>
          <p className="mt-1 text-lg text-[var(--accent-color)]">{markets.text}</p>
        </div>
      )}
      {(phase === 3 || phase === "loading") && (
        <div className="flex flex-col items-center justify-center gap-6 px-6">
          <div className="flex h-20 w-20 items-center justify-center" style={{ animation: "briefing-logo-spin 3s linear infinite" }}>
            <QuantivTradeLogoImage size={80} />
          </div>
          <p className="min-h-[2rem] text-center text-lg text-zinc-300">{LOADING_LINES[loadingLineIndex]}</p>
          <div className="h-1 w-64 overflow-hidden rounded-full bg-white/10">
            <div ref={progressRef} className="h-full rounded-full transition-[width] duration-300 ease-out" style={{ width: "0%", backgroundColor: "var(--accent-color)" }} />
          </div>
        </div>
      )}
    </div>
  );
}
