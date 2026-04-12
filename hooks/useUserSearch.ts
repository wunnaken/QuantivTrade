"use client";

import { useEffect, useState } from "react";

export type SearchProfile = {
  user_id: string;
  name: string;
  username: string;
  is_verified?: boolean;
  is_founder?: boolean;
};

/**
 * Debounced search against /api/profiles/search.
 * Returns results and a loading flag. Clears results when query < 2 chars.
 */
export function useUserSearch(query: string, debounceMs = 300) {
  const [results, setResults] = useState<SearchProfile[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/profiles/search?q=${encodeURIComponent(query)}`);
        const data = await res.json() as { profiles: SearchProfile[] };
        setResults(data.profiles ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, debounceMs);
    return () => clearTimeout(t);
  }, [query, debounceMs]);

  return { results, searching };
}
