import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/feed";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/sign-in?error=oauth`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/auth/sign-in?error=oauth`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/auth/sign-in?error=oauth`);
  }

  // Check if profile exists; new OAuth users won't have one yet
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    // First OAuth sign-in — create a minimal profile then send to setup
    const rawName =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      "Trader";
    await supabase.from("profiles").upsert(
      { user_id: user.id, email: user.email ?? "", name: rawName },
      { onConflict: "user_id" }
    );
    return NextResponse.redirect(`${origin}/auth/setup-profile`);
  }

  if (!profile.username) {
    return NextResponse.redirect(`${origin}/auth/setup-profile`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
