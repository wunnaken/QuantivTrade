import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ people: [], rooms: [] });

  const supabase = createServerClient();

  const [{ data: people }, { data: rooms }] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, name, username, is_verified, is_founder, avatar_url")
      .or(`name.ilike.%${q}%,username.ilike.%${q}%`)
      .limit(5),
    supabase
      .from("rooms")
      .select("id, name, description, slug, is_live")
      .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
      .limit(5),
  ]);

  return NextResponse.json({ people: people ?? [], rooms: rooms ?? [] });
}
