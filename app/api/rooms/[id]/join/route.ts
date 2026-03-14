import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

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
    if (error.code === "23505") return NextResponse.json({ ok: true });
    console.error("[rooms/join] POST error:", error);
    return NextResponse.json({ error: "Failed to join room" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
