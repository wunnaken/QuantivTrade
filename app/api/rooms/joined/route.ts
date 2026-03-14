import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export async function GET() {
  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ roomIds: [] });
  }

  const supabase = createServerClient();
  const { data: members, error } = await supabase
    .from("room_members")
    .select("room_id")
    .eq("user_id", profileId);

  if (error) {
    console.error("[rooms/joined] GET error:", error);
    return NextResponse.json({ roomIds: [], rooms: [] });
  }

  const roomIds = (members || []).map((r) => r.room_id);
  if (roomIds.length === 0) return NextResponse.json({ roomIds, rooms: [] });

  const { data: roomsRows } = await supabase
    .from("rooms")
    .select("id, name")
    .in("id", roomIds);

  const rooms = (roomsRows || []).map((r) => ({ id: r.id, name: r.name ?? r.id }));
  return NextResponse.json({ roomIds, rooms });
}
