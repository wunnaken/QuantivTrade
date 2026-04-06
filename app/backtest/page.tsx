"use client";
import dynamic from "next/dynamic";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeModal } from "@/components/UpgradeModal";

const BacktestView = dynamic(() => import("./BacktestView"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[400px] items-center justify-center text-sm text-zinc-500">
      Loading Backtester…
    </div>
  ),
});

export default function BacktestPage() {
  const { canAccess, upgradeModal, openUpgradeModal, closeUpgradeModal } = useSubscription();
  const hasAccess = canAccess("starter");

  return (
    <div className="min-h-screen app-page">
      <UpgradeModal
        open={upgradeModal.open}
        feature={upgradeModal.feature}
        requiredTier={upgradeModal.requiredTier}
        onClose={closeUpgradeModal}
      />
      <div className="mx-auto max-w-7xl px-2 py-3 sm:px-4 lg:px-6">
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--accent-color)]/80">
            Quantitative Analysis
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
            Strategy Backtester
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Test any trading strategy against real historical data with institutional-grade analytics.
          </p>
        </div>
        {hasAccess ? (
          <BacktestView />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#050713] py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-color)]/10 text-[var(--accent-color)]">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </div>
            <p className="mb-1 text-base font-semibold text-zinc-200">Starter plan required</p>
            <p className="mb-5 max-w-xs text-sm text-zinc-500">Unlock full backtesting with up to 10 runs/day on the Starter plan.</p>
            <button
              onClick={() => openUpgradeModal("Backtesting Engine", "starter")}
              className="rounded-xl bg-[var(--accent-color)] px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Upgrade to Starter
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
