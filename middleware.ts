import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "./lib/auth-cookie";

const PROTECTED_PATHS = ["/profile"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isProtected) return NextResponse.next();

  const hasAuth = request.cookies.get(AUTH_COOKIE_NAME)?.value === "1";
  if (hasAuth) return NextResponse.next();

  const signIn = new URL("/auth/sign-in", request.url);
  signIn.searchParams.set("from", pathname);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/profile", "/profile/:path*"],
};
