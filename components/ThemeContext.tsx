"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DEFAULT_ACCENT, getStoredAccent, setStoredAccent } from "../lib/accent-color";
import { getStoredTheme, setStoredTheme, type Theme } from "../lib/theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  accentColor: string;
  setAccentColor: (hex: string) => void;
  previewAccentColor: (hex: string | null) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx)
    return {
      theme: "dark" as Theme,
      setTheme: () => {},
      accentColor: DEFAULT_ACCENT,
      setAccentColor: () => {},
      previewAccentColor: () => {},
    };
  return ctx;
}

function applyAccent(hex: string) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--accent-color", hex);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [accentColor, setAccentColorState] = useState<string>(DEFAULT_ACCENT);
  const [mounted, setMounted] = useState(false);
  const skipNextSync = useRef(true);

  useLayoutEffect(() => {
    const storedTheme = getStoredTheme();
    document.documentElement.setAttribute("data-theme", storedTheme);
    const storedAccent = getStoredAccent();
    applyAccent(storedAccent);
    queueMicrotask(() => {
      setThemeState(storedTheme);
      setAccentColorState(storedAccent);
      setMounted(true);
    });
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    document.documentElement.setAttribute("data-theme", theme);
    setStoredTheme(theme);
  }, [theme, mounted]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  const setAccentColor = useCallback((hex: string) => {
    setStoredAccent(hex);
    applyAccent(hex);
    setAccentColorState(hex);
  }, []);

  const previewAccentColor = useCallback((hex: string | null) => {
    if (hex) applyAccent(hex);
    else applyAccent(getStoredAccent());
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, accentColor, setAccentColor, previewAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
}
