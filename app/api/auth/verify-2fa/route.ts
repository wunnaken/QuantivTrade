import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export async function POST(request: NextRequest) {
  const { factorId, code } = await request.json() as { factorId: string; code: string };

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

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });

  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options ?? {});
  }

  return response;
}
