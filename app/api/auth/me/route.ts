import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ user: null });

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, username, bio, avatar_url, created_at, is_verified, is_founder, subscription_tier, subscription_status, stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email ?? "",
      name: profile?.name ?? "Trader",
      username: profile?.username ?? null,
      bio: profile?.bio ?? null,
      profilePicture: profile?.avatar_url ?? null,
      joinedAt: profile?.created_at ?? new Date().toISOString(),
      isVerified: profile?.is_verified ?? false,
      isFounder: profile?.is_founder ?? false,
      subscription_tier: profile?.subscription_tier ?? "free",
      subscription_status: profile?.subscription_status ?? "free",
      stripe_customer_id: profile?.stripe_customer_id ?? null,
    },
  });
}
