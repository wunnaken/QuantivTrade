/**
 * Sentiment Radar — sector/region definitions, weights, colors, snapshot storage.
 * Scores: 40% community (localStorage posts), 60% news (API/Claude). See dev notes.
 */

export const SENTIMENT_SNAPSHOTS_KEY = "xchange-sentiment-snapshots";
export const SENTIMENT_ONBOARDING_KEY = "xchange-sentiment-onboarding-seen";
const MAX_SNAPSHOTS_DAYS = 30;
const SNAPSHOT_INTERVAL_MS = 30 * 60 * 1000;

export const US_SECTORS = [
  "Technology",
  "Healthcare",
  "Financials",
  "Consumer Discretionary",
  "Industrials",
  "Communication Services",
  "Energy",
  "Consumer Staples",
  "Real Estate",
  "Materials",
  "Utilities",
] as const;

export type SectorId = (typeof US_SECTORS)[number];

/** Approximate market cap weight (for bubble size). Tech largest, Utilities smallest. */
export const SECTOR_WEIGHTS: Record<SectorId, number> = {
  Technology: 28,
  Healthcare: 13,
  Financials: 12,
  "Consumer Discretionary": 10,
  Industrials: 8,
  "Communication Services": 8,
  Energy: 5,
  "Consumer Staples": 6,
  "Real Estate": 2.5,
  Materials: 2.5,
  Utilities: 2,
};

export const GLOBAL_REGIONS = [
  "North America",
  "Europe",
  "Asia Pacific",
  "China",
  "Emerging Markets",
  "Latin America",
  "Middle East & Africa",
] as const;

export type RegionId = (typeof GLOBAL_REGIONS)[number];

export const SECTOR_KEYWORDS: Record<SectorId, string[]> = {
  Technology: ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "tech", "AI", "semiconductor", "software", "chip", "XLK"],
  Healthcare: ["JNJ", "PFE", "UNH", "pharma", "biotech", "drug", "healthcare", "XLV"],
  Financials: ["JPM", "BAC", "GS", "bank", "Fed", "rate", "lending", "XLF"],
  "Consumer Discretionary": ["AMZN", "TSLA", "HD", "retail", "consumer", "XLY"],
  Industrials: ["CAT", "BA", "industrial", "manufacturing", "XLI"],
  "Communication Services": ["GOOGL", "META", "NFLX", "communication", "XLC"],
  Energy: ["XOM", "CVX", "oil", "gas", "energy", "crude", "XLE"],
  "Consumer Staples": ["PG", "KO", "WMT", "staples", "XLP"],
  "Real Estate": ["real estate", "REIT", "XLRE"],
  Materials: ["materials", "mining", "XLB"],
  Utilities: ["utilities", "power", "XLU"],
};

export type SentimentScores = Record<SectorId, number>;
export type GlobalScores = Record<RegionId, number>;

export interface SentimentSnapshot {
  timestamp: string;
  scores: SentimentScores;
  globalScores: GlobalScores;
}

function sentimentColor(score: number): string {
  if (score >= 75) return "#00C896";
  if (score >= 55) return "#86EFAC";
  if (score >= 45) return "#FDE68A";
  if (score >= 30) return "#FCA5A5";
  return "#EF4444";
}

export function getSentimentColor(score: number): string {
  return sentimentColor(score);
}

export function getSentimentLabel(score: number): string {
  if (score >= 75) return "Very Bullish";
  if (score >= 55) return "Bullish";
  if (score >= 45) return "Neutral";
  if (score >= 30) return "Bearish";
  return "Very Bearish";
}

export function getSectorWeight(sector: SectorId): number {
  return SECTOR_WEIGHTS[sector] ?? 5;
}

/** Load snapshots from localStorage; keep last 30 days. */
export function loadSentimentSnapshots(): SentimentSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SENTIMENT_SNAPSHOTS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SentimentSnapshot[];
    if (!Array.isArray(list)) return [];
    const cutoff = Date.now() - MAX_SNAPSHOTS_DAYS * 24 * 60 * 60 * 1000;
    return list.filter((s) => new Date(s.timestamp).getTime() > cutoff);
  } catch {
    return [];
  }
}

/** Save snapshots (append, then trim to last 30 days). */
export function saveSentimentSnapshot(snapshot: SentimentSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    const list = loadSentimentSnapshots();
    list.push(snapshot);
    const cutoff = Date.now() - MAX_SNAPSHOTS_DAYS * 24 * 60 * 60 * 1000;
    const trimmed = list.filter((s) => new Date(s.timestamp).getTime() > cutoff);
    window.localStorage.setItem(SENTIMENT_SNAPSHOTS_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

/** Generate initial 7-day mock snapshots for playback. */
// TODO: Replace with Sentiment Snapshots API
// Endpoint: GET /api/sentiment/snapshots or time-series store (historical sector/region scores)
// When: before launch
export function generateInitialSnapshots(): SentimentSnapshot[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const snapshots: SentimentSnapshot[] = [];
  const baseScores: SentimentScores = {
    Technology: 58,
    Healthcare: 52,
    Financials: 48,
    "Consumer Discretionary": 55,
    Industrials: 50,
    "Communication Services": 54,
    Energy: 45,
    "Consumer Staples": 51,
    "Real Estate": 42,
    Materials: 47,
    Utilities: 49,
  };
  const globalBase: GlobalScores = {
    "North America": 55,
    Europe: 48,
    "Asia Pacific": 52,
    China: 44,
    "Emerging Markets": 46,
    "Latin America": 43,
    "Middle East & Africa": 47,
  };
  for (let i = 6; i >= 0; i--) {
    const t = new Date(now - i * day);
    t.setHours(12, 0, 0, 0);
    const scores = { ...baseScores } as SentimentScores;
    const globalScores = { ...globalBase } as GlobalScores;
    US_SECTORS.forEach((s) => {
      scores[s] = Math.max(0, Math.min(100, baseScores[s] + (Math.random() - 0.5) * 12));
    });
    GLOBAL_REGIONS.forEach((r) => {
      globalScores[r] = Math.max(0, Math.min(100, globalBase[r] + (Math.random() - 0.5) * 10));
    });
    snapshots.push({ timestamp: t.toISOString(), scores, globalScores });
  }
  return snapshots;
}

/** Community score 0-100 from localStorage posts (keyword match + simple heuristic). */
export function computeCommunityScore(sector: SectorId): number {
  if (typeof window === "undefined") return 50;
  try {
    const raw = window.localStorage.getItem("xchange-demo-posts");
    if (!raw) return 50;
    const posts = JSON.parse(raw) as Array<{ text?: string; date?: string }>;
    if (!Array.isArray(posts)) return 50;
    const keywords = SECTOR_KEYWORDS[sector].map((k) => k.toLowerCase());
    let bullish = 0;
    let bearish = 0;
    const now = Date.now();
    posts.forEach((p) => {
      const text = (p.text ?? "").toLowerCase();
      if (!keywords.some((kw) => text.includes(kw))) return;
      const date = p.date ? new Date(p.date).getTime() : now;
      const ageHours = (now - date) / (60 * 60 * 1000);
      const weight = Math.max(0.1, 1 - ageHours / 168);
      if (text.match(/\b(up|bull|buy|strong|gain|rally|moon)\b/)) bullish += weight;
      else if (text.match(/\b(down|bear|sell|weak|drop|crash)\b/)) bearish += weight;
      else bullish += weight * 0.5;
    });
    const total = bullish + bearish || 1;
    const rawScore = (bullish / total) * 100;
    return Math.round(Math.max(0, Math.min(100, rawScore)));
  } catch {
    return 50;
  }
}

/** Mock news score (replace with API/Claude in production). */
export function getMockNewsScore(_sector: SectorId): number {
  return 45 + Math.round(Math.random() * 20);
}

/** Combined score: 40% community, 60% news. */
export function computeSectorScore(sector: SectorId, newsScore?: number): number {
  const community = computeCommunityScore(sector);
  const news = newsScore ?? getMockNewsScore(sector);
  return Math.round(community * 0.4 + news * 0.6);
}

/** Get current scores for all sectors (and optional global). */
export function getCurrentScores(): { scores: SentimentScores; globalScores: GlobalScores } {
  const scores = {} as SentimentScores;
  US_SECTORS.forEach((s) => {
    scores[s] = computeSectorScore(s);
  });
  const globalScores = {} as GlobalScores;
  GLOBAL_REGIONS.forEach((r) => {
    globalScores[r] = 45 + Math.round(Math.random() * 20);
  });
  return { scores, globalScores };
}

export function hasSeenOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SENTIMENT_ONBOARDING_KEY) === "1";
}

export function setOnboardingSeen(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SENTIMENT_ONBOARDING_KEY, "1");
}

export type DriverPost = { text: string; date: string; sentiment: "bullish" | "bearish" | "neutral" };

/** Get posts that mention this sector (for detail panel). */
export function getSectorDriverPosts(sector: SectorId): DriverPost[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("xchange-demo-posts");
    if (!raw) return [];
    const posts = JSON.parse(raw) as Array<{ text?: string; date?: string }>;
    if (!Array.isArray(posts)) return [];
    const keywords = SECTOR_KEYWORDS[sector].map((k) => k.toLowerCase());
    const out: DriverPost[] = [];
    posts.forEach((p) => {
      const text = (p.text ?? "").trim();
      if (!text || !keywords.some((kw) => text.toLowerCase().includes(kw))) return;
      let sentiment: "bullish" | "bearish" | "neutral" = "neutral";
      if (text.toLowerCase().match(/\b(up|bull|buy|strong|gain|rally|moon|breakout)\b/)) sentiment = "bullish";
      else if (text.toLowerCase().match(/\b(down|bear|sell|weak|drop|crash|dump)\b/)) sentiment = "bearish";
      out.push({ text, date: p.date ?? new Date().toISOString(), sentiment });
    });
    return out.slice(-20).reverse();
  } catch {
    return [];
  }
}

/** Placeholder news/politics drivers (replace with real API). */
// TODO: Replace with News / Sentiment API
// Endpoint: NewsAPI or similar + Claude (or provider) for sector headline sentiment
// When: before launch
export function getSectorDriverHeadlines(_sector: SectorId): string[] {
  return [
    "Earnings beat expectations; guidance raised.",
    "Fed holds rates; sector seen as beneficiary.",
    "Regulatory update pending; analysts mixed.",
  ];
}
