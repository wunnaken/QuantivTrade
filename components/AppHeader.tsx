"use client";

import Link from "next/link";
import { useAuth } from "./AuthContext";
import { DemoInfoIcon } from "./DemoInfoIcon";
import { MarketTickerBar } from "./MarketTickerBar";
import { ProfileIcon } from "./ProfileIcon";
import { XchangeLogo } from "./XchangeLogo";

export function AppHeader() {
  const { user } = useAuth();
  return (
    <header
      className="border-b backdrop-blur transition-colors duration-300"
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
          <Link
            href="/feed"
            className="rounded-full border px-3 py-1.5 text-xs font-medium transition hover:border-[var(--accent-color)]/50 hover:bg-[var(--accent-color)]/10 hover:text-[var(--accent-color)]"
            style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-card)" }}
          >
            Feed
          </Link>
        </div>

        <MarketTickerBar />

        <div className="flex shrink-0 items-center gap-3">
          <DemoInfoIcon />
          <ProfileIcon />
          {!user && (
            <>
              <Link
                href="/auth/sign-in"
                className="rounded-full border px-4 py-1.5 text-sm font-medium transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 focus:ring-offset-2 focus:ring-offset-[var(--app-bg)]"
                style={{ borderColor: "var(--app-border)", color: "var(--app-navbar-text)" }}
              >
                Sign In
              </Link>
              <Link
                href="/auth/sign-up"
                className="rounded-full bg-[var(--accent-color)] px-4 py-1.5 text-sm font-semibold text-[#020308] shadow-lg shadow-[var(--accent-color)]/40 transition hover:bg-[var(--accent-color)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2 focus:ring-offset-[var(--app-bg)]"
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
