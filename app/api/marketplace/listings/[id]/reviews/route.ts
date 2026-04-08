import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data: reviews, error } = await supabase
    .from("marketplace_reviews")
    .select("id, rating, comment, created_at, reviewer_id")
    .eq("listing_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ reviews: [] });

  const reviewerIds = [...new Set((reviews ?? []).map((r) => r.reviewer_id).filter(Boolean))];
  let profilesMap: Record<string, { username: string; avatar_url: string | null }> = {};

  if (reviewerIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username, name, avatar_url")
      .in("user_id", reviewerIds);

    for (const p of profiles ?? []) {
      profilesMap[p.user_id] = {
        username: p.username ?? p.name ?? "User",
        avatar_url: p.avatar_url ?? null,
      };
    }
  }

  const enriched = (reviews ?? []).map((r) => ({
    ...r,
    reviewer: profilesMap[r.reviewer_id] ?? null,
  }));

  return NextResponse.json({ reviews: enriched });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const supabase = createServerClient();

  // Verify access — either a completed purchase or the seller themselves (matches GET [id] access logic)
  const { data: listingAccess } = await supabase
    .from("marketplace_listings")
    .select("seller_id")
    .eq("id", id)
    .single();

  const isSeller = listingAccess?.seller_id === userId;

  if (!isSeller) {
    const { data: purchase } = await supabase
      .from("marketplace_purchases")
      .select("id")
      .eq("listing_id", id)
      .eq("buyer_id", userId)
      .eq("status", "completed")
      .maybeSingle();

    if (!purchase) {
      return NextResponse.json({ error: "You must purchase this listing before reviewing" }, { status: 403 });
    }
  }

  // Check for existing review
  const { data: existing } = await supabase
    .from("marketplace_reviews")
    .select("id")
    .eq("listing_id", id)
    .eq("reviewer_id", userId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "You have already reviewed this listing" }, { status: 409 });
  }

  const body = await req.json() as { rating?: number; comment?: string };
  const rating = Math.min(5, Math.max(1, Math.round(body.rating ?? 0)));
  const comment = body.comment?.trim() ?? "";

  if (!rating || rating < 1) {
    return NextResponse.json({ error: "A rating between 1 and 5 is required" }, { status: 400 });
  }

  const { data: review, error: insertErr } = await supabase
    .from("marketplace_reviews")
    .insert({
      listing_id: id,
      reviewer_id: userId,
      seller_id: listingAccess?.seller_id ?? null,
      rating,
      comment,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertErr) {
    console.error("[marketplace/reviews POST]", insertErr);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Recalculate avg_rating and review_count on the listing
  const { data: allReviews } = await supabase
    .from("marketplace_reviews")
    .select("rating")
    .eq("listing_id", id);

  const count = allReviews?.length ?? 1;
  const avg = (allReviews ?? []).reduce((s, r) => s + (r.rating as number), 0) / count;

  await supabase
    .from("marketplace_listings")
    .update({
      review_count: count,
      avg_rating: Math.round(avg * 10) / 10,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json({ review }, { status: 201 });
}
