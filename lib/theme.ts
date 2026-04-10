export const THEME_STORAGE_KEY = "quantivtrade-theme";
export type Theme = "dark" | "light";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch { /* ignore */ }
  return "dark";
}

export function setStoredTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    // Sync to Supabase (fire and forget)
    fetch("/api/profile/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ theme }),
    }).catch(() => {});
  } catch { /* ignore */ }
}

/** On login, load theme from DB and apply if different from local. */
export async function loadThemeFromDB(): Promise<Theme | null> {
  try {
    const res = await fetch("/api/profile/me", { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json() as { ui_preferences?: { theme?: string } };
    const dbTheme = data.ui_preferences?.theme;
    if (dbTheme === "light" || dbTheme === "dark") {
      window.localStorage.setItem(THEME_STORAGE_KEY, dbTheme);
      return dbTheme;
    }
  } catch { /* ignore */ }
  return null;
}
