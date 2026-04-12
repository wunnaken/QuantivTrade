import { NextResponse } from "next/server";
import { anthropicSSEToTextStream } from "@/lib/anthropicStream";
import type { BriefingPreferences } from "../../../lib/briefing-preferences";
import { buildPreferencesSummary } from "../../../lib/briefing-preferences";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BASE_SYSTEM_PROMPT = `You are the morning market analyst for QuantivTrade, a social trading intelligence platform. Generate a concise, insightful morning market briefing. Respond in this exact JSON format:
{
  "headline": string (one punchy headline summarizing today's market mood, max 10 words),
  "marketMood": string ("Risk On", "Risk Off", or "Neutral"),
  "moodColor": string ("green", "red", or "yellow"),
  "overview": string (3-4 sentences covering overnight market action, key moves, and what drove them),
  "topStories": array of 3 objects {
    "title": string (headline, max 12 words),
    "impact": string ("Bullish", "Bearish", or "Neutral"),
    "detail": string (1-2 sentences explaining market impact)
  },
  "watchlist": array of 4 objects {
    "asset": string (ticker or name),
    "reason": string (1 sentence why to watch today)
  },
  "keyLevels": array of 3 objects {
    "asset": string,
    "level": string (price level),
    "significance": string (why it matters, 1 sentence)
  },
  "geopolitical": string (1-2 sentences on any geopolitical developments affecting markets),
  "tradersEdge": string (one specific actionable insight for today, 2-3 sentences),
  "oneLiner": string (a witty or insightful one-liner about today's market, like a Bloomberg terminal quip)
}
Return only valid JSON. Base this on actual current market conditions and news.`;

export type MorningBriefingResponse = {
  headline: string;
  marketMood: string;
  moodColor: "green" | "red" | "yellow";
  overview: string;
  topStories: { title: string; impact: string; detail: string }[];
  watchlist: { asset: string; reason: string }[];
  keyLevels: { asset: string; level: string; significance: string }[];
  geopolitical: string;
  tradersEdge: string;
  oneLiner: string;
};

async function fetchMarketSnapshot(): Promise<string> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return "";
  try {
    const [spy, qqq] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=SPY&token=${key}`, { next: { revalidate: 0 } }).then((r) => (r.ok ? r.json() : null)),
      fetch(`https://finnhub.io/api/v1/quote?symbol=QQQ&token=${key}`, { next: { revalidate: 0 } }).then((r) => (r.ok ? r.json() : null)),
    ]);
    const parts: string[] = [];
    if (spy?.c != null) parts.push(`SPY: $${spy.c.toFixed(2)} (${(spy.dp ?? 0) >= 0 ? "+" : ""}${(spy.dp ?? 0).toFixed(2)}%)`);
    if (qqq?.c != null) parts.push(`QQQ: $${qqq.c.toFixed(2)} (${(qqq.dp ?? 0) >= 0 ? "+" : ""}${(qqq.dp ?? 0).toFixed(2)}%)`);
    return parts.length ? `Current market snapshot: ${parts.join("; ")}.` : "";
  } catch {
    return "";
  }
}

async function generate(preferences: BriefingPreferences | null): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const snapshot = await fetchMarketSnapshot();

  let systemPrompt = BASE_SYSTEM_PROMPT;
  if (preferences) {
    const summary = buildPreferencesSummary(preferences);
    if (summary) {
      systemPrompt += `\n\nThis user has provided personal trading preferences. Prioritize their watchlist tickers in the watchlist and key levels sections, focus on their sectors of interest in top stories, and tailor the trader's edge to their trading style and risk tolerance. Preferences: ${summary}.`;
    }
  }

  const userMessage = [
    `Generate the morning market briefing for ${today}.`,
    snapshot,
    "Use current market conditions and recent news.",
  ].filter(Boolean).join(" ");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1200,
        stream: true,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!res.ok || !res.body) {
      const err = await res.text();
      return NextResponse.json(
        { error: err || `Anthropic API error: ${res.status}` },
        { status: res.status >= 500 ? 502 : 400 }
      );
    }

    return new Response(anthropicSSEToTextStream(res.body), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return generate(null);
}

export async function POST(req: Request) {
  let preferences: BriefingPreferences | null = null;
  try {
    const body = await req.json();
    preferences = (body.preferences as BriefingPreferences) ?? null;
  } catch {}
  return generate(preferences);
}
