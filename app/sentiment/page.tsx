"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  US_SECTORS,
  GLOBAL_REGIONS,
  type SectorId,
  type RegionId,
  type SentimentSnapshot,
  loadSentimentSnapshots,
  saveSentimentSnapshot,
  generateInitialSnapshots,
  getSentimentColor,
  getCurrentScores,
  getSectorDriverPosts,
  getSectorDriverHeadlines,
  getSentimentLabel,
  hasSeenOnboarding,
  setOnboardingSeen,
} from "../../lib/sentiment-radar";

const PAGE_BG = "#0A0E1A";
const CARD_BG = "#0F1520";
const GRID_LINE = "rgba(255,255,255,0.05)";
const CONNECTION_LINE = "rgba(26,37,53,0.5)";

type ViewMode = "sectors" | "global";
type TimeMode = "live" | "today" | "week" | "month";

export default function SentimentRadarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("sectors");
  const [timeMode, setTimeMode] = useState<TimeMode>("live");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [globalScores, setGlobalScores] = useState<Record<string, number>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [snapshots, setSnapshots] = useState<SentimentSnapshot[]>([]);
  const playbackStartRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null);
  const [selectedSector, setSelectedSector] = useState<SectorId | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<RegionId | null>(null);
  const [sweepAngle, setSweepAngle] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshScores = useCallback(() => {
    const { scores: s, globalScores: g } = getCurrentScores();
    setScores(s);
    setGlobalScores(g);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    let list = loadSentimentSnapshots();
    if (list.length === 0) {
      list = generateInitialSnapshots();
      list.forEach((sn) => saveSentimentSnapshot(sn));
    }
    setSnapshots(list);
    refreshScores();
  }, [refreshScores]);

  useEffect(() => {
    if (timeMode !== "live") return;
    const id = setInterval(() => {
      refreshScores();
      const { scores: s, globalScores: g } = getCurrentScores();
      saveSentimentSnapshot({
        timestamp: new Date().toISOString(),
        scores: s,
        globalScores: g,
      });
      setSnapshots((prev) => {
        const next = [...prev, { timestamp: new Date().toISOString(), scores: s, globalScores: g }];
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const trimmed = next.filter((x) => new Date(x.timestamp).getTime() > cutoff);
        return trimmed.slice(-48 * 30);
      });
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [timeMode, refreshScores]);

  const playbackProgressRef = useRef(0);
  playbackProgressRef.current = playbackProgress;
  const lastTickRef = useRef(0);

  useEffect(() => {
    if (!playing || timeMode === "live" || snapshots.length === 0) return;
    if (typeof requestAnimationFrame === "undefined") return;
    const maxP = Math.max(0, snapshots.length - 1);
    function tick(now: number) {
      const prev = lastTickRef.current;
      lastTickRef.current = now;
      const dt = prev > 0 ? (now - prev) / 1000 : 0;
      const current = playbackProgressRef.current;
      const next = Math.min(current + dt * playbackSpeed, maxP);
      playbackProgressRef.current = next;
      setPlaybackProgress(next);
      if (next >= maxP) setPlaying(false);
      else rafRef.current = requestAnimationFrame(tick);
    }
    lastTickRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (typeof cancelAnimationFrame !== "undefined" && rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, timeMode, snapshots.length, playbackSpeed]);

  const playbackIndex = Math.max(0, Math.min(Math.floor(playbackProgress), Math.max(0, snapshots.length - 1)));

  useEffect(() => {
    if (timeMode !== "live" && snapshots.length > 0 && playbackIndex >= 0 && playbackIndex < snapshots.length) {
      const sn = snapshots[playbackIndex];
      if (sn?.scores) setScores(sn.scores);
      if (sn?.globalScores) setGlobalScores(sn.globalScores);
    }
  }, [timeMode, playbackIndex, snapshots]);

  useEffect(() => {
    intervalRef.current = setInterval(() => setSweepAngle((a) => (a + 2) % 360), 50);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (hasSeenOnboarding()) return;
    setOnboardingStep(0);
  }, []);

  useEffect(() => {
    if (timeMode !== "live" && snapshots.length > 0 && playbackProgress > snapshots.length - 1) {
      setPlaybackProgress(Math.max(0, snapshots.length - 1));
    }
  }, [timeMode, snapshots.length, playbackProgress]);

  const currentSnapshot = timeMode !== "live" && snapshots[playbackIndex];
  const overallScore = Object.values(scores).reduce((a, b) => a + b, 0) / (Object.keys(scores).length || 1);
  const moodLabel = overallScore >= 55 ? "BULLISH" : overallScore >= 45 ? "NEUTRAL" : "BEARISH";
  const moodColor = overallScore >= 55 ? "#86EFAC" : overallScore >= 45 ? "#FDE68A" : "#FCA5A5";

  const topBullish = (viewMode === "sectors" ? US_SECTORS : GLOBAL_REGIONS)
    .map((id) => ({ id, score: (viewMode === "sectors" ? scores[id] : globalScores[id]) ?? 50 }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 3);
  const topBearish = (viewMode === "sectors" ? US_SECTORS : GLOBAL_REGIONS)
    .map((id) => ({ id, score: (viewMode === "sectors" ? scores[id] : globalScores[id]) ?? 50 }))
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, 3);

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE_BG }}>
      {/* Header */}
      <header className="border-b border-white/10 px-4 py-3">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Sentiment Radar</h1>
            <p className="text-xs text-zinc-500">Community sentiment and news analysis visualized in real time</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("sectors")}
                className={`rounded px-3 py-1.5 text-xs font-medium transition ${viewMode === "sectors" ? "bg-white/15 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                US Sectors
              </button>
              <button
                type="button"
                onClick={() => setViewMode("global")}
                className={`rounded px-3 py-1.5 text-xs font-medium transition ${viewMode === "global" ? "bg-white/15 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                Global
              </button>
            </div>
            <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
              {(["live", "today", "week", "month"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setTimeMode(m); setPlaying(false); }}
                  className={`rounded px-3 py-1.5 text-xs font-medium transition ${timeMode === m ? "bg-white/15 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  {m === "live" && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
            {timeMode !== "live" && (
              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                <button type="button" onClick={() => setPlaybackProgress(0)} className="rounded p-1 text-zinc-400 hover:text-white" title="Start">|&lt;</button>
                <button type="button" onClick={() => setPlaybackProgress((p) => Math.max(0, p - 1))} className="rounded p-1 text-zinc-400 hover:text-white" title="Previous">&lt;</button>
                <button type="button" onClick={() => setPlaying((p) => !p)} className="rounded px-2 py-1 text-xs font-medium text-white">{playing ? "Pause" : "Play"}</button>
                <button type="button" onClick={() => setPlaybackProgress((p) => Math.min(snapshots.length - 1, p + 1))} className="rounded p-1 text-zinc-400 hover:text-white" title="Next">&gt;</button>
                <button type="button" onClick={() => setPlaybackProgress(Math.max(0, snapshots.length - 1))} className="rounded p-1 text-zinc-400 hover:text-white" title="End">&gt;|</button>
                {[1, 2, 5].map((s) => (
                  <button key={s} type="button" onClick={() => setPlaybackSpeed(s)} className={`rounded px-1.5 py-0.5 text-[10px] ${playbackSpeed === s ? "bg-white/20 text-white" : "text-zinc-500"}`}>{s}x</button>
                ))}
              </div>
            )}
          </div>
        </div>
        {timeMode !== "live" && snapshots.length > 0 && (
          <div className="mx-auto mt-2 max-w-[1600px]">
            <input
              type="range"
              min={0}
              max={Math.max(0, snapshots.length - 1)}
              step="any"
              value={playbackProgress}
              onChange={(e) => setPlaybackProgress(Number(e.target.value))}
              className="w-full accent-[var(--accent-color)]"
            />
            <p className="text-center text-[10px] text-zinc-500">
              {currentSnapshot ? new Date(currentSnapshot.timestamp).toLocaleString() : "—"}
            </p>
          </div>
        )}
      </header>

      <div className="mx-auto flex max-w-[1600px] gap-4 p-4">
        {/* Main visualization */}
        <main className="relative min-h-[500px] flex-1 overflow-hidden rounded-xl border border-white/10" style={{ backgroundColor: CARD_BG }}>
          {/* Radar grid */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="h-full w-full" viewBox="0 0 600 500">
              {[1, 2, 3, 4].map((r) => (
                <circle key={r} cx="300" cy="250" r={r * 60} fill="none" stroke={GRID_LINE} strokeWidth="1" />
              ))}
            </svg>
          </div>
          {/* Sweep */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <svg className="h-full w-full" viewBox="0 0 600 500">
              <defs>
                <linearGradient id="sweepGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="white" stopOpacity="0" />
                  <stop offset="100%" stopColor="white" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              <circle cx="300" cy="250" r="240" fill="none" stroke="url(#sweepGrad)" strokeWidth="2" strokeDasharray="4 200" transform={`rotate(${sweepAngle}, 300, 250)`} />
            </svg>
          </div>

          {viewMode === "sectors" ? (
            <SectorBubbles
              scores={scores}
              onSelect={(s) => { setSelectedSector(s); setSelectedRegion(null); }}
              selected={selectedSector}
            />
          ) : (
            <GlobalBlobs
              scores={globalScores}
              onSelect={(r) => { setSelectedRegion(r); setSelectedSector(null); }}
              selected={selectedRegion}
            />
          )}
        </main>

        {/* Right panel */}
        <aside className="w-[300px] shrink-0 space-y-4 rounded-xl border border-white/10 p-4" style={{ backgroundColor: CARD_BG }}>
          <section>
            <p className="text-[10px] text-zinc-500">
              {timeMode === "live" ? "Live" : currentSnapshot ? new Date(currentSnapshot.timestamp).toLocaleString() : "—"}
            </p>
            <p className="mt-1 text-xs font-medium text-zinc-400">Overall market mood</p>
            <span className="mt-1 inline-block rounded px-2 py-1 text-sm font-semibold" style={{ backgroundColor: `${moodColor}22`, color: moodColor }}>
              {moodLabel}
            </span>
          </section>
          <section>
            <h3 className="text-xs font-semibold text-zinc-300">Top Bullish</h3>
            <ul className="mt-2 space-y-1">
              {topBullish.map(({ id, score }) => (
                <li key={id} className="flex justify-between text-xs">
                  <span className="text-zinc-300">{id}</span>
                  <span className="text-emerald-400">{score?.toFixed(0) ?? "—"}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="text-xs font-semibold text-zinc-300">Top Bearish</h3>
            <ul className="mt-2 space-y-1">
              {topBearish.map(({ id, score }) => (
                <li key={id} className="flex justify-between text-xs">
                  <span className="text-zinc-300">{id}</span>
                  <span className="text-red-400">{score?.toFixed(0) ?? "—"}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <p className="text-[10px] text-zinc-500">Last updated {lastUpdated ? `${Math.round((Date.now() - lastUpdated.getTime()) / 60000)} min ago` : "—"}</p>
            <button type="button" onClick={refreshScores} className="mt-2 rounded bg-white/10 px-2 py-1 text-xs text-zinc-300 hover:bg-white/15">Refresh now</button>
          </section>
        </aside>
      </div>

      {/* Bubble detail panel: why this grade */}
      {(selectedSector || selectedRegion) && (
        <div className="mx-auto max-w-[1600px] border-t border-white/10 px-4 py-4">
          <BubbleDetailPanel
            sector={selectedSector}
            region={selectedRegion}
            score={selectedSector ? (scores[selectedSector] ?? 50) : selectedRegion ? (globalScores[selectedRegion] ?? 50) : 50}
            onClose={() => { setSelectedSector(null); setSelectedRegion(null); }}
          />
        </div>
      )}

      {/* How it works & data source */}
      <div className="mx-auto max-w-[1600px] border-t border-white/10 px-4 py-6">
        <h2 className="text-sm font-semibold text-zinc-200">How it works</h2>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-zinc-400">
          Sentiment Radar combines <strong className="text-zinc-300">community sentiment</strong> (posts and reactions from the feed) with <strong className="text-zinc-300">news sentiment</strong> to produce a score from 0 to 100 for each sector or region. Each bubble is one market sector (or, in Global view, one region). Bubble <strong className="text-zinc-300">size</strong> reflects relative market cap weight (e.g. Technology is largest). Bubble <strong className="text-zinc-300">color</strong> shows the combined score: dark green = very bullish (75–100), light green = bullish (55–75), yellow = neutral (45–55), orange = bearish (30–45), red = very bearish (0–30). In Live mode scores refresh every 5 minutes; use Today / Week / Month and Play to replay saved snapshots.
        </p>
        <h2 className="mt-4 text-sm font-semibold text-zinc-200">What the numbers mean</h2>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-zinc-400">
          The number on each bubble is the <strong className="text-zinc-300">sentiment score (0–100)</strong>. Higher = more bullish (optimistic), lower = more bearish (pessimistic). The right panel shows overall market mood (BULLISH / NEUTRAL / BEARISH), top 3 most bullish and most bearish sectors, and when the data was last updated.
        </p>
        <h2 className="mt-4 text-sm font-semibold text-zinc-200">Is the data real?</h2>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-zinc-400">
          <strong className="text-zinc-300">Partially.</strong> Community sentiment is based on real posts from your feed (stored in the browser). The news portion is currently <strong className="text-amber-400/90">simulated</strong> for demo purposes. A full production version would use news headlines (e.g. NewsAPI) plus an AI (e.g. Claude) to score headline sentiment per sector, with caching to limit API cost. Until that is wired, sector scores blend real community data with placeholder news values so you can see how the radar works.
        </p>
      </div>

      {/* Onboarding */}
      {onboardingStep !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-w-sm rounded-xl border border-white/20 bg-[#0F1520] p-6 shadow-xl">
            <p className="text-sm text-zinc-200">
              {onboardingStep === 0 && "Each bubble = a market sector. Color shows community + news sentiment."}
              {onboardingStep === 1 && "Green = bullish, Red = bearish. Size = relative market cap weight."}
              {onboardingStep === 2 && "Hit Play (when not in Live) to watch sentiment evolve through the day."}
            </p>
            <div className="mt-4 flex justify-between">
              <button
                type="button"
                onClick={() => {
                  if (onboardingStep < 2) setOnboardingStep(onboardingStep + 1);
                  else { setOnboardingStep(null); setOnboardingSeen(); }
                }}
                className="rounded bg-white/15 px-3 py-1.5 text-xs text-white"
              >
                {onboardingStep < 2 ? "Next" : "Done"}
              </button>
              <button type="button" onClick={() => { setOnboardingStep(null); setOnboardingSeen(); }} className="rounded px-3 py-1.5 text-xs text-zinc-400 hover:text-white">Skip</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SECTOR_SHORT_LABELS: Record<string, string> = {
  "Communication Services": "Comms",
  "Consumer Discretionary": "Consumer Disc",
  "Consumer Staples": "Staples",
  "Real Estate": "Real Est",
};

function sectorLabel(sector: string): string {
  return SECTOR_SHORT_LABELS[sector] ?? sector.split(" ")[0] ?? sector;
}

function SectorBubbles({
  scores,
  onSelect,
  selected,
}: {
  scores: Record<string, number>;
  onSelect: (s: SectorId | null) => void;
  selected: SectorId | null;
}) {
  const positions: [number, number][] = [
    [300, 120], [180, 180], [420, 180], [120, 250], [300, 250], [480, 250],
    [180, 320], [420, 320], [300, 380], [240, 320], [360, 320],
  ];
  const minR = 18;
  const maxR = 54;
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {US_SECTORS.map((sector, i) => {
        const score = scores[sector] ?? 50;
        const r = minR + (score / 100) * (maxR - minR);
        const [cx, cy] = positions[i] ?? [300, 250];
        const color = getSentimentColor(score);
        const label = sectorLabel(sector);
        return (
          <button
            key={sector}
            type="button"
            onClick={() => onSelect(selected === sector ? null : sector)}
            className="absolute flex items-center justify-center rounded-full border-2 transition-all duration-[800ms] ease-out hover:scale-105 sentiment-bubble-pulse"
            style={{
              left: `${(cx / 600) * 100}%`,
              top: `${(cy / 500) * 100}%`,
              width: r * 2,
              height: r * 2,
              marginLeft: -r,
              marginTop: -r,
              backgroundColor: `${color}33`,
              borderColor: selected === sector ? "white" : color,
              boxShadow: `0 0 20px ${color}40`,
            }}
            title={`${sector}: ${score}/100`}
          >
            <span className="text-center text-[10px] font-medium text-white drop-shadow truncate px-1" style={{ maxWidth: r * 1.8 }}>
              {label}
            </span>
            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-zinc-400">{score}</span>
          </button>
        );
      })}
    </div>
  );
}

const GLOBAL_POSITIONS: [number, number][] = [
  [300, 140],
  [180, 250],
  [420, 250],
  [300, 350],
  [120, 250],
  [480, 250],
  [300, 250],
];

const GLOBAL_SHORT_LABELS: Record<string, string> = {
  "North America": "N.America",
  "Asia Pacific": "Asia Pac",
  "Emerging Markets": "Emerging",
  "Middle East & Africa": "ME & Africa",
};

function globalLabel(region: string): string {
  return GLOBAL_SHORT_LABELS[region] ?? (region.length > 10 ? region.split(" ")[0] ?? region : region);
}

function GlobalBlobs({
  scores,
  onSelect,
  selected,
}: {
  scores: Record<string, number>;
  onSelect?: (region: RegionId) => void;
  selected?: RegionId | null;
}) {
  const minR = 22;
  const maxR = 52;
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {GLOBAL_REGIONS.map((region, i) => {
        const score = scores[region] ?? 50;
        const r = minR + (score / 100) * (maxR - minR);
        const [cx, cy] = GLOBAL_POSITIONS[i] ?? [300, 250];
        const color = getSentimentColor(score);
        const shortLabel = globalLabel(region);
        const isSelected = selected === region;
        return (
          <button
            key={region}
            type="button"
            onClick={() => onSelect?.(region as RegionId)}
            className="absolute flex flex-col items-center justify-center rounded-full border-2 transition-all duration-[800ms] ease-out hover:scale-105 sentiment-bubble-pulse cursor-pointer"
            style={{
              left: `${(cx / 600) * 100}%`,
              top: `${(cy / 500) * 100}%`,
              width: r * 2,
              height: r * 2,
              marginLeft: -r,
              marginTop: -r,
              backgroundColor: `${color}33`,
              borderColor: isSelected ? "white" : color,
              borderWidth: isSelected ? 3 : 2,
              boxShadow: isSelected ? `0 0 24px ${color}80` : `0 0 20px ${color}40`,
            }}
            title={`${region}: ${score}/100`}
          >
            <span className="text-center text-[10px] font-medium text-white drop-shadow truncate px-1" style={{ maxWidth: r * 1.8 }}>
              {shortLabel}
            </span>
            <span className="text-[10px] text-zinc-400 mt-0.5">{score}</span>
          </button>
        );
      })}
    </div>
  );
}

function BubbleDetailPanel({
  sector,
  region,
  score,
  onClose,
}: {
  sector: SectorId | null;
  region: RegionId | null;
  score: number;
  onClose: () => void;
}) {
  const name = sector ?? region ?? "";
  const color = getSentimentColor(score);
  const label = getSentimentLabel(score);
  const posts = sector ? getSectorDriverPosts(sector) : [];
  const headlines = sector ? getSectorDriverHeadlines(sector) : [];

  return (
    <div className="rounded-xl border border-white/10 p-4" style={{ backgroundColor: CARD_BG }}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-zinc-200">{name}</span>
          <span className="rounded px-2 py-1 text-sm font-medium" style={{ backgroundColor: `${color}22`, color }}>
            {score} — {label}
          </span>
        </div>
        <button type="button" onClick={onClose} className="rounded bg-white/10 px-2 py-1 text-xs text-zinc-400 hover:bg-white/15">
          Close
        </button>
      </div>
      <h3 className="mt-4 text-xs font-semibold text-zinc-400">Why this grade</h3>
      <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sector && (
          <>
            <section>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Community (tweets & posts)</p>
              {posts.length === 0 ? (
                <p className="mt-1 text-xs text-zinc-500">No matching posts in your feed for this sector yet.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {posts.slice(0, 5).map((p, i) => (
                    <li key={i} className="rounded border border-white/5 bg-white/5 p-2 text-xs text-zinc-300">
                      <span className={`mr-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] ${p.sentiment === "bullish" ? "bg-emerald-500/20 text-emerald-400" : p.sentiment === "bearish" ? "bg-red-500/20 text-red-400" : "bg-zinc-500/20 text-zinc-400"}`}>
                        {p.sentiment}
                      </span>
                      {p.text.slice(0, 120)}{p.text.length > 120 ? "…" : ""}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">News</p>
              <ul className="mt-2 space-y-1">
                {headlines.map((h, i) => (
                  <li key={i} className="text-xs text-zinc-400">• {h}</li>
                ))}
              </ul>
            </section>
            <section>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Politics & policy</p>
              <p className="mt-1 text-xs text-zinc-500">Fed outlook and sector-specific regulation feed into the score. (Placeholder — wire to real data in production.)</p>
            </section>
          </>
        )}
        {region && !sector && (
          <>
            <section>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Regional sentiment</p>
              <p className="mt-1 text-xs text-zinc-400">Score reflects news and macro sentiment for this region. Good headlines and stable politics lift the grade; risk-off or political stress weigh it down.</p>
            </section>
            <section>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">News & politics</p>
              <p className="mt-1 text-xs text-zinc-500">Regional news and policy developments are factored in. (Placeholder — wire to real API in production.)</p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
