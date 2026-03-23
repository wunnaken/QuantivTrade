import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  const { id: convId, msgId } = await params;
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerClient();
  const body = (await request.json()) as { content?: string; is_pinned?: boolean };

  const { data: msg } = await supabase
    .from("messages")
    .select("id, user_id, created_at, is_pinned")
    .eq("id", msgId)
    .eq("conversation_id", convId)
    .single();

  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Edit content — author only, within 5 minutes
  if (body.content !== undefined) {
    if (msg.user_id !== userId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const ageMs = Date.now() - new Date(msg.created_at as string).getTime();
    if (ageMs > 5 * 60 * 1000)
      return NextResponse.json({ error: "Edit window expired" }, { status: 403 });

    const content = body.content.trim();
    if (!content || content.length > 2000)
      return NextResponse.json({ error: "Invalid content" }, { status: 400 });

    const { data: updated } = await supabase
      .from("messages")
      .update({ content, edited_at: new Date().toISOString() })
      .eq("id", msgId)
      .select("id, content, edited_at")
      .single();

    return NextResponse.json({ message: updated });
  }

  // Pin / unpin — any conversation member
  if (body.is_pinned !== undefined) {
    const { data: membership } = await supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", convId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: updated } = await supabase
      .from("messages")
      .update({ is_pinned: body.is_pinned })
      .eq("id", msgId)
      .select("id, is_pinned")
      .single();

    return NextResponse.json({ message: updated });
  }

  return NextResponse.json({ error: "No valid field" }, { status: 400 });
}
