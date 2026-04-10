import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/maintenance",
  "/api/access",
  "/_next",
  "/favicon",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const accessCookie = request.cookies.get("xch_access");
  const validCode = process.env.ACCESS_CODE;

  // If no ACCESS_CODE env var is set, gate is disabled
  if (!validCode) return NextResponse.next();

  if (!accessCookie || accessCookie.value !== validCode) {
    const url = request.nextUrl.clone();
    url.pathname = "/maintenance";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
