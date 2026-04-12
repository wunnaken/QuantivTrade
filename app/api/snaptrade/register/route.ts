import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/api-auth";
import { createServerClient } from "@/lib/supabase/server";
import { getSnaptradeClient } from "@/lib/snaptrade-client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let redirectURL: string | undefined;
  try {
    const body = await request.json();
    if (typeof body.redirectURL === "string") redirectURL = body.redirectURL;
  } catch {
    // optional body
  }

  const supabase = createServerClient();
  const client = getSnaptradeClient();

  // Check if user is already registered with SnapTrade
  const { data: existing } = await supabase
    .from("snaptrade_users")
    .select("user_secret")
    .eq("user_id", userId)
    .single();

  let userSecret: string;

  if (existing?.user_secret) {
    userSecret = existing.user_secret;
  } else {
    // Register user with SnapTrade
    const reg = await client.authentication.registerSnapTradeUser({ userId });
    const secret = reg.data?.userSecret;
    if (!secret) return NextResponse.json({ error: "SnapTrade registration failed" }, { status: 500 });
    userSecret = secret;

    const { error: insertError } = await supabase.from("snaptrade_users").insert({
      user_id: userId,
      user_secret: userSecret,
    });
    if (insertError) return NextResponse.json({ error: "Failed to store SnapTrade credentials" }, { status: 500 });
  }

  // Get connection portal URL
  const login = await client.authentication.loginSnapTradeUser({
    userId,
    userSecret,
    ...(redirectURL ? { customRedirect: redirectURL } : {}),
    darkMode: true,
  });

  const portalUrl = (login.data as { redirectURI?: string })?.redirectURI;
  if (!portalUrl) return NextResponse.json({ error: "Failed to get connection portal URL" }, { status: 500 });

  return NextResponse.json({ portalUrl });
}
