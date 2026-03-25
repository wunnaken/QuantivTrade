import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfileId } from "@/lib/get-profile-id";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const routeClient = await createRouteHandlerClient();
  const profileId = await getProfileId(routeClient);
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    roomId: number;
    ticker: string;
    direction: "long" | "short";
    entryPrice: number;
    targetPrice?: number | null;
    stopLoss?: number | null;
    notes?: string | null;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const supabase = createServerClient();

  const { data: room } = await supabase.from("rooms").select("host_user_id").eq("id", body.roomId).single();
  if (room?.host_user_id !== profileId) return NextResponse.json({ error: "Only the host can post trade calls" }, { status: 403 });

  const { data: call, error } = await supabase
    .from("room_trade_calls")
    .insert({
      room_id: body.roomId,
      host_user_id: profileId,
      ticker: body.ticker.toUpperCase().trim(),
      direction: body.direction,
      entry_price: body.entryPrice,
      target_price: body.targetPrice ?? null,
      stop_loss: body.stopLoss ?? null,
      current_price: body.entryPrice,
      status: "active",
      notes: body.notes?.trim() || null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tradeCall: call });
}
