import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// ── User state (points + daily claim) ───────────────────────────────────────

export async function GET() {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerClient();

  const [stateResult, betsResult, marketsResult] = await Promise.all([
    supabase.from("predict_user_state").select("*").eq("user_id", userId).single(),
    supabase.from("predict_bets").select("*").eq("user_id", userId).order("placed_at", { ascending: false }),
    supabase.from("predict_markets").select("*").order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    state: stateResult.data ?? null,
    bets: betsResult.data ?? [],
    markets: marketsResult.data ?? [],
  });
}

export async function PATCH(request: NextRequest) {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    points?: number;
    last_daily_claim?: number;
    bet?: {
      id: string;
      market_id: string;
      user_name: string;
      side: "yes" | "no";
      amount: number;
      odds_at_bet: number;
    };
    update_market?: {
      id: string;
      yes_points?: number;
      no_points?: number;
      last_bet_at?: string;
      status?: string;
      outcome?: string;
      resolved_at?: string;
      resolved_by?: string;
    };
    resolve_bets?: {
      market_id: string;
      outcome: "yes" | "no";
      resolved_at: string;
    };
  } | null;

  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const supabase = createServerClient();

  // Update user state (points / daily claim)
  if (body.points !== undefined || body.last_daily_claim !== undefined) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.points !== undefined) patch.points = Math.max(0, Math.floor(body.points));
    if (body.last_daily_claim !== undefined) patch.last_daily_claim = body.last_daily_claim;
    await supabase
      .from("predict_user_state")
      .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
  }

  // Place a bet
  if (body.bet) {
    await supabase.from("predict_bets").upsert({
      id: body.bet.id,
      market_id: body.bet.market_id,
      user_id: userId,
      user_name: body.bet.user_name,
      side: body.bet.side,
      amount: body.bet.amount,
      odds_at_bet: body.bet.odds_at_bet,
      placed_at: new Date().toISOString(),
      status: "open",
    });
  }

  // Update market totals after a bet / resolve
  if (body.update_market) {
    const { id, ...rest } = body.update_market;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) patch[k] = v;
    }
    if (Object.keys(patch).length > 0) {
      await supabase.from("predict_markets").update(patch).eq("id", id);
    }
  }

  // Mark bets as won/lost when a market resolves
  if (body.resolve_bets) {
    const { market_id, outcome, resolved_at } = body.resolve_bets;
    const { data: bets } = await supabase
      .from("predict_bets")
      .select("*")
      .eq("market_id", market_id)
      .eq("status", "open");

    if (bets && bets.length > 0) {
      let totalPayout = 0;
      for (const bet of bets) {
        const won = bet.side === outcome;
        const payout = won ? Math.floor(bet.amount / bet.odds_at_bet) : 0;
        if (won && bet.user_id === userId) totalPayout += payout;
        await supabase.from("predict_bets").update({
          status: won ? "won" : "lost",
          payout: won ? payout : null,
          resolved_at,
        }).eq("id", bet.id);
      }
      // Credit payout to current user
      if (totalPayout > 0) {
        const { data: state } = await supabase
          .from("predict_user_state")
          .select("points")
          .eq("user_id", userId)
          .single();
        const current = state?.points ?? 1000;
        await supabase.from("predict_user_state").upsert({
          user_id: userId,
          points: current + totalPayout,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
