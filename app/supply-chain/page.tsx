"use client";

import dynamic from "next/dynamic";

const SupplyChainView = dynamic(() => import("./SupplyChainView"), {
  ssr: false,
  loading: () => (
    <div className="animate-pulse space-y-6 px-2 py-3">
      <div className="h-12 rounded-xl bg-white/5" />
      <div className="h-10 w-full max-w-lg rounded-xl bg-white/5" />
      <div className="flex gap-6">
        <div className="flex-1 space-y-4">
          <div className="h-64 rounded-2xl bg-white/5" />
          <div className="h-64 rounded-2xl bg-white/5" />
        </div>
        <div className="hidden w-72 shrink-0 xl:block">
          <div className="h-96 rounded-2xl bg-white/5" />
        </div>
      </div>
    </div>
  ),
});

export default function SupplyChainPage() {
  return (
    <div className="min-h-screen app-page">
      <div className="mx-auto max-w-7xl px-2 py-3 sm:px-4 lg:px-6">
        <div className="mb-6">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--accent-color)]/80">
            Leading Indicators
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">
            Supply Chain Intelligence
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Track the upstream signals that move markets before earnings reports and economic data catch up.
          </p>
        </div>
        <SupplyChainView />
      </div>
    </div>
  );
}
