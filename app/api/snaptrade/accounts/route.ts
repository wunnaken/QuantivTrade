import { NextResponse } from "next/server";
import { getUserId } from "@/lib/api-auth";
import { createServerClient } from "@/lib/supabase/server";
import { getSnaptradeClient } from "@/lib/snaptrade-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerClient();

  const { data: snap } = await supabase
    .from("snaptrade_users")
    .select("user_secret")
    .eq("user_id", userId)
    .single();

  if (!snap?.user_secret) return NextResponse.json({ accounts: [] });

  const client = getSnaptradeClient();
  const res = await client.accountInformation.listUserAccounts({
    userId,
    userSecret: snap.user_secret,
  });

  const accounts = res.data ?? [];

  // Mark as verified trader if at least one account connected
  if (accounts.length > 0) {
    await supabase.from("profiles").update({ verified_trader: true }).eq("user_id", userId);
  }

  return NextResponse.json({ accounts });
}
