import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  const cookieStore = await cookies();

  // Verify the user has the access cookie
  const accessCookie = cookieStore.get("xch_access")?.value;
  const validCode = process.env.ACCESS_CODE;
  if (validCode && accessCookie !== validCode) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the authenticated user
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Upgrade to elite using service role
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  await admin.from("profiles").update({ subscription_tier: "elite", is_verified: true }).eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
