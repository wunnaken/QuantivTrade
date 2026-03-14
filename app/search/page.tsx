"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const SUGGESTION_TICKERS = [
  "AAPL",
  "TSLA",
  "NVDA",
  "MSFT",
  "GOOGL",
  "AMZN",
  "BTC",
  "ETH",
  "SPY",
  "QQQ",
  "EURUSD",
  "GOLD",
  "OIL",
];

const TRENDING_TICKERS = ["NVDA", "BTC", "SPY", "TSLA"];
function getTrendingThisSession(): string[] {
  const shuffled = [...TRENDING_TICKERS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3 + Math.floor(Math.random() * 2));
}

function filterSuggestions(query: string): string[] {
  const q = query.trim().toUpperCase();
  if (!q) return SUGGESTION_TICKERS;
  return SUGGESTION_TICKERS.filter((t) => t.includes(q) || t.startsWith(q));
}

export default function SearchPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [trending] = useState(() => getTrendingThisSession());
  const suggestions = filterSuggestions(query);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const goToTicker = useCallback(
    (ticker: string) => {
      setDropdownOpen(false);
      router.push(`/search/${encodeURIComponent(ticker.toUpperCase())}`);
    },
    [router]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && suggestions.length > 0) {
      e.preventDefault();
      goToTicker(suggestions[0]);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold text-zinc-100">Smart Search</h1>
        <p className="mb-6 text-sm text-zinc-400">
          Search any stock, crypto, or forex symbol. Press <kbd className="rounded border border-white/20 px-1.5 py-0.5 text-xs">/</kbd> from anywhere to focus search.
        </p>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setDropdownOpen(true);
            }}
            onFocus={() => setDropdownOpen(true)}
            onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
            onKeyDown={handleKeyDown}
            placeholder="Search any stock, crypto, forex..."
            className="w-full rounded-xl border border-white/10 bg-[#0F1520] px-4 py-3.5 text-zinc-100 placeholder:text-zinc-500 outline-none transition-colors focus:border-[var(--accent-color)]/50"
            aria-label="Search tickers"
            aria-autocomplete="list"
          />
          {dropdownOpen && (
            <ul
              className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-auto rounded-xl border border-white/10 bg-[#0F1520] py-1 shadow-xl"
              role="listbox"
            >
              {suggestions.length === 0 ? (
                <li className="px-4 py-3 text-sm text-zinc-500">No matches</li>
              ) : (
                suggestions.map((ticker) => (
                  <li key={ticker} role="option" aria-selected="false">
                    <button
                      type="button"
                      onClick={() => goToTicker(ticker)}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-zinc-200 transition-colors hover:bg-white/5 hover:text-[var(--accent-color)]"
                    >
                      {ticker}
                      {trending.includes(ticker) && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">🔥 Trending</span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
    </div>
  );
}
