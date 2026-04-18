import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const routeClient = await createRouteHandlerClient();

  const { data: { user } } = await routeClient.auth.getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const authUid = user.id;

  const roomId = Number(id);
  let body: { content: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.content?.trim()) return NextResponse.json({ error: "content required" }, { status: 400 });

  const supabase = createServerClient();

  // Check membership — try UUID match first, then check if user is host
  const { data: membership } = await supabase
    .from("room_members")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", authUid)
    .maybeSingle();

  if (!membership) {
    // Fallback: check if user is the room host (hosts can always send)
    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", authUid).single();
    const { data: room } = await supabase.from("rooms").select("host_user_id").eq("id", roomId).single();
    const isHost = profile && room && room.host_user_id === profile.id;
    if (!isHost) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }
  }

  const { data: msg, error } = await supabase
    .from("room_messages")
    .insert({ room_id: roomId, user_id: authUid, content: body.content.trim(), type: "text", is_pinned: false })
    .select("id, room_id, user_id, content, type, is_pinned, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: msg });
}
