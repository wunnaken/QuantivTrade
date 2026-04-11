// Run this SQL in Supabase before using board invites:
//
// ALTER TABLE whiteboard_boards ADD COLUMN IF NOT EXISTS invite_token text;
// CREATE UNIQUE INDEX IF NOT EXISTS whiteboard_boards_invite_token_idx ON whiteboard_boards(invite_token) WHERE invite_token IS NOT NULL;

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function generateToken(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function normalizeBoardId(raw: string): string | null {
  const id = raw.startsWith("board-") ? raw.slice("board-".length) : raw;
  return /^\d+$/.test(id) ? id : null;
}

// GET ?token=xxx — validate token, return board preview (no auth required)
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) return bad("Missing token");

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("whiteboard_boards")
    .select("id, name, creator_name, is_group, allowed_members, permissions")
    .eq("invite_token", token)
    .single();

  if (error || !data) return bad("Invite link is invalid or has been revoked", 404);

  const b = data as Record<string, unknown>;
  return NextResponse.json({
    boardId: String(b.id),
    boardName: b.name,
    creatorName: b.creator_name ?? null,
    permissions: b.permissions ?? "edit",
    memberCount: Array.isArray(b.allowed_members) ? b.allowed_members.length : 0,
  });
}

// POST ?boardId=xxx — generate (or return existing) invite token for a board (creator only)
export async function POST(request: NextRequest) {
  const userId = await getCurrentProfileId();
  if (!userId) return bad("Unauthorized", 401);

  const rawId = request.nextUrl.searchParams.get("boardId")?.trim();
  if (!rawId) return bad("Missing boardId");
  const boardIdForDb = normalizeBoardId(rawId);
  if (!boardIdForDb) return bad("Invalid boardId");

  const supabase = createServerClient();

  // Must be creator
  const { data: board } = await supabase
    .from("whiteboard_boards")
    .select("user_id, invite_token, name")
    .eq("id", boardIdForDb)
    .single();

  if (!board) return bad("Board not found", 404);
  const b = board as { user_id: string; invite_token: string | null; name: string };
  if (b.user_id !== userId) return bad("Only the board creator can generate invite links", 403);

  // Return existing token if one exists
  if (b.invite_token) {
    return NextResponse.json({ token: b.invite_token });
  }

  // Generate a new unique token
  let token = generateToken();
  let attempts = 0;
  while (attempts < 5) {
    const { error } = await supabase
      .from("whiteboard_boards")
      .update({ invite_token: token })
      .eq("id", boardIdForDb);
    if (!error) break;
    token = generateToken();
    attempts++;
  }

  return NextResponse.json({ token });
}

// PATCH ?token=xxx — join a board via invite token (authenticated)
export async function PATCH(request: NextRequest) {
  const userId = await getCurrentProfileId();
  if (!userId) return bad("Unauthorized", 401);

  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) return bad("Missing token");

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("whiteboard_boards")
    .select("id, name, user_id, allowed_members, permissions")
    .eq("invite_token", token)
    .single();

  if (error || !data) return bad("Invite link is invalid or has been revoked", 404);

  const b = data as { id: string | number; name: string; user_id: string; allowed_members: string[] | null; permissions: string };

  // Creator doesn't need to join
  if (b.user_id === userId) {
    return NextResponse.json({ boardId: String(b.id), boardName: b.name, alreadyMember: true });
  }

  const members: string[] = Array.isArray(b.allowed_members) ? b.allowed_members : [];

  // Already a member
  if (members.includes(userId)) {
    return NextResponse.json({ boardId: String(b.id), boardName: b.name, alreadyMember: true });
  }

  // Add to allowed_members
  const { error: updateErr } = await supabase
    .from("whiteboard_boards")
    .update({ allowed_members: [...members, userId] })
    .eq("id", b.id);

  if (updateErr) return bad(updateErr.message, 500);

  return NextResponse.json({ boardId: String(b.id), boardName: b.name, alreadyMember: false });
}

// DELETE ?boardId=xxx — revoke invite token (creator only)
export async function DELETE(request: NextRequest) {
  const userId = await getCurrentProfileId();
  if (!userId) return bad("Unauthorized", 401);

  const rawId = request.nextUrl.searchParams.get("boardId")?.trim();
  if (!rawId) return bad("Missing boardId");
  const boardIdForDb = normalizeBoardId(rawId);
  if (!boardIdForDb) return bad("Invalid boardId");

  const supabase = createServerClient();

  const { data: board } = await supabase
    .from("whiteboard_boards")
    .select("user_id")
    .eq("id", boardIdForDb)
    .single();

  if (!board) return bad("Board not found", 404);
  if ((board as { user_id: string }).user_id !== userId) return bad("Only the creator can revoke invite links", 403);

  await supabase
    .from("whiteboard_boards")
    .update({ invite_token: null })
    .eq("id", boardIdForDb);

  return NextResponse.json({ ok: true });
}
