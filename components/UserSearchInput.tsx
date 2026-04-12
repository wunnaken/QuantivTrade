"use client";

import type { InputHTMLAttributes } from "react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> {
  /** Wrap in a <form> that navigates to /people?q=... on submit (for nav-style search) */
  asNavForm?: boolean;
  /** Extra classes on the wrapping element when asNavForm is true */
  formClassName?: string;
  sizeVariant?: "sm" | "md";
}

/**
 * Shared user-search input with consistent styling across the site.
 *
 * - Default: plain <input> for inline / controlled usage (Messages, modals).
 * - asNavForm=true: wraps in <form action="/people" method="get"> so pressing
 *   Enter navigates to the People page (Social Feed sidebar, People page header).
 */
export function UserSearchInput({ asNavForm, formClassName, sizeVariant = "md", ...inputProps }: Props) {
  const padding = sizeVariant === "sm" ? "px-3 py-2" : "px-4 py-2.5";
  const inputEl = (
    <div className="relative flex items-center">
      <svg
        className="pointer-events-none absolute left-3 h-4 w-4 text-zinc-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="search"
        {...inputProps}
        className={`w-full rounded-xl border border-white/10 bg-[var(--app-card)] pl-9 pr-4 ${padding} text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition-colors focus:border-[var(--accent-color)]/50`}
      />
    </div>
  );

  if (asNavForm) {
    return (
      <form action="/people" method="get" className={formClassName}>
        {/* The input must be named "q" so the form serialises it in the URL */}
        {/* We clone the input el to ensure name="q" is always present */}
        <div className="relative flex items-center">
          <svg
            className="pointer-events-none absolute left-3 h-4 w-4 text-zinc-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            name="q"
            {...inputProps}
            className={`w-full rounded-xl border border-white/10 bg-[var(--app-card)] pl-9 pr-4 ${padding} text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition-colors focus:border-[var(--accent-color)]/50`}
          />
        </div>
      </form>
    );
  }

  return inputEl;
}
