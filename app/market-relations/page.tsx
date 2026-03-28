"use client";

import dynamic from "next/dynamic";

const MarketRelationsView = dynamic(() => import("./MarketRelationsView"), {
  ssr: false,
  loading: () => (
    <div className="animate-pulse space-y-6 px-2 py-3">
      <div className="h-16 rounded-xl bg-white/5" />
      <div className="h-10 w-64 rounded-lg bg-white/5" />
      <div className="h-[520px] rounded-2xl bg-white/5" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-48 rounded-2xl bg-white/5" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-40 rounded-2xl bg-white/5" />
        ))}
      </div>
    </div>
  ),
});

export default function MarketRelationsPage() {
  return (
    <div className="min-h-screen app-page">
      <div className="mx-auto max-w-7xl px-2 py-3 sm:px-4 lg:px-6">
        <div className="mb-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--accent-color)]/80">
            Cross-Asset Intelligence
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">Market Relations</h1>
          <p className="mt-1 text-xs text-zinc-400">
            Discover how global markets, metals, bonds, and currencies move together — and find the surprising
            connections most traders miss.
          </p>
        </div>
        <MarketRelationsView />
      </div>
    </div>
  );
}
