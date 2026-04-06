import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { PREBUILT_TERMS, slugify, guessCategory } from "@/lib/archive-prebuilt";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ArticleContent {
  definition: string;
  howItWorks: string;
  keyComponents: string[];
  tradingApplication: string;
  example: string;
  advantages: string[];
  disadvantages: string[];
  commonMistakes: string[];
  relatedConcepts: string[];
  brokerNote?: string;
  regulatoryNote?: string;
  proTip: string;
}

interface Article {
  slug: string;
  title: string;
  category: string;
  summary: string;
  content: ArticleContent;
  related_terms: string[];
  tags: string[];
  is_prebuilt: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}

async function isTradingRelated(term: string, apiKey: string): Promise<boolean> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 10,
      system: "You are a relevance filter for a trading/finance encyclopedia. Reply with only the single word YES or NO.",
      messages: [
        {
          role: "user",
          content: `Is "${term}" a trading, investing, finance, economics, or financial markets topic? YES or NO only.`,
        },
      ],
    }),
  });
  if (!res.ok) return true; // fail open — let generation attempt and handle errors there
  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  const answer = data.content?.[0]?.text?.trim().toUpperCase() ?? "";
  return answer.startsWith("Y");
}

async function generateWithClaude(term: string, category: string, apiKey: string): Promise<Omit<Article, "slug" | "is_prebuilt" | "view_count" | "created_at" | "updated_at">> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: `You are a professional trading educator writing for the Quantiv trading intelligence platform. Write a comprehensive, accurate article about the requested trading topic. Your audience is serious retail traders ranging from intermediate to advanced. Be specific, practical, and data-driven. Never give financial advice. Return ONLY valid JSON — no markdown, no code fences, no text before or after.`,
      messages: [
        {
          role: "user",
          content: `Write a comprehensive article about: ${term}
Category: ${category}

Return ONLY a JSON object with this exact structure:
{
  "title": "Full title of the term",
  "summary": "2-3 sentence overview for search results",
  "content": {
    "definition": "Clear 1-2 paragraph definition",
    "howItWorks": "Detailed explanation with mechanics",
    "keyComponents": ["component 1", "component 2", "component 3"],
    "tradingApplication": "How traders actually use this in practice",
    "example": "Concrete real-world example with specific numbers",
    "advantages": ["advantage 1", "advantage 2", "advantage 3"],
    "disadvantages": ["disadvantage 1", "disadvantage 2"],
    "commonMistakes": ["mistake 1", "mistake 2", "mistake 3"],
    "relatedConcepts": ["related term 1", "related term 2", "related term 3"],
    "brokerNote": "If broker/platform comparison include fee structures and key differences, otherwise omit this field",
    "regulatoryNote": "Any relevant regulatory considerations, or omit if not applicable",
    "proTip": "Advanced insight most traders miss — must be specific and actionable"
  },
  "related_terms": ["term1", "term2", "term3", "term4", "term5"],
  "tags": ["tag1", "tag2", "tag3"]
}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Claude API error: ${res.status}`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.[0]?.text?.trim() ?? "";

  // Strip any accidental code fences
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const parsed = JSON.parse(cleaned) as Omit<Article, "slug" | "is_prebuilt" | "view_count" | "created_at" | "updated_at">;
  return parsed;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slugParam = searchParams.get("slug")?.trim();
  const termParam = searchParams.get("term")?.trim();

  if (!slugParam && !termParam) {
    return NextResponse.json({ error: "slug or term required" }, { status: 400 });
  }

  const slug = slugParam ?? slugify(termParam!);
  const supabase = createServerClient();

  // Check cache first
  const { data: existing } = await supabase
    .from("archive_articles")
    .select("*")
    .eq("slug", slug)
    .single();

  if (existing) {
    // Increment view count (fire and forget)
    supabase
      .from("archive_articles")
      .update({ view_count: (existing.view_count ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq("slug", slug)
      .then(() => {});
    return NextResponse.json({ article: { ...existing, view_count: (existing.view_count ?? 0) + 1 } });
  }

  // Not cached — generate with Claude
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  // Find prebuilt term metadata if available
  const prebuilt = PREBUILT_TERMS.find((t) => t.slug === slug);
  const term = termParam ?? prebuilt?.title ?? slug.replace(/-/g, " ");
  const category = prebuilt?.category ?? guessCategory(term);

  // Guard: skip relevance check for known prebuilt terms (they're already vetted)
  if (!prebuilt) {
    const relevant = await isTradingRelated(term, apiKey);
    if (!relevant) {
      return NextResponse.json(
        {
          error: "off_topic",
          message: `"${term}" doesn't appear to be a trading or finance topic. The Archive covers trading strategies, indicators, brokers, order types, options, crypto, economic indicators, risk management, and regulations.`,
        },
        { status: 422 }
      );
    }
  }

  try {
    const generated = await generateWithClaude(term, category, apiKey);

    const article: Omit<Article, "view_count" | "created_at" | "updated_at"> = {
      slug,
      title: generated.title,
      category,
      summary: generated.summary,
      content: generated.content,
      related_terms: generated.related_terms ?? [],
      tags: generated.tags ?? prebuilt?.tags ?? [],
      is_prebuilt: !!prebuilt,
    };

    // Save to Supabase
    const { data: saved, error: saveErr } = await supabase
      .from("archive_articles")
      .upsert({ ...article, view_count: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .select()
      .single();

    if (saveErr) {
      console.error("[archive/article] Supabase save error:", saveErr);
    }

    return NextResponse.json({ article: saved ?? { ...article, view_count: 1 } });
  } catch (e) {
    console.error("[archive/article] Generation error:", e);
    return NextResponse.json(
      { error: "Failed to generate article", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
