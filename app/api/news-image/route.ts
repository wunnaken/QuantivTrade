import { NextRequest, NextResponse } from "next/server";

/** Proxy news images so they load when publishers block hotlinking. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  const decoded = decodeURIComponent(url);
  if (!decoded.startsWith("https://") && !decoded.startsWith("http://")) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  try {
    const res = await fetch(decoded, {
      headers: { Accept: "image/*", "User-Agent": "Xchange-News/1.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return new NextResponse(null, { status: res.status });
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
