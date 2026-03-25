"use client";

import Link from "next/link";
import { useAuth } from "../../components/AuthContext";
import { SiteFooter } from "../../components/SiteFooter";

export default function AboutPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-zinc-200">
      {/* Section 1 — Hero */}
      <section className="px-4 py-20 text-center md:py-28">
        <h1 className="mx-auto max-w-4xl text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
          Built for traders who think before they trade
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
          QuantivTrade is the social trading intelligence platform combining real-time market data, AI-powered analysis, and a community of serious investors.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/auth/sign-up"
            className="rounded-full bg-[var(--accent-color)] px-6 py-3 text-base font-semibold text-[#020308] transition hover:opacity-90"
          >
            Get Started
          </Link>
          <Link
            href={user ? "/feed" : "/auth/sign-in"}
            className="rounded-full border border-white/20 px-6 py-3 text-base font-medium text-zinc-200 transition hover:border-[var(--accent-color)]/40 hover:bg-white/5"
          >
            View the Platform
          </Link>
        </div>
      </section>

      {/* Section 2 — The Problem We Solve */}
      <section className="border-t border-white/10 px-4 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold text-white md:text-3xl" style={{ color: "var(--accent-color)" }}>
            The Problem We Solve
          </h2>
          <div className="mt-12 grid gap-12 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 md:p-8">
              <h3 className="text-lg font-semibold text-zinc-300">The old way</h3>
              <ul className="mt-4 space-y-3 text-zinc-400">
                <li className="flex gap-3"><span className="text-red-400" aria-hidden>✕</span> Scattered across Bloomberg, Reddit, Twitter, and TradingView</li>
                <li className="flex gap-3"><span className="text-red-400" aria-hidden>✕</span> No single place for data AND community</li>
                <li className="flex gap-3"><span className="text-red-400" aria-hidden>✕</span> Generic advice not matched to your risk tolerance</li>
                <li className="flex gap-3"><span className="text-red-400" aria-hidden>✕</span> No way to verify if traders are legit</li>
                <li className="flex gap-3"><span className="text-red-400" aria-hidden>✕</span> Expensive professional tools or low quality free ones</li>
              </ul>
            </div>
            <div className="rounded-xl border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/5 p-6 md:p-8">
              <h3 className="text-lg font-semibold text-white" style={{ color: "var(--accent-color)" }}>The QuantivTrade way</h3>
              <ul className="mt-4 space-y-3 text-zinc-300">
                <li className="flex gap-3"><span className="text-[var(--accent-color)]" aria-hidden>✓</span> Everything in one platform</li>
                <li className="flex gap-3"><span className="text-[var(--accent-color)]" aria-hidden>✓</span> Social community meets institutional data</li>
                <li className="flex gap-3"><span className="text-[var(--accent-color)]" aria-hidden>✓</span> Personalized to your risk profile</li>
                <li className="flex gap-3"><span className="text-[var(--accent-color)]" aria-hidden>✓</span> Verified trader credibility system</li>
                <li className="flex gap-3"><span className="text-[var(--accent-color)]" aria-hidden>✓</span> Professional grade tools, accessible pricing</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3 — Core Features */}
      <section className="border-t border-white/10 px-4 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold text-white md:text-3xl" style={{ color: "var(--accent-color)" }}>
            Core Features
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-[#0F1520] p-6">
              <h3 className="font-semibold text-white">AI Market Intelligence</h3>
              <p className="mt-2 text-sm text-zinc-400">Search any stock, crypto or currency and get an instant AI-powered breakdown with risk rating, bull case, bear case and key factors to watch.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0F1520] p-6">
              <h3 className="font-semibold text-white">Interactive Macro Map</h3>
              <p className="mt-2 text-sm text-zinc-400">Click any country on our world map to see GDP, inflation, unemployment, political risk and the latest news. Switch between 10 data layers.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0F1520] p-6">
              <h3 className="font-semibold text-white">Smart Communities</h3>
              <p className="mt-2 text-sm text-zinc-400">Join focused trading rooms organized by asset class and strategy. Real discussions from real traders, not noise.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0F1520] p-6">
              <h3 className="font-semibold text-white">Trade Journal & Analytics</h3>
              <p className="mt-2 text-sm text-zinc-400">Log every trade, track your performance over time, and get AI coaching on your strengths, weaknesses and patterns.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0F1520] p-6">
              <h3 className="font-semibold text-white">CEO Intelligence</h3>
              <p className="mt-2 text-sm text-zinc-400">Track the leaders behind 100+ major companies. Get alerts on CEO changes, news, legal history and AI leadership assessment.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0F1520] p-6">
              <h3 className="font-semibold text-white">Prediction Markets</h3>
              <p className="mt-2 text-sm text-zinc-400">Put your market knowledge to the test. Trade on outcomes with virtual points and prove your edge on the leaderboard.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4 — For Every Type of Investor */}
      <section className="border-t border-white/10 px-4 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold text-white md:text-3xl" style={{ color: "var(--accent-color)" }}>
            For Every Type of Investor
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-[#0F1520] p-6">
              <h3 className="font-semibold text-white">Conservative / Beginner</h3>
              <p className="mt-2 text-sm text-zinc-400">New to investing? QuantivTrade explains what every indicator means in plain English. Your Conservative profile surfaces safe, long-term ideas matched to your goals.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0F1520] p-6">
              <h3 className="font-semibold text-white">Moderate / Intermediate</h3>
              <p className="mt-2 text-sm text-zinc-400">Following markets but want more? Get deeper data, community insights and a trade journal to track your growing portfolio.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0F1520] p-6">
              <h3 className="font-semibold text-white">Aggressive / Advanced</h3>
              <p className="mt-2 text-sm text-zinc-400">Serious traders get DataHub with options flow, insider trading, dark pool data and verified communities where real ideas get shared.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5 — Not Financial Advice Banner */}
      <section className="border-t border-white/10 px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-6 py-4 text-center">
            <p className="text-sm font-medium text-amber-200">
              QuantivTrade is an educational platform. Nothing on QuantivTrade is financial advice. Always do your own research and consult a qualified financial advisor.
            </p>
          </div>
        </div>
      </section>

      {/* Section 6 — The Numbers */}
      <section className="border-t border-white/10 px-4 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-[#0F1520] p-6 text-center">
              <p className="text-2xl font-bold text-white md:text-3xl" style={{ color: "var(--accent-color)" }}>12+</p>
              <p className="mt-1 text-sm text-zinc-400">Data Tools</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0F1520] p-6 text-center">
              <p className="text-2xl font-bold text-white md:text-3xl" style={{ color: "var(--accent-color)" }}>100+</p>
              <p className="mt-1 text-sm text-zinc-400">CEOs Tracked</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0F1520] p-6 text-center">
              <p className="text-2xl font-bold text-white md:text-3xl" style={{ color: "var(--accent-color)" }}>AI</p>
              <p className="mt-1 text-sm text-zinc-400">Powered Analysis</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0F1520] p-6 text-center">
              <p className="text-2xl font-bold text-white md:text-3xl" style={{ color: "var(--accent-color)" }}>Free</p>
              <p className="mt-1 text-sm text-zinc-400">to Start</p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 7 — CTA */}
      <section className="border-t border-white/10 bg-[#050B14] px-4 py-16 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-white md:text-3xl">
            Ready to think smarter about markets?
          </h2>
          <p className="mt-4 text-zinc-400">
            Join QuantivTrade today — free to get started
          </p>
          <Link
            href="/auth/sign-up"
            className="mt-8 inline-block rounded-full bg-[var(--accent-color)] px-8 py-4 text-lg font-semibold text-[#020308] transition hover:opacity-90"
          >
            Get Started
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
