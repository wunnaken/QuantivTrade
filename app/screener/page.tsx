"use client";

import dynamic from "next/dynamic";

const ScreenerView = dynamic(() => import("./ScreenerView"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-white/10 bg-[#050713] text-sm text-zinc-500">
      Loading screener...
    </div>
  ),
});

export default function ScreenerPage() {
  return (
    <div className="flex min-h-screen flex-col app-page">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 sm:px-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--accent-color)]/80">
          Analytics
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
          Stock Screener
        </h1>
        <p className="mt-1 text-xs text-zinc-400">
          Filter stocks by fundamentals, technicals, and performance.
        </p>
      </div>
      {/* Screener — fills remaining height, no outer horizontal scroll */}
      <div className="flex min-h-0 flex-1 overflow-hidden px-4 pb-4 sm:px-6">
        <ScreenerView />
      </div>
    </div>
  );
}
