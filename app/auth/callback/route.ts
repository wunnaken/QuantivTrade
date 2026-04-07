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

  // Collect cookies Supabase wants to set so we can attach them to the redirect response
  const cookiesToForward: { name: string; value: string; options: Record<string, unknown> }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options = {} }) => {
            // Queue for the response
            cookiesToForward.push({ name, value, options: options as Record<string, unknown> });
            // Also write to the Next.js cookie store (for subsequent server calls in this request)
            try { cookieStore.set(name, value, options as Record<string, unknown>); } catch { /* ignore */ }
          });
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

  // Check/create profile for new OAuth users
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("user_id", user.id)
    .single();

  let destination = `${origin}${next}`;

  if (!profile) {
    const rawName =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      "Trader";
    await supabase.from("profiles").upsert(
      { user_id: user.id, email: user.email ?? "", name: rawName },
      { onConflict: "user_id" }
    );
    destination = `${origin}/auth/setup-profile`;
  } else if (!profile.username) {
    destination = `${origin}/auth/setup-profile`;
  }

  // Build the redirect and explicitly attach session cookies
  const response = NextResponse.redirect(destination);
  cookiesToForward.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
  });

  return response;
}
