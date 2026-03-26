import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const currentUserId = await getCurrentProfileId();

  const supabase = createServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, name, username, bio, avatar_url, is_verified, is_founder, created_at, ui_preferences")
    .eq("user_id", userId)
    .single();

  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [
    { count: followersCount },
    { count: followingCount },
    { data: postsRaw },
    { data: memberRows },
  ] = await Promise.all([
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
    supabase
      .from("posts")
      .select("id, content, created_at, comments_count")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("room_members")
      .select("room_id")
      .eq("user_id", userId),
  ]);

  // Fetch rooms for this user's memberships
  const roomIds = (memberRows ?? []).map((r: { room_id: number }) => r.room_id);
  let groups: { id: number; name: string }[] = [];
  if (roomIds.length > 0) {
    const { data: roomRows } = await supabase
      .from("rooms")
      .select("id, name")
      .in("id", roomIds)
      .is("ended_at", null)
      .limit(6);
    groups = (roomRows ?? []) as { id: number; name: string }[];
  }

  let isFollowing = false;
  if (currentUserId && currentUserId !== userId) {
    const { data: row } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", currentUserId)
      .eq("following_id", userId)
      .maybeSingle();
    isFollowing = !!row;
  }

  const prefs = (profile.ui_preferences as Record<string, unknown>) ?? {};

  return NextResponse.json({
    profile: {
      user_id: profile.user_id,
      name: profile.name,
      username: profile.username,
      bio: profile.bio,
      avatar_url: profile.avatar_url,
      is_verified: profile.is_verified,
      is_founder: profile.is_founder,
      created_at: profile.created_at,
    },
    followersCount: followersCount ?? 0,
    followingCount: followingCount ?? 0,
    isFollowing,
    bubbleIds: Array.isArray(prefs.bubble_ids) ? (prefs.bubble_ids as string[]) : [],
    xpTotal: typeof prefs.xp_total === "number" ? prefs.xp_total : 0,
    posts: (postsRaw ?? []).map((p) => ({
      id: p.id,
      content: p.content,
      created_at: p.created_at,
      comments_count: p.comments_count ?? 0,
    })),
    groups,
  });
}
