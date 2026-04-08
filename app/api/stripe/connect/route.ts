import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// Uses Stripe Account Links (hosted onboarding) — no Connect Client ID needed.
// Only requires STRIPE_SECRET_KEY.
//
//   fetch('/api/stripe/connect', { method: 'POST' })
//     .then(r => r.json()).then(d => window.location.href = d.url)
//
// Stripe redirects back to /settings?connected=true on completion.
// Add "account.updated" to your webhook to auto-set stripe_onboarded=true.

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function POST() {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase = createServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_account_id")
    .eq("user_id", userId)
    .single();

  let accountId = profile?.stripe_account_id;

  // Create a new Connect account if none exists
  if (!accountId) {
    const { data: profileFull } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .single();

    const account = await stripe.accounts.create({
      type: "express",
      email: profileFull?.email ?? undefined,
      metadata: { userId },
    });
    accountId = account.id;
    await supabase.from("profiles").update({ stripe_account_id: accountId }).eq("user_id", userId);
  }

  // Create onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${BASE_URL}/settings?connect_retry=true`,
    return_url: `${BASE_URL}/settings?connected=true`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}
