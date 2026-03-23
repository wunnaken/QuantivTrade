import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  const { msgId } = await params;
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerClient();
  const { emoji } = (await request.json()) as { emoji: string };
  if (!emoji) return NextResponse.json({ error: "emoji required" }, { status: 400 });

  // Toggle: remove if exists, add if not
  const { data: existing } = await supabase
    .from("message_reactions")
    .select("id")
    .eq("message_id", msgId)
    .eq("user_id", userId)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    await supabase.from("message_reactions").delete().eq("id", existing.id);
    return NextResponse.json({ action: "removed" });
  }

  await supabase
    .from("message_reactions")
    .insert({ message_id: msgId, user_id: userId, emoji });

  return NextResponse.json({ action: "added" });
}
