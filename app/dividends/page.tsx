"use client";
import dynamic from "next/dynamic";
const DividendsView = dynamic(() => import("./DividendsView"), {
  ssr: false,
  loading: () => (
    <div className="relative flex min-h-[520px] items-center justify-center rounded-2xl border border-white/10 bg-[var(--app-card-alt)] text-sm text-zinc-500">
      Loading dividends...
    </div>
  ),
});
export default function DividendsPage() {
  return (
    <div className="min-h-screen app-page">
      <div className="mx-auto max-w-7xl px-2 py-3 sm:px-4 lg:px-6">
        <div className="mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent-color)]/80">Income</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">Dividends</h1>
          <p className="mt-1 text-xs text-zinc-400">Dividend calendar, aristocrats, income tools, ETF comparison, and more.</p>
        </div>
        <DividendsView />
      </div>
    </div>
  );
}
