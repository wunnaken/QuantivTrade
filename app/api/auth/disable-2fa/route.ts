import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export async function POST(request: NextRequest) {
  const { factorId, code } = await request.json() as { factorId: string; code: string };

  if (!factorId || !code || code.length !== 6) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

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

  // Verify user is authenticated
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Challenge then verify to reach AAL2
  const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) {
    return NextResponse.json({ error: challengeError.message }, { status: 400 });
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code,
  });
  if (verifyError) {
    return NextResponse.json({ error: "Incorrect code. Try again." }, { status: 401 });
  }

  // Unenroll the factor
  const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
  if (unenrollError) {
    return NextResponse.json({ error: unenrollError.message }, { status: 400 });
  }

  const response = NextResponse.json({ success: true });

  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options ?? {});
  }

  return response;
}
