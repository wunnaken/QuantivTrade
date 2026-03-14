import { NextResponse } from "next/server";
import { LAYERS, type LayerId } from "../../../lib/map-layers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_COUNTRIES = 35;

const SYSTEM = `You are a macro data analyst. You will receive a list of countries and one economic/market indicator. For each country, provide your best numerical estimate based on the most recent data, news, and trends you know. Return ONLY a valid JSON object: keys are the exact country names as given, values are numbers (no units). Use the same scale as the indicator (e.g. percentages as 2.5 for 2.5%, population in absolute count). If you truly cannot estimate, omit that country. No explanation, no markdown—only the JSON object.`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  let body: { layerId: LayerId; layerLabel: string; countryNames: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { layerId, layerLabel, countryNames } = body;
  if (!layerId || !layerLabel || !Array.isArray(countryNames)) {
    return NextResponse.json({ error: "Need layerId, layerLabel, countryNames" }, { status: 400 });
  }

  const layer = LAYERS.find((l) => l.id === layerId);
  if (!layer) {
    return NextResponse.json({ error: "Unknown layer" }, { status: 400 });
  }

  const list = countryNames.slice(0, MAX_COUNTRIES);
  if (list.length === 0) {
    return NextResponse.json({ estimates: {} });
  }

  const user = `Indicator: ${layerLabel}\nScale/units: ${layer.legend.title}\n\nCountries to estimate (use these exact names as keys):\n${list.join("\n")}`;

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
        system: SYSTEM,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err || "AI request failed" }, { status: 502 });
    }

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    let text = data.content?.[0]?.text?.trim() ?? "";
    // Strip possible markdown code block
    const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeMatch) text = codeMatch[1].trim();
    let estimates: Record<string, number> = {};
    try {
      estimates = JSON.parse(text) as Record<string, number>;
    } catch {
      return NextResponse.json({ error: "AI did not return valid JSON" }, { status: 502 });
    }

    // Normalize keys: only keep entries for requested countries (fuzzy match by exact name)
    const out: Record<string, number> = {};
    for (const name of list) {
      const val = estimates[name];
      if (typeof val === "number" && !Number.isNaN(val)) out[name] = val;
    }
    return NextResponse.json({ estimates: out });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
