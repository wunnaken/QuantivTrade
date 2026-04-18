import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const routeClient = await createRouteHandlerClient();
  const { data: { user } } = await routeClient.auth.getUser();
  const authUid = user?.id;

  const { id: roomId } = await context.params;
  if (!roomId) {
    return NextResponse.json({ error: "Room id required" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { error } = await supabase.from("room_members").insert({
    user_id: profileId,
    room_id: roomId,
  });

  if (error) {
    if (error.code === "23505") return NextResponse.json({ ok: true }); // already member
    console.error("[rooms/join] POST error:", error);
    return NextResponse.json({ error: "Failed to join room" }, { status: 500 });
  }

  if (authUid) {
    const { data: profile } = await supabase.from("profiles").select("username, name").eq("user_id", authUid).single();
    const displayName = profile?.username || profile?.name || "A user";

    // Post system message to room_messages
    await supabase.from("room_messages").insert({
      room_id: Number(roomId),
      user_id: authUid,
      content: `${displayName} joined the room`,
      type: "system",
      is_pinned: false,
    });

    // Also add to conversation_members so full messaging works
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("room_id", Number(roomId))
      .single();
    if (conv) {
      await supabase.from("conversation_members").insert({
        conversation_id: conv.id,
        user_id: authUid,
      }).then(() => {});

      // Post system message to conversations too
      await supabase.from("messages").insert({
        conversation_id: conv.id,
        user_id: authUid,
        content: `${displayName} joined the room`,
        type: "system",
      });
    }
  }

  return NextResponse.json({ ok: true });
}
