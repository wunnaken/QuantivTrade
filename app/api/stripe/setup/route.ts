import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const PRODUCTS = [
  { name: "Quantiv Starter",        price: 1900,  interval: "month" as const, tier: "starter" },
  { name: "Quantiv Pro",            price: 2900,  interval: "month" as const, tier: "pro" },
  { name: "Quantiv Elite",          price: 8900,  interval: "month" as const, tier: "elite" },
  { name: "Quantiv Verified Trader",price: 900,   interval: "month" as const, tier: "verified" },
  { name: "Quantiv Starter Annual", price: 19000, interval: "year"  as const, tier: "starter_annual" },
  { name: "Quantiv Pro Annual",     price: 29000, interval: "year"  as const, tier: "pro_annual" },
  { name: "Quantiv Elite Annual",   price: 89000, interval: "year"  as const, tier: "elite_annual" },
];

export async function GET() {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase = createServerClient();
  const results: Record<string, { stripe_product_id: string; stripe_price_id: string }> = {};

  for (const p of PRODUCTS) {
    // Check if already set up in DB
    const { data: existing } = await supabase
      .from("stripe_products")
      .select("stripe_product_id, stripe_price_id")
      .eq("tier", p.tier)
      .single();

    if (existing) {
      results[p.tier] = existing;
      continue;
    }

    // Create Stripe product
    const product = await stripe.products.create({
      name: p.name,
      metadata: { tier: p.tier },
    });

    // Create Stripe price
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: p.price,
      currency: "usd",
      recurring: { interval: p.interval },
      metadata: { tier: p.tier },
    });

    // Persist to DB
    await supabase.from("stripe_products").insert({
      tier: p.tier,
      stripe_product_id: product.id,
      stripe_price_id: price.id,
      price_cents: p.price,
      interval: p.interval,
    });

    results[p.tier] = { stripe_product_id: product.id, stripe_price_id: price.id };
  }

  return NextResponse.json({ ok: true, products: results });
}
