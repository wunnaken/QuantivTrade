import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=30", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error("FNG fetch failed");
    const json = await res.json();
    return NextResponse.json({ data: json.data ?? [] });
  } catch (e) {
    console.error("Fear greed error:", e);
    return NextResponse.json({ data: [] }, { status: 500 });
  }
}
