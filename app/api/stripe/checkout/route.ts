import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function POST(req: Request) {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json() as { tier: string; interval?: "month" | "year" };
  const { tier, interval = "month" } = body;

  const lookupTier = interval === "year" ? `${tier}_annual` : tier;

  const supabase = createServerClient();

  // Look up the price ID
  const { data: product, error: productErr } = await supabase
    .from("stripe_products")
    .select("stripe_price_id")
    .eq("tier", lookupTier)
    .single();

  if (productErr || !product) {
    return NextResponse.json({ error: "Plan not found. Run /api/stripe/setup first." }, { status: 404 });
  }

  // Get user's email
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, stripe_customer_id")
    .eq("user_id", userId)
    .single();

  const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
    mode: "subscription",
    line_items: [{ price: product.stripe_price_id, quantity: 1 }],
    success_url: `${BASE_URL}/settings?upgraded=true`,
    cancel_url: `${BASE_URL}/pricing`,
    allow_promotion_codes: true,
    metadata: { userId, tier: lookupTier },
    subscription_data: { metadata: { userId, tier: lookupTier } },
  };

  if (profile?.stripe_customer_id) {
    sessionParams.customer = profile.stripe_customer_id;
  } else if (profile?.email) {
    sessionParams.customer_email = profile.email;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return NextResponse.json({ url: session.url });
}
