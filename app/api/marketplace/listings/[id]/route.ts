import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Listing ID required" }, { status: 400 });

  const supabase = createServerClient();

  // Verify ownership and fetch current content for comparison
  const { data: existing, error: fetchErr } = await supabase
    .from("marketplace_listings")
    .select("id, seller_id, title, description, category, backtest_data, content_data")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  if (existing.seller_id !== userId) return NextResponse.json({ error: "Not your listing" }, { status: 403 });

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
    backtest_data?: string;
    content_data?: string;
    preview_image_url?: string;
  };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title?.trim())            updates.title = body.title.trim();
  if (body.category)                 updates.category = body.category;
  if (body.categories)               updates.categories = body.categories;
  if (body.description?.trim())      updates.description = body.description.trim();
  if (body.price !== undefined)      updates.price = body.price;
  if (body.price_type)               updates.price_type = body.price_type;
  if (body.subscription_interval !== undefined) updates.subscription_interval = body.subscription_interval;
  if (body.asset_classes)            updates.asset_classes = body.asset_classes;
  if (body.tags)                     updates.tags = body.tags;
  if (body.backtest_data !== undefined) updates.backtest_data = body.backtest_data;
  if (body.content_data !== undefined)  updates.content_data = body.content_data;
  if (body.preview_image_url !== undefined) updates.preview_image_url = body.preview_image_url;

  // Only re-review if content actually differs from what's already saved
  const contentChanged =
    (body.title?.trim() && body.title.trim() !== existing.title) ||
    (body.description?.trim() && body.description.trim() !== existing.description) ||
    (body.category && body.category !== existing.category) ||
    (body.backtest_data !== undefined && body.backtest_data !== existing.backtest_data) ||
    (body.content_data !== undefined && body.content_data !== existing.content_data);

  if (contentChanged) {
    updates.status = "pending";
    updates.rejection_reason = null;
  }

  const { data: updated, error: updateErr } = await supabase
    .from("marketplace_listings")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (updateErr) {
    console.error("[marketplace/listings PATCH]", updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Only re-trigger AI review if content changed
  if (contentChanged) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    if (siteUrl) {
      fetch(`${siteUrl}/api/marketplace/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: id,
          title: updated.title,
          category: updated.category,
          description: updated.description,
        }),
      }).catch(() => {});
    }
  }

  return NextResponse.json({ listing: updated });
}
