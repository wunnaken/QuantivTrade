import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const supabase = createServerClient();

  const { data: listing, error: fetchErr } = await supabase
    .from("marketplace_listings")
    .select("id, seller_id, title, category, description")
    .eq("id", id)
    .single();

  if (fetchErr || !listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  if (listing.seller_id !== userId) return NextResponse.json({ error: "Not your listing" }, { status: 403 });

  // Reset to pending
  await supabase
    .from("marketplace_listings")
    .update({ status: "pending", rejection_reason: null, updated_at: new Date().toISOString() })
    .eq("id", id);

  // Fire review
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (siteUrl) {
    fetch(`${siteUrl}/api/marketplace/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listing_id: id, title: listing.title, category: listing.category, description: listing.description }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
