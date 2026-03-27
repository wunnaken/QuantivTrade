import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json([]);

  const supabase = createServerClient();

  // Communities owned by the user
  const { data: owned } = await supabase
    .from("communities")
    .select("id, name")
    .eq("user_id", userId);

  // Communities the user is a member of
  const { data: memberships } = await supabase
    .from("community_members")
    .select("community_id, communities(id, name)")
    .eq("user_id", userId);

  const all = new Map<string, { id: string; name: string }>();
  for (const c of (owned ?? []) as Array<{ id: string; name: string }>) all.set(c.id, c);
  for (const m of (memberships ?? []) as Array<Record<string, unknown>>) {
    const c = m.communities as { id: string; name: string } | null;
    if (c?.id) all.set(c.id, { id: c.id, name: c.name });
  }

  return NextResponse.json(Array.from(all.values()));
}
