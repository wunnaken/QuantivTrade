import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

type IndicatorDef = {
  id: string;
  label: string;
  seriesId: string;
  category: string;
  frequency: string;
  /** Higher = more bullish. Set false for series where higher = worse (e.g. jobless claims) */
  higherIsBetter: boolean;
  neutralLevel?: number;
};

const INDICATORS: IndicatorDef[] = [
  // Business Sentiment
  { id: "nfib", label: "NFIB Small Business Optimism", seriesId: "NFIBOPTM", category: "Business Sentiment", frequency: "Monthly", higherIsBetter: true, neutralLevel: 100 },
  { id: "ism-mfg", label: "ISM Manufacturing PMI", seriesId: "MANEMP", category: "Business Sentiment", frequency: "Monthly", higherIsBetter: true, neutralLevel: 50 },
  { id: "ism-svc", label: "ISM Services PMI", seriesId: "NMFCI", category: "Business Sentiment", frequency: "Monthly", higherIsBetter: true, neutralLevel: 50 },
  { id: "philly-fed", label: "Philadelphia Fed Mfg Index", seriesId: "GFDEGDQ188S", category: "Business Sentiment", frequency: "Monthly", higherIsBetter: true, neutralLevel: 0 },
  { id: "empire", label: "Empire State Mfg Index", seriesId: "GACDISA066MSFRBNY", category: "Business Sentiment", frequency: "Monthly", higherIsBetter: true, neutralLevel: 0 },
  { id: "chicago-pmi", label: "Chicago PMI", seriesId: "NAPMPMI", category: "Business Sentiment", frequency: "Monthly", higherIsBetter: true, neutralLevel: 50 },

  // Consumer Sentiment
  { id: "umich", label: "U. Michigan Consumer Sentiment", seriesId: "UMCSENT", category: "Consumer Sentiment", frequency: "Monthly", higherIsBetter: true },
  { id: "cb-confidence", label: "Conference Board Consumer Confidence", seriesId: "CSCICP03USM665S", category: "Consumer Sentiment", frequency: "Monthly", higherIsBetter: true },

  // Housing Sentiment
  { id: "nahb", label: "NAHB Housing Market Index", seriesId: "HOUST", category: "Housing Sentiment", frequency: "Monthly", higherIsBetter: true },

  // Labor Sentiment
  { id: "jolts", label: "JOLTS Job Openings", seriesId: "JTSJOL", category: "Labor Sentiment", frequency: "Monthly", higherIsBetter: true },
  { id: "initial-claims", label: "Initial Jobless Claims", seriesId: "ICSA", category: "Labor Sentiment", frequency: "Weekly", higherIsBetter: false },
  { id: "continuing-claims", label: "Continuing Jobless Claims", seriesId: "CCSA", category: "Labor Sentiment", frequency: "Weekly", higherIsBetter: false },
  { id: "adp", label: "ADP Employment Change", seriesId: "ADPWNUSNERSA", category: "Labor Sentiment", frequency: "Monthly", higherIsBetter: true },

  // Financial Conditions
  { id: "nfci", label: "Chicago Fed Financial Conditions", seriesId: "NFCI", category: "Financial Conditions", frequency: "Weekly", higherIsBetter: false, neutralLevel: 0 },

  // Global
  { id: "zew", label: "ZEW Economic Sentiment (EU)", seriesId: "EUROCOINEA", category: "Global", frequency: "Monthly", higherIsBetter: true, neutralLevel: 0 },
];

type FredObs = { date: string; value: string };

async function fetchFredSeries(apiKey: string, seriesId: string, limit = 6): Promise<Array<{ date: string; value: number }>> {
  try {
    const params = new URLSearchParams({
      series_id: seriesId,
      api_key: apiKey,
      file_type: "json",
      sort_order: "desc",
      limit: String(limit),
    });
    const res = await fetch(`${FRED_BASE}?${params}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json() as { observations?: FredObs[] };
    return (data.observations ?? [])
      .map(o => ({ date: o.date, value: parseFloat(o.value) }))
      .filter(o => Number.isFinite(o.value))
      .reverse(); // oldest first
  } catch { return []; }
}

let indicatorCache: { data: unknown; fetchedAt: number } | null = null;
const CACHE_MS = 15 * 60 * 1000; // 15 minutes — these are slow-moving surveys

export async function GET() {
  if (indicatorCache && Date.now() - indicatorCache.fetchedAt < CACHE_MS) {
    return NextResponse.json(indicatorCache.data);
  }

  const fredKey = process.env.FRED_API_KEY?.trim();
  if (!fredKey) {
    return NextResponse.json({ indicators: [], error: "Data temporarily unavailable" });
  }

  const results = await Promise.all(
    INDICATORS.map(async (ind) => {
      const obs = await fetchFredSeries(fredKey, ind.seriesId, 6);
      if (obs.length === 0) return null;

      const latest = obs[obs.length - 1];
      const prev = obs.length >= 2 ? obs[obs.length - 2] : null;
      const change = prev ? latest.value - prev.value : null;
      const changePct = prev && prev.value !== 0 ? ((latest.value - prev.value) / Math.abs(prev.value)) * 100 : null;

      // Determine signal
      let signal: "bullish" | "bearish" | "neutral" = "neutral";
      if (change !== null) {
        if (ind.higherIsBetter) {
          signal = change > 0 ? "bullish" : change < 0 ? "bearish" : "neutral";
        } else {
          signal = change < 0 ? "bullish" : change > 0 ? "bearish" : "neutral";
        }
      }

      // Check against neutral level if defined
      if (ind.neutralLevel !== undefined) {
        if (latest.value > ind.neutralLevel + 2) signal = ind.higherIsBetter ? "bullish" : "bearish";
        else if (latest.value < ind.neutralLevel - 2) signal = ind.higherIsBetter ? "bearish" : "bullish";
      }

      return {
        id: ind.id,
        label: ind.label,
        category: ind.category,
        frequency: ind.frequency,
        value: latest.value,
        date: latest.date,
        change,
        changePct,
        signal,
        history: obs.map(o => ({ date: o.date, value: o.value })),
      };
    })
  );

  const responseData = {
    indicators: results.filter((r): r is NonNullable<typeof r> => r !== null),
    lastUpdated: new Date().toISOString(),
  };

  indicatorCache = { data: responseData, fetchedAt: Date.now() };
  return NextResponse.json(responseData);
}
