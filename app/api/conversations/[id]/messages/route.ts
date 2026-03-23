import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type DbProfile = { user_id: string; name: string; username: string };
type DbMessage = {
  id: string;
  user_id: string | null;
  content: string;
  reply_to_id: string | null;
  created_at: string;
  edited_at: string | null;
  is_pinned: boolean | null;
};
type DbReaction = { message_id: string; user_id: string; emoji: string };

async function getConvType(supabase: ReturnType<typeof createServerClient>, convId: string) {
  const { data } = await supabase
    .from("conversations")
    .select("type")
    .eq("id", convId)
    .single();
  return data?.type as string | null;
}

async function isMember(
  supabase: ReturnType<typeof createServerClient>,
  convId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", convId)
    .eq("user_id", userId)
    .single();
  return !!data;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: convId } = await params;
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerClient();
  const convType = await getConvType(supabase, convId);
  if (!convType) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (convType !== "community" && !(await isMember(supabase, convId, userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("id, user_id, content, reply_to_id, created_at, edited_at, is_pinned")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true })
    .limit(100);

  const authorIds = [...new Set((messages ?? []).map((m: DbMessage) => m.user_id).filter(Boolean))] as string[];
  let profileMap: Record<string, DbProfile> = {};

  if (authorIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, name, username")
      .in("user_id", authorIds);
    for (const p of (profs ?? []) as DbProfile[]) profileMap[p.user_id] = p;
  }

  // Fetch reply-to message previews
  const replyToIds = [...new Set((messages ?? []).map((m: DbMessage) => m.reply_to_id).filter(Boolean))] as string[];
  const replyToMap: Record<string, { content: string; author_name: string }> = {};
  if (replyToIds.length > 0) {
    const { data: replyMsgs } = await supabase
      .from("messages")
      .select("id, content, user_id")
      .in("id", replyToIds);
    const replyAuthorIds = [...new Set((replyMsgs ?? []).map((m: { user_id: string | null }) => m.user_id).filter(Boolean))] as string[];
    const replyAuthorMap: Record<string, string> = {};
    if (replyAuthorIds.length > 0) {
      const { data: replyAuthors } = await supabase.from("profiles").select("user_id, name").in("user_id", replyAuthorIds);
      for (const a of (replyAuthors ?? []) as { user_id: string; name: string }[]) replyAuthorMap[a.user_id] = a.name;
    }
    for (const m of (replyMsgs ?? []) as { id: string; content: string; user_id: string | null }[]) {
      replyToMap[m.id] = { content: m.content, author_name: m.user_id ? (replyAuthorMap[m.user_id] ?? "Trader") : "Trader" };
    }
  }

  // Fetch reactions grouped by message
  const messageIds = (messages ?? []).map((m: DbMessage) => m.id);
  const reactionsMap: Record<string, { emoji: string; count: number; by_me: boolean }[]> = {};
  if (messageIds.length > 0) {
    const { data: allReactions } = await supabase
      .from("message_reactions")
      .select("message_id, user_id, emoji")
      .in("message_id", messageIds);
    for (const r of (allReactions ?? []) as DbReaction[]) {
      if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = [];
      const existing = reactionsMap[r.message_id].find((x) => x.emoji === r.emoji);
      if (existing) { existing.count++; if (r.user_id === userId) existing.by_me = true; }
      else reactionsMap[r.message_id].push({ emoji: r.emoji, count: 1, by_me: r.user_id === userId });
    }
  }

  const enriched = (messages ?? []).map((m: DbMessage) => ({
    ...m,
    is_mine: m.user_id === userId,
    author: m.user_id ? profileMap[m.user_id] ?? { name: "Trader", username: "unknown" } : null,
    reply_to: m.reply_to_id ? (replyToMap[m.reply_to_id] ?? null) : null,
    reactions: reactionsMap[m.id] ?? [],
  }));

  // Update last_read_at
  await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", convId)
    .eq("user_id", userId);

  return NextResponse.json({ messages: enriched });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: convId } = await params;
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerClient();
  const convType = await getConvType(supabase, convId);
  if (!convType) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (convType === "community") {
    // Auto-join community on first message
    await supabase
      .from("conversation_members")
      .upsert(
        { conversation_id: convId, user_id: userId, role: "member" },
        { onConflict: "conversation_id,user_id", ignoreDuplicates: true }
      );
  } else if (!(await isMember(supabase, convId, userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { content: string; reply_to_id?: string };
  const content = body.content?.trim();
  if (!content || content.length > 2000)
    return NextResponse.json({ error: "Invalid content" }, { status: 400 });

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: convId,
      user_id: userId,
      content,
      reply_to_id: body.reply_to_id ?? null,
    })
    .select("id, user_id, content, reply_to_id, created_at, edited_at, is_pinned")
    .single();

  if (error || !message) return NextResponse.json({ error: "Failed to send" }, { status: 500 });

  await supabase
    .from("conversations")
    .update({
      last_message_at: message.created_at,
      last_message_preview: content.slice(0, 100),
    })
    .eq("id", convId);

  // Get author info
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, name, username")
    .eq("user_id", userId)
    .single();

  // Fetch reply_to preview if present
  let reply_to = null;
  if (body.reply_to_id) {
    const { data: replyMsg } = await supabase
      .from("messages")
      .select("content, user_id")
      .eq("id", body.reply_to_id)
      .single();
    if (replyMsg) {
      const { data: replyAuthor } = await supabase
        .from("profiles").select("name").eq("user_id", replyMsg.user_id).single();
      reply_to = { content: replyMsg.content, author_name: replyAuthor?.name ?? "Trader" };
    }
  }

  return NextResponse.json({
    message: {
      ...message,
      is_mine: true,
      author: profile ? { name: profile.name, username: profile.username } : { name: "Trader", username: "unknown" },
      reply_to,
      reactions: [],
    },
  });
}
