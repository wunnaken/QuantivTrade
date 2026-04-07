import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/auth/sign-in?error=oauth", request.url));
  }

  const cookieStore = await cookies();

  // Collect cookies Supabase wants to set so we can copy them to the redirect response
  const pendingCookies: Array<{ name: string; value: string; options?: Partial<ResponseCookie> }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Partial<ResponseCookie> }>) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    }
  );

  let exchangeData: Awaited<ReturnType<typeof supabase.auth.exchangeCodeForSession>> | null = null;
  try {
    exchangeData = await supabase.auth.exchangeCodeForSession(code);
  } catch (e) {
    console.error("[callback] exchange threw:", e);
    return NextResponse.redirect(new URL("/auth/sign-in?error=oauth", request.url));
  }

  const { data, error } = exchangeData;

  if (error || !data.session) {
    console.error("[callback] exchange error:", error?.message);
    return NextResponse.redirect(new URL("/auth/sign-in?error=oauth", request.url));
  }

  const user = data.session.user;

  // Check whether this user already has a completed profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("user_id", user.id)
    .single();

  let redirectPath: string;

  if (!profile) {
    const rawName =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      "Trader";
    await supabase.from("profiles").upsert(
      { user_id: user.id, email: user.email ?? "", name: rawName },
      { onConflict: "user_id" }
    );
    redirectPath = "/auth/setup-profile";
  } else if (!profile.username) {
    redirectPath = "/auth/setup-profile";
  } else {
    redirectPath = "/feed";
  }

  const response = NextResponse.redirect(new URL(redirectPath, request.url));

  // Attach session cookies to the redirect so the browser persists the session
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options ?? {});
  }

  return response;
}
