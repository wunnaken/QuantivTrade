import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { code } = await req.json();
  const validCode = process.env.ACCESS_CODE;

  if (!validCode) {
    // No code required — grant access
    const res = NextResponse.json({ ok: true });
    res.cookies.set("xch_access", "", { path: "/", maxAge: 60 * 60 * 24 * 365 });
    return res;
  }

  if (!code || code.trim() !== validCode) {
    return NextResponse.json({ error: "Invalid access code." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("xch_access", validCode, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
