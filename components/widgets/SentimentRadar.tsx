"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  US_SECTORS,
  type SectorId,
  getSentimentColor,
  getSectorWeight,
  getCurrentScores,
} from "../../lib/sentiment-radar";

export function SentimentRadarWidget({ onLoaded }: { onLoaded?: () => void }) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(() => {
    const { scores: s } = getCurrentScores();
    setScores(s);
    setLastUpdated(new Date());
    onLoaded?.();
  }, [onLoaded]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="flex h-full flex-col p-2">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <Link href="/sentiment" className="text-xs font-semibold text-white hover:underline">
          Sentiment Radar · Live
        </Link>
        <button type="button" onClick={refresh} className="rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-white/10 hover:text-zinc-300">
          Refresh
        </button>
      </div>
      <p className="text-[10px] text-zinc-500">Last updated {lastUpdated ? `${Math.round((Date.now() - lastUpdated.getTime()) / 60000)} min ago` : "—"}</p>
      <div className="mt-2 flex flex-1 flex-wrap content-center items-center justify-center gap-1">
        {US_SECTORS.map((sector) => {
          const score = scores[sector] ?? 50;
          const color = getSentimentColor(score);
          const size = 10 + getSectorWeight(sector) * 0.5;
          return (
            <Link
              key={sector}
              href={`/sentiment`}
              className="flex items-center justify-center rounded-full border transition hover:scale-110"
              style={{
                width: size,
                height: size,
                backgroundColor: `${color}44`,
                borderColor: color,
              }}
              title={`${sector}: ${score}`}
            >
              <span className="text-[8px] font-medium text-white">{sector.slice(0, 2)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
