"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";

const MENU_CLASS = "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors duration-200 hover:bg-white/5 hover:text-[var(--accent-color)]";
const DOT_CLASS = "h-1.5 w-1.5 rounded-full bg-zinc-500 opacity-40 transition-transform transition-opacity duration-200 group-hover:scale-125 group-hover:opacity-100 group-hover:bg-[var(--accent-color)]";
const DOT_SIGN_OUT = "h-1.5 w-1.5 rounded-full bg-zinc-500 opacity-40 transition-transform transition-opacity duration-200 group-hover:scale-125 group-hover:opacity-100 group-hover:bg-red-400";
const TEXT_CLASS = "truncate transition-transform duration-150 group-hover:translate-x-0.5 group-hover:scale-105";

const TIER_LABEL: Record<string, string> = {
  free: "Free",
  verified: "Verified",
  starter: "Starter",
  pro: "Pro",
  elite: "Elite",
};

const TIER_COLOR: Record<string, string> = {
  free: "text-zinc-400 border-zinc-600/40 bg-zinc-700/30",
  verified: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  starter: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  pro: "text-[var(--accent-color)] border-[var(--accent-color)]/30 bg-[var(--accent-color)]/10",
  elite: "text-amber-400 border-amber-400/30 bg-amber-400/10",
};

export function ProfileIcon() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const href = user ? "/profile" : "/auth/sign-in";
  const label = user ? "User menu" : "Sign in";
  const tier = (user as any)?.subscription_tier ?? "free";

  return (
    <div className="group relative overflow-visible">
      <Link
        href={href}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-zinc-300 transition hover:border-[var(--accent-color)]/50 hover:bg-white/5 hover:text-[var(--accent-color)]"
        aria-label={label}
        title={label}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </Link>

      <div className="invisible absolute right-0 top-full z-[100] pt-1 opacity-0 transition-[visibility,opacity] duration-150 group-hover:visible group-hover:opacity-100">
        <div className="min-w-[240px] rounded-xl border border-white/10 bg-[var(--app-card)] py-2 shadow-xl" role="menu">
          {user ? (
            <>
              {/* User info + badges */}
              <div className="px-4 py-2.5">
                <p className="truncate text-sm font-semibold text-zinc-100">{user.name || "Trader"}</p>
                <p className="truncate text-xs text-zinc-500">@{user.username?.trim() || "trader"}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {/* Subscription tier badge */}
                  {tier && tier !== "free" && (
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TIER_COLOR[tier] ?? TIER_COLOR.free}`}>
                      {TIER_LABEL[tier] ?? tier}
                    </span>
                  )}
                  {/* Verified badge */}
                  {user.isVerified && (
                    <span className="inline-flex items-center gap-0.5 rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-400">
                      <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Verified
                    </span>
                  )}
                  {/* Founder badge */}
                  {user.isFounder && (
                    <>
                      <style>{`
                        @keyframes dd-founder-shimmer {
                          0%   { background-position: -200% center; }
                          100% { background-position:  200% center; }
                        }
                        .dd-founder {
                          background: linear-gradient(90deg,#92400e 0%,#d97706 25%,#fbbf24 45%,#fde68a 50%,#fbbf24 55%,#d97706 75%,#92400e 100%);
                          background-size: 200% auto;
                          -webkit-background-clip: text;
                          background-clip: text;
                          -webkit-text-fill-color: transparent;
                          animation: dd-founder-shimmer 2.8s linear infinite;
                        }
                      `}</style>
                      <span className="dd-founder inline-flex items-center rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                        Founder
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="my-2 h-px bg-white/10" />

              <Link href="/profile" className={MENU_CLASS}>
                <span className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
                  <span className={DOT_CLASS} />
                </span>
                <span className={TEXT_CLASS}>View Profile</span>
              </Link>
              <Link href="/settings" className={MENU_CLASS}>
                <span className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
                  <span className={DOT_CLASS} />
                </span>
                <span className={TEXT_CLASS}>Settings</span>
              </Link>
              <Link href="/plans" className={MENU_CLASS}>
                <span className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
                  <span className={DOT_CLASS} />
                </span>
                <span className={TEXT_CLASS}>Plans</span>
              </Link>

              <div className="my-2 h-px bg-white/10" />

              <Link href="/feedback" className={MENU_CLASS}>
                <span className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
                  <span className={DOT_CLASS} />
                </span>
                <span className={TEXT_CLASS}>Help Center</span>
              </Link>
              <Link href="/whats-new" className={MENU_CLASS}>
                <span className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
                  <span className={DOT_CLASS} />
                </span>
                <span className={TEXT_CLASS}>
                  What&apos;s New
                  <span className="ml-1.5 rounded-full bg-[var(--accent-color)] px-1.5 py-0.5 text-[9px] font-bold text-[#020308]">NEW</span>
                </span>
              </Link>

              <div className="my-2 h-px bg-white/10" />

              <button
                type="button"
                onClick={async () => { await signOut(); window.location.href = "/"; }}
                className={`${MENU_CLASS} hover:text-red-400`}
              >
                <span className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
                  <span className={DOT_SIGN_OUT} />
                </span>
                <span className={TEXT_CLASS}>Sign Out</span>
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/sign-in" className={MENU_CLASS}>
                <span className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
                  <span className={DOT_CLASS} />
                </span>
                <span className={TEXT_CLASS}>Sign in</span>
              </Link>
              <Link href="/plans" className={MENU_CLASS}>
                <span className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
                  <span className={DOT_CLASS} />
                </span>
                <span className={TEXT_CLASS}>Plans</span>
              </Link>
              <div className="my-2 h-px bg-white/10" />
              <Link href="/feedback" className={MENU_CLASS}>
                <span className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
                  <span className={DOT_CLASS} />
                </span>
                <span className={TEXT_CLASS}>Help Center</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
