import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json() as { email: string; password: string };

  const cookieStore = await cookies();
  const pendingCookies: Array<{ name: string; value: string; options?: Partial<ResponseCookie> }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Partial<ResponseCookie> }>) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  // Check MFA requirement
  let mfaRequired = false;
  let factorId: string | null = null;
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = factors?.totp?.find((f) => f.status === "verified");
    if (totp) {
      mfaRequired = true;
      factorId = totp.id;
    }
  }

  // Check profile completion (only needed if not going to MFA)
  let hasUsername = false;
  if (!mfaRequired && data.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("user_id", data.user.id)
      .single();
    hasUsername = !!profile?.username;
  }

  const response = NextResponse.json({
    mfaRequired,
    factorId,
    hasUsername,
    accessToken: data.session?.access_token ?? null,
    refreshToken: data.session?.refresh_token ?? null,
  });

  // Attach session cookies to the response so the browser stores them
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options ?? {});
  }

  return response;
}
