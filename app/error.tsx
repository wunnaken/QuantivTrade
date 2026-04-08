"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  const message = error?.message ?? "";
  const isConnectionError =
    /connection refused|failed to fetch|network error|load failed|ERR_CONNECTION_REFUSED/i.test(message) ||
    (message.includes("fetch") && message.toLowerCase().includes("refused"));

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[var(--app-card)] p-8 text-center">
        <h1 className="text-xl font-semibold text-zinc-100">Something went wrong</h1>
        {isConnectionError ? (
          <p className="mt-3 text-sm text-zinc-400">
            Connection refused. Make sure the dev server is running: run <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">npm run dev</code> in the project folder and open{" "}
            <a href="http://localhost:3000" className="text-[var(--accent-color)] hover:underline">http://localhost:3000</a>.
          </p>
        ) : (
          <p className="mt-3 text-sm text-zinc-400">
            The app hit an error. You can try again or go back home.
          </p>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-[var(--accent-color)] px-5 py-2 text-sm font-semibold text-[#020308] transition hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-full border border-white/20 px-5 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/5"
          >
            Go to home
          </Link>
        </div>
      </div>
    </div>
  );
}
