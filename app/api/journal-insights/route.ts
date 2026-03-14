import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are an expert trading coach and performance analyst for Xchange. Analyze this trader's journal data and provide honest, specific, actionable feedback. Be direct but encouraging. Format your response as JSON with these exact fields:
{
  "overallGrade": string (A+/A/B+/B/C+/C/D/F),
  "gradeSummary": string (1 sentence explaining grade),
  "strengths": array of 3 strings (what they do well),
  "weaknesses": array of 3 strings (areas to improve),
  "patterns": array of 2-3 strings (patterns noticed),
  "actionItems": array of 3 strings (specific things to do differently),
  "riskAssessment": string (assessment of their risk management),
  "bestStrategy": string (their most profitable strategy type),
  "coachingTip": string (one key piece of advice, 2-3 sentences),
  "weeklyChallenge": string (one specific challenge to improve their trading)
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
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: err || `Anthropic API error: ${res.status}` },
        { status: res.status >= 500 ? 502 : 400 }
      );
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.[0]?.text?.trim() ?? "";
    if (!text) {
      return NextResponse.json({ error: "Empty response from API" }, { status: 502 });
    }

    const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    const parsed = JSON.parse(jsonStr) as JournalInsightsResponse;

    return NextResponse.json(parsed);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
