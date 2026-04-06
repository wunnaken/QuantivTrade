"use client";

import { useRouter } from "next/navigation";
import type { SubscriptionTier } from "@/hooks/useSubscription";
import { TIER_LABELS, TIER_COLORS, TIER_BG } from "@/hooks/useSubscription";

const TIER_PRICES: Record<SubscriptionTier, string> = {
  free: "Free",
  verified: "$9/mo",
  starter: "$19/mo",
  pro: "$29/mo",
  elite: "$89/mo",
};

const TIER_FEATURES: Record<SubscriptionTier, string[]> = {
  free: [],
  verified: ["Verified Trader badge", "Enhanced profile", "Priority support"],
  starter: ["Full maps & news", "25 watchlist items", "10 backtests/day", "Verified Trader badge"],
  pro: ["Everything in Starter", "Host trade rooms", "Sell on Marketplace", "Unlimited backtests"],
  elite: ["Everything in Pro", "Auto-verified", "25% Marketplace discount", "API access", "Priority onboarding"],
};

export function UpgradeModal({
  open,
  feature,
  requiredTier,
  onClose,
}: {
  open: boolean;
  feature: string;
  requiredTier: SubscriptionTier;
  onClose: () => void;
}) {
  const router = useRouter();

  if (!open) return null;

  const handleUpgrade = () => {
    onClose();
    router.push("/pricing");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0A0E1A] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-color)]/10 text-[var(--accent-color)]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <span className="text-sm font-semibold text-zinc-100">Upgrade Required</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="mb-1 text-sm text-zinc-300">
            <span className="font-semibold text-zinc-100">{feature}</span> requires the{" "}
            <span className={`font-bold ${TIER_COLORS[requiredTier]}`}>{TIER_LABELS[requiredTier]}</span> plan.
          </p>
          <p className="mb-4 text-xs text-zinc-500">Unlock this and more starting at {TIER_PRICES[requiredTier]}.</p>

          {/* Features list */}
          <div className={`mb-4 rounded-xl border border-white/10 p-3 ${TIER_BG[requiredTier]}`}>
            <p className={`mb-2 text-[10px] font-bold uppercase tracking-widest ${TIER_COLORS[requiredTier]}`}>
              {TIER_LABELS[requiredTier]} — {TIER_PRICES[requiredTier]}
            </p>
            <ul className="space-y-1">
              {TIER_FEATURES[requiredTier].map((f) => (
                <li key={f} className="flex items-center gap-1.5 text-xs text-zinc-300">
                  <svg className="h-3 w-3 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={handleUpgrade}
            className="w-full rounded-xl bg-[var(--accent-color)] py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            View Plans
          </button>
          <button
            onClick={onClose}
            className="mt-2 w-full rounded-xl py-2 text-xs text-zinc-600 hover:text-zinc-400 transition"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
