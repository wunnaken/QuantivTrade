"use client";
import dynamic from "next/dynamic";

const FuturesView = dynamic(() => import("./FuturesView"), {
  ssr: false,
  loading: () => (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-16 rounded-2xl bg-white/5" />
      <div className="h-10 rounded-xl bg-white/5" />
      <div className="h-96 rounded-2xl bg-white/5" />
    </div>
  ),
});

export default function FuturesPage() {
  return (
    <div className="min-h-screen app-page">
      <div className="mx-auto max-w-7xl px-2 py-3 sm:px-4 lg:px-6">
        <div className="mb-5">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--accent-color)]/80">Derivatives Markets</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">Futures</h1>
          <p className="mt-1 text-xs text-zinc-400">
            Live futures prices, term structure, and institutional positioning across all major markets.
          </p>
        </div>
        <FuturesView />
      </div>
    </div>
  );
}
