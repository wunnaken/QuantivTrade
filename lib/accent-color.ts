/**
 * Accent color theme: stored in localStorage (instant read) + synced to Supabase.
 * Apply via CSS var --accent-color.
 */

export const ACCENT_STORAGE_KEY = "quantivtrade-accent-color";
export const DEFAULT_ACCENT = "#e8846a";

export type AccentOption = { id: string; name: string; hex: string };

export const ACCENT_OPTIONS: AccentOption[] = [
  { id: "default", name: "Quantiv Salmon", hex: "#e8846a" },
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
  if (raw.toLowerCase() === "#4f9cf9") return DEFAULT_ACCENT; // migrate old default
  return raw;
}

export function setStoredAccent(hex: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCENT_STORAGE_KEY, hex);
  // Sync to Supabase (fire and forget)
  fetch("/api/profile/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ accent_color: hex }),
  }).catch(() => {});
}

/** On login, load accent from DB and apply if different from local. */
export async function loadAccentFromDB(): Promise<void> {
  try {
    const res = await fetch("/api/profile/me", { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json() as { ui_preferences?: { accent_color?: string } };
    const dbAccent = data.ui_preferences?.accent_color;
    if (dbAccent && /^#[0-9a-f]{6}$/i.test(dbAccent)) {
      window.localStorage.setItem(ACCENT_STORAGE_KEY, dbAccent);
    }
  } catch { /* ignore */ }
}
