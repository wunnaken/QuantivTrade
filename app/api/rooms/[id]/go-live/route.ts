import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfileId } from "@/lib/get-profile-id";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const routeClient = await createRouteHandlerClient();
  const profileId = await getProfileId(routeClient);
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roomId = Number(id);
  let body: { isLive: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const supabase = createServerClient();

  const { data: room } = await supabase.from("rooms").select("host_user_id").eq("id", roomId).single();
  if (room?.host_user_id !== profileId) return NextResponse.json({ error: "Only the host can change live status" }, { status: 403 });

  const update: Record<string, unknown> = { is_live: body.isLive };
  if (!body.isLive) update.ended_at = new Date().toISOString();

  const { error } = await supabase.from("rooms").update(update).eq("id", roomId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, isLive: body.isLive });
}
