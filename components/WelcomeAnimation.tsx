"use client";

import { useEffect, useCallback } from "react";
import { QuantivTradeLogoImage } from "./XchangeLogoImage";

const BG = "#0A0E1A";
const TOTAL_DURATION_MS = 6500;

export function WelcomeAnimation({ onComplete }: { onComplete: () => void }) {
  const handleComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const t = setTimeout(handleComplete, TOTAL_DURATION_MS);
    return () => clearTimeout(t);
  }, [handleComplete]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: BG }}
      aria-live="polite"
      aria-label="Welcome to QuantivTrade"
    >
      {/* Skip */}
      <button
        type="button"
        onClick={handleComplete}
        className="absolute right-4 top-4 z-10 text-sm text-zinc-500 transition-colors hover:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2 focus:ring-offset-[#0A0E1A]"
      >
        Skip →
      </button>

      {/* Floating particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-[var(--accent-color)]"
            style={{
              left: `${(i * 7 + 3) % 100}%`,
              bottom: "-20px",
              animation: "welcome-particle-float 12s ease-in infinite",
              animationDelay: `${i * 0.5}s`,
            }}
          />
        ))}
      </div>

      {/* Content container — fades out at 5.5s */}
      <div
        className="welcome-content flex flex-col items-center justify-center px-6"
        style={{
          animation: "welcome-fade-out 1s ease-in forwards",
          animationDelay: "5.5s",
          animationFillMode: "both",
        }}
      >
        {/* Step 1: Globe logo (0–1s) + continuous rotate (0–6.5s) */}
        <div
          className="relative flex h-[130px] w-[130px] flex-shrink-0 items-center justify-center sm:h-[150px] sm:w-[150px]"
          style={{
            animation: "welcome-globe-rotate 6.5s linear",
          }}
        >
          <div
            className="flex h-[120px] w-[120px] flex-shrink-0 items-center justify-center sm:h-[140px] sm:w-[140px]"
            style={{
              animation: "welcome-logo-in 1s ease-out forwards",
            }}
          >
            <QuantivTradeLogoImage size={120} />
          </div>
        </div>

        {/* Step 2: "QuantivTrade" letter by letter (1–2s) */}
        <div className="mt-8 flex justify-center sm:mt-10" style={{ minHeight: "4rem" }}>
          {"QuantivTrade".split("").map((letter, i) => (
            <span
              key={`${letter}-${i}`}
              className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
              style={{
                color: "var(--accent-color)",
                animation: "welcome-letter-in 0.2s ease-out forwards",
                animationDelay: `${1 + i * 0.14}s`,
                opacity: 0,
                animationFillMode: "forwards",
              }}
            >
              {letter}
            </span>
          ))}
        </div>

        {/* Step 3: Tagline (2–3.2s) */}
        <p
          className="mt-5 text-xl text-zinc-300 sm:mt-6 sm:text-2xl"
          style={{
            animation: "welcome-tagline-in 1.2s ease-out forwards",
            animationDelay: "2s",
            opacity: 0,
            animationFillMode: "forwards",
          }}
        >
          Where the World Trades Ideas
        </p>

        {/* Step 4: Three bullets (3.2s, 3.6s, 4s) */}
        <ul className="mt-10 flex flex-col gap-3 text-left sm:gap-4">
          {[
            { emoji: "📊", text: "Your risk profile is ready" },
            { emoji: "🌍", text: "Global markets at your fingertips" },
            { emoji: "👥", text: "Your community awaits" },
          ].map((item, i) => (
            <li
              key={item.text}
              className="rounded-xl px-5 py-3 text-zinc-200 shadow-[0_0_24px_var(--accent-color-40)] sm:px-6 sm:py-4"
              style={{
                animation: "welcome-bullet-in 0.4s ease-out forwards",
                animationDelay: `${3.2 + i * 0.4}s`,
                opacity: 0,
                animationFillMode: "forwards",
                backgroundColor: "rgba(15, 21, 32, 0.8)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span className="mr-2 text-xl" aria-hidden>{item.emoji}</span>
              <span className="text-sm font-medium sm:text-base">{item.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Step 5: Progress bar (4.5–5.5s) — fixed at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 flex flex-col gap-2 px-6 pb-12"
        style={{
          animation: "welcome-fade-out 1s ease-in forwards",
          animationDelay: "5.5s",
          animationFillMode: "both",
        }}
      >
        <p
          className="text-center text-xs text-zinc-500"
          style={{
            animation: "welcome-tagline-in 0.5s ease-out forwards",
            animationDelay: "4.5s",
            opacity: 0,
            animationFillMode: "forwards",
          }}
        >
          Setting up your experience...
        </p>
        <div className="h-1 w-full max-w-md overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--accent-color)]"
            style={{
              animation: "welcome-progress-fill 1s ease-out forwards",
              animationDelay: "4.5s",
              width: 0,
              animationFillMode: "forwards",
            }}
          />
        </div>
      </div>
    </div>
  );
}
