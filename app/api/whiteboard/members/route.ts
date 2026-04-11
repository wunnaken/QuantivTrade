import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json([]);

  const supabase = createServerClient();

  // Resolve by IDs (for displaying existing members)
  const ids = request.nextUrl.searchParams.get("ids")?.trim();
  if (ids) {
    const idList = ids.split(",").filter(Boolean);
    if (idList.length === 0) return NextResponse.json([]);
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, username, name")
      .in("user_id", idList)
      .limit(50);
    if (error) return NextResponse.json([]);
    return NextResponse.json((data ?? []).map((p: Record<string, unknown>) => ({ id: p.user_id, username: p.username, name: p.name })));
  }

  // Search by username or name
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 1) return NextResponse.json([]);

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username, name")
    .or(`username.ilike.%${q}%,name.ilike.%${q}%`)
    .neq("user_id", userId)
    .limit(10);

  if (error) return NextResponse.json([]);
  return NextResponse.json((data ?? []).map((p: Record<string, unknown>) => ({ id: p.user_id, username: p.username, name: p.name })));
}
