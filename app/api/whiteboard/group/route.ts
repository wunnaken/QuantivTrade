// Run this SQL in Supabase before using group boards:
//
// ALTER TABLE whiteboard_boards ADD COLUMN IF NOT EXISTS is_group boolean DEFAULT false;
// ALTER TABLE whiteboard_boards ADD COLUMN IF NOT EXISTS community_id uuid;
// ALTER TABLE whiteboard_boards ADD COLUMN IF NOT EXISTS allowed_members uuid[] DEFAULT '{}';
// ALTER TABLE whiteboard_boards ADD COLUMN IF NOT EXISTS permissions text DEFAULT 'edit';
// ALTER TABLE whiteboard_boards ADD COLUMN IF NOT EXISTS creator_name text;

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeBoardId(raw: string): string | null {
  const id = raw.startsWith("board-") ? raw.slice("board-".length) : raw;
  return /^\d+$/.test(id) ? id : null;
}

// GET — fetch group boards where current user is creator or allowed member
export async function GET() {
  const userId = await getCurrentProfileId();
  if (!userId) return bad("Unauthorized", 401);

  const supabase = createServerClient();
  const sel = "id, name, scene, updated_at, is_group, community_id, allowed_members, permissions, user_id, creator_name";

  // Run two queries and merge to avoid fragile or+cs PostgREST syntax
  const [{ data: owned }, { data: member }] = await Promise.all([
    supabase.from("whiteboard_boards").select(sel).eq("is_group", true).eq("user_id", userId).order("updated_at", { ascending: false }),
    supabase.from("whiteboard_boards").select(sel).eq("is_group", true).contains("allowed_members", [userId]).order("updated_at", { ascending: false }),
  ]);

  // Deduplicate by id
  const seen = new Set<string>();
  const merged = [...(owned ?? []), ...(member ?? [])].filter(b => {
    const id = String((b as Record<string, unknown>).id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  merged.sort((a, b) => {
    const ta = (a as Record<string, unknown>).updated_at as string ?? "";
    const tb = (b as Record<string, unknown>).updated_at as string ?? "";
    return tb.localeCompare(ta);
  });

  const boards = merged as Array<Record<string, unknown>>;

  // Enrich with community names
  const communityIds = [...new Set(
    boards.filter(b => b.community_id).map(b => b.community_id as string)
  )];
  const communityMap: Record<string, string> = {};
  if (communityIds.length > 0) {
    const { data: comms } = await supabase
      .from("communities")
      .select("id, name")
      .in("id", communityIds);
    for (const c of comms ?? []) communityMap[(c as Record<string, unknown>).id as string] = (c as Record<string, unknown>).name as string;
  }

  const enriched = boards.map(b => ({
    ...b,
    id: String(b.id),
    community_name: b.community_id ? (communityMap[b.community_id as string] ?? null) : null,
    member_count: Array.isArray(b.allowed_members) ? b.allowed_members.length : 0,
  }));

  return NextResponse.json({ boards: enriched });
}

// POST — create a new group board
export async function POST(request: NextRequest) {
  const userId = await getCurrentProfileId();
  if (!userId) return bad("Unauthorized", 401);

  const body = await request.json().catch(() => null) as {
    name?: string;
    community_id?: string | null;
    allowed_members?: string[];
    permissions?: "edit" | "view";
  } | null;

  if (!body?.name?.trim()) return bad("Missing board name");

  const supabase = createServerClient();

  // Get creator's display name
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, name")
    .eq("user_id", userId)
    .single();
  const creatorName = (profile as Record<string, unknown> | null)?.username as string
    ?? (profile as Record<string, unknown> | null)?.name as string ?? null;

  const id = String(Date.now());

  const { data, error } = await supabase
    .from("whiteboard_boards")
    .insert({
      id,
      user_id: userId,
      name: body.name.trim(),
      scene: { elements: [], appState: { viewBackgroundColor: "#1e1e2e" }, files: {} },
      is_group: true,
      community_id: body.community_id ?? null,
      allowed_members: body.allowed_members ?? [],
      permissions: body.permissions ?? "edit",
      creator_name: creatorName,
      updated_at: new Date().toISOString(),
    })
    .select("id, name, scene, updated_at, is_group, community_id, allowed_members, permissions, user_id, creator_name")
    .single();

  if (error) return bad(error.message, 500);

  return NextResponse.json(
    { board: { ...(data as Record<string, unknown>), id: String((data as Record<string, unknown>).id) } },
    { status: 201 }
  );
}

// PATCH — update group board scene/name/members (creator or edit-permission members)
export async function PATCH(request: NextRequest) {
  const userId = await getCurrentProfileId();
  if (!userId) return bad("Unauthorized", 401);

  const body = await request.json().catch(() => null) as {
    boardId?: string;
    name?: string;
    scene?: unknown;
    // Member management (creator only)
    action?: "add_member" | "remove_member" | "set_permissions";
    memberId?: string;
    permissions?: "edit" | "view";
  } | null;

  if (!body?.boardId) return bad("Missing boardId");
  const boardIdForDb = normalizeBoardId(body.boardId);
  if (!boardIdForDb) return bad("Invalid boardId");

  const supabase = createServerClient();

  const { data: board } = await supabase
    .from("whiteboard_boards")
    .select("user_id, allowed_members, permissions")
    .eq("id", boardIdForDb)
    .single();

  if (!board) return bad("Board not found", 404);

  const b = board as { user_id: string; allowed_members: string[] | null; permissions: string };
  const isCreator = b.user_id === userId;
  const isMember = Array.isArray(b.allowed_members) && b.allowed_members.includes(userId);

  // Member management actions require creator
  if (body.action) {
    if (!isCreator) return bad("Only the board creator can manage members", 403);
    const members: string[] = Array.isArray(b.allowed_members) ? b.allowed_members : [];

    if (body.action === "add_member") {
      if (!body.memberId) return bad("Missing memberId");
      if (members.includes(body.memberId)) return NextResponse.json({ ok: true }); // already added
      const { error } = await supabase
        .from("whiteboard_boards")
        .update({ allowed_members: [...members, body.memberId], updated_at: new Date().toISOString() })
        .eq("id", boardIdForDb);
      if (error) return bad(error.message, 500);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "remove_member") {
      if (!body.memberId) return bad("Missing memberId");
      const { error } = await supabase
        .from("whiteboard_boards")
        .update({ allowed_members: members.filter(id => id !== body.memberId), updated_at: new Date().toISOString() })
        .eq("id", boardIdForDb);
      if (error) return bad(error.message, 500);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "set_permissions") {
      if (!body.permissions) return bad("Missing permissions");
      const { error } = await supabase
        .from("whiteboard_boards")
        .update({ permissions: body.permissions, updated_at: new Date().toISOString() })
        .eq("id", boardIdForDb);
      if (error) return bad(error.message, 500);
      return NextResponse.json({ ok: true });
    }
  }

  // Scene/name update — creator or edit-permission member
  if (!isCreator && !(isMember && b.permissions === "edit")) return bad("Permission denied", 403);

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name?.trim()) updates.name = body.name.trim();
  if (body.scene != null) updates.scene = body.scene;

  const { error } = await supabase
    .from("whiteboard_boards")
    .update(updates)
    .eq("id", boardIdForDb);

  if (error) return bad(error.message, 500);
  return NextResponse.json({ ok: true });
}

// DELETE — delete a group board (creator only)
export async function DELETE(request: NextRequest) {
  const userId = await getCurrentProfileId();
  if (!userId) return bad("Unauthorized", 401);

  const rawId = request.nextUrl.searchParams.get("boardId")?.trim();
  if (!rawId) return bad("Missing boardId");
  const boardIdForDb = normalizeBoardId(rawId);
  if (!boardIdForDb) return bad("Invalid boardId");

  const supabase = createServerClient();
  const { error } = await supabase
    .from("whiteboard_boards")
    .delete()
    .eq("id", boardIdForDb)
    .eq("user_id", userId)
    .eq("is_group", true);

  if (error) return bad(error.message, 500);
  return NextResponse.json({ ok: true });
}
