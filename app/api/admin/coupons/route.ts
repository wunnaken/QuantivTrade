import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

async function requireFounder() {
  const userId = await getCurrentProfileId();
  if (!userId) return null;
  const supabase = createServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("is_founder")
    .eq("user_id", userId)
    .single();
  return data?.is_founder ? userId : null;
}

export async function GET() {
  const founder = await requireFounder();
  if (!founder) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const codes = await stripe.promotionCodes.list({ limit: 100, expand: ["data.coupon"] });

  const result = codes.data.map((pc) => {
    const coupon = (pc as unknown as { coupon: Stripe.Coupon }).coupon;
    return {
      id: pc.id,
      code: pc.code,
      active: pc.active,
      percent_off: coupon.percent_off,
      amount_off: coupon.amount_off,
      currency: coupon.currency,
      max_redemptions: pc.max_redemptions,
      times_redeemed: pc.times_redeemed,
      expires_at: pc.expires_at,
      created: pc.created,
      coupon_id: coupon.id,
      coupon_name: coupon.name,
    };
  });

  return NextResponse.json({ codes: result });
}

export async function POST(req: Request) {
  const founder = await requireFounder();
  if (!founder) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  let body: { code: string; percent_off: number; max_redemptions?: number; expires_at?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { code, percent_off, max_redemptions = 1, expires_at } = body;

  if (!code || typeof code !== "string" || code.trim().length < 2) {
    return NextResponse.json({ error: "Code must be at least 2 characters" }, { status: 400 });
  }
  if (!percent_off || percent_off < 1 || percent_off > 100) {
    return NextResponse.json({ error: "percent_off must be 1–100" }, { status: 400 });
  }

  const coupon = await stripe.coupons.create({
    percent_off,
    duration: "once",
    name: code.trim().toUpperCase(),
  });

  const promoParams: Stripe.PromotionCodeCreateParams = {
    coupon: coupon.id,
    code: code.trim().toUpperCase(),
    max_redemptions,
  };
  if (expires_at) promoParams.expires_at = expires_at;

  const promoCode = await stripe.promotionCodes.create(promoParams);

  return NextResponse.json({
    id: promoCode.id,
    code: promoCode.code,
    percent_off: coupon.percent_off,
    max_redemptions: promoCode.max_redemptions,
    created: promoCode.created,
  });
}

export async function DELETE(req: Request) {
  const founder = await requireFounder();
  if (!founder) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await stripe.promotionCodes.update(id, { active: false });

  return NextResponse.json({ ok: true });
}
