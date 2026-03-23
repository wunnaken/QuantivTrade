import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type DbConv = {
  id: string;
  type: string;
  name: string | null;
  description: string | null;
  room_id: string | null;
  created_by: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  created_at: string;
};

type DbMember = { conversation_id: string; user_id: string; last_read_at: string };
type DbProfile = { user_id: string; name: string; username: string; is_verified?: boolean; is_founder?: boolean };

export async function GET() {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerClient();

  // Community conversations (visible to all)
  const { data: communityRaw } = await supabase
    .from("conversations")
    .select("*")
    .eq("type", "community")
    .order("last_message_at", { ascending: false });

  // User's memberships
  const { data: memberships } = await supabase
    .from("conversation_members")
    .select("conversation_id, user_id, last_read_at")
    .eq("user_id", userId);

  const memberConvIds = (memberships as DbMember[] ?? []).map((m) => m.conversation_id);

  // DM + group conversations user is a member of
  let memberConvs: DbConv[] = [];
  if (memberConvIds.length > 0) {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .in("id", memberConvIds)
      .in("type", ["dm", "group"])
      .order("last_message_at", { ascending: false });
    memberConvs = (data ?? []) as DbConv[];
  }

  // For DMs: get the other member's profile
  const dmConvIds = memberConvs.filter((c) => c.type === "dm").map((c) => c.id);
  let otherProfiles: DbProfile[] = [];
  const otherUserByConv: Record<string, DbProfile> = {};

  if (dmConvIds.length > 0) {
    const { data: otherMembers } = await supabase
      .from("conversation_members")
      .select("conversation_id, user_id")
      .in("conversation_id", dmConvIds)
      .neq("user_id", userId);

    const otherUserIds = [...new Set((otherMembers ?? []).map((m: DbMember) => m.user_id))];
    if (otherUserIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, name, username, is_verified, is_founder")
        .in("user_id", otherUserIds);
      otherProfiles = (profs ?? []) as DbProfile[];
    }

    const profMap: Record<string, DbProfile> = {};
    for (const p of otherProfiles) profMap[p.user_id] = p;

    for (const m of (otherMembers ?? []) as DbMember[]) {
      const prof = profMap[m.user_id];
      if (prof) otherUserByConv[m.conversation_id] = prof;
    }
  }

  return NextResponse.json({
    community: (communityRaw as DbConv[] ?? []).map((c) => ({ ...c, unread: 0 })),
    dms: memberConvs
      .filter((c) => c.type === "dm")
      .map((c) => ({ ...c, other_user: otherUserByConv[c.id] ?? null, unread: 0 })),
    groups: memberConvs.filter((c) => c.type === "group").map((c) => ({ ...c, unread: 0 })),
  });
}

export async function POST(request: NextRequest) {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    type: "dm" | "group";
    other_user_id?: string;
    name?: string;
    member_ids?: string[];
  };

  const supabase = createServerClient();

  if (body.type === "dm") {
    if (!body.other_user_id) return NextResponse.json({ error: "other_user_id required" }, { status: 400 });

    // Check if DM already exists between these two users
    const { data: myMemberships } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", userId);

    const myConvIds = (myMemberships ?? []).map((m: { conversation_id: string }) => m.conversation_id);

    if (myConvIds.length > 0) {
      const { data: shared } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", body.other_user_id)
        .in("conversation_id", myConvIds);

      if (shared && shared.length > 0) {
        const sharedIds = shared.map((s: { conversation_id: string }) => s.conversation_id);
        const { data: existingDm } = await supabase
          .from("conversations")
          .select("id")
          .eq("type", "dm")
          .in("id", sharedIds)
          .limit(1)
          .single();

        if (existingDm) return NextResponse.json({ id: existingDm.id });
      }
    }

    const { data: conv, error } = await supabase
      .from("conversations")
      .insert({ type: "dm", created_by: userId })
      .select("id")
      .single();

    if (error || !conv) return NextResponse.json({ error: "Failed to create" }, { status: 500 });

    await supabase.from("conversation_members").insert([
      { conversation_id: conv.id, user_id: userId, role: "member" },
      { conversation_id: conv.id, user_id: body.other_user_id, role: "member" },
    ]);

    return NextResponse.json({ id: conv.id });
  }

  if (body.type === "group") {
    if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

    const { data: conv, error } = await supabase
      .from("conversations")
      .insert({ type: "group", name: body.name.trim(), created_by: userId })
      .select("id")
      .single();

    if (error || !conv) return NextResponse.json({ error: "Failed to create" }, { status: 500 });

    const allIds = [...new Set([userId, ...(body.member_ids ?? [])])];
    await supabase.from("conversation_members").insert(
      allIds.map((uid) => ({
        conversation_id: conv.id,
        user_id: uid,
        role: uid === userId ? "owner" : "member",
      }))
    );

    return NextResponse.json({ id: conv.id });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
