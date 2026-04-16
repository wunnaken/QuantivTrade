"use client";

import dynamic from "next/dynamic";

const MarketRatesView = dynamic(() => import("./MarketRatesView"), {
  ssr: false,
  loading: () => (
    <div className="relative flex min-h-[520px] items-center justify-center rounded-2xl border border-white/10 bg-[var(--app-card-alt)] text-sm text-zinc-500">
      Loading market rates...
    </div>
  ),
});

export default function MarketRatesPage() {
  return (
    <div className="min-h-screen app-page">
      <div className="mx-auto max-w-7xl px-2 py-3 sm:px-4 lg:px-6">
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--accent-color)]/80">
            Construction &amp; Energy
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
            Building &amp; Gas
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Live mortgage rates, building material prices, gas prices, and construction sector performance.
          </p>
        </div>
        <MarketRatesView />
      </div>
    </div>
  );
}
