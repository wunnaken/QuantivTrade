"use client";

import dynamic from "next/dynamic";

const ArchiveView = dynamic(() => import("./ArchiveView"), {
  ssr: false,
  loading: () => (
    <div className="animate-pulse space-y-6 px-2 py-3">
      <div className="h-14 rounded-2xl bg-white/5" />
      <div className="grid grid-cols-5 gap-3">
        {[...Array(10)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-white/5" />)}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <div key={i} className="h-40 rounded-2xl bg-white/5" />)}
      </div>
    </div>
  ),
});

export default function ArchivePage() {
  return (
    <div className="min-h-screen app-page">
      <div className="mx-auto max-w-7xl px-2 py-3 sm:px-4 lg:px-6">
        <div className="mb-6">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--accent-color)]/80">
            Knowledge Base
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">Trading Archive</h1>
          <p className="mt-1 text-xs text-zinc-400">
            The complete encyclopedia of trading — strategies, indicators, brokers, regulations, and more. Search anything not yet covered.
          </p>
        </div>
        <ArchiveView />
      </div>
    </div>
  );
}
