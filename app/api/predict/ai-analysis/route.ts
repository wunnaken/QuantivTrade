import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

interface AnalysisRequest {
  question: string;
  currentProbability: number | null;
  context?: string;
}

export async function POST(req: Request) {
  try {
    const body: AnalysisRequest = await req.json();
    const { question, currentProbability, context } = body;

    if (!question || question.trim().length < 5) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI analysis not configured" }, { status: 503 });
    }

    const currentStr =
      currentProbability != null
        ? `The current market probability is ${currentProbability}%.`
        : "No current market price is available.";

    const prompt = `You are a prediction market analyst. Analyze the following prediction market question and provide a detailed probability assessment.

Question: "${question}"
${currentStr}
${context ? `Additional context: ${context}` : ""}

Provide your analysis in this exact JSON format (no markdown, just raw JSON):
{
  "fairValue": <number 0-100, your estimated fair probability>,
  "confidence": <"low" | "medium" | "high">,
  "summary": "<2-3 sentence summary of your assessment>",
  "bullishFactors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "bearishFactors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "baseRate": "<historical base rate analysis, 1-2 sentences>",
  "mispricing": <number, how far off current market is — positive means market underprices YES, negative means overprices. null if no current price>,
  "keyRisks": "<main risks to your assessment, 1 sentence>"
}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Claude error:", err);
      return NextResponse.json({ error: "AI analysis failed" }, { status: 500 });
    }

    const data = await res.json();
    const text = data.content?.[0]?.text ?? "";

    // Parse JSON from response
    let analysis;
    try {
      // Strip potential markdown code fences
      const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      // If JSON parse fails, return raw text
      return NextResponse.json({ raw: text, fairValue: null });
    }

    return NextResponse.json(analysis);
  } catch (e) {
    console.error("AI analysis error:", e);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}

// Bulk mispricing scan
export async function GET(req: Request) {
  try {
    const base = new URL(req.url).origin;
    const marketsRes = await fetch(`${base}/api/predict/markets`, { next: { revalidate: 300 } });
    if (!marketsRes.ok) return NextResponse.json({ error: "Could not load markets" }, { status: 500 });

    const { markets } = await marketsRes.json();
    const sample = markets.slice(0, 20);

    if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

    const list = sample
      .map((m: { question: string; probability: number; source: string }, i: number) => `${i + 1}. "${m.question}" — current: ${m.probability}% (${m.source})`)
      .join("\n");

    const prompt = `You are a prediction market analyst. Review these prediction market questions and identify which ones seem potentially mispriced based on available information.

Markets:
${list}

Return a JSON array of the top 5 most interesting/potentially mispriced markets. Format:
[
  {
    "index": <1-based index from list>,
    "question": "<exact question>",
    "currentProbability": <current %>,
    "fairValue": <your estimate %>,
    "reasoning": "<1-2 sentences why you think it's mispriced>",
    "direction": "overpriced" | "underpriced"
  }
]

Only return raw JSON array, no markdown.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) return NextResponse.json({ error: "AI scan failed" }, { status: 500 });
    const data = await res.json();
    const text = data.content?.[0]?.text ?? "[]";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const results = JSON.parse(cleaned);
    return NextResponse.json({ mispricings: results });
  } catch (e) {
    console.error("Scan error:", e);
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }
}
