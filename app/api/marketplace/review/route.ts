import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json() as {
    listing_id?: string;
    title?: string;
    category?: string;
    description?: string;
  };

  const { listing_id, title, category, description } = body;

  if (!listing_id || !title || !description) {
    return NextResponse.json({ error: "listing_id, title, and description required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system:
        "You are a quality control reviewer for Quantiv, a professional trading platform marketplace. Review listings for policy compliance. Return ONLY valid JSON — no markdown, no code fences.",
      messages: [
        {
          role: "user",
          content: `Review this marketplace listing for a professional trading platform.

Title: ${title}
Category: ${category ?? "unknown"}
Description: ${description}

ONLY reject if one or more of these hard violations is clearly present:
1. Guarantees specific returns or claims "never lose money" / "risk-free" / "guaranteed profit"
2. Completely unrelated to trading, finance, investing, or markets (e.g. recipe, dating advice, unrelated software)
3. Obvious spam, nonsense, or placeholder content with no real substance
4. Promotes illegal activity

Approve everything else, including: strategies that discuss historical results, indicators with backtested stats, educational content at any quality level, signal services, chart presets, courses, and tools — even if imperfect or basic. Be very lenient.

Return ONLY this JSON object:
{
  "approved": true or false,
  "issues": ["specific issue if any — omit if approved"],
  "suggestions": ["one helpful suggestion if any"],
  "rejection_reason": "one-sentence reason if rejected, null if approved"
}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    console.error("[marketplace/review] Claude API error:", res.status);
    return NextResponse.json({ error: `Claude API error: ${res.status}` }, { status: 500 });
  }

  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  const text = data.content?.[0]?.text?.trim() ?? "";
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  let review: {
    approved: boolean;
    issues: string[];
    suggestions: string[];
    rejection_reason: string | null;
  };

  try {
    review = JSON.parse(cleaned);
  } catch {
    console.error("[marketplace/review] Failed to parse AI response:", cleaned);
    review = {
      approved: false,
      issues: ["AI review system encountered an error"],
      suggestions: ["Please resubmit your listing"],
      rejection_reason: "Review system error — please resubmit",
    };
  }

  const supabase = createServerClient();

  const { error: updateErr } = await supabase
    .from("marketplace_listings")
    .update({
      status: review.approved ? "approved" : "rejected",
      rejection_reason: review.rejection_reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listing_id);

  if (updateErr) {
    console.error("[marketplace/review] Supabase update error:", updateErr);
  }

  return NextResponse.json({
    approved: review.approved,
    issues: review.issues ?? [],
    suggestions: review.suggestions ?? [],
    rejection_reason: review.rejection_reason ?? null,
  });
}
