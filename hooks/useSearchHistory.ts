"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Fetches the user's 4 most recent searches from Supabase and provides
 * a function to save a new query (deduped, newest first).
 */
export function useSearchHistory() {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/search-history")
      .then((r) => r.ok ? r.json() : { queries: [] })
      .then((d: { queries: string[] }) => setRecent(d.queries ?? []))
      .catch(() => {});
  }, []);

  const save = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    fetch("/api/search-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: trimmed }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d: { queries?: string[] } | null) => {
        if (d?.queries) setRecent(d.queries);
      })
      .catch(() => {});
  }, []);

  const remove = useCallback((query: string) => {
    setRecent((prev) => prev.filter((q) => q !== query));
    fetch(`/api/search-history?q=${encodeURIComponent(query)}`, {
      method: "DELETE",
    }).catch(() => {});
  }, []);

  return { recent, save, remove };
}
