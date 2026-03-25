import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SYSTEM_PROMPT = `You are a financial analyst for QuantivTrade. Given this economic data for a country, provide a JSON response with exactly these fields:
{
  "outlook": string (2-3 sentences, plain English market outlook for this country),
  "riskScore": number (1-10, investment risk),
  "riskLabel": string (e.g. "Moderate Risk"),
  "riskColor": string ("green", "yellow", or "red"),
  "opportunities": array of 2 strings (potential investment opportunities),
  "risks": array of 2 strings (main economic risks),
  "sentiment": string ("Bullish", "Neutral", or "Bearish")
}
Return only valid JSON, no markdown, no extra text.`;

export type MapCountryOutlookResponse = {
  outlook: string;
  riskScore: number;
  riskLabel: string;
  riskColor: "green" | "yellow" | "red";
  opportunities: string[];
  risks: string[];
  sentiment: string;
};

export async function POST(request: NextRequest) {
  let body: { country: string; gdpGrowth?: number | null; inflation?: number | null; unemployment?: number | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const country = body?.country?.trim();
  if (!country) {
    return NextResponse.json({ error: "Missing country" }, { status: 400 });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  const gdp = body.gdpGrowth != null ? `${body.gdpGrowth}%` : "N/A";
  const inf = body.inflation != null ? `${body.inflation}%` : "N/A";
  const unem = body.unemployment != null ? `${body.unemployment}%` : "N/A";
  const userMessage = `Country: ${country}, GDP Growth: ${gdp}, Inflation: ${inf}, Unemployment: ${unem}`;

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

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.[0]?.text?.trim() ?? "";
    if (!text) return NextResponse.json({ error: "Empty response" }, { status: 502 });

    const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    const parsed = JSON.parse(jsonStr) as MapCountryOutlookResponse;
    return NextResponse.json(parsed);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
