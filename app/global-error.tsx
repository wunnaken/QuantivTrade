"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  const message = error?.message ?? "";
  const isConnectionError =
    /connection refused|failed to fetch|network error|load failed|ERR_CONNECTION_REFUSED/i.test(message) ||
    (message.includes("fetch") && message.toLowerCase().includes("refused"));

  return (
    <html lang="en">
      <body className="min-h-screen app-page antialiased flex flex-col items-center justify-center p-6 font-sans" style={{ backgroundColor: "var(--app-bg)" }}>
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[var(--app-card)] p-8 shadow-xl text-center">
          <h1 className="text-xl font-semibold text-zinc-50">Something went wrong</h1>
          {isConnectionError ? (
            <p className="mt-3 text-sm text-zinc-400">
              Connection refused. Start the dev server: run <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">npm run dev</code> in the project folder, then open <a href="http://localhost:3000" className="text-[var(--accent-color)] hover:underline">http://localhost:3000</a>.
            </p>
          ) : (
            <p className="mt-3 text-sm text-zinc-400">
              The app hit an error. You can try again or go back to the home page.
            </p>
          )}
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => typeof reset === "function" && reset()}
              className="rounded-full bg-[var(--accent-color)] px-5 py-2 text-sm font-semibold text-[#020308] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2 focus:ring-offset-[var(--app-bg)]"
            >
              Try again
            </button>
            <Link
              href="/"
              className="rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-zinc-200 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 focus:ring-offset-2 focus:ring-offset-[var(--app-bg)]"
            >
              Go to home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
