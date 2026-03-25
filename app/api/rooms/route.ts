import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfileId } from "@/lib/get-profile-id";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

function rand(len = 8): string {
  return Math.random().toString(36).substring(2, 2 + len).toUpperCase();
}

export async function POST(req: Request) {
  const routeClient = await createRouteHandlerClient();

  // Get both the auth UUID (for room_members) and bigint profile id (for rooms)
  const { data: { user } } = await routeClient.auth.getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const authUid = user.id;

  const profileId = await getProfileId(routeClient);
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    name: string;
    description?: string;
    maxMembers?: number;
    scheduledAt?: string | null;
    isInviteOnly?: boolean;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const supabase = createServerClient();
  const slug = body.name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + rand(4).toLowerCase();
  const inviteCode = rand(8);

  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .insert({
      name: body.name.trim(),
      description: body.description?.trim() || null,
      slug,
      host_user_id: profileId,
      is_live: false,
      is_invite_only: body.isInviteOnly ?? true,
      max_members: body.maxMembers ?? 50,
      invite_code: inviteCode,
      scheduled_at: body.scheduledAt || null,
    })
    .select("id")
    .single();

  if (roomErr || !room) return NextResponse.json({ error: roomErr?.message ?? "Failed to create room" }, { status: 500 });

  // room_members.user_id is a UUID referencing auth.users
  const { error: memberErr } = await supabase.from("room_members").insert({
    room_id: room.id,
    user_id: authUid,
  });

  if (memberErr) {
    await supabase.from("rooms").delete().eq("id", room.id);
    return NextResponse.json({ error: memberErr.message }, { status: 500 });
  }

  return NextResponse.json({ roomId: room.id });
}
