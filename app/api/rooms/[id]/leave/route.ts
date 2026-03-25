import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfileId } from "@/lib/get-profile-id";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const routeClient = await createRouteHandlerClient();

  const { data: { user } } = await routeClient.auth.getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const authUid = user.id;

  const profileId = await getProfileId(routeClient);
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roomId = Number(id);
  const supabase = createServerClient();

  // host_user_id is bigint (profileId), block host from leaving
  const { data: room } = await supabase.from("rooms").select("host_user_id").eq("id", roomId).single();
  if (room?.host_user_id === profileId) {
    return NextResponse.json({ error: "Host cannot leave — end the session instead" }, { status: 400 });
  }

  // room_members.user_id is UUID
  await supabase.from("room_members").delete().eq("room_id", roomId).eq("user_id", authUid);
  return NextResponse.json({ ok: true });
}
