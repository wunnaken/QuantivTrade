import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are a financial analyst assistant for Xchange, a social trading intelligence platform. When given a stock ticker or asset, provide a clear, structured analysis in this exact JSON format:
{
  "riskRating": number (1-10, where 1=very safe, 10=extremely risky),
  "riskLabel": string (e.g. "Moderate Risk"),
  "riskColor": string ("green", "yellow", or "red"),
  "summary": string (2-3 sentences, plain English overview of what this company/asset is),
  "bullCase": string (2-3 sentences on why it could go up),
  "bearCase": string (2-3 sentences on why it could go down),
  "suitableFor": string (which investor profile this suits: Conservative/Moderate/Aggressive),
  "keyFactors": array of 3-4 strings (key things to watch for this asset),
  "disclaimer": "This is AI-generated analysis for educational purposes only. Not financial advice."
}
Return only valid JSON, no markdown, no extra text.`;

export type AnalyzeTickerResponse = {
  riskRating: number;
  riskLabel: string;
  riskColor: "green" | "yellow" | "red";
  summary: string;
  bullCase: string;
  bearCase: string;
  suitableFor: string;
  keyFactors: string[];
  disclaimer: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.trim().toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: "Missing ticker" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 503 }
    );
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
        messages: [{ role: "user", content: `Analyze this asset: ${ticker}` }],
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

    // Strip markdown code fence if present
    const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    const parsed = JSON.parse(jsonStr) as AnalyzeTickerResponse;

    return NextResponse.json(parsed);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
