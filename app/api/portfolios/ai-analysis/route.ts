import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface AnalysisRequest {
  type: "thematic" | "famous";
  name: string;
  description?: string;
  style?: string;
  holdings: Array<{
    ticker: string;
    companyName?: string;
    portfolioPct?: number;
    changePercent?: number | null;
    change?: "NEW" | "INCREASED" | "DECREASED" | "CLOSED" | "UNCHANGED";
  }>;
  dayChangePct?: number | null;
  filingPeriod?: string | null;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  let body: AnalysisRequest;
  try {
    body = (await req.json()) as AnalysisRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, name, description, style, holdings, dayChangePct, filingPeriod } = body;

  let prompt: string;

  if (type === "thematic") {
    const topHoldings = holdings.slice(0, 8).map((h) => `${h.ticker} (${h.changePercent != null ? (h.changePercent >= 0 ? "+" : "") + h.changePercent.toFixed(2) + "%" : "N/A"})`).join(", ");
    prompt = `Analyze this thematic investment portfolio:
Portfolio: ${name}
Theme: ${description ?? ""}
Today's Performance: ${dayChangePct != null ? (dayChangePct >= 0 ? "+" : "") + dayChangePct.toFixed(2) + "%" : "N/A"}
Holdings: ${topHoldings}

Write a 3-4 sentence analysis covering: what macro/sector trends are driving this theme right now, how the portfolio is positioned relative to those trends, and what risks or catalysts investors should watch. Be specific and insightful.`;
  } else {
    const changes = holdings.filter((h) => h.change && h.change !== "UNCHANGED");
    const topPositions = holdings.slice(0, 5).map((h) => `${h.ticker} (${h.portfolioPct?.toFixed(1)}%)`).join(", ");
    const changesText = changes.length > 0
      ? changes.map((h) => `${h.ticker}: ${h.change}`).join(", ")
      : "no material changes";

    prompt = `Analyze this famous investor's latest portfolio filing:
Investor: ${name}
Investment Style: ${style ?? ""}
Filing Period: ${filingPeriod ?? "latest quarter"}
Top Positions: ${topPositions}
Recent Changes: ${changesText}

Write a 3-4 sentence analysis covering: what the current positioning reveals about this investor's macro view, what the recent changes suggest about their conviction, and what themes or risks they appear to be positioning for. Reference their known investment style and philosophy.`;
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
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: 502 });
    }

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.[0]?.text?.trim() ?? "";
    return NextResponse.json({ analysis: text });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
