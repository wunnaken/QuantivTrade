import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { PREBUILT_TERMS, slugify } from "@/lib/archive-prebuilt";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const supabase = createServerClient();

  // Search cached articles in Supabase
  const { data: dbResults } = await supabase
    .from("archive_articles")
    .select("slug, title, category, summary, tags, is_prebuilt, view_count")
    .or(`title.ilike.%${q}%,summary.ilike.%${q}%,tags.cs.{${q}}`)
    .order("view_count", { ascending: false })
    .limit(8);

  const dbSlugs = new Set((dbResults ?? []).map((r) => r.slug));

  // Also match against prebuilt terms list (not yet in DB)
  const ql = q.toLowerCase();
  const prebuiltMatches = PREBUILT_TERMS.filter(
    (t) =>
      !dbSlugs.has(t.slug) &&
      (t.title.toLowerCase().includes(ql) || t.tags.some((tag) => tag.includes(ql)) || t.slug.includes(ql))
  )
    .slice(0, 6)
    .map((t) => ({
      slug: t.slug,
      title: t.title,
      category: t.category,
      summary: `Comprehensive guide to ${t.title}. Click to generate a full AI-written article.`,
      tags: t.tags,
      is_prebuilt: true,
      view_count: 0,
      needs_generation: true,
    }));

  // If no DB results and no prebuilt match, offer AI generation for the raw query
  const allResults = [...(dbResults ?? []), ...prebuiltMatches];

  const aiSuggestion =
    allResults.length < 3
      ? {
          slug: slugify(q),
          title: q,
          category: "AI Generated",
          summary: `No existing article found. Click to have AI write a comprehensive article about "${q}" instantly.`,
          tags: [],
          is_prebuilt: false,
          view_count: 0,
          needs_generation: true,
          is_ai_suggestion: true,
        }
      : null;

  return NextResponse.json({
    results: aiSuggestion ? [...allResults, aiSuggestion] : allResults,
    query: q,
  });
}
