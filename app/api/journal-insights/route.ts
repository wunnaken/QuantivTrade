import { NextResponse } from "next/server";
import { anthropicSSEToTextStream } from "@/lib/anthropicStream";

const SYSTEM_PROMPT = `You are a trading-process coach for QuantivTrade. You analyze a trader's logged journal data and produce observational, educational feedback about their PROCESS — risk management discipline, position-sizing patterns, journaling consistency, strategy mix, behavioral biases.

CRITICAL GUARDRAILS — never violate:
- Do NOT provide financial, investment, or tax advice
- Do NOT recommend specific securities, asset classes, or trades to enter or exit
- Do NOT predict market direction or price movements
- Do NOT suggest position sizes or capital allocation amounts
- Frame everything as observation of past behavior, not guidance for future trades
- Use "you tend to…", "your trades show…", NOT "you should buy…", "consider increasing exposure to…"
- The "actionItems" and "weeklyChallenge" fields must be PROCESS habits (e.g. "set a written stop-loss before each entry", "review losing trades weekly"), never market calls

Format response as JSON with these exact fields:
{
  "overallGrade": string (A+/A/B+/B/C+/C/D/F),
  "gradeSummary": string (1 sentence on the grade — about discipline/consistency, not P&L predictions),
  "strengths": array of 3 strings (process strengths),
  "weaknesses": array of 3 strings (process gaps to work on),
  "patterns": array of 2-3 strings (behavioral patterns noticed in past trades),
  "actionItems": array of 3 strings (process habits to adopt — never trade recommendations),
  "riskAssessment": string (observation of their risk-management discipline),
  "bestStrategy": string (which of their logged strategies has performed best HISTORICALLY — past tense only),
  "coachingTip": string (one process tip, 2-3 sentences),
  "weeklyChallenge": string (one process habit to practice this week)
}
Return only valid JSON.`;

export type JournalInsightsResponse = {
  overallGrade: string;
  gradeSummary: string;
  strengths: string[];
  weaknesses: string[];
  patterns: string[];
  actionItems: string[];
  riskAssessment: string;
  bestStrategy: string;
  coachingTip: string;
  weeklyChallenge: string;
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 503 }
    );
  }

  let body: { userMessage: string };
  try {
    body = (await request.json()) as { userMessage: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userMessage } = body;
  if (!userMessage || typeof userMessage !== "string") {
    return NextResponse.json({ error: "userMessage required" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        // claude-sonnet-4-6 has noticeably better latency than 4-20250514 and
        // produces equivalent quality for this structured-JSON task.
        model: "claude-sonnet-4-6",
        // 1500 leaves enough headroom for verbose insights without truncating
        // mid-string. Earlier 800 cap caused "Unterminated string in JSON".
        max_tokens: 1500,
        stream: true,
        system: SYSTEM_PROMPT,
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
