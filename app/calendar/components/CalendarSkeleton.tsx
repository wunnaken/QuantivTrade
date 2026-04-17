"use client";

/**
 * Full grid skeleton shown on first load (no data, no cache yet).
 * Mirrors the actual grid shape so layout doesn't shift when data arrives.
 *
 * Uses the global `.skeleton` shimmer (defined in globals.css) instead of
 * Tailwind's `animate-pulse` for a smoother fade.
 */
export function CalendarSkeleton({ tab }: { tab: "earnings" | "economic" | "year" }) {
  if (tab === "year") {
    return (
      <div className="space-y-6">
        <div className="skeleton h-72 w-full rounded-xl" />
        <div className="skeleton h-32 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {[0, 1, 2, 3, 4].map((dayIdx) => (
        <div key={dayIdx} className="flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="skeleton mb-3 mx-auto h-4 w-12 rounded" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: tab === "earnings" ? 3 : 2 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/10 p-3">
                <div className="flex items-start gap-2">
                  <div className="skeleton h-9 w-9 flex-shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3 w-3/4 rounded" />
                    <div className="skeleton h-2 w-1/3 rounded" />
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="skeleton h-2 w-full rounded" />
                  <div className="skeleton h-2 w-2/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
