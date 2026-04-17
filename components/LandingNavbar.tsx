"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import { MarketTickerBar } from "./MarketTickerBar";
import { QuantivTradeLogo } from "./QuantivTradeLogo";
import type { User } from "../types";

function getInitials(user: User) {
  const name = (user.name || user.username || user.email || "?").trim();
  if (!name) return "?";
  const parts = name.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function LandingNavbar() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

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
        className="flex w-full items-center gap-4 px-6 py-4.5 lg:px-8"
        aria-label="Main navigation"
      >
        <div className="flex shrink-0 items-center gap-4">
          <QuantivTradeLogo />
        </div>
        <div className="min-w-0 flex-1">
          <MarketTickerBar />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {user ? (
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((o) => !o)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-zinc-300 transition hover:border-[var(--accent-color)]/50 hover:bg-white/5 hover:text-[var(--accent-color)]"
                aria-label="User menu"
                aria-expanded={profileOpen}
                aria-haspopup="true"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
              {profileOpen && (
                <div
                  className="absolute right-0 top-full z-50 mt-1 min-w-[240px] animate-[fadeIn_0.15s_ease-out] rounded-xl border border-white/10 py-2 shadow-xl"
                  style={{ backgroundColor: "var(--app-card)" }}
                  role="menu"
                >
                  {/* User info + badges */}
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-[var(--accent-color)]">
                        {getInitials(user)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-100">{user.name || "Trader"}</p>
                        <p className="truncate text-xs text-zinc-500">@{user.username?.trim() || "trader"}</p>
                      </div>
                    </div>
                    {(() => {
                      const tier = (user as any)?.subscription_tier as string | undefined;
                      const TIER_STYLES: Record<string, string> = {
                        verified: "text-blue-400 border-blue-500/30 bg-blue-500/10",
                        starter:  "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
                        pro:      "text-[var(--accent-color)] border-[var(--accent-color)]/30 bg-[var(--accent-color)]/10",
                        elite:    "text-amber-400 border-amber-400/30 bg-amber-400/10",
                      };
                      const TIER_LABELS: Record<string, string> = { verified: "Verified Plan", starter: "Starter", pro: "Pro", elite: "Elite" };
                      const showTier = tier && tier !== "free" && TIER_STYLES[tier];
                      if (!showTier && !user.isVerified && !user.isFounder) return null;
                      return (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {showTier && (
                            <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TIER_STYLES[tier!]}`}>
                              {TIER_LABELS[tier!] ?? tier}
                            </span>
                          )}
                          {user.isVerified && (
                            <span className="inline-flex items-center gap-0.5 rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-400">
                              <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Verified
                            </span>
                          )}
                          {user.isFounder && (
                            <span style={{
                              background: "linear-gradient(90deg,#92400e 0%,#d97706 25%,#fbbf24 45%,#fde68a 50%,#fbbf24 55%,#d97706 75%,#92400e 100%)",
                              backgroundSize: "200% auto",
                              WebkitBackgroundClip: "text",
                              backgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                              animation: "founder-shimmer 2.8s linear infinite",
                            }} className="inline-flex items-center rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                              Founder
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="my-2 h-px bg-white/10" />

                  <Link
                    href="/feed"
                    onClick={() => setProfileOpen(false)}
                    className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors duration-200 hover:bg-white/5 hover:text-[var(--accent-color)]"
                    role="menuitem"
                  >
                    <span className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    </span>
                    <span className="truncate transition-transform duration-150 group-hover:translate-x-0.5 group-hover:scale-105">Dashboard</span>
                  </Link>
                  <Link
                    href="/profile"
                    onClick={() => setProfileOpen(false)}
                    className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors duration-200 hover:bg-white/5 hover:text-[var(--accent-color)]"
                    role="menuitem"
                  >
                    <span className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 opacity-40 transition-transform transition-opacity duration-200 group-hover:opacity-100 group-hover:scale-125" />
                    </span>
                    <span className="truncate transition-transform duration-150 group-hover:translate-x-0.5 group-hover:scale-105">View Profile</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => { setProfileOpen(false); router.push("/settings"); }}
                    className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors duration-200 hover:bg-white/5 hover:text-[var(--accent-color)]"
                    role="menuitem"
                  >
                    <span className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 opacity-40 transition-transform transition-opacity duration-200 group-hover:opacity-100 group-hover:scale-125" />
                    </span>
                    <span className="truncate transition-transform duration-150 group-hover:translate-x-0.5 group-hover:scale-105">Settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setProfileOpen(false); router.push("/plans"); }}
                    className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors duration-200 hover:bg-white/5 hover:text-[var(--accent-color)]"
                    role="menuitem"
                  >
                    <span className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 opacity-40 transition-transform transition-opacity duration-200 group-hover:opacity-100 group-hover:scale-125" />
                    </span>
                    <span className="truncate transition-transform duration-150 group-hover:translate-x-0.5 group-hover:scale-105">Plans</span>
                  </button>

                  <div className="my-2 h-px bg-white/10" />

                  <div className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors duration-200 hover:bg-white/5">
                    <span className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 opacity-40 transition-transform transition-opacity duration-200 group-hover:opacity-100 group-hover:scale-125" />
                    </span>
                    <span className="truncate transition-transform duration-150 group-hover:translate-x-0.5 group-hover:scale-105">Appearance</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={theme === "light"}
                      aria-label="Toggle dark/light mode"
                      onClick={(e) => { e.preventDefault(); setTheme(theme === "dark" ? "light" : "dark"); }}
                      className="relative ml-auto h-6 w-11 flex-shrink-0 rounded-full transition-colors"
                      style={{ backgroundColor: theme === "dark" ? "#374151" : "var(--accent-color)" }}
                    >
                      <span
                        className="absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform"
                        style={{ transform: theme === "light" ? "translateX(20px)" : "translateX(0)" }}
                      />
                    </button>
                  </div>

                  <div className="my-2 h-px bg-white/10" />

                  <button
                    type="button"
                    onClick={() => { setProfileOpen(false); router.push("/feedback"); }}
                    className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors duration-200 hover:bg-white/5 hover:text-[var(--accent-color)]"
                    role="menuitem"
                  >
                    <span className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 opacity-40 transition-transform transition-opacity duration-200 group-hover:opacity-100 group-hover:scale-125" />
                    </span>
                    <span className="truncate transition-transform duration-150 group-hover:translate-x-0.5 group-hover:scale-105">Help Center</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setProfileOpen(false); router.push("/whats-new"); }}
                    className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors duration-200 hover:bg-white/5 hover:text-[var(--accent-color)]"
                    role="menuitem"
                  >
                    <span className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 opacity-40 transition-transform transition-opacity duration-200 group-hover:opacity-100 group-hover:scale-125" />
                    </span>
                    <span className="truncate transition-transform duration-150 group-hover:translate-x-0.5 group-hover:scale-105">What&apos;s New</span>
                  </button>

                  <div className="my-2 h-px bg-white/10" />

                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      signOut().catch(() => {});
                      window.location.href = "/";
                    }}
                    className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors duration-200 hover:bg-white/5 hover:text-red-400"
                    role="menuitem"
                  >
                    <span className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 opacity-40 transition-transform transition-opacity duration-200 group-hover:opacity-100 group-hover:scale-125" />
                    </span>
                    <span className="truncate transition-transform duration-150 group-hover:translate-x-0.5 group-hover:scale-105">Sign Out</span>
                  </button>
                </div>
              )}
            </div>
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
