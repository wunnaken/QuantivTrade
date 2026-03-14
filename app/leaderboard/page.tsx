"use client";

import Link from "next/link";
import { useState } from "react";

type RoomRow = {
  id: string;
  name: string;
  slug: string;
  exclusive: boolean;
  members: string;
  activity: string;
  description: string;
};

const MOCK_WEEKLY: RoomRow[] = [
  { id: "w1", name: "Pro Desk Flow", slug: "pro-desk", exclusive: true, members: "2.4k", activity: "1.2k posts", description: "Institutional-grade flow and ideas" },
  { id: "w2", name: "Global Equities Flow", slug: "equities", exclusive: false, members: "1.8k", activity: "890 posts", description: "Large-cap, sectors, index flows" },
  { id: "w3", name: "Macro Alpha (Pro)", slug: "macro-pro", exclusive: true, members: "1.1k", activity: "640 posts", description: "Rates, FX, and macro plays" },
  { id: "w4", name: "Crypto & High-Beta", slug: "crypto", exclusive: false, members: "920", activity: "520 posts", description: "BTC, ETH, alt rotations" },
  { id: "w5", name: "Global Macro & Rates", slug: "macro", exclusive: false, members: "840", activity: "410 posts", description: "Central banks, inflation, cross-asset" },
  { id: "w6", name: "Options Flow Elite", slug: "options-elite", exclusive: true, members: "680", activity: "380 posts", description: "Unusual options and flow" },
  { id: "w7", name: "Earnings Edge", slug: "earnings", exclusive: true, members: "550", activity: "290 posts", description: "Pre- and post-earnings ideas" },
  { id: "w8", name: "Sector Rotation", slug: "sector-rot", exclusive: false, members: "420", activity: "180 posts", description: "Sector and thematic rotation" },
  { id: "w9", name: "FX & Commodities", slug: "fx-comm", exclusive: false, members: "310", activity: "95 posts", description: "Currencies and commodities" },
  { id: "w10", name: "New Trader Hub", slug: "new-trader", exclusive: false, members: "280", activity: "120 posts", description: "Learning and first steps" },
];

const MOCK_ALL_TIME: RoomRow[] = [
  { id: "a1", name: "Global Equities Flow", slug: "equities", exclusive: false, members: "12.4k", activity: "48k total", description: "Large-cap, sectors, index flows" },
  { id: "a2", name: "Pro Desk Flow", slug: "pro-desk", exclusive: true, members: "8.2k", activity: "32k total", description: "Institutional-grade flow and ideas" },
  { id: "a3", name: "Crypto & High-Beta", slug: "crypto", exclusive: false, members: "7.1k", activity: "28k total", description: "BTC, ETH, alt rotations" },
  { id: "a4", name: "Global Macro & Rates", slug: "macro", exclusive: false, members: "5.9k", activity: "22k total", description: "Central banks, inflation, cross-asset" },
  { id: "a5", name: "Macro Alpha (Pro)", slug: "macro-pro", exclusive: true, members: "4.2k", activity: "18k total", description: "Rates, FX, and macro plays" },
  { id: "a6", name: "Options Flow Elite", slug: "options-elite", exclusive: true, members: "3.8k", activity: "15k total", description: "Unusual options and flow" },
  { id: "a7", name: "Earnings Edge", slug: "earnings", exclusive: true, members: "2.9k", activity: "11k total", description: "Pre- and post-earnings ideas" },
  { id: "a8", name: "Sector Rotation", slug: "sector-rot", exclusive: false, members: "2.1k", activity: "8k total", description: "Sector and thematic rotation" },
  { id: "a9", name: "FX & Commodities", slug: "fx-comm", exclusive: false, members: "1.6k", activity: "5k total", description: "Currencies and commodities" },
  { id: "a10", name: "New Trader Hub", slug: "new-trader", exclusive: false, members: "1.4k", activity: "4k total", description: "Learning and first steps" },
];

export default function LeaderboardPage() {
  const [tab, setTab] = useState<"weekly" | "alltime">("weekly");
  const rows = tab === "weekly" ? MOCK_WEEKLY : MOCK_ALL_TIME;

  return (
    <div className="min-h-screen app-page font-[&quot;Times_New_Roman&quot;,serif]">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">🏆 Leaderboard</h1>
          <p className="mt-2 text-sm text-zinc-400">Top chat rooms by activity. Join exclusive rooms to get the edge.</p>
          <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Demo data — real leaderboard launches with full release.
          </p>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("weekly")}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              tab === "weekly"
                ? "border-[var(--accent-color)]/50 bg-[var(--accent-color)]/10 text-[var(--accent-color)]"
                : "border-white/10 text-zinc-400 hover:bg-white/5"
            }`}
          >
            Weekly
          </button>
          <button
            type="button"
            onClick={() => setTab("alltime")}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              tab === "alltime"
                ? "border-[var(--accent-color)]/50 bg-[var(--accent-color)]/10 text-[var(--accent-color)]"
                : "border-white/10 text-zinc-400 hover:bg-white/5"
            }`}
          >
            All Time
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0F1520]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-black/20">
                <th className="px-4 py-3 font-medium text-zinc-400">Rank</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Room</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Members</th>
                <th className="px-4 py-3 font-medium text-zinc-400">{tab === "weekly" ? "Posts this week" : "Total activity"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const rank = idx + 1;
                return (
                  <tr key={row.id} className="border-b border-white/5 transition-colors hover:bg-white/5">
                    <td className="px-4 py-3">
                      <span className="text-zinc-500">{rank}</span>
                      {rank <= 3 && <span className="ml-1 text-base" aria-hidden>👑</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href="/communities"
                        className="group flex flex-col gap-0.5"
                      >
                        <span className="font-medium text-zinc-100 group-hover:text-[var(--accent-color)]">
                          {row.name}
                        </span>
                        <span className="text-xs text-zinc-500">{row.description}</span>
                        {row.exclusive && (
                          <span className="mt-0.5 inline-flex w-fit rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                            Exclusive
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{row.members}</td>
                    <td className="px-4 py-3 text-zinc-400">{row.activity}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500">
          <Link href="/communities" className="text-[var(--accent-color)] hover:underline">Browse all rooms</Link>
          {" · "}
          <Link href="/feed" className="text-[var(--accent-color)] hover:underline">Back to Feed</Link>
        </p>
      </div>
    </div>
  );
}
