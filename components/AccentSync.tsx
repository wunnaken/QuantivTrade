"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthContext";
import { DEFAULT_ACCENT, getStoredAccent } from "../lib/accent-color";

function applyAccent(hex: string) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--accent-color", hex);
}

/**
 * When user is signed out or on a public page (landing, sign-in, sign-up, etc.),
 * uses default green so logo and name always show brand color. When signed in on app
 * pages, applies the user's stored accent.
 */
export function AccentSync() {
  const { user } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    const isPublic = pathname === "/" || pathname?.startsWith("/auth") || pathname === "/onboarding" || pathname === "/plans";
    if (!user || isPublic) {
      applyAccent(DEFAULT_ACCENT);
    } else {
      applyAccent(getStoredAccent());
    }
  }, [user, pathname]);

  return null;
}
