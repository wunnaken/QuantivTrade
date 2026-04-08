// ─── Stripe Webhook Handler ────────────────────────────────────────────────────
//
// SETUP INSTRUCTIONS:
// 1. Go to Stripe Dashboard → Developers → Webhooks
// 2. Add endpoint: https://xchange-xi.vercel.app/api/stripe/webhook
// 3. Select these events:
//      checkout.session.completed
//      customer.subscription.updated
//      customer.subscription.deleted
//      invoice.payment_failed
//      invoice.payment_succeeded
// 4. Copy the "Signing secret" to STRIPE_WEBHOOK_SECRET in .env.local and Vercel
//
// LOCAL TESTING:
//   stripe listen --forward-to localhost:3000/api/stripe/webhook
//   (Install Stripe CLI: https://stripe.com/docs/stripe-cli)
// ──────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase/server";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

// Map Stripe tier metadata to internal tier names
function normalizeTier(raw: string | null | undefined): string {
  if (!raw) return "free";
  return raw.replace("_annual", ""); // 'pro_annual' → 'pro'
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServerClient();

  try {
    switch (event.type) {
      // ── Checkout completed ─────────────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const { userId, tier, listingId, buyerId, sellerId } = session.metadata ?? {};

        if (session.mode === "subscription" && userId && tier) {
          // Platform subscription purchase
          const sub = session.subscription as string;
          const normalTier = normalizeTier(tier);
          await supabase.from("profiles").update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: sub,
            subscription_tier: normalTier,
            subscription_status: "active",
          }).eq("user_id", userId);
        }

        if ((session.mode === "payment" || session.mode === "subscription") && listingId && buyerId && sellerId) {
          // Marketplace purchase
          const amountTotal = session.amount_total ?? 0;
          const platformFee = Math.round(amountTotal * 0.20);
          const sellerRevenue = amountTotal - platformFee;

          await supabase.from("marketplace_purchases").insert({
            listing_id: listingId,
            buyer_id: buyerId,
            seller_id: sellerId,
            amount_paid: amountTotal / 100,
            platform_fee: platformFee / 100,
            seller_revenue: sellerRevenue / 100,
            status: "completed",
            stripe_session_id: session.id,
            purchased_at: new Date().toISOString(),
          });

          // Increment listing sales count
          const { data: listing } = await supabase
            .from("marketplace_listings")
            .select("sales_count")
            .eq("id", listingId)
            .single();
          if (listing) {
            await supabase.from("marketplace_listings")
              .update({ sales_count: (listing.sales_count ?? 0) + 1 })
              .eq("id", listingId);
          }
        }
        break;
      }

      // ── Subscription updated ────────────────────────────────────────────��──
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;
        const tier = normalizeTier(sub.metadata?.tier ?? null);
        const status = sub.status === "active" ? "active"
          : sub.status === "past_due" ? "past_due"
          : sub.status === "canceled" ? "cancelled"
          : sub.status;
        await supabase.from("profiles").update({
          subscription_tier: tier,
          subscription_status: status,
          subscription_ends_at: // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((sub as any).current_period_end)
            ? new Date((sub as any).current_period_end * 1000).toISOString()
            : null,
        }).eq("stripe_customer_id", sub.customer as string);
        break;
      }

      // ── Subscription deleted (cancelled) ───────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await supabase.from("profiles").update({
          subscription_tier: "free",
          subscription_status: "cancelled",
          stripe_subscription_id: null,
          subscription_ends_at: // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((sub as any).current_period_end)
            ? new Date((sub as any).current_period_end * 1000).toISOString()
            : null,
        }).eq("stripe_customer_id", sub.customer as string);
        break;
      }

      // ── Payment failed ─────────────────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await supabase.from("profiles").update({
          subscription_status: "past_due",
        }).eq("stripe_customer_id", invoice.customer as string);
        break;
      }

      // ── Payment succeeded (renewal) ────────────────────────────────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.billing_reason === "subscription_cycle") {
          await supabase.from("profiles").update({
            subscription_status: "active",
          }).eq("stripe_customer_id", invoice.customer as string);
        }
        break;
      }

      // ── Stripe Connect: seller onboarding complete ─────────────────────────
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        if (account.details_submitted) {
          await supabase.from("profiles").update({
            stripe_onboarded: true,
          }).eq("stripe_account_id", account.id);
        }
        break;
      }
    }
  } catch (err) {
    console.error(`[stripe/webhook] error handling ${event.type}:`, err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
