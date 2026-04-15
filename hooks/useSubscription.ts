"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/components/AuthContext";

export type SubscriptionTier = "free" | "verified" | "starter" | "pro" | "elite";

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  verified: 1,
  starter: 2,
  pro: 3,
  elite: 4,
};

export interface UpgradeModalState {
  open: boolean;
  feature: string;
  requiredTier: SubscriptionTier;
}

export function useSubscription() {
  const { user } = useAuth();
  const tier = ((user as any)?.subscription_tier as SubscriptionTier) ?? "free";
  const status: string = (user as any)?.subscription_status ?? "free";

  const [upgradeModal, setUpgradeModal] = useState<UpgradeModalState>({
    open: false,
    feature: "",
    requiredTier: "starter",
  });

  const isActive = status === "active" || status === "free";
  const isVerified = TIER_RANK[tier] >= TIER_RANK["verified"];

  // Returns true if the user's current tier meets or exceeds the required tier
  const canAccess = useCallback(
    (requiredTier: SubscriptionTier): boolean => {
      if (user?.isFounder) return true;
      if (!isActive && tier !== "free") return false;
      return TIER_RANK[tier] >= TIER_RANK[requiredTier];
    },
    [tier, isActive, user]
  );

  const openUpgradeModal = useCallback(
    (feature: string, requiredTier: SubscriptionTier) => {
      setUpgradeModal({ open: true, feature, requiredTier });
    },
    []
  );

  const closeUpgradeModal = useCallback(() => {
    setUpgradeModal((s) => ({ ...s, open: false }));
  }, []);

  return {
    tier,
    status,
    isVerified,
    canAccess,
    upgradeModal,
    openUpgradeModal,
    closeUpgradeModal,
  };
}

// Tier display helpers
export const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: "Free",
  verified: "Verified",
  starter: "Starter",
  pro: "Pro",
  elite: "Elite",
};

export const TIER_COLORS: Record<SubscriptionTier, string> = {
  free: "text-zinc-400",
  verified: "text-blue-400",
  starter: "text-emerald-400",
  pro: "text-[var(--accent-color)]",
  elite: "text-amber-400",
};

export const TIER_BG: Record<SubscriptionTier, string> = {
  free: "bg-zinc-700/30",
  verified: "bg-blue-500/20",
  starter: "bg-emerald-500/20",
  pro: "bg-[var(--accent-color)]/20",
  elite: "bg-amber-500/20",
};
