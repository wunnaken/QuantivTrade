import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfileId } from "@/lib/get-profile-id";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleLeave(params);
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleLeave(params);
}

async function handleLeave(params: Promise<{ id: string }>) {
  const { id } = await params;
  const routeClient = await createRouteHandlerClient();

  const { data: { user } } = await routeClient.auth.getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const authUid = user.id;

  const profileId = await getProfileId(routeClient);
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roomId = Number(id);
  const supabase = createServerClient();

  // Block host from leaving
  const { data: room } = await supabase.from("rooms").select("host_user_id").eq("id", roomId).single();
  if (room?.host_user_id === profileId) {
    return NextResponse.json({ error: "Host cannot leave — end the session instead" }, { status: 400 });
  }

  // Get username for system message
  const { data: profile } = await supabase.from("profiles").select("username, name").eq("user_id", authUid).single();
  const displayName = profile?.username || profile?.name || "A user";

  // Remove from room
  await supabase.from("room_members").delete().eq("room_id", roomId).eq("user_id", authUid);

  // Post system message to room_messages
  await supabase.from("room_messages").insert({
    room_id: roomId,
    user_id: authUid,
    content: `${displayName} left the room`,
    type: "system",
    is_pinned: false,
  });

  // Also remove from conversation_members and post system message
  const { data: conv } = await supabase.from("conversations").select("id").eq("room_id", roomId).single();
  if (conv) {
    await supabase.from("conversation_members").delete().eq("conversation_id", conv.id).eq("user_id", authUid);
    await supabase.from("messages").insert({
      conversation_id: conv.id,
      user_id: authUid,
      content: `${displayName} left the room`,
      type: "system",
    });
  }

  return NextResponse.json({ ok: true });
}
