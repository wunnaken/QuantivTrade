"use client";

import { STREAK_BADGES } from "../lib/engagement/constants";
import type { StreakData } from "../lib/engagement/streaks";

const STREAK_CONFIG = [
  { key: "login" as const, emoji: "🔥", label: "Login Streak", streak: (d: StreakData) => d.loginStreak, best: (d: StreakData) => d.bestLoginStreak, history: (d: StreakData) => d.loginHistory },
  { key: "journal" as const, emoji: "📓", label: "Journal Streak", streak: (d: StreakData) => d.journalStreak, best: (d: StreakData) => d.bestJournalStreak, history: (d: StreakData) => d.journalHistory },
  { key: "briefing" as const, emoji: "📋", label: "Briefing Streak", streak: (d: StreakData) => d.briefingStreak, best: (d: StreakData) => d.bestBriefingStreak, history: (d: StreakData) => d.briefingHistory },
];

export function StreakDetailModal({ data, onClose }: { data: StreakData; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="streak-modal-title">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[var(--app-card)] p-6 shadow-xl">
        <h2 id="streak-modal-title" className="text-lg font-semibold text-zinc-100">Your Streaks</h2>
        <p className="mt-1 text-xs text-zinc-500">Consecutive days. Keep it going!</p>
        <div className="mt-4 space-y-4">
          {STREAK_CONFIG.map(({ emoji, label, streak, best, history }) => {
            const s = streak(data);
            const b = best(data);
            const hist = history(data);
            const badge = s >= 365 ? STREAK_BADGES[365] : s >= 100 ? STREAK_BADGES[100] : s >= 30 ? STREAK_BADGES[30] : s >= 7 ? STREAK_BADGES[7] : null;
            return (
              <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center gap-2">
                  <span aria-hidden>{emoji}</span>
                  <span className="text-sm font-medium text-zinc-200">{label}</span>
                </div>
                <p className="mt-1 text-2xl font-bold text-[var(--accent-color)]">{s} day{s !== 1 ? "s" : ""}</p>
                <div className="mt-2 flex gap-1">
                  {hist.map((active, i) => (
                    <span
                      key={i}
                      className={`h-2 w-2 rounded-full ${active ? "bg-[var(--accent-color)]" : "bg-zinc-600"}`}
                      title={active ? "Active" : "Missed"}
                    />
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-zinc-500">Best streak: {b} days</p>
                {badge && (
                  <p className="mt-0.5 text-xs font-medium text-amber-400">{badge}</p>
                )}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-full border border-white/15 py-2 text-sm font-medium text-zinc-300 hover:bg-white/5"
        >
          Close
        </button>
      </div>
    </div>
  );
}
