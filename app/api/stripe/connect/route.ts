import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// NOTE: Stripe Connect setup required:
// 1. Go to Stripe Dashboard → Settings → Connect settings
// 2. Enable "OAuth for Standard accounts" (or use Express/Custom)
// 3. Copy your Connect "client_id" (starts with ca_) to STRIPE_CONNECT_CLIENT_ID
// 4. Add redirect URI: https://xchange-xi.vercel.app/api/stripe/connect
//
// RECOMMENDED ALTERNATIVE: Use Stripe Account Links (hosted onboarding) instead
// of OAuth — it's simpler and the current Stripe-recommended approach.
// See POST handler below for the Account Links approach.

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// ── GET: Generate OAuth link (OAuth approach) OR handle OAuth callback ─────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.redirect(`${BASE_URL}/settings`);

  if (!code) {
    // Generate OAuth link
    const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({ error: "STRIPE_CONNECT_CLIENT_ID not set" }, { status: 500 });
    }
    const oauthUrl = `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${clientId}&scope=read_write&state=${userId}&redirect_uri=${encodeURIComponent(BASE_URL + "/api/stripe/connect")}`;
    return NextResponse.redirect(oauthUrl);
  }

  // Handle callback — exchange code for account id
  try {
    const response = await stripe.oauth.token({ grant_type: "authorization_code", code });
    const stripeAccountId = response.stripe_user_id;
    if (!stripeAccountId) throw new Error("No stripe_user_id in response");

    const supabase = createServerClient();
    await supabase.from("profiles").update({
      stripe_account_id: stripeAccountId,
      stripe_onboarded: true,
    }).eq("user_id", userId);

    return NextResponse.redirect(`${BASE_URL}/settings?connected=true`);
  } catch (err) {
    console.error("[stripe/connect] OAuth error:", err);
    return NextResponse.redirect(`${BASE_URL}/settings?connect_error=true`);
  }
}

// ── POST: Create Stripe Account Link (recommended hosted onboarding) ──────────
//
// Use this instead of OAuth if you want Stripe-hosted onboarding:
//   fetch('/api/stripe/connect', { method: 'POST' })
//   .then(r => r.json()).then(d => window.location.href = d.url)

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
