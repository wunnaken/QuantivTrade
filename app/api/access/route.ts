import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const { code } = await req.json();
  const validCode = process.env.ACCESS_CODE;

  if (!validCode) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("xch_access", "", { path: "/", maxAge: 60 * 60 * 24 * 365 });
    return res;
  }

  if (!code || code.trim() !== validCode) {
    return NextResponse.json({ error: "Invalid access code." }, { status: 401 });
  }

  // Grant elite status to the user if they have a session
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && (serviceKey || anonKey)) {
      // Try to get the user from the auth cookie
      const { createServerClient } = await import("@supabase/ssr");
      const cookieStore = new Map<string, string>();
      const cookieHeader = req.headers.get("cookie") ?? "";
      cookieHeader.split(";").forEach((c) => {
        const [k, ...v] = c.trim().split("=");
        if (k) cookieStore.set(k, v.join("="));
      });
      const supabaseAuth = createServerClient(supabaseUrl, anonKey!, {
        cookies: {
          getAll() {
            return Array.from(cookieStore.entries()).map(([name, value]) => ({ name, value }));
          },
          setAll() {},
        },
      });
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (user) {
        // Use service role to update the profile
        const admin = createClient(supabaseUrl, serviceKey || anonKey!);
        await admin.from("profiles").update({ subscription_tier: "elite", is_verified: true }).eq("user_id", user.id);
      }
    }
  } catch {
    // Non-fatal — access is still granted even if elite upgrade fails
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("xch_access", validCode, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
