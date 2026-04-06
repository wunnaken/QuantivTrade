import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { PREBUILT_TERMS, ARCHIVE_CATEGORIES } from "@/lib/archive-prebuilt";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET() {
  const supabase = createServerClient();

  const [topResult, recentResult] = await Promise.allSettled([
    supabase
      .from("archive_articles")
      .select("slug, title, category, summary, tags, is_prebuilt, view_count, created_at")
      .order("view_count", { ascending: false })
      .limit(20),
    supabase
      .from("archive_articles")
      .select("slug, title, category, summary, tags, is_prebuilt, view_count, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const topArticles = topResult.status === "fulfilled" ? (topResult.value.data ?? []) : [];
  const recentArticles = recentResult.status === "fulfilled" ? (recentResult.value.data ?? []) : [];

  // Top per category from DB
  const byCategory: Record<string, typeof topArticles> = {};
  for (const cat of ARCHIVE_CATEGORIES) {
    const catArticles = topArticles.filter((a) => a.category === cat.id).slice(0, 5);
    if (catArticles.length > 0) byCategory[cat.id] = catArticles;
  }

  // Category counts — DB + prebuilt
  const dbCategoryCounts = topArticles.reduce<Record<string, number>>((acc, a) => {
    acc[a.category] = (acc[a.category] ?? 0) + 1;
    return acc;
  }, {});

  const categoryCounts = ARCHIVE_CATEGORIES.map((cat) => {
    const prebuiltCount = PREBUILT_TERMS.filter((t) => t.category === cat.id).length;
    return {
      category: cat.id,
      emoji: cat.emoji,
      color: cat.color,
      total: prebuiltCount,
      generated: dbCategoryCounts[cat.id] ?? 0,
    };
  });

  return NextResponse.json({
    topArticles,
    recentArticles,
    byCategory,
    categoryCounts,
    totalTerms: PREBUILT_TERMS.length,
    totalGenerated: topArticles.length,
  });
}
