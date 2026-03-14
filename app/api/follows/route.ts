import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export async function GET() {
  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("follows")
    .select("followed_id")
    .eq("follower_id", profileId);

  if (error) {
    console.error("[follows] GET error:", error);
    return NextResponse.json({ error: "Failed to load follows" }, { status: 500 });
  }

  const followedIds = (data || []).map((r) => r.followed_id);
  return NextResponse.json({ followedIds });
}

export async function POST(request: NextRequest) {
  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { followed_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const followedId = typeof body.followed_id === "string" ? body.followed_id.trim() : "";
  if (!followedId) {
    return NextResponse.json({ error: "followed_id is required" }, { status: 400 });
  }
  if (followedId === profileId) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { error } = await supabase.from("follows").insert({
    follower_id: profileId,
    followed_id: followedId,
  });

  if (error) {
    if (error.code === "23505") return NextResponse.json({ ok: true });
    console.error("[follows] POST error:", error);
    return NextResponse.json({ error: "Failed to follow" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const followedId = request.nextUrl.searchParams.get("followed_id")?.trim();
  if (!followedId) {
    return NextResponse.json({ error: "followed_id is required" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", profileId)
    .eq("followed_id", followedId);

  if (error) {
    console.error("[follows] DELETE error:", error);
    return NextResponse.json({ error: "Failed to unfollow" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
