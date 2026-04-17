// CREATE TABLE saved_screens (
//   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
//   name text NOT NULL,
//   description text,
//   filters jsonb NOT NULL DEFAULT '{}',
//   is_public boolean DEFAULT false,
//   alerts_enabled boolean DEFAULT false,
//   created_at timestamptz DEFAULT now(),
//   updated_at timestamptz DEFAULT now()
// );
// CREATE INDEX ON saved_screens(user_id);

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

type SavedScreenRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  filters: Record<string, unknown>;
  is_public: boolean;
  alerts_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export async function GET() {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json([]);
  }

  const { data, error } = await supabase
    .from("saved_screens")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(Array.isArray(data) ? data : []);
}

export async function POST(request: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    description?: string;
    filters?: Record<string, unknown>;
    is_public?: boolean;
    alerts_enabled?: boolean;
  } | null;

  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Cap at 10 saved screens per user. Hitting the limit returns 409 so the
  // client can show a friendly "delete one to add another" message.
  const { count: existingCount, error: countError } = await supabase
    .from("saved_screens")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }
  if ((existingCount ?? 0) >= 10) {
    return NextResponse.json(
      { error: "Saved-screen limit reached (10). Delete one to add another." },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("saved_screens")
    .insert({
      user_id: user.id,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      filters: body.filters ?? {},
      is_public: body.is_public ?? false,
      alerts_enabled: body.alerts_enabled ?? false,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data as SavedScreenRow, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("saved_screens")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
