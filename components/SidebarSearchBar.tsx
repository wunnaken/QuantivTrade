"use client";

import Link from "next/link";

export function SidebarSearchBar() {
  return (
    <Link
      href="/search"
      className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-left text-sm text-zinc-500 transition-colors hover:border-[var(--accent-color)]/30 hover:bg-white/10 hover:text-zinc-300 focus:border-[var(--accent-color)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]/50"
      aria-label="Search any stock, crypto, forex"
    >
      <svg className="h-4 w-4 flex-shrink-0 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <span className="truncate">Search any stock, crypto, forex...</span>
    </Link>
  );
}
