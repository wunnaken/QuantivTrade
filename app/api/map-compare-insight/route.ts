import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SYSTEM = `You are a macro and markets analyst for QuantivTrade. Given a comparison of 2–4 countries on one main metric plus GDP growth, inflation, and population where available, write a short comparative insight (2–4 sentences). Be specific: highlight who leads or lags, what might explain it, and one practical takeaway. No bullet points—plain prose. Do not give buy/sell advice.`;

type CountryRow = {
  name: string;
  layerValue: number | null;
  gdp?: number | null;
  inflation?: number | null;
  population?: number | null;
};

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  let body: { countries: CountryRow[]; layerName: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { countries, layerName } = body;
  if (!Array.isArray(countries) || countries.length < 2 || !layerName) {
    return NextResponse.json({ error: "Need at least 2 countries and layerName" }, { status: 400 });
  }

  const rows = countries
    .map(
      (c) =>
        `${c.name}: ${layerName}=${c.layerValue ?? "n/a"}` +
        (c.gdp != null ? `, GDP growth=${c.gdp}%` : "") +
        (c.inflation != null ? `, Inflation=${c.inflation}%` : "") +
        (c.population != null ? `, Population=${(c.population / 1e6).toFixed(1)}M` : "")
    )
    .join("\n");

  const user = `Compare these countries on the main metric "${layerName}" and related data. Write a short comparative insight.\n\n${rows}`;

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
        max_tokens: 400,
        system: SYSTEM,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err || "AI request failed" }, { status: 502 });
    }

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.[0]?.text?.trim() ?? "";
    return NextResponse.json({ insight: text });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
