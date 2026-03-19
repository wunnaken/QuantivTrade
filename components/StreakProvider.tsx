"use client";

import { useCallback, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import { loadStreaks, tickLoginStreak } from "../lib/engagement/streaks";
import { STREAK_BADGES } from "../lib/engagement/constants";

/** Call once on app load when user is logged in: tick login streak and show milestone celebration. */
export function useLoginStreakTick() {
  const { user } = useAuth();
  const toast = useToast();

  const tick = useCallback(() => {
    if (!user) return;
    const { data, milestone } = tickLoginStreak();
    if (milestone) {
      const label = STREAK_BADGES[milestone] ?? `${milestone} Day Streak`;
      toast.showToast(`🔥 ${milestone} Day Streak! You're on fire. Keep it up.`, "celebration");
      // Store that we showed this so we don't re-show on every load (only when they actually hit the milestone that day)
      try {
        window.sessionStorage.setItem(`xchange-streak-milestone-${milestone}`, String(data.lastLogin));
      } catch {
        // ignore
      }
    }
  }, [user, toast]);

  useEffect(() => {
    if (!user) return;
    tick();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- only on mount / user change
}
