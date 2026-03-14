"use client";

import Link from "next/link";
import { XchangeLogoImage } from "../../components/XchangeLogoImage";

export default function MissionPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:px-8 sm:py-16">
      <Link
        href="/"
        className="mb-10 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-[var(--accent-color)]"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to home
      </Link>

      <div className="flex flex-col items-center text-center">
        <div className="mb-8 flex justify-center">
          <XchangeLogoImage size={80} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
          Our Mission
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Where the World Trades Ideas
        </p>
      </div>

      <div className="mt-12 space-y-6 text-zinc-300 sm:mt-16">
        <p className="text-base leading-relaxed sm:text-lg">
          Xchange exists to give every investor access to the same tools that move markets:
          real-time intelligence, global perspectives, and a community that trades ideas, not just tickers.
        </p>
        <p className="text-base leading-relaxed sm:text-lg">
          We believe the best decisions come when signal is separated from noise—when macro events,
          earnings, and sentiment are connected to your watchlists and goals. So you see why markets
          move, not just that they are.
        </p>
        <p className="text-base leading-relaxed sm:text-lg">
          From social communities and live market feeds to risk-based profiles and global maps,
          Xchange is built for how modern markets move: fast, linked, and personal. Our mission is
          to put that power in your hands. -wunnaken
        </p>
      </div>

      <div className="mt-14 flex justify-center">
        <Link
          href="/plans"
          className="rounded-full bg-[var(--accent-color)] px-6 py-2.5 text-sm font-semibold text-[#020308] transition hover:opacity-90"
        >
          Join Xchange
        </Link>
      </div>
    </div>
  );
}
