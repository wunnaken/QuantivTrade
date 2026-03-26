import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerClient();

  const { data: conv } = await supabase
    .from("conversations")
    .select("type")
    .eq("id", id)
    .single();

  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (conv.type !== "group") return NextResponse.json({ error: "Can only leave group conversations" }, { status: 400 });

  await supabase
    .from("conversation_members")
    .delete()
    .eq("conversation_id", id)
    .eq("user_id", userId);

  return NextResponse.json({ ok: true });
}
