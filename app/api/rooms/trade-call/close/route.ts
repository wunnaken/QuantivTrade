import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfileId } from "@/lib/get-profile-id";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const routeClient = await createRouteHandlerClient();
  const profileId = await getProfileId(routeClient);
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { tradeCallId: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const supabase = createServerClient();

  const { data: call } = await supabase
    .from("room_trade_calls")
    .select("host_user_id, ticker, direction, entry_price")
    .eq("id", body.tradeCallId)
    .single();

  if (!call) return NextResponse.json({ error: "Trade call not found" }, { status: 404 });
  if (call.host_user_id !== profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  // Fetch current price from Finnhub
  const finnhubKey = process.env.FINNHUB_API_KEY;
  let currentPrice: number | null = null;
  if (finnhubKey) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(call.ticker)}&token=${finnhubKey}`,
        { next: { revalidate: 0 } }
      );
      if (res.ok) {
        const q = await res.json() as { c?: number };
        if (q?.c) currentPrice = q.c;
      }
    } catch {}
  }

  let resultPnl: number | null = null;
  let resultPnlPercent: number | null = null;
  if (currentPrice != null && call.entry_price) {
    const entry = Number(call.entry_price);
    const pnlPct = call.direction === "long"
      ? ((currentPrice - entry) / entry) * 100
      : ((entry - currentPrice) / entry) * 100;
    resultPnlPercent = Math.round(pnlPct * 100) / 100;
    resultPnl = Math.round((currentPrice - entry) * 100) / 100;
  }

  const { error } = await supabase
    .from("room_trade_calls")
    .update({
      status: "closed",
      current_price: currentPrice,
      result_pnl: resultPnl,
      result_pnl_percent: resultPnlPercent,
      closed_at: new Date().toISOString(),
    })
    .eq("id", body.tradeCallId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, currentPrice, resultPnlPercent });
}
