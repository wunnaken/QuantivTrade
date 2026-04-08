import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** Founder-only manual approval override */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase = createServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_founder")
    .eq("user_id", userId)
    .single();

  if (!profile?.is_founder) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;

  const { error } = await supabase
    .from("marketplace_listings")
    .update({ status: "approved", rejection_reason: null, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
