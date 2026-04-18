import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfileId } from "@/lib/get-profile-id";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const routeClient = await createRouteHandlerClient();

  const { data: { user } } = await routeClient.auth.getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await getProfileId(routeClient);
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const roomId = Number(id);
  const supabase = createServerClient();

  // Verify caller is host
  const { data: room } = await supabase.from("rooms").select("host_user_id").eq("id", roomId).single();
  if (!room || room.host_user_id !== profileId) {
    return NextResponse.json({ error: "Only the host can rename this room" }, { status: 403 });
  }

  const { error } = await supabase.from("rooms").update({ name: body.name.trim() }).eq("id", roomId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
