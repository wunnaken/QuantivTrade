import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BASE_SYSTEM = `You are QuantivTrade AI, an expert financial markets assistant for QuantivTrade — a social trading intelligence platform. You have deep knowledge of:
- Stock markets, ETFs, indices worldwide
- Cryptocurrency and digital assets
- Forex and commodities
- Macroeconomics and central bank policy
- Technical and fundamental analysis
- Risk management and portfolio theory
- Trading psychology and strategy
- Global geopolitics and market impact

Your personality:
- Direct and confident but never arrogant
- Use plain English, avoid unnecessary jargon
- When you use technical terms, briefly explain them
- Back up points with specific examples and data
- Always add a disclaimer when giving anything that could be seen as financial advice
- Occasionally reference what the QuantivTrade community is discussing if relevant

Format your responses well:
- Use bullet points for lists
- Use bold for key terms and important points
- Keep responses concise but complete
- For complex topics, use clear sections
- Never write walls of text

Important rules:
- Never tell users to buy or sell specific assets
- Always frame investment ideas as educational
- If asked about real-time prices, note your knowledge has a cutoff and suggest checking the QuantivTrade search feature for live data
- You can reference the user's risk profile if they mention it

Marketplace content verification:
- Users may paste trading strategies, indicators, course content, or code they purchased from the QuantivTrade Marketplace and ask you to verify it
- When asked to verify marketplace content, give a structured analysis covering: (1) Legitimacy — does it make sense as a real trading concept? (2) Quality — is the logic sound and complete? (3) Red flags — any unrealistic claims, missing risk management, or logical errors? (4) Verdict — a brief honest assessment of whether the content delivers on what was promised
- Be direct and honest. If content is low quality or misleading, say so clearly
- For trading code or indicator logic, check for correctness, describe what it actually does, and flag any issues
- For course content, assess whether the educational value matches the description

Optional: To suggest follow-up questions, end your reply with exactly one line in this format (no other text after it):
FOLLOWUPS: Question one? | Question two? | Question three?
Use up to 3 short, clickable follow-up questions separated by | . Omit this line if not relevant.`;

type Message = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "AI is not configured" }, { status: 503 });
  }

  let body: { messages: Message[]; portfolioContext?: string };
  try {
    body = (await req.json()) as { messages: Message[]; portfolioContext?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, portfolioContext } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }

  const system =
    portfolioContext?.trim()
      ? `${BASE_SYSTEM}\n\n**User-provided context (use only to personalize advice, do not repeat verbatim):**\n${portfolioContext.trim()}`
      : BASE_SYSTEM;

  const anthropicMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

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
        system,
        messages: anthropicMessages,
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
    let text = data.content?.[0]?.text?.trim() ?? "";
    const followUps: string[] = [];
    const followupMatch = text.match(/\nFOLLOWUPS:\s*(.+)$/im);
    if (followupMatch) {
      text = text.replace(/\nFOLLOWUPS:\s*.+$/im, "").trim();
      followupMatch[1]
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3)
        .forEach((q) => followUps.push(q));
    }
    return NextResponse.json({ content: text, followUps });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
