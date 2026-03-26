import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", profileId);

  if (error) {
    console.error("[follows] GET error:", error);
    return NextResponse.json({ error: "Failed to load follows" }, { status: 500 });
  }

  const followedIds = (data || []).map((r) => r.following_id);
  return NextResponse.json({ followedIds });
}

export async function POST(request: NextRequest) {
  try {
    const profileId = await getCurrentProfileId();
    if (!profileId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let body: { following_id?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const followingId = typeof body.following_id === "string" ? body.following_id.trim() : "";
    if (!followingId) {
      return NextResponse.json({ error: "following_id is required" }, { status: 400 });
    }
    if (followingId === profileId) {
      return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase.from("follows").insert({
      follower_id: profileId,
      following_id: followingId,
    });

    if (error) {
      if (error.code === "23505") return NextResponse.json({ ok: true });
      console.error("[follows] POST error:", error);
      return NextResponse.json({ error: error.message ?? "Failed to follow" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[follows] POST unhandled:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const profileId = await getCurrentProfileId();
    if (!profileId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const followingId = request.nextUrl.searchParams.get("following_id")?.trim();
    if (!followingId) {
      return NextResponse.json({ error: "following_id is required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", profileId)
      .eq("following_id", followingId);

    if (error) {
      console.error("[follows] DELETE error:", error);
      return NextResponse.json({ error: error.message ?? "Failed to unfollow" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[follows] DELETE unhandled:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
