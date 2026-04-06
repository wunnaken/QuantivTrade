"use client";

import dynamic from "next/dynamic";

const MarketplaceView = dynamic(() => import("./MarketplaceView"), {
  ssr: false,
  loading: () => (
    <div className="animate-pulse space-y-6 px-2 py-3">
      <div className="h-20 rounded-2xl bg-white/5" />
      <div className="flex gap-2">
        {[...Array(6)].map((_, i) => <div key={i} className="h-9 w-28 rounded-xl bg-white/5" />)}
      </div>
      <div className="h-10 rounded-xl bg-white/5" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(9)].map((_, i) => <div key={i} className="h-56 rounded-2xl bg-white/5" />)}
      </div>
    </div>
  ),
});

export default function MarketplacePage() {
  return (
    <div className="min-h-screen app-page">
      <div className="mx-auto max-w-7xl px-2 py-3 sm:px-4 lg:px-6">
        <div className="mb-6">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--accent-color)]/80">
            Creator Economy
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">Marketplace</h1>
          <p className="mt-1 text-xs text-zinc-400">
            Buy and sell chart presets, trading strategies, indicators, courses, and signal services. All verified by Quantiv.
          </p>
        </div>
        <MarketplaceView />
      </div>
    </div>
  );
}
