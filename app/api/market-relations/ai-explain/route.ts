import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function callClaude(prompt: string, maxTokens = 512): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return data.content?.[0]?.text?.trim() ?? "";
}

function parseJSON(text: string): Record<string, string> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, string>;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Regime detection mode ────────────────────────────────────────────────
  if (body.isRegimeDetection) {
    const { regime, spyReturn, tltReturn, gldReturn, usoReturn, uupReturn } = body;

    const prompt = `You are a cross-asset macro analyst. Based on these 1-month asset returns, provide analysis of the current market regime.

Detected Regime: ${regime}
SPY (US Equities) 1M: ${typeof spyReturn === "number" ? spyReturn.toFixed(2) + "%" : "N/A"}
TLT (Long Bonds) 1M: ${typeof tltReturn === "number" ? tltReturn.toFixed(2) + "%" : "N/A"}
GLD (Gold) 1M: ${typeof gldReturn === "number" ? gldReturn.toFixed(2) + "%" : "N/A"}
USO (Oil) 1M: ${typeof usoReturn === "number" ? usoReturn.toFixed(2) + "%" : "N/A"}
UUP (US Dollar) 1M: ${typeof uupReturn === "number" ? uupReturn.toFixed(2) + "%" : "N/A"}

Write 3 sentences covering: (1) the economic forces driving this regime, (2) which asset classes typically outperform, (3) key risks to watch.

Respond with JSON only: {"explanation": "3-sentence analysis", "tradingImplication": "one actionable sentence for traders"}`;

    try {
      const text = await callClaude(prompt, 400);
      const parsed = parseJSON(text);
      if (parsed) return NextResponse.json(parsed);
      return NextResponse.json({ explanation: text, tradingImplication: "" });
    } catch (err) {
      return NextResponse.json(
        { error: `AI error: ${err instanceof Error ? err.message : "unknown"}` },
        { status: 500 },
      );
    }
  }

  // ── Pair correlation explanation mode ────────────────────────────────────
  const { assetA, assetB, correlation, duration, classA, classB } = body;

  if (!assetA || !assetB || correlation === undefined) {
    return NextResponse.json({ error: "Missing required fields: assetA, assetB, correlation" }, { status: 400 });
  }

  const corrNum = Number(correlation);
  const direction = corrNum > 0 ? "positively" : "negatively";
  const corrStr = (corrNum >= 0 ? "+" : "") + corrNum.toFixed(2);

  const prompt = `You are a cross-asset market analyst specializing in correlations between asset classes.

Asset A: ${assetA} (class: ${classA ?? "unknown"})
Asset B: ${assetB} (class: ${classB ?? "unknown"})
Correlation: ${corrStr} (${direction} correlated over ${duration ?? "90"} days)

Provide a concise, insightful response covering:
1. The economic mechanism connecting these two assets
2. Why this correlation exists (macro, structural, or behavioral reason)
3. Historical context — has this relationship persisted over time?
4. One clear trading implication for active traders

Respond with JSON only:
{"explanation": "3-4 sentence explanation of the mechanism and context", "tradingImplication": "1-2 sentence actionable trading insight"}`;

  try {
    const text = await callClaude(prompt, 512);
    const parsed = parseJSON(text);
    if (parsed) return NextResponse.json(parsed);
    return NextResponse.json({ explanation: text, tradingImplication: "" });
  } catch (err) {
    return NextResponse.json(
      { error: `AI error: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 },
    );
  }
}
