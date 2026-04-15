import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfileId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const userId = await getCurrentProfileId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Max 10 MB" }, { status: 400 });

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) return NextResponse.json({ error: "Image files only" }, { status: 400 });

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `posts/${userId}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const supabase = createServerClient();

  const { error } = await supabase.storage
    .from("marketplace")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = supabase.storage.from("marketplace").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
