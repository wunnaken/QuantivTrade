import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const revalidate = 60;

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.trim().toUpperCase();
  if (!ticker) return NextResponse.json({ watchlistCount: 0, posts: [] });

  const supabase = createServerClient();

  const [watchlistResult, postsResult] = await Promise.all([
    supabase
      .from("watchlist_items")
      .select("id", { count: "exact", head: true })
      .eq("ticker", ticker),
    supabase
      .from("posts")
      .select("id, user_id, content, created_at")
      .or(`content.ilike.%$${ticker}%,content.ilike.% ${ticker} %`)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const watchlistCount = watchlistResult.count ?? 0;
  const posts = (postsResult.data ?? []).map((p) => ({
    id: p.id as string,
    content: p.content as string,
    created_at: p.created_at as string,
    user_id: p.user_id as string,
  }));

  return NextResponse.json({ watchlistCount, posts });
}
