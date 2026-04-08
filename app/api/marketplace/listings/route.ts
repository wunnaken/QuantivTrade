import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? "";
  const categoriesParam = searchParams.get("categories") ?? "";
  const search = searchParams.get("search") ?? "";
  const sort = searchParams.get("sort") ?? "popular";
  const minPrice = parseFloat(searchParams.get("minPrice") ?? "0");
  const maxPriceRaw = searchParams.get("maxPrice");
  const maxPrice = maxPriceRaw ? parseFloat(maxPriceRaw) : null;
  const assetClass = searchParams.get("assetClass") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const offset = (page - 1) * limit;

  const supabase = createServerClient();

  let query = supabase
    .from("marketplace_listings")
    .select(
      "id, title, category, description, price, price_type, subscription_interval, asset_classes, tags, preview_image_url, preview_images, is_featured, backtest_verified, signal_win_rate, signal_total, view_count, sales_count, avg_rating, review_count, created_at, seller_id",
      { count: "exact" }
    )
    .eq("status", "approved");

  const categories = categoriesParam ? categoriesParam.split(",").filter(Boolean) : category && category !== "all" ? [category] : [];
  if (categories.length === 1) query = query.eq("category", categories[0]);
  else if (categories.length > 1) query = query.in("category", categories);
  if (search) query = query.ilike("title", `%${search}%`);
  if (assetClass && assetClass !== "all") query = query.contains("asset_classes", [assetClass]);
  if (minPrice > 0) query = query.gte("price", minPrice);
  if (maxPrice !== null) query = query.lte("price", maxPrice);

  switch (sort) {
    case "newest":    query = query.order("created_at", { ascending: false }); break;
    case "price_low": query = query.order("price", { ascending: true });       break;
    case "price_high":query = query.order("price", { ascending: false });      break;
    case "rating":    query = query.order("avg_rating", { ascending: false }); break;
    default:          query = query.order("sales_count", { ascending: false }); // popular
  }

  const { data: listings, count, error } = await query.range(offset, offset + limit - 1);

  if (error) {
    console.error("[marketplace/listings GET]", error);
    return NextResponse.json({ listings: [], total: 0, page, limit, pages: 0 });
  }

  // Fetch seller profiles for all unique seller_ids
  const sellerIds = [...new Set((listings ?? []).map((l) => l.seller_id).filter(Boolean))];
  let sellersMap: Record<string, { username: string; avatar_url: string | null; is_verified: boolean; is_founder: boolean; total_sales: number }> = {};

  if (sellerIds.length > 0) {
    const { data: profiles, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, username, name, avatar_url, is_verified, is_founder, total_sales")
      .in("user_id", sellerIds);

    if (profileErr) {
      // Fall back to minimal select if extended columns don't exist yet
      console.error("[marketplace/listings] profiles query error:", profileErr.message);
      const { data: fallback } = await supabase
        .from("profiles")
        .select("user_id, username, name, avatar_url")
        .in("user_id", sellerIds);
      for (const p of fallback ?? []) {
        sellersMap[p.user_id] = {
          username: p.username ?? p.name ?? "Seller",
          avatar_url: p.avatar_url ?? null,
          is_verified: false,
          is_founder: false,
          total_sales: 0,
        };
      }
    } else {
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
  }

  const enriched = (listings ?? [])
    .map((l) => ({ ...l, seller: sellersMap[l.seller_id] ?? null }))
    .sort((a, b) => {
      const aFounder = a.seller?.is_founder ? 1 : 0;
      const bFounder = b.seller?.is_founder ? 1 : 0;
      return bFounder - aFounder;
    });

  return NextResponse.json({
    listings: enriched,
    total: count ?? 0,
    page,
    limit,
    pages: Math.ceil((count ?? 0) / limit),
  });
}

export async function POST(req: Request) {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json() as {
    title?: string;
    category?: string;
    categories?: string[];
    description?: string;
    price?: number;
    price_type?: string;
    subscription_interval?: string;
    asset_classes?: string[];
    tags?: string[];
    preview_images?: string[];
    backtest_data?: string;
    content_data?: string;
    preview_disabled?: boolean;
  };

  const { title, category, categories, description, price, price_type, subscription_interval, asset_classes, tags, preview_images, backtest_data, content_data, preview_disabled } = body;

  const primaryCategory = category || categories?.[0];
  if (!title?.trim() || !primaryCategory || !description?.trim()) {
    return NextResponse.json({ error: "title, category, and description are required" }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: listing, error } = await supabase
    .from("marketplace_listings")
    .insert({
      seller_id: userId,
      title: title.trim(),
      category: primaryCategory,
      categories: categories ?? (primaryCategory ? [primaryCategory] : []),
      description: description.trim(),
      price: price ?? 0,
      price_type: price_type ?? "free",
      subscription_interval: subscription_interval ?? null,
      asset_classes: asset_classes ?? [],
      tags: tags ?? [],
      preview_images: preview_images ?? [],
      backtest_data: backtest_data ?? null,
      content_data: content_data ?? null,
      preview_disabled: preview_disabled ?? false,
      status: "pending",
      view_count: 0,
      sales_count: 0,
      avg_rating: 0,
      review_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("[marketplace/listings POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Trigger AI review asynchronously
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (siteUrl) {
    fetch(`${siteUrl}/api/marketplace/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listing_id: listing.id, title, category, description }),
    }).catch(() => {});
  }

  return NextResponse.json({ listing }, { status: 201 });
}
