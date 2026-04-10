import { NextResponse } from "next/server";
import { createServerClient } from "../../../../lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ subscribed: false });
  }

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("newsletter_subscribers")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  return NextResponse.json({ subscribed: !!data });
}
