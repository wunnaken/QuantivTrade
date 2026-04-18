import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfileId } from "@/lib/get-profile-id";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const routeClient = await createRouteHandlerClient();

  const { data: { user } } = await routeClient.auth.getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const authUid = user.id;

  const profileId = await getProfileId(routeClient);
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerClient();
  const roomId = Number(id);

  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // room_members.user_id is UUID
  const { data: memberRow } = await supabase
    .from("room_members")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", authUid)
    .single();

  const { data: members } = await supabase
    .from("room_members")
    .select("id, room_id, user_id")
    .eq("room_id", roomId);

  const { data: messages } = await supabase
    .from("room_messages")
    .select("id, room_id, user_id, content, type, is_pinned, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(100);

  const { data: tradeCalls } = await supabase
    .from("room_trade_calls")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });

  // Resolve usernames — room_members.user_id is UUID, map via profiles.user_id
  const allAuthUids = [...new Set([
    ...(members ?? []).map((m: { user_id: string }) => m.user_id),
    ...(messages ?? []).map((m: { user_id: string }) => m.user_id),
  ])];

  const profileMap: Record<string, string | null> = {};
  let hostAuthUid: string | null = null;
  if (allAuthUids.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, user_id, username, name")
      .in("user_id", allAuthUids);
    (profiles ?? []).forEach((p: { id: number; user_id: string; username: string | null; name: string | null }) => {
      profileMap[p.user_id] = p.username || p.name || null;
      if (p.id === room.host_user_id) hostAuthUid = p.user_id;
    });
  }

  // Fallback: look up host auth uid directly if not found above
  if (!hostAuthUid) {
    const { data: hostProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("id", room.host_user_id)
      .single();
    hostAuthUid = hostProfile?.user_id ?? null;
  }

  return NextResponse.json({
    room,
    isMember: !!memberRow,
    isHost: room.host_user_id === profileId,
    authUid,
    hostAuthUid,
    members: (members ?? []).map((m: { user_id: string } & Record<string, unknown>) => ({
      ...m,
      username: profileMap[m.user_id] ?? null,
    })),
    messages: (messages ?? []).map((m: { user_id: string } & Record<string, unknown>) => ({
      ...m,
      username: profileMap[m.user_id] ?? null,
    })),
    tradeCalls: tradeCalls ?? [],
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const routeClient = await createRouteHandlerClient();

  const { data: { user } } = await routeClient.auth.getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await getProfileId(routeClient);
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerClient();
  const roomId = Number(id);

  // Verify the user is the host
  const { data: room } = await supabase.from("rooms").select("id, host_user_id, name").eq("id", roomId).single();
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (room.host_user_id !== profileId) return NextResponse.json({ error: "Only the host can delete this community" }, { status: 403 });

  // Delete members, messages, trade calls, then the room
  await supabase.from("room_messages").delete().eq("room_id", roomId);
  await supabase.from("room_trade_calls").delete().eq("room_id", roomId);
  await supabase.from("room_members").delete().eq("room_id", roomId);
  const { error: delErr } = await supabase.from("rooms").delete().eq("id", roomId);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
