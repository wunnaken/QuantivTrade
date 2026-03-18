import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type TradeRow = {
  id: number;
  created_at: string;
  user_id: string;
  asset: string;
  direction: string;
  entry_price: number;
  exit_price: number | null;
  position_size: number;
  entry_date: string;
  exit_date: string | null;
  strategy: string;
  notes: string;
  tags: string[];
  pnl_dollars: number | null;
  pnl_percent: number | null;
  status: string;
  updated_at: string;
};

function rowToTrade(row: TradeRow) {
  const entryDate = row.entry_date ? (row.entry_date.includes("T") ? row.entry_date : `${row.entry_date}T00:00:00.000Z`) : "";
  const exitDate = row.exit_date ? (row.exit_date.includes("T") ? row.exit_date : `${row.exit_date}T00:00:00.000Z`) : null;
  return {
    id: String(row.id),
    asset: row.asset ?? "",
    direction: row.direction as "LONG" | "SHORT",
    entryPrice: Number(row.entry_price),
    exitPrice: row.exit_price != null ? Number(row.exit_price) : null,
    entryDate,
    exitDate,
    positionSize: Number(row.position_size),
    strategy: row.strategy ?? "Other",
    notes: row.notes ?? "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    optionPl: null as number | null,
    pnlDollars: row.pnl_dollars != null ? Number(row.pnl_dollars) : undefined,
    pnlPercent: row.pnl_percent != null ? Number(row.pnl_percent) : undefined,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

function computePnl(
  direction: string,
  entryPrice: number,
  exitPrice: number | null,
  positionSize: number
): { pnlDollars: number; pnlPercent: number } | null {
  if (exitPrice == null || !Number.isFinite(entryPrice) || !Number.isFinite(positionSize) || entryPrice === 0) return null;
  const mult = direction === "SHORT" ? -1 : 1;
  const pnlDollars = (exitPrice - entryPrice) * mult * positionSize;
  const pnlPercent = (pnlDollars / (entryPrice * positionSize)) * 100;
  return { pnlDollars, pnlPercent };
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return bad("Unauthorized", 401);

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("trades")
    .select("id,created_at,user_id,asset,direction,entry_price,exit_price,position_size,entry_date,exit_date,strategy,notes,tags,pnl_dollars,pnl_percent,status,updated_at")
    .eq("user_id", userId)
    .order("entry_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const trades = (Array.isArray(data) ? data : []).map((r) => rowToTrade(r as TradeRow));
  return NextResponse.json({ trades });
}

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return bad("Unauthorized", 401);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bad("Invalid JSON", 400);
  }

  const asset = typeof body.asset === "string" ? body.asset.trim() : "";
  const direction = body.direction === "SHORT" ? "SHORT" : "LONG";
  const entryPrice = typeof body.entry_price === "number" ? body.entry_price : Number(body.entry_price);
  const exitPrice = body.exit_price != null ? Number(body.exit_price) : null;
  const positionSize = typeof body.position_size === "number" ? body.position_size : Number(body.position_size);
  let entryDate = typeof body.entry_date === "string" ? body.entry_date : "";
  let exitDate = body.exit_date != null && body.exit_date !== "" ? String(body.exit_date) : null;
  const strategy = typeof body.strategy === "string" ? body.strategy : "Other";
  const notes = typeof body.notes === "string" ? body.notes : "";
  const tags = Array.isArray(body.tags) ? body.tags.map(String) : [];

  if (!asset || !Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(positionSize) || positionSize <= 0) {
    return bad("Missing or invalid: asset, entry_price, position_size", 400);
  }
  if (!entryDate) entryDate = new Date().toISOString().slice(0, 10);
  if (entryDate.includes("T")) entryDate = entryDate.slice(0, 10);
  if (exitDate && exitDate.includes("T")) exitDate = exitDate.slice(0, 10);

  let pnlDollars: number | null = typeof body.pnl_dollars === "number" ? body.pnl_dollars : null;
  let pnlPercent: number | null = typeof body.pnl_percent === "number" ? body.pnl_percent : null;
  if (pnlDollars != null || pnlPercent != null) {
    const cost = entryPrice * positionSize;
    if (pnlDollars == null && cost !== 0 && pnlPercent != null) pnlDollars = (pnlPercent / 100) * cost;
    if (pnlPercent == null && cost !== 0 && pnlDollars != null) pnlPercent = (pnlDollars / cost) * 100;
  } else {
    const computed = computePnl(direction, entryPrice, exitPrice, positionSize);
    if (computed) {
      pnlDollars = computed.pnlDollars;
      pnlPercent = computed.pnlPercent;
    }
  }
  const status = exitPrice != null && exitDate ? "closed" : "open";

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("trades")
    .insert({
      user_id: userId,
      asset,
      direction,
      entry_price: entryPrice,
      exit_price: exitPrice,
      position_size: positionSize,
      entry_date: entryDate,
      exit_date: exitDate,
      strategy,
      notes,
      tags,
      pnl_dollars: pnlDollars,
      pnl_percent: pnlPercent,
      status,
      updated_at: new Date().toISOString(),
    })
    .select("id,created_at,user_id,asset,direction,entry_price,exit_price,position_size,entry_date,exit_date,strategy,notes,tags,pnl_dollars,pnl_percent,status,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(rowToTrade(data as TradeRow));
}

export async function PUT(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return bad("Unauthorized", 401);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bad("Invalid JSON", 400);
  }

  const id = body.id != null ? String(body.id) : "";
  if (!id || !/^\d+$/.test(id)) return bad("Valid trade id required", 400);

  const supabase = createServerClient();
  const { data: existing } = await supabase.from("trades").select("id,user_id,direction,entry_price,exit_price,position_size").eq("id", id).eq("user_id", userId).single();
  if (!existing) return bad("Trade not found", 404);

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.asset === "string") updates.asset = body.asset.trim();
  if (body.direction === "SHORT" || body.direction === "LONG") updates.direction = body.direction;
  if (typeof body.entry_price === "number") updates.entry_price = body.entry_price;
  if (body.exit_price !== undefined) updates.exit_price = body.exit_price != null && body.exit_price !== "" ? Number(body.exit_price) : null;
  if (typeof body.position_size === "number") updates.position_size = body.position_size;
  if (typeof body.entry_date === "string") updates.entry_date = body.entry_date.includes("T") ? body.entry_date.slice(0, 10) : body.entry_date;
  if (body.exit_date !== undefined) updates.exit_date = body.exit_date != null && body.exit_date !== "" ? (String(body.exit_date).includes("T") ? String(body.exit_date).slice(0, 10) : body.exit_date) : null;
  if (typeof body.strategy === "string") updates.strategy = body.strategy;
  if (typeof body.notes === "string") updates.notes = body.notes;
  if (Array.isArray(body.tags)) updates.tags = body.tags.map(String);

  const entryPrice = (updates.entry_price as number) ?? (existing as { entry_price: number }).entry_price;
  const exitPrice = updates.exit_price !== undefined ? (updates.exit_price as number | null) : (existing as { exit_price: number | null }).exit_price;
  const positionSize = (updates.position_size as number) ?? (existing as { position_size: number }).position_size;
  const direction = (updates.direction as string) ?? (existing as { direction: string }).direction;
  const manualDollars = typeof body.pnl_dollars === "number" ? body.pnl_dollars : undefined;
  const manualPercent = typeof body.pnl_percent === "number" ? body.pnl_percent : undefined;
  if (manualDollars !== undefined || manualPercent !== undefined) {
    const cost = entryPrice * positionSize;
    updates.pnl_dollars = manualDollars ?? (cost !== 0 && manualPercent !== undefined ? (manualPercent / 100) * cost : null);
    updates.pnl_percent = manualPercent ?? (cost !== 0 && manualDollars !== undefined ? (manualDollars / cost) * 100 : null);
  } else {
    const computed = computePnl(direction, entryPrice, exitPrice, positionSize);
    if (computed) {
      updates.pnl_dollars = computed.pnlDollars;
      updates.pnl_percent = computed.pnlPercent;
    }
  }
  updates.status = exitPrice != null && updates.exit_date ? "closed" : "open";

  const { data, error } = await supabase
    .from("trades")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id,created_at,user_id,asset,direction,entry_price,exit_price,position_size,entry_date,exit_date,strategy,notes,tags,pnl_dollars,pnl_percent,status,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(rowToTrade(data as TradeRow));
}

export async function DELETE(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return bad("Unauthorized", 401);

  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id || !/^\d+$/.test(id)) return bad("Query param id required", 400);

  const supabase = createServerClient();
  const { error } = await supabase.from("trades").delete().eq("id", id).eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
