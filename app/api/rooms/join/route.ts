import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const routeClient = await createRouteHandlerClient();
  const { data: { user } } = await routeClient.auth.getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const authUid = user.id;

  let body: { inviteCode: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.inviteCode?.trim()) return NextResponse.json({ error: "inviteCode required" }, { status: 400 });

  const supabase = createServerClient();

  const { data: room } = await supabase
    .from("rooms")
    .select("id, max_members")
    .eq("invite_code", body.inviteCode.trim().toUpperCase())
    .single();

  if (!room) return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });

  // Check already a member (room_members.user_id is UUID)
  const { data: existing } = await supabase
    .from("room_members")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", authUid)
    .single();

  if (existing) return NextResponse.json({ roomId: room.id });

  // Check capacity
  const { count } = await supabase
    .from("room_members")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id);

  if (count != null && count >= room.max_members) {
    return NextResponse.json({ error: "Room is full" }, { status: 403 });
  }

  const { error: memberErr } = await supabase.from("room_members").insert({
    room_id: room.id,
    user_id: authUid,
  });

  if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });

  return NextResponse.json({ roomId: room.id });
}
