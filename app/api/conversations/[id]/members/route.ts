import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { user_id?: string };
  if (!body.user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const supabase = createServerClient();

  const { data: conv } = await supabase
    .from("conversations")
    .select("type")
    .eq("id", id)
    .single();

  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (conv.type !== "group") return NextResponse.json({ error: "Can only add members to group conversations" }, { status: 400 });

  // Verify requester is already a member
  const { data: membership } = await supabase
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });

  // Check if already a member
  const { data: existing } = await supabase
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", id)
    .eq("user_id", body.user_id)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: "Already a member" }, { status: 409 });

  await supabase.from("conversation_members").insert({
    conversation_id: id,
    user_id: body.user_id,
    role: "member",
  });

  return NextResponse.json({ ok: true });
}
