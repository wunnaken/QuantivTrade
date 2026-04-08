"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const PLANS_TAB_HIDDEN_KEY = "quantivtrade-plans-tab-hidden";
const PLANS_TAB_HIDDEN_AT_KEY = "quantivtrade-plans-tab-hidden-at";
const JUST_SIGNED_IN_KEY = "quantivtrade-just-signed-in";
const REAPPEAR_AFTER_MS = 60 * 60 * 1000; // 1 hour

/** Floating Plans tab — visible to everyone (guests and signed-in). Right side, re-shows after 1h if dismissed, and when a new account is created. */
export function PlansFloatingTab() {
  const { user } = useAuth();
  const [hidden, setHidden] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      const stored = window.localStorage.getItem(PLANS_TAB_HIDDEN_KEY);
      const hiddenAt = window.localStorage.getItem(PLANS_TAB_HIDDEN_AT_KEY);
      if (stored === "1") {
        const at = hiddenAt ? parseInt(hiddenAt, 10) : 0;
        if (Date.now() - at < REAPPEAR_AFTER_MS) {
          queueMicrotask(() => setHidden(true));
        } else {
          window.localStorage.removeItem(PLANS_TAB_HIDDEN_KEY);
          window.localStorage.removeItem(PLANS_TAB_HIDDEN_AT_KEY);
        }
      }
    } catch {}
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    if (!user) return;
    try {
      if (window.sessionStorage.getItem(JUST_SIGNED_IN_KEY) === "1") {
        window.sessionStorage.removeItem(JUST_SIGNED_IN_KEY);
        window.localStorage.removeItem(PLANS_TAB_HIDDEN_KEY);
        window.localStorage.removeItem(PLANS_TAB_HIDDEN_AT_KEY);
        queueMicrotask(() => setHidden(false));
      }
    } catch {}
  }, [user, mounted]);

  const hide = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(PLANS_TAB_HIDDEN_KEY, "1");
      window.localStorage.setItem(PLANS_TAB_HIDDEN_AT_KEY, String(Date.now()));
    } catch {}
  };

  if (hidden) {
    return null;
  }

  return (
    <div
      className="plans-tab-ping fixed right-0 top-1/2 z-[100] flex min-w-[72px] -translate-y-1/2 shrink-0 items-center justify-end gap-0.5 rounded-l-lg border-y border-l border-white/10 bg-[var(--app-card-alt)]/98 px-2.5 py-1.5 shadow-xl backdrop-blur"
      style={{ isolation: "isolate" }}
      role="complementary"
      aria-label="Plans"
    >
      <Link
        href="/plans"
        className="plans-text whitespace-nowrap text-[11px] font-medium uppercase tracking-wider transition"
      >
        Plans
      </Link>
      <button
        type="button"
        onClick={hide}
        className="rounded-full p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
        title="Hide Plans"
        aria-label="Hide Plans"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
