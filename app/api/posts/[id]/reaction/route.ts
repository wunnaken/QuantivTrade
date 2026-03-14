import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

const REACTION_TYPES = ["bullish", "bearish", "informative", "risky", "interesting"] as const;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: postId } = await context.params;
  if (!postId) {
    return NextResponse.json({ error: "Post id required" }, { status: 400 });
  }

  let body: { reaction_type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reactionType = typeof body.reaction_type === "string" ? body.reaction_type.toLowerCase() : "";
  if (!REACTION_TYPES.includes(reactionType as (typeof REACTION_TYPES)[number])) {
    return NextResponse.json({ error: "Invalid reaction_type" }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: existing } = await supabase
    .from("user_post_reactions")
    .select("reaction_type")
    .eq("user_id", profileId)
    .eq("post_id", postId)
    .eq("reaction_type", reactionType)
    .maybeSingle();

  const hadReaction = !!existing;

  if (hadReaction) {
    await supabase
      .from("user_post_reactions")
      .delete()
      .eq("user_id", profileId)
      .eq("post_id", postId)
      .eq("reaction_type", reactionType);

    const { data: row } = await supabase
      .from("post_reactions")
      .select("count")
      .eq("post_id", postId)
      .eq("reaction_type", reactionType)
      .single();

    const newCount = Math.max(0, (row?.count ?? 1) - 1);
    await supabase
      .from("post_reactions")
      .upsert(
        { post_id: postId, reaction_type: reactionType, count: newCount, updated_at: new Date().toISOString() },
        { onConflict: "post_id,reaction_type" }
      );
  } else {
    await supabase.from("user_post_reactions").insert({
      user_id: profileId,
      post_id: postId,
      reaction_type: reactionType,
    });

    const { data: row } = await supabase
      .from("post_reactions")
      .select("count")
      .eq("post_id", postId)
      .eq("reaction_type", reactionType)
      .maybeSingle();

    const newCount = (row?.count ?? 0) + 1;
    await supabase
      .from("post_reactions")
      .upsert(
        { post_id: postId, reaction_type: reactionType, count: newCount, updated_at: new Date().toISOString() },
        { onConflict: "post_id,reaction_type" }
      );
  }

  return NextResponse.json({ added: !hadReaction });
}
