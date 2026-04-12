import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/api-auth";
import { createServerClient } from "@/lib/supabase/server";
import { getSnaptradeClient } from "@/lib/snaptrade-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accountId = request.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

  const supabase = createServerClient();

  const { data: snap } = await supabase
    .from("snaptrade_users")
    .select("user_secret")
    .eq("user_id", userId)
    .single();

  if (!snap?.user_secret) return NextResponse.json({ holdings: null });

  const client = getSnaptradeClient();
  const res = await client.accountInformation.getUserHoldings({
    accountId,
    userId,
    userSecret: snap.user_secret,
  });

  return NextResponse.json({ holdings: res.data ?? null });
}
