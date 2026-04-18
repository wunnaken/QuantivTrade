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

  // Fetch community conversations, memberships, and room memberships in parallel
  const [communityRes, membershipsRes, roomMembersRes] = await Promise.all([
    supabase.from("conversations").select("*").eq("type", "community").order("last_message_at", { ascending: false }),
    supabase.from("conversation_members").select("conversation_id, user_id, last_read_at").eq("user_id", userId),
    supabase.from("room_members").select("room_id").eq("user_id", userId),
  ]);
  const communityRaw = communityRes.data;
  const memberships = membershipsRes.data;

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

    const otherUserIds = [...new Set((otherMembers ?? []).map((m) => m.user_id))];
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

  // Use pre-fetched room memberships
  const joinedRoomIds = (roomMembersRes.data ?? []).map((r: { room_id: number }) => r.room_id);

  let joinedRooms: Array<{ id: number; name: string; description: string | null; created_at: string }> = [];
  if (joinedRoomIds.length > 0) {
    const { data: roomRows } = await supabase
      .from("rooms")
      .select("id, name, description, created_at, is_paid, monthly_price")
      .in("id", joinedRoomIds)
      .order("created_at", { ascending: false });
    joinedRooms = (roomRows ?? []) as typeof joinedRooms;
  }

  // Enrich community conversations with room data (is_paid, etc.)
  const communityRoomIds = (communityRaw as any[] ?? []).map((c: any) => c.room_id).filter(Boolean);
  let roomDataMap: Record<string, { is_paid: boolean; monthly_price: number | null }> = {};
  if (communityRoomIds.length > 0) {
    const { data: roomData } = await supabase.from("rooms").select("id, is_paid, monthly_price").in("id", communityRoomIds);
    for (const r of roomData ?? []) {
      roomDataMap[String(r.id)] = { is_paid: r.is_paid ?? false, monthly_price: r.monthly_price ?? null };
    }
  }

  const communityConvs = (communityRaw as any[] ?? []).map((c: any) => {
    const rd = c.room_id ? roomDataMap[String(c.room_id)] : null;
    return { ...c, unread: 0, is_room: !!c.room_id, room_id: c.room_id ?? null, is_paid: rd?.is_paid ?? false, monthly_price: rd?.monthly_price ?? null };
  });
  const existingNames = new Set(communityConvs.map((c) => c.name?.toLowerCase()));
  const roomConvs = joinedRooms
    .filter((r) => !existingNames.has(r.name?.toLowerCase()))
    .map((r) => ({
      id: `room-${r.id}`,
      name: r.name,
      type: "community" as const,
      created_at: r.created_at,
      last_message_at: r.created_at,
      last_message_preview: r.description || "Community room",
      unread: 0,
      is_room: true,
      room_id: r.id,
      is_paid: (r as any).is_paid ?? false,
      monthly_price: (r as any).monthly_price ?? null,
    }));

  return NextResponse.json({
    community: [...communityConvs, ...roomConvs],
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
