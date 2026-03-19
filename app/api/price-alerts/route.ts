import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type AlertRow = {
  id: string;
  created_at: string;
  user_id: string;
  ticker: string;
  company: string | null;
  condition: "above" | "below";
  target_price: number;
  current_price: number | null;
  name: string | null;
  status: "active" | "triggered" | "paused";
  repeat: boolean;
  notify_browser: boolean;
  notify_in_app: boolean;
  triggered_at: string | null;
  updated_at: string | null;
};

function toApi(a: AlertRow) {
  return {
    id: a.id,
    userId: a.user_id,
    ticker: a.ticker,
    company: a.company ?? "",
    condition: a.condition,
    targetPrice: a.target_price,
    currentPrice: a.current_price ?? 0,
    name: a.name ?? "",
    createdAt: a.created_at,
    triggeredAt: a.triggered_at,
    status: a.status,
    repeat: Boolean(a.repeat),
    notifyBrowser: Boolean(a.notify_browser),
    notifyInApp: Boolean(a.notify_in_app),
    updatedAt: a.updated_at ?? a.created_at,
  };
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("price_alerts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const alerts = Array.isArray(data) ? (data as AlertRow[]).map(toApi) : [];
  return NextResponse.json({ alerts });
}

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | {
        ticker?: string;
        company?: string;
        condition?: "above" | "below";
        target_price?: number;
        current_price?: number;
        name?: string;
        repeat?: boolean;
        notify_browser?: boolean;
        notify_in_app?: boolean;
      }
    | null;
  if (!body?.ticker || !body.condition || typeof body.target_price !== "number") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("price_alerts")
    .insert({
      user_id: userId,
      ticker: body.ticker.trim().toUpperCase(),
      company: (body.company ?? "").trim() || null,
      condition: body.condition,
      target_price: body.target_price,
      current_price: body.current_price ?? null,
      name: (body.name ?? "").trim() || null,
      status: "active",
      repeat: Boolean(body.repeat),
      notify_browser: body.notify_browser !== false,
      notify_in_app: body.notify_in_app !== false,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alert: toApi(data as AlertRow) });
}

export async function PUT(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | {
        id?: string;
        status?: "active" | "triggered" | "paused";
        target_price?: number;
        current_price?: number;
        name?: string;
        repeat?: boolean;
        notify_browser?: boolean;
        notify_in_app?: boolean;
        triggered_at?: string | null;
      }
    | null;
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status) patch.status = body.status;
  if (typeof body.target_price === "number") patch.target_price = body.target_price;
  if (typeof body.current_price === "number") patch.current_price = body.current_price;
  if (typeof body.name === "string") patch.name = body.name.trim() || null;
  if (typeof body.repeat === "boolean") patch.repeat = body.repeat;
  if (typeof body.notify_browser === "boolean") patch.notify_browser = body.notify_browser;
  if (typeof body.notify_in_app === "boolean") patch.notify_in_app = body.notify_in_app;
  if (body.triggered_at !== undefined) patch.triggered_at = body.triggered_at;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("price_alerts")
    .update(patch)
    .eq("id", body.id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ alert: toApi(data as AlertRow) });
}

export async function DELETE(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = createServerClient();
  const { error } = await supabase
    .from("price_alerts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

