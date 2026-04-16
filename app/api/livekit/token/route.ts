import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";
import { getProfileId } from "@/lib/get-profile-id";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const routeClient = await createRouteHandlerClient();
  const profileId = await getProfileId(routeClient);
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { roomId } = (await req.json()) as { roomId: number };
  if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });

  const supabase = createServerClient();

  // Verify user is a member of the room
  const { data: membership } = await supabase
    .from("room_members")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", profileId)
    .single();

  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  // Get user info for display name
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, name")
    .eq("id", profileId)
    .single();

  // Check if user is host
  const { data: room } = await supabase
    .from("rooms")
    .select("host_user_id")
    .eq("id", roomId)
    .single();

  const isHost = room?.host_user_id === profileId;
  const identity = `user-${profileId}`;
  const displayName = profile?.username || profile?.name || "Trader";
  const livekitRoom = `trade-room-${roomId}`;

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: "LiveKit not configured" }, { status: 500 });
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name: displayName,
    ttl: "6h",
  });

  token.addGrant({
    room: livekitRoom,
    roomJoin: true,
    canPublish: isHost,
    canSubscribe: true,
    canPublishData: true,
  });

  const jwt = await token.toJwt();

  return NextResponse.json({
    token: jwt,
    url: process.env.LIVEKIT_URL || "",
    room: livekitRoom,
    isHost,
  });
}
