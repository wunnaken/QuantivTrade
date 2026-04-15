/**
 * GET  /api/ceo-sentiment   — returns all stored sentiment rows (fast Supabase read)
 * POST /api/ceo-sentiment   — weekly refresh job; requires Authorization: Bearer <CRON_SECRET>
 *
 * Required Supabase table (run once):
 *   create table if not exists ceo_sentiments (
 *     ticker          text primary key,
 *     sentiment       text not null check (sentiment in ('positive','neutral','negative')),
 *     sentiment_reason text,
 *     headlines_used  jsonb default '[]',
 *     updated_at      timestamptz default now()
 *   );
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../../lib/supabase/server";
import { CEOS } from "../../../lib/ceo-data";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min – Vercel Pro / Railway

// ─── GET: return all stored sentiments ────────────────────────────────────────

export async function GET(req: NextRequest) {
  // ?test=AAPL  — run a single-ticker debug (no auth needed locally)
  const testTicker = req.nextUrl.searchParams.get("test")?.toUpperCase();
  if (testTicker) {
    const finnhubKey = process.env.FINNHUB_API_KEY?.trim() ?? "";
    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim() ?? "";
    const ceo = CEOS.find((c) => c.ticker.toUpperCase() === testTicker);
    if (!ceo) return NextResponse.json({ error: "Unknown ticker" }, { status: 404 });
    const headlines = await fetchHeadlines(ceo.ticker, finnhubKey);
    const result = await classifyWithClaude(ceo.name, ceo.company, ceo.ticker, headlines, anthropicKey);
    return NextResponse.json({ ticker: testTicker, headlines, result });
  }

  try {
    const db = createServerClient();
    const { data, error } = await db
      .from("ceo_sentiments")
      .select("ticker, sentiment, sentiment_reason, previous_sentiment, sentiment_changed_at, updated_at");

    if (error) throw error;
    return NextResponse.json({ sentiments: data ?? [] });
  } catch (err) {
    console.error("[ceo-sentiment GET]", err);
    return NextResponse.json({ sentiments: [] });
  }
}

// ─── POST: weekly refresh ─────────────────────────────────────────────────────

const FINNHUB_BASE = "https://finnhub.io/api/v1";

type FinnhubNewsItem = {
  headline?: string;
  summary?: string;
  datetime?: number;
};

type SentimentResult = {
  sentiment: "positive" | "neutral" | "negative";
  reason: string;
};

async function fetchHeadlines(ticker: string, finnhubKey: string): Promise<string[]> {
  const to = Math.floor(Date.now() / 1000);
  const from = to - 7 * 24 * 60 * 60; // 7 days ago
  const url = `${FINNHUB_BASE}/company-news?symbol=${encodeURIComponent(ticker)}&from=${dateStr(from)}&to=${dateStr(to)}&token=${finnhubKey}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const items = (await res.json()) as FinnhubNewsItem[];
    if (!Array.isArray(items)) return [];
    return items
      .slice(0, 10) // top 10 recent headlines
      .map((n) => n.headline ?? n.summary ?? "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

function dateStr(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 10);
}

async function classifyWithClaude(
  ceoName: string,
  company: string,
  ticker: string,
  headlines: string[],
  anthropicKey: string
): Promise<SentimentResult | null> {
  const headlineBlock =
    headlines.length > 0
      ? headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")
      : "(no recent news this week)";

  const prompt = `CEO: ${ceoName}
Company: ${company} (${ticker})
Recent headlines (last 7 days):
${headlineBlock}

Classify the overall market/public sentiment toward this CEO and company based on these headlines.
You MUST choose exactly one of: "positive", "neutral", or "negative". Never use "mixed" — if signals are mixed, use "neutral".
Respond with a single JSON object:
{"sentiment":"positive"|"neutral"|"negative","reason":"1-2 sentence explanation"}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        system:
          "You are a financial sentiment analyst. Reply with a single valid JSON object only — no markdown, no code fences, no extra text.",
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[ceo-sentiment] Claude error for ${ticker}: ${res.status} ${errText}`);
      return null;
    }
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const raw = data.content?.[0]?.text?.trim() ?? "";
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    try {
      const parsed = JSON.parse(text) as Partial<SentimentResult>;
      if (
        parsed.sentiment === "positive" ||
        parsed.sentiment === "neutral" ||
        parsed.sentiment === "negative"
      ) {
        return { sentiment: parsed.sentiment, reason: String(parsed.reason ?? "") };
      }
      console.error(`[ceo-sentiment] Unexpected Claude JSON for ${ticker}:`, text);
      return null;
    } catch {
      console.error(`[ceo-sentiment] Claude non-JSON for ${ticker}:`, text);
      return null;
    }
  } catch (err) {
    console.error(`[ceo-sentiment] Claude fetch error for ${ticker}:`, err);
    return null;
  }
}

async function processBatch(
  batch: (typeof CEOS)[number][],
  finnhubKey: string,
  anthropicKey: string,
  db: ReturnType<typeof createServerClient>
): Promise<{ ticker: string; ok: boolean }[]> {
  return Promise.all(
    batch.map(async (ceo) => {
      try {
        const headlines = await fetchHeadlines(ceo.ticker, finnhubKey);
        const result = await classifyWithClaude(
          ceo.name,
          ceo.company,
          ceo.ticker,
          headlines,
          anthropicKey
        );
        if (!result) return { ticker: ceo.ticker, ok: false };

        // Read current sentiment so we can detect a flip
        const { data: existing } = await db
          .from("ceo_sentiments")
          .select("sentiment")
          .eq("ticker", ceo.ticker)
          .maybeSingle();

        const now = new Date().toISOString();
        const sentimentChanged = existing && existing.sentiment !== result.sentiment;

        await db.from("ceo_sentiments").upsert(
          {
            ticker: ceo.ticker,
            sentiment: result.sentiment,
            sentiment_reason: result.reason,
            headlines_used: headlines,
            updated_at: now,
            // Record the previous value and timestamp only when it actually flips
            ...(sentimentChanged
              ? { previous_sentiment: existing.sentiment, sentiment_changed_at: now }
              : {}),
          },
          { onConflict: "ticker" }
        );

        return { ticker: ceo.ticker, ok: true };
      } catch (err) {
        console.error(`[ceo-sentiment] Failed for ${ceo.ticker}:`, err);
        return { ticker: ceo.ticker, ok: false };
      }
    })
  );
}

export async function POST(req: NextRequest) {
  // Auth check
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!cronSecret || token !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const finnhubKey = process.env.FINNHUB_API_KEY?.trim();
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!finnhubKey || !anthropicKey) {
    return NextResponse.json({ error: "Missing API keys" }, { status: 500 });
  }

  const db = createServerClient();
  const BATCH_SIZE = 3;
  const DELAY_MS = 4000; // 4s between batches → ~45 req/min, safely under 50/min limit

  const results: { ticker: string; ok: boolean }[] = [];
  const batches: (typeof CEOS)[number][][] = [];
  for (let i = 0; i < CEOS.length; i += BATCH_SIZE) {
    batches.push(CEOS.slice(i, i + BATCH_SIZE));
  }

  for (const batch of batches) {
    const batchResults = await processBatch(batch, finnhubKey, anthropicKey, db);
    results.push(...batchResults);
    if (DELAY_MS > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).map((r) => r.ticker);

  console.log(`[ceo-sentiment] Updated ${ok}/${results.length} CEOs. Failed: ${failed.join(", ") || "none"}`);
  return NextResponse.json({ updated: ok, total: results.length, failed });
}
