// SQL to run in Supabase before use:
//
// CREATE TABLE IF NOT EXISTS board_invites (
//   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   board_id bigint NOT NULL,
//   board_name text NOT NULL,
//   inviter_id uuid NOT NULL,
//   inviter_name text,
//   invitee_id uuid NOT NULL,
//   permissions text NOT NULL DEFAULT 'edit',
//   status text NOT NULL DEFAULT 'pending',
//   created_at timestamptz DEFAULT now()
// );

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

// GET — two modes:
//   ?boardId=X  → pending invites for a board (creator-only view)
//   (no param)  → pending invites where current user is invitee
export async function GET(request: NextRequest) {
  const userId = await getCurrentProfileId();
  if (!userId) return bad("Unauthorized", 401);

  const supabase = createServerClient();
  const boardId = request.nextUrl.searchParams.get("boardId");

  if (boardId) {
    // Verify requester is the board creator
    const { data: board } = await supabase
      .from("whiteboard_boards")
      .select("user_id")
      .eq("id", boardId)
      .single();
    if (!board || (board as Record<string, unknown>).user_id !== userId) return bad("Forbidden", 403);

    const { data, error } = await supabase
      .from("board_invites")
      .select("id, invitee_id, inviter_name, permissions, status, created_at")
      .eq("board_id", boardId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) return bad(error.message, 500);
    return NextResponse.json({ invites: data ?? [] });
  }

  // Invitee view — pending invites for this user
  const { data, error } = await supabase
    .from("board_invites")
    .select("id, board_id, board_name, inviter_name, permissions, created_at")
    .eq("invitee_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) return bad(error.message, 500);
  return NextResponse.json({ invites: data ?? [] });
}

// POST — create a board invite
export async function POST(request: NextRequest) {
  const userId = await getCurrentProfileId();
  if (!userId) return bad("Unauthorized", 401);

  const body = await request.json().catch(() => null) as {
    board_id: string;
    board_name: string;
    invitee_id: string;
    permissions?: "edit" | "view";
  } | null;

  if (!body?.board_id || !body?.invitee_id || !body?.board_name) return bad("Missing fields");

  const supabase = createServerClient();

  // Get inviter's display name
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, name")
    .eq("user_id", userId)
    .single();
  const inviterName = (profile as Record<string, unknown> | null)?.username as string
    ?? (profile as Record<string, unknown> | null)?.name as string ?? null;

  // Skip if already pending
  const { data: existing } = await supabase
    .from("board_invites")
    .select("id")
    .eq("board_id", body.board_id)
    .eq("invitee_id", body.invitee_id)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, already: true });

  const { error } = await supabase.from("board_invites").insert({
    board_id: body.board_id,
    board_name: body.board_name,
    inviter_id: userId,
    inviter_name: inviterName,
    invitee_id: body.invitee_id,
    permissions: body.permissions ?? "edit",
    status: "pending",
  });

  if (error) return bad(error.message, 500);
  return NextResponse.json({ ok: true });
}

// PATCH — accept or decline an invite
export async function PATCH(request: NextRequest) {
  const userId = await getCurrentProfileId();
  if (!userId) return bad("Unauthorized", 401);

  const body = await request.json().catch(() => null) as {
    id: string;
    action: "accept" | "decline";
  } | null;

  if (!body?.id || !body?.action) return bad("Missing id or action");

  const supabase = createServerClient();

  const { data: invite } = await supabase
    .from("board_invites")
    .select("board_id, permissions")
    .eq("id", body.id)
    .eq("invitee_id", userId)
    .eq("status", "pending")
    .single();

  if (!invite) return bad("Invite not found", 404);
  const inv = invite as { board_id: string; permissions: string };

  await supabase
    .from("board_invites")
    .update({ status: body.action === "accept" ? "accepted" : "declined" })
    .eq("id", body.id);

  if (body.action === "accept") {
    const { data: board } = await supabase
      .from("whiteboard_boards")
      .select("allowed_members")
      .eq("id", inv.board_id)
      .single();
    if (board) {
      const current: string[] = Array.isArray((board as Record<string, unknown>).allowed_members)
        ? (board as Record<string, unknown>).allowed_members as string[]
        : [];
      if (!current.includes(userId)) {
        await supabase
          .from("whiteboard_boards")
          .update({ allowed_members: [...current, userId], updated_at: new Date().toISOString() })
          .eq("id", inv.board_id);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
