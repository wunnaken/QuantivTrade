"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen app-page antialiased flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#050713] p-8 shadow-xl text-center">
          <h1 className="text-xl font-semibold text-zinc-50">Something went wrong</h1>
          <p className="mt-3 text-sm text-zinc-400">
            The app hit an error. You can try again or go back to the home page.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => typeof reset === "function" && reset()}
              className="rounded-full bg-[#11c60f] px-5 py-2 text-sm font-semibold text-[#020308] hover:bg-[#13e211] focus:outline-none focus:ring-2 focus:ring-[#11c60f] focus:ring-offset-2 focus:ring-offset-[#0A0E1A]"
            >
              Try again
            </button>
            <Link
              href="/"
              className="rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-zinc-200 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#11c60f]/50 focus:ring-offset-2 focus:ring-offset-[#0A0E1A]"
            >
              Go to home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
