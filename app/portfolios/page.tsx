"use client";
import dynamic from "next/dynamic";

const PortfoliosView = dynamic(() => import("./PortfoliosView"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[400px] items-center justify-center text-sm text-zinc-500">
      Loading Portfolios…
    </div>
  ),
});

export default function PortfoliosPage() {
  return (
    <div className="min-h-screen app-page">
      <div className="mx-auto max-w-7xl px-2 py-3 sm:px-4 lg:px-6">
        <div className="mb-5">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--accent-color)]/80">Portfolio Intelligence</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">Portfolios</h1>
          <p className="mt-1 text-xs text-zinc-400">
            Track thematic investment themes and famous investor positions updated from SEC filings.
          </p>
        </div>
        <PortfoliosView />
      </div>
    </div>
  );
}
