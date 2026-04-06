import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// IMPORTANT: This route requires Stripe Connect.
// Sellers must complete onboarding via /api/stripe/connect before marketplace
// transfers can be processed. Until a seller has a stripe_account_id,
// payments will still go through but the transfer_data will be omitted
// (platform collects full amount). Wire up payouts manually until Connect is live.

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function POST(req: Request) {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json() as { listingId: string };
  const { listingId } = body;

  if (!listingId) return NextResponse.json({ error: "listingId required" }, { status: 400 });

  const supabase = createServerClient();

  // Fetch listing
  const { data: listing, error: listingErr } = await supabase
    .from("marketplace_listings")
    .select("id, title, price, price_type, subscription_interval, seller_id")
    .eq("id", listingId)
    .eq("status", "approved")
    .single();

  if (listingErr || !listing) {
    return NextResponse.json({ error: "Listing not found or not approved" }, { status: 404 });
  }

  if (listing.seller_id === userId) {
    return NextResponse.json({ error: "Cannot purchase your own listing" }, { status: 400 });
  }

  // Check for existing purchase
  const { data: existing } = await supabase
    .from("marketplace_purchases")
    .select("id")
    .eq("listing_id", listingId)
    .eq("buyer_id", userId)
    .eq("status", "completed")
    .single();

  if (existing) return NextResponse.json({ error: "Already purchased" }, { status: 400 });

  // Fetch seller's Stripe Connect account id
  const { data: seller } = await supabase
    .from("profiles")
    .select("stripe_account_id, stripe_onboarded")
    .eq("user_id", listing.seller_id)
    .single();

  const amountCents = Math.round(listing.price * 100);
  const platformFeeCents = Math.round(amountCents * 0.20);

  const isSubscription = listing.price_type === "subscription";

  // Build session params
  const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
    mode: isSubscription ? "subscription" : "payment",
    success_url: `${BASE_URL}/marketplace?purchased=true&listing=${listingId}`,
    cancel_url: `${BASE_URL}/marketplace`,
    metadata: { listingId, buyerId: userId, sellerId: listing.seller_id },
  };

  if (isSubscription) {
    // For subscription listings we need a Stripe Price created per-listing (Phase 2)
    // For now, create an ad-hoc price
    const price = await stripe.prices.create({
      currency: "usd",
      unit_amount: amountCents,
      recurring: { interval: (listing.subscription_interval as "month" | "year") ?? "month" },
      product_data: { name: listing.title },
    });
    sessionParams.line_items = [{ price: price.id, quantity: 1 }];
    sessionParams.subscription_data = {
      metadata: { listingId, buyerId: userId, sellerId: listing.seller_id },
      ...(seller?.stripe_onboarded && seller.stripe_account_id
        ? { application_fee_percent: 20, transfer_data: { destination: seller.stripe_account_id } }
        : {}),
    };
  } else {
    sessionParams.line_items = [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: amountCents,
        product_data: { name: listing.title },
      },
    }];
    if (seller?.stripe_onboarded && seller.stripe_account_id) {
      sessionParams.payment_intent_data = {
        application_fee_amount: platformFeeCents,
        transfer_data: { destination: seller.stripe_account_id },
        metadata: { listingId, buyerId: userId, sellerId: listing.seller_id },
      };
    }
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return NextResponse.json({ url: session.url });
}
