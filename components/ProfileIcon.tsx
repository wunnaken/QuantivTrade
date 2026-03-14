"use client";

import Link from "next/link";
import { useAuth } from "./AuthContext";

export function ProfileIcon() {
  const { user } = useAuth();
  const href = user ? "/profile" : "/auth/sign-in";
  const label = user ? "User menu" : "Sign in";

  return (
    <div className="relative group">
      <Link
        href={href}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-zinc-300 transition hover:border-[#11c60f]/50 hover:bg-white/5 hover:text-[#11c60f]"
        aria-label={label}
        title={label}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </Link>
      <div className="invisible absolute right-0 top-full z-50 pt-1 opacity-0 transition group-hover:visible group-hover:opacity-100">
        <div className="min-w-[140px] rounded-lg border border-white/10 bg-[#0A0E1A] py-1 shadow-xl">
        <Link
          href={href}
          className="block px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-[#11c60f]"
        >
          {user ? "Profile" : "Sign in"}
        </Link>
        <Link
          href="/plans"
          className="block px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-[#11c60f]"
        >
          Plans
        </Link>
        </div>
      </div>
    </div>
  );
}
