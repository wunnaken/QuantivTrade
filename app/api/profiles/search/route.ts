import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json({ profiles: [] });

  const supabase = createServerClient();

  const { data } = await supabase
    .from("profiles")
    .select("user_id, name, username")
    .or(`name.ilike.%${q}%,username.ilike.%${q}%`)
    .neq("user_id", userId)
    .limit(10);

  return NextResponse.json({ profiles: data ?? [] });
}
