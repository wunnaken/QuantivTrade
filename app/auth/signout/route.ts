import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "../../../lib/supabase/route-handler";

export async function GET() {
  const supabase = await createRouteHandlerClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_SITE_URL ?? "https://quantiv.trade"), {
    status: 302,
  });
}
