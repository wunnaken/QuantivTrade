/**
 * GET /api/ceo-sentiment/cron
 * Called by Vercel Cron every Monday at 06:00 UTC.
 * Vercel automatically injects Authorization: Bearer <CRON_SECRET>.
 * Can also be triggered manually: curl -X GET <url> -H "Authorization: Bearer <CRON_SECRET>"
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!cronSecret || token !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Delegate to the main POST refresh handler by calling it internally
  const baseUrl = req.nextUrl.origin;
  try {
    const res = await fetch(`${baseUrl}/api/ceo-sentiment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
