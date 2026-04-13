"use client";
import { useState } from "react";

export function SectionCard({
  title,
  icon,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="rounded-2xl border border-white/10 overflow-hidden"
      style={{ backgroundColor: "var(--app-card)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-[var(--accent-color)]">{icon}</span>}
          <span className="text-sm font-semibold text-zinc-100">{title}</span>
          {badge && (
            <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-[var(--accent-color)]/15 text-[var(--accent-color)]">
              {badge}
            </span>
          )}
        </div>
        <svg
          className="h-4 w-4 text-zinc-500 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}
