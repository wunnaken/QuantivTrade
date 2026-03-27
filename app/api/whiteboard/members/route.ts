import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json([]);

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 1) return NextResponse.json([]);

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, name")
    .ilike("username", `%${q}%`)
    .neq("id", userId)
    .limit(10);

  if (error) return NextResponse.json([]);
  return NextResponse.json(data ?? []);
}
