/**
 * Profile bubbles/badges: selectable tags for trading style and interests.
 * Users can select up to 8 total. Stored in localStorage for now (DB later).
 */

export type BubbleCategory = "trading_style" | "risk_appetite" | "interests" | "experience";

export type ProfileBubble = {
  id: string;
  emoji: string;
  label: string;
  category: BubbleCategory;
};

export const BUBBLE_CATEGORIES: { key: BubbleCategory; label: string }[] = [
  { key: "trading_style", label: "Trading Style" },
  { key: "risk_appetite", label: "Risk Appetite" },
  { key: "interests", label: "Interests" },
  { key: "experience", label: "Experience" },
];

export const ALL_PROFILE_BUBBLES: ProfileBubble[] = [
  { id: "long_term", emoji: "📈", label: "Long Term Investor", category: "trading_style" },
  { id: "active_trader", emoji: "⚡", label: "Active Trader", category: "trading_style" },
  { id: "swing_trader", emoji: "🎯", label: "Swing Trader", category: "trading_style" },
  { id: "day_trader", emoji: "📊", label: "Day Trader", category: "trading_style" },
  { id: "passive_investor", emoji: "🧘", label: "Passive Investor", category: "trading_style" },
  { id: "buy_hold", emoji: "💎", label: "Buy & Hold", category: "trading_style" },
  { id: "high_risk", emoji: "🔥", label: "High Risk High Reward", category: "risk_appetite" },
  { id: "balanced", emoji: "⚖️", label: "Balanced Approach", category: "risk_appetite" },
  { id: "capital_preservation", emoji: "🛡️", label: "Capital Preservation", category: "risk_appetite" },
  { id: "aggressive_growth", emoji: "🚀", label: "Aggressive Growth", category: "risk_appetite" },
  { id: "open_dms", emoji: "💬", label: "Open to DMs", category: "interests" },
  { id: "talking_groups", emoji: "👥", label: "Talking in Groups", category: "interests" },
  { id: "sharing_ideas", emoji: "💡", label: "Sharing Trade Ideas", category: "interests" },
  { id: "following_news", emoji: "📰", label: "Following the News", category: "interests" },
  { id: "macro_focused", emoji: "🗺️", label: "Macro Focused", category: "interests" },
  { id: "crypto_native", emoji: "🪙", label: "Crypto Native", category: "interests" },
  { id: "short_seller", emoji: "📉", label: "Short Seller", category: "interests" },
  { id: "fundamental", emoji: "🏦", label: "Fundamental Analyst", category: "interests" },
  { id: "technical", emoji: "📐", label: "Technical Analyst", category: "interests" },
  { id: "global_markets", emoji: "🌍", label: "Global Markets", category: "interests" },
  { id: "new_investing", emoji: "🌱", label: "New to Investing", category: "experience" },
  { id: "self_taught", emoji: "📚", label: "Self Taught", category: "experience" },
  { id: "finance_background", emoji: "🎓", label: "Finance Background", category: "experience" },
];

export const MAX_SELECTED_BUBBLES = 6;
const STORAGE_KEY = "quantivtrade-profile-bubbles";

export function getSelectedBubbleIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const ids = parsed.filter((x): x is string => typeof x === "string");
    return ids.slice(0, MAX_SELECTED_BUBBLES);
  } catch {
    return [];
  }
}

export function setSelectedBubbleIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  const valid = ids.slice(0, MAX_SELECTED_BUBBLES);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
}

export function getBubblesById(ids: string[]): ProfileBubble[] {
  const set = new Set(ids);
  return ALL_PROFILE_BUBBLES.filter((b) => set.has(b.id));
}
