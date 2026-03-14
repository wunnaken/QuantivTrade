"use client";

import Link from "next/link";
import { useAuth } from "./AuthContext";
import { MarketTickerBar } from "./MarketTickerBar";
import { XchangeLogo } from "./XchangeLogo";

export function LandingNavbar() {
  const { user } = useAuth();
  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur transition-colors duration-300"
      style={{
        backgroundColor: "var(--app-navbar-bg)",
        borderColor: "var(--app-navbar-border)",
        color: "var(--app-navbar-text)",
      }}
      role="banner"
    >
      <nav
        className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4.5 lg:px-8"
        aria-label="Main navigation"
      >
        <div className="flex shrink-0 items-center gap-4">
          <XchangeLogo />
        </div>
        <div className="min-w-0 flex-1">
          <MarketTickerBar />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {user ? (
            <Link
              href="/profile"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-zinc-300 transition hover:border-[var(--accent-color)]/50 hover:bg-white/5 hover:text-[var(--accent-color)]"
              style={{ borderColor: "var(--app-border)" }}
              aria-label="User menu"
              title="Profile"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
          ) : (
            <>
              <Link
                href="/auth/sign-in"
                className="rounded-full border px-4 py-1.5 text-sm font-medium transition hover:opacity-90"
                style={{ borderColor: "var(--app-border)", color: "var(--app-navbar-text)" }}
              >
                Sign In
              </Link>
              <Link
                href="/auth/sign-up"
                className="rounded-full bg-[var(--accent-color)] px-4 py-1.5 text-sm font-semibold text-[#020308] transition hover:bg-[var(--accent-color)]/90"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
