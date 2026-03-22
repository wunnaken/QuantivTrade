import { type NextRequest } from "next/server";
import {
  US_SECTORS,
  GLOBAL_REGIONS,
  SECTOR_KEYWORDS,
  type SectorId,
} from "@/lib/sentiment-radar";

export const dynamic = "force-dynamic";

// ─── Types ────────────────────────────────────────────────────────────────────

type Scores = Record<string, number>;

interface State {
  scores: Scores;
  globalScores: Scores;
  lastUpdated: number;
  /** Most recent headlines that matched each sector's keywords */
  sectorHeadlines: Record<string, string[]>;
  /** Subset of sector headlines that also mention policy/regulation */
  policyHeadlines: Record<string, string[]>;
  /** Most recent headlines that matched each global region */
  regionHeadlines: Record<string, string[]>;
}

// ─── Baselines ────────────────────────────────────────────────────────────────

const BASE_SCORES: Scores = {
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

const BASE_GLOBAL: Scores = {
  "North America": 55,
  Europe: 48,
  "Asia Pacific": 52,
  China: 44,
  "Emerging Markets": 46,
  "Latin America": 43,
  "Middle East & Africa": 47,
};

const REGION_KEYWORDS: Record<string, string[]> = {
  "North America": ["united states", "us economy", "canada", "wall street", "s&p", "nasdaq", "dow", "fed", "federal reserve", "american"],
  Europe: ["europe", "eurozone", "ecb", "germany", "france", "italy", "spain", "uk", "britain", "euro", "european"],
  "Asia Pacific": ["asia", "japan", "south korea", "australia", "india", "singapore", "hong kong", "asia pacific"],
  China: ["china", "chinese", "beijing", "shanghai", "pboc", "renminbi", "yuan", "ccp"],
  "Emerging Markets": ["emerging markets", "developing", "brazil", "russia", "indonesia", "turkey", "south africa"],
  "Latin America": ["latin america", "brazil", "mexico", "argentina", "chile", "colombia", "peru"],
  "Middle East & Africa": ["middle east", "africa", "saudi", "uae", "dubai", "israel", "nigeria", "south africa", "opec"],
};

const POLICY_TERMS = [
  "fed", "federal reserve", "rate hike", "interest rate", "rate cut",
  "regulation", "sec", "treasury", "congress", "legislation", "tariff",
  "tax", "policy", "central bank", "monetary", "fiscal", "sanctions",
];

// ─── Shared server-side state ──────────────────────────────────────────────

let state: State = {
  scores: { ...BASE_SCORES },
  globalScores: { ...BASE_GLOBAL },
  lastUpdated: 0,
  sectorHeadlines: {},
  policyHeadlines: {},
  regionHeadlines: {},
};

// 8-minute poll → ~180 requests/day, within NewsData.io free tier (200/day)
const POLL_MS = 8 * 60 * 1000;
let pollTimer: ReturnType<typeof setInterval> | null = null;
const subscribers = new Set<(data: string) => void>();

// ─── Sentiment scoring ────────────────────────────────────────────────────────

const POSITIVE = new Set([
  "surge", "rally", "gain", "rise", "jump", "boom", "growth", "profit",
  "beat", "record", "bullish", "upgrade", "strong", "soar", "advance",
  "positive", "win", "outperform", "robust", "recovery", "expand", "high",
]);
const NEGATIVE = new Set([
  "crash", "drop", "fall", "decline", "slump", "loss", "miss", "bearish",
  "downgrade", "weak", "plunge", "tumble", "retreat", "fear", "sell", "low",
  "negative", "recession", "deficit", "risk", "warning", "cut", "layoff",
]);

function rawSentiment(text: string): number {
  const words = text.toLowerCase().split(/\W+/);
  let s = 0;
  for (const w of words) {
    if (POSITIVE.has(w)) s += 1;
    if (NEGATIVE.has(w)) s -= 1;
  }
  return s;
}

function sectorSignals(text: string): Record<string, number> {
  const lower = text.toLowerCase();
  const delta = Math.max(-8, Math.min(8, rawSentiment(text) * 3));
  const out: Record<string, number> = {};
  for (const sector of US_SECTORS) {
    const kws = SECTOR_KEYWORDS[sector as SectorId] ?? [];
    if (kws.some((kw) => lower.includes(kw.toLowerCase()))) out[sector] = delta;
  }
  return out;
}

// ─── News polling ─────────────────────────────────────────────────────────────

async function pollNewsData(): Promise<void> {
  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) return;

  try {
    const url = `https://newsdata.io/api/1/news?apikey=${apiKey}&category=business&language=en&size=10`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return;

    const json = (await res.json()) as {
      results?: Array<{ title?: string; description?: string }>;
    };
    const articles = json.results ?? [];
    if (articles.length === 0) return;

    const newScores = { ...state.scores };
    const newSectorHeadlines: Record<string, string[]> = {};
    const newPolicyHeadlines: Record<string, string[]> = {};
    const newRegionHeadlines: Record<string, string[]> = {};

    for (const article of articles) {
      const title = (article.title ?? "").trim();
      const text = [title, article.description].filter(Boolean).join(" ");
      const lower = text.toLowerCase();
      const signals = sectorSignals(text);
      const isPolicy = POLICY_TERMS.some((t) => lower.includes(t));

      // Update sector scores + collect headlines
      for (const [sector, delta] of Object.entries(signals)) {
        newScores[sector] = (newScores[sector] ?? 50) + delta * 0.2;

        if (title) {
          newSectorHeadlines[sector] ??= [];
          if (newSectorHeadlines[sector].length < 4) newSectorHeadlines[sector].push(title);

          if (isPolicy) {
            newPolicyHeadlines[sector] ??= [];
            if (newPolicyHeadlines[sector].length < 3) newPolicyHeadlines[sector].push(title);
          }
        }
      }

      // Collect regional headlines
      for (const region of GLOBAL_REGIONS) {
        const kws = REGION_KEYWORDS[region] ?? [];
        if (kws.some((kw) => lower.includes(kw)) && title) {
          newRegionHeadlines[region] ??= [];
          if (newRegionHeadlines[region].length < 4) newRegionHeadlines[region].push(title);
        }
      }
    }

    // Mean-reversion for sector scores
    for (const sector of US_SECTORS) {
      const base = BASE_SCORES[sector] ?? 50;
      newScores[sector] = Math.round(
        Math.max(0, Math.min(100, (newScores[sector] ?? 50) * 0.9 + base * 0.1))
      );
    }

    // Global scores: jitter + mean-reversion
    const newGlobal = { ...state.globalScores };
    for (const region of GLOBAL_REGIONS) {
      const base = BASE_GLOBAL[region] ?? 50;
      const jitter = (Math.random() - 0.5) * 4;
      newGlobal[region] = Math.round(
        Math.max(0, Math.min(100, (newGlobal[region] ?? 50) * 0.85 + base * 0.1 + jitter))
      );
    }

    // Merge new headlines with existing (keep previous poll's if no new ones this poll)
    const mergedSectorH: Record<string, string[]> = { ...state.sectorHeadlines };
    for (const [s, hs] of Object.entries(newSectorHeadlines)) mergedSectorH[s] = hs;

    const mergedPolicyH: Record<string, string[]> = { ...state.policyHeadlines };
    for (const [s, hs] of Object.entries(newPolicyHeadlines)) mergedPolicyH[s] = hs;

    const mergedRegionH: Record<string, string[]> = { ...state.regionHeadlines };
    for (const [r, hs] of Object.entries(newRegionHeadlines)) mergedRegionH[r] = hs;

    state = {
      scores: newScores,
      globalScores: newGlobal,
      lastUpdated: Date.now(),
      sectorHeadlines: mergedSectorH,
      policyHeadlines: mergedPolicyH,
      regionHeadlines: mergedRegionH,
    };

    broadcast();
  } catch {
    // Silently ignore network / parse errors
  }
}

function broadcast() {
  const payload = JSON.stringify({
    type: "scores",
    scores: state.scores,
    globalScores: state.globalScores,
    lastUpdated: state.lastUpdated,
    sectorHeadlines: state.sectorHeadlines,
    policyHeadlines: state.policyHeadlines,
    regionHeadlines: state.regionHeadlines,
  });
  for (const push of subscribers) push(payload);
}

function ensurePolling() {
  if (pollTimer !== null) return;
  setTimeout(() => void pollNewsData(), 2_000);
  pollTimer = setInterval(() => void pollNewsData(), POLL_MS);
}

// ─── SSE Route ────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  let push!: (data: string) => void;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      push = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch { /* closed */ }
      };

      subscribers.add(push);
      ensurePolling();

      // Send current cached state immediately
      const initial = JSON.stringify({
        type: "scores",
        scores: state.scores,
        globalScores: state.globalScores,
        lastUpdated: state.lastUpdated || Date.now(),
        sectorHeadlines: state.sectorHeadlines,
        policyHeadlines: state.policyHeadlines,
        regionHeadlines: state.regionHeadlines,
      });
      controller.enqueue(encoder.encode(`data: ${initial}\n\n`));

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      req.signal.addEventListener("abort", () => {
        subscribers.delete(push);
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
        if (subscribers.size === 0 && pollTimer !== null) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
