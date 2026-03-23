import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ count: 0 });

  const supabase = createServerClient();

  // Get all memberships with last_read_at
  const { data: memberships } = await supabase
    .from("conversation_members")
    .select("conversation_id, last_read_at")
    .eq("user_id", userId);

  if (!memberships?.length) return NextResponse.json({ count: 0 });

  let total = 0;
  for (const m of memberships) {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", m.conversation_id)
      .neq("user_id", userId)
      .gt("created_at", m.last_read_at ?? "1970-01-01");

    total += count ?? 0;
  }

  return NextResponse.json({ count: total });
}
