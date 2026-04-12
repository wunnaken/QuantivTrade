"use client";

import type React from "react";
import { STREAK_BADGES } from "../lib/engagement/constants";
import type { StreakData } from "../lib/engagement/streaks";

const STREAK_ICONS: Record<string, React.ReactNode> = {
  login: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.5-6.5C12 5 13 7 13 7s1.5-2.5 3-3c.5 2 1 4 1 5 0 2-.5 4-3 6a5 5 0 003 1.5 4 4 0 01-6 2c-1 0-2-.5-3-1.5" /></svg>,
  journal: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  briefing: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
};
const STREAK_CONFIG = [
  { key: "login" as const, label: "Login Streak", streak: (d: StreakData) => d.loginStreak, best: (d: StreakData) => d.bestLoginStreak, history: (d: StreakData) => d.loginHistory },
  { key: "journal" as const, label: "Journal Streak", streak: (d: StreakData) => d.journalStreak, best: (d: StreakData) => d.bestJournalStreak, history: (d: StreakData) => d.journalHistory },
  { key: "briefing" as const, label: "Briefing Streak", streak: (d: StreakData) => d.briefingStreak, best: (d: StreakData) => d.bestBriefingStreak, history: (d: StreakData) => d.briefingHistory },
];

export function StreakDetailModal({ data, onClose }: { data: StreakData; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="streak-modal-title">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[var(--app-card)] p-6 shadow-xl">
        <h2 id="streak-modal-title" className="text-lg font-semibold text-zinc-100">Your Streaks</h2>
        <p className="mt-1 text-xs text-zinc-500">Consecutive days. Keep it going!</p>
        <div className="mt-4 space-y-4">
          {STREAK_CONFIG.map(({ key, label, streak, best, history }) => {
            const s = streak(data);
            const b = best(data);
            const hist = history(data);
            const badge = s >= 365 ? STREAK_BADGES[365] : s >= 100 ? STREAK_BADGES[100] : s >= 30 ? STREAK_BADGES[30] : s >= 7 ? STREAK_BADGES[7] : null;
            return (
              <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center gap-2 text-[var(--accent-color)]">
                  <span aria-hidden>{STREAK_ICONS[key]}</span>
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
