import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase = createServerClient();

  const [listingsResult, purchasesResult, reviewsResult] = await Promise.allSettled([
    supabase
      .from("marketplace_listings")
      .select(
        "id, title, category, categories, status, view_count, sales_count, avg_rating, review_count, price, price_type, subscription_interval, description, tags, asset_classes, backtest_data, content_data, preview_image_url, created_at, rejection_reason"
      )
      .eq("seller_id", userId)
      .order("created_at", { ascending: false }),

    supabase
      .from("marketplace_purchases")
      .select("amount_paid, platform_fee, seller_revenue, purchased_at, status")
      .eq("seller_id", userId)
      .eq("status", "completed"),

    supabase
      .from("marketplace_reviews")
      .select("id, rating, comment, created_at, listing_id")
      .eq("seller_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const listings =
    listingsResult.status === "fulfilled" ? (listingsResult.value.data ?? []) : [];
  const purchases =
    purchasesResult.status === "fulfilled" ? (purchasesResult.value.data ?? []) : [];
  const reviews =
    reviewsResult.status === "fulfilled" ? (reviewsResult.value.data ?? []) : [];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalRevenue =
    purchases.reduce((sum, p) => sum + ((p.seller_revenue as number) ?? 0), 0);

  const thisMonthRevenue = purchases
    .filter((p) => new Date(p.purchased_at as string) >= monthStart)
    .reduce((sum, p) => sum + ((p.seller_revenue as number) ?? 0), 0);

  return NextResponse.json({
    listings,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    thisMonthRevenue: Math.round(thisMonthRevenue * 100) / 100,
    totalSales: purchases.length,
    pendingPayout: Math.round(totalRevenue * 100) / 100, // Phase 2: subtract already paid out
    reviews,
  });
}
