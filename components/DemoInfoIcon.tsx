"use client";

import { useState, useRef, useEffect } from "react";

const MESSAGE =
  "This app is in very early demo and prone to possible breaks and construction. Features and data may change.";

export function DemoInfoIcon() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-zinc-400 transition hover:border-white/25 hover:bg-white/5 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[#11c60f]/50 focus:ring-offset-2 focus:ring-offset-[var(--app-bg)]"
        aria-label="Demo info"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-white/10 bg-[var(--app-bg)] px-3 py-2.5 text-left text-xs text-zinc-300 shadow-xl"
        >
          <p>{MESSAGE}</p>
        </div>
      )}
    </div>
  );
}
