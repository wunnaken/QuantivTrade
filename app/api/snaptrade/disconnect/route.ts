import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/api-auth";
import { createServerClient } from "@/lib/supabase/server";
import { getSnaptradeClient } from "@/lib/snaptrade-client";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connectionId = request.nextUrl.searchParams.get("connectionId");
  if (!connectionId) return NextResponse.json({ error: "connectionId required" }, { status: 400 });

  const supabase = createServerClient();

  const { data: snap } = await supabase
    .from("snaptrade_users")
    .select("user_secret")
    .eq("user_id", userId)
    .single();

  if (!snap?.user_secret) return NextResponse.json({ error: "Not connected" }, { status: 404 });

  const client = getSnaptradeClient();
  await client.connections.deleteConnection({
    connectionId,
    userId,
    userSecret: snap.user_secret,
  });

  // Check if any accounts remain; if none, remove verified_trader status
  const remaining = await client.accountInformation.listUserAccounts({
    userId,
    userSecret: snap.user_secret,
  });

  if (!remaining.data?.length) {
    await supabase.from("profiles").update({ verified_trader: false }).eq("user_id", userId);
  }

  return NextResponse.json({ ok: true });
}
