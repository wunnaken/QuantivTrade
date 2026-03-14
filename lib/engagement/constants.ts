/** Streak milestone badges */
export const STREAK_BADGES: Record<number, string> = {
  7: "Week Warrior",
  30: "Monthly Master",
  100: "Century Trader",
  365: "Legend",
};

/** XP thresholds for rank titles */
export const XP_RANKS: { min: number; title: string }[] = [
  { min: 10000, title: "Market Legend" },
  { min: 5000, title: "Elite Trader" },
  { min: 2500, title: "Market Expert" },
  { min: 1000, title: "Senior Trader" },
  { min: 500, title: "Market Analyst" },
  { min: 100, title: "Active Trader" },
  { min: 0, title: "Market Observer" },
];

export function getRankTitle(xp: number): string {
  for (const r of XP_RANKS) {
    if (xp >= r.min) return r.title;
  }
  return "Market Observer";
}

/** XP gains (localStorage-based) */
export const XP_GAIN = {
  tradeLogged: 10,
  streakDay: 5,
  post: 15,
  reaction: 2,
} as const;
