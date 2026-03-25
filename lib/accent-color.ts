/**
 * Accent color theme: stored in localStorage, applied via CSS var --accent-color.
 * Only available to logged-in users; default is QuantivTrade Green.
 */

export const ACCENT_STORAGE_KEY = "quantivtrade-accent-color";
export const DEFAULT_ACCENT = "#00C896";

export type AccentOption = { id: string; name: string; hex: string };

export const ACCENT_OPTIONS: AccentOption[] = [
  { id: "green", name: "QuantivTrade Green", hex: "#00C896" },
  { id: "blue", name: "Ocean Blue", hex: "#3B82F6" },
  { id: "purple", name: "Royal Purple", hex: "#8B5CF6" },
  { id: "pink", name: "Rose Pink", hex: "#EC4899" },
  { id: "amber", name: "Amber Orange", hex: "#F59E0B" },
  { id: "red", name: "Trading Red", hex: "#EF4444" },
  { id: "cyan", name: "Sky Cyan", hex: "#06B6D4" },
  { id: "platinum", name: "Platinum", hex: "#94A3B8" },
  { id: "gold", name: "Gold", hex: "#EAB308" },
  { id: "white", name: "Arctic White", hex: "#F1F5F9" },
];

export function getStoredAccent(): string {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  const raw = window.localStorage.getItem(ACCENT_STORAGE_KEY);
  if (!raw || !raw.startsWith("#")) return DEFAULT_ACCENT;
  return raw;
}

export function setStoredAccent(hex: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCENT_STORAGE_KEY, hex);
}
