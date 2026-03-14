import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a trading analyst reviewing a trader's whiteboard/notes for Xchange. Analyze what you see (drawings, text, structure) and provide your response as valid JSON only, no other text, with this exact structure:
{
  "summary": "string (what the trader is planning or analyzing, 2-3 sentences)",
  "tradeSetup": "string (if there's a trade setup, describe it clearly; otherwise empty string)",
  "strengths": ["string", "string", "string"] (2-3 items: what looks good about this setup/analysis),
  "concerns": ["string", "string", "string"] (2-3 items: potential issues or risks to consider),
  "suggestions": ["string", "string", "string"] (3 specific improvements or things to add),
  "verdict": "string (exactly one of: 'Looks Solid', 'Needs More Work', 'High Risk')",
  "verdictColor": "string (exactly one of: 'green', 'yellow', 'red')"
}
Return only the JSON object.`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  let body: { imageBase64?: string };
  try {
    body = (await req.json()) as { imageBase64?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const imageBase64 = body.imageBase64;
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });
  }

  const imageMediaType = "image/png";
  const imageData = imageBase64.replace(/^data:image\/\w+;base64,/, "");

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
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: imageMediaType,
                  data: imageData,
                },
              },
              {
                type: "text",
                text: "Analyze this trading whiteboard and return the JSON analysis.",
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: err || `API error: ${res.status}` },
        { status: res.status >= 500 ? 502 : 400 }
      );
    }

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.[0]?.text?.trim() ?? "";
    const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    return NextResponse.json(parsed);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
