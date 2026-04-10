import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export async function GET() {
  const cookieStore = await cookies();
  const pendingCookies: Array<{ name: string; value: string; options?: Partial<ResponseCookie> }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) { pendingCookies.push(...cookiesToSet); },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ mfaRequired: false, factorId: null, hasUsername: false });
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  let mfaRequired = false;
  let factorId: string | null = null;
  if (aal && aal.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = factors?.totp?.find((f) => f.status === "verified");
    if (totp) { mfaRequired = true; factorId = totp.id; }
  }

  const { data: profile } = await supabase.from("profiles").select("username").eq("user_id", user.id).single();
  const hasUsername = !!profile?.username;

  const response = NextResponse.json({ mfaRequired, factorId, hasUsername });
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options ?? {});
  }
  return response;
}
