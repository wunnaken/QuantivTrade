import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json() as { listing_id?: string };
  const { listing_id } = body;

  if (!listing_id) return NextResponse.json({ error: "listing_id required" }, { status: 400 });

  const supabase = createServerClient();

  // Fetch listing
  const { data: listing, error: listingErr } = await supabase
    .from("marketplace_listings")
    .select("id, title, price, price_type, seller_id, status")
    .eq("id", listing_id)
    .single();

  if (listingErr || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  if (listing.status !== "approved") {
    return NextResponse.json({ error: "Listing is not available for purchase" }, { status: 400 });
  }

  if (listing.seller_id === userId) {
    return NextResponse.json({ error: "You cannot purchase your own listing" }, { status: 400 });
  }

  // Check for duplicate purchase
  const { data: existing } = await supabase
    .from("marketplace_purchases")
    .select("id")
    .eq("buyer_id", userId)
    .eq("listing_id", listing_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "You have already purchased this listing" }, { status: 409 });
  }

  const price = (listing.price as number) ?? 0;
  const platformFee = Math.round(price * 0.20 * 100) / 100;
  const sellerRevenue = Math.round(price * 0.80 * 100) / 100;

  // Record the purchase
  const { data: purchase, error: purchaseErr } = await supabase
    .from("marketplace_purchases")
    .insert({
      buyer_id: userId,
      listing_id,
      seller_id: listing.seller_id,
      amount_paid: price,
      platform_fee: platformFee,
      seller_revenue: sellerRevenue,
      status: "completed",
      purchased_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (purchaseErr) {
    console.error("[marketplace/purchase POST]", purchaseErr);
    return NextResponse.json({ error: purchaseErr.message }, { status: 500 });
  }

  // Increment listing sales_count (fire and forget)
  supabase
    .from("marketplace_listings")
    .select("sales_count")
    .eq("id", listing_id)
    .single()
    .then(({ data }) => {
      supabase
        .from("marketplace_listings")
        .update({ sales_count: (data?.sales_count ?? 0) + 1, updated_at: new Date().toISOString() })
        .eq("id", listing_id)
        .then(() => {});
    });

  return NextResponse.json(
    {
      purchase,
      fee_breakdown: {
        price,
        platform_fee: platformFee,
        seller_revenue: sellerRevenue,
        note: "Stripe Connect payouts launching in Phase 2",
      },
    },
    { status: 201 }
  );
}
