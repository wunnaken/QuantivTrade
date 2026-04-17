"use client";
import dynamic from "next/dynamic";
const DividendsView = dynamic(() => import("./DividendsView"), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      <div className="skeleton h-10 w-64 rounded-lg" />
      <div className="grid grid-cols-4 gap-3">
        {[0,1,2,3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
      </div>
      <div className="skeleton h-64 rounded-xl" />
      <div className="skeleton h-48 rounded-xl" />
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
