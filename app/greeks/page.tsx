"use client";

import dynamic from "next/dynamic";

const GreeksView = dynamic(() => import("./GreeksView"), {
  ssr: false,
  loading: () => (
    <div className="animate-pulse space-y-6 px-2 py-3">
      <div className="h-10 w-72 rounded-lg bg-white/5" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-white/5" />
        ))}
      </div>
      <div className="h-[400px] rounded-2xl bg-white/5" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-64 rounded-2xl bg-white/5" />
        ))}
      </div>
    </div>
  ),
});

export default function GreeksPage() {
  return (
    <div className="min-h-screen app-page">
      <div className="mx-auto max-w-7xl px-2 py-3 sm:px-4 lg:px-6">
        <div className="mb-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--accent-color)]/80">
            Derivatives Intelligence
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">Greeks & Options</h1>
          <p className="mt-1 text-xs text-zinc-400">
            Full options chain with computed greeks, volatility surfaces, gamma/delta exposure, and flow analysis.
          </p>
        </div>
        <div className="relative">
          {/* Blurred preview */}
          <div className="pointer-events-none select-none blur-[6px] opacity-60" aria-hidden>
            <GreeksView />
          </div>
          {/* Coming soon overlay */}
          <div className="absolute inset-0 z-10 flex items-start justify-center pt-32">
            <div className="rounded-2xl border border-white/10 bg-[var(--app-card)]/95 backdrop-blur-md px-10 py-8 text-center shadow-2xl">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-color)]/10">
                <svg className="h-6 w-6 text-[var(--accent-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-zinc-50">Coming Soon</h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">
                Greeks & Derivatives Intelligence is currently in development. Full options chain, volatility surfaces, GEX/DEX exposure, and macro vol dashboard launching soon.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
