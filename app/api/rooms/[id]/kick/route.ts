import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfileId } from "@/lib/get-profile-id";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const routeClient = await createRouteHandlerClient();

  const { data: { user } } = await routeClient.auth.getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await getProfileId(routeClient);
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { userId: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const roomId = Number(id);
  const supabase = createServerClient();

  // Verify caller is the host
  const { data: room } = await supabase.from("rooms").select("host_user_id").eq("id", roomId).single();
  if (!room || room.host_user_id !== profileId) {
    return NextResponse.json({ error: "Only the room host can kick members" }, { status: 403 });
  }

  // Can't kick yourself
  if (body.userId === user.id) {
    return NextResponse.json({ error: "Cannot kick yourself" }, { status: 400 });
  }

  // Get kicked user's name for system message
  const { data: kickedProfile } = await supabase.from("profiles").select("username, name").eq("user_id", body.userId).single();
  const kickedName = kickedProfile?.username || kickedProfile?.name || "A user";

  // Remove from room
  const { error: delErr } = await supabase.from("room_members").delete().eq("room_id", roomId).eq("user_id", body.userId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  // Post system message to room_messages
  await supabase.from("room_messages").insert({
    room_id: roomId,
    user_id: user.id,
    content: `${kickedName} was removed from the room`,
    type: "system",
    is_pinned: false,
  });

  // Also remove from conversation_members and post system message
  const { data: conv } = await supabase.from("conversations").select("id").eq("room_id", roomId).single();
  if (conv) {
    await supabase.from("conversation_members").delete().eq("conversation_id", conv.id).eq("user_id", body.userId);
    await supabase.from("messages").insert({
      conversation_id: conv.id,
      user_id: user.id,
      content: `${kickedName} was removed from the room`,
      type: "system",
    });
  }

  return NextResponse.json({ ok: true });
}
