import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase = createServerClient();

  const { data: purchases, error } = await supabase
    .from("marketplace_purchases")
    .select("listing_id, purchased_at, amount_paid")
    .eq("buyer_id", userId)
    .eq("status", "completed")
    .order("purchased_at", { ascending: false });

  if (error) return NextResponse.json({ listings: [] });

  const purchasedIds = (purchases ?? []).map((p) => p.listing_id);

  // Fetch seller's own listings (they always have access to these)
  const { data: ownListings } = await supabase
    .from("marketplace_listings")
    .select("id, created_at")
    .eq("seller_id", userId);

  const ownIds = (ownListings ?? []).map((l) => l.id);
  const allIds = [...new Set([...purchasedIds, ...ownIds])];

  if (allIds.length === 0) return NextResponse.json({ listings: [] });

  const { data: listings } = await supabase
    .from("marketplace_listings")
    .select(
      "id, title, category, description, price, price_type, subscription_interval, asset_classes, tags, preview_image_url, preview_images, is_featured, backtest_verified, signal_win_rate, signal_total, view_count, sales_count, avg_rating, review_count, created_at, seller_id, discount_percent, discount_enabled, discount_expires_at"
    )
    .in("id", allIds);

  const sellerIds = [...new Set((listings ?? []).map((l) => l.seller_id).filter(Boolean))];
  let sellersMap: Record<string, { username: string; avatar_url: string | null; is_verified: boolean; is_founder: boolean; total_sales: number }> = {};

  if (sellerIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username, name, avatar_url, is_verified, is_founder, total_sales")
      .in("user_id", sellerIds);
    for (const p of profiles ?? []) {
      sellersMap[p.user_id] = {
        username: p.username ?? p.name ?? "Seller",
        avatar_url: p.avatar_url ?? null,
        is_verified: p.is_verified ?? false,
        is_founder: p.is_founder ?? false,
        total_sales: p.total_sales ?? 0,
      };
    }
  }

  const purchaseMap = Object.fromEntries((purchases ?? []).map((p) => [p.listing_id, p]));

  const enriched = (listings ?? []).map((l) => ({
    ...l,
    seller: sellersMap[l.seller_id] ?? null,
    purchased_at: purchaseMap[l.id]?.purchased_at ?? l.created_at,
    amount_paid: purchaseMap[l.id]?.amount_paid ?? null,
    is_own: l.seller_id === userId,
  }))
    .sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime());

  return NextResponse.json({ listings: enriched });
}
