import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function verifySignature(data: string, sig: string): boolean {
  const secret = process.env.ACCESS_CODE || process.env.SUPABASE_SERVICE_ROLE_KEY || "fallback-secret";
  const expected = createHmac("sha256", secret).update(data).digest("hex").slice(0, 16);
  return expected === sig;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const encoded = searchParams.get("data");
  const sig = searchParams.get("sig");
  const action = searchParams.get("action");

  if (!encoded || !sig || !action) {
    return new NextResponse(page("Invalid Link", "This link is missing required parameters."), { headers: { "Content-Type": "text/html" } });
  }

  if (!verifySignature(encoded, sig)) {
    return new NextResponse(page("Invalid Signature", "This link has been tampered with or has expired."), { headers: { "Content-Type": "text/html" } });
  }

  let payload: {
    name: string; description: string; category: string;
    pricing: string; monthlyPrice: number;
    applicantUsername: string; applicantEmail: string;
  };
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
  } catch {
    return new NextResponse(page("Invalid Data", "Could not parse application data."), { headers: { "Content-Type": "text/html" } });
  }

  if (action === "approve") {
    // Create the room in the database
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const admin = createClient(supabaseUrl, serviceKey);

      // Find the applicant's profile to set as host
      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .eq("username", payload.applicantUsername)
        .single();

      const slug = payload.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Math.random().toString(36).slice(2, 6);
      const inviteCode = Math.random().toString(36).slice(2, 10).toUpperCase();

      const isPaid = payload.pricing === "paid" && payload.monthlyPrice > 0;
      const roomData: Record<string, unknown> = {
        name: payload.name,
        description: payload.description,
        slug,
        invite_code: inviteCode,
        is_invite_only: isPaid,
        is_live: false,
        is_paid: isPaid,
        monthly_price: isPaid ? payload.monthlyPrice : null,
      };
      if (profile?.id) roomData.host_user_id = profile.id;

      const { data: newRoom, error: roomErr } = await admin.from("rooms").insert(roomData).select("id").single();
      if (roomErr || !newRoom) {
        return new NextResponse(page("Database Error", `Failed to create room: ${roomErr?.message ?? "unknown"}`), { headers: { "Content-Type": "text/html" } });
      }

      // Add the host as a member so it shows in their profile
      let hostAuthUid: string | null = null;
      if (profile?.id) {
        const { data: hostProfile } = await admin.from("profiles").select("user_id").eq("id", profile.id).single();
        hostAuthUid = hostProfile?.user_id ?? null;
        if (hostAuthUid) {
          await admin.from("room_members").insert({ room_id: newRoom.id, user_id: hostAuthUid });
        }
      }

      // Create a conversation row so the full messaging system (realtime, typing, reactions, pins) works
      const { data: conv } = await admin.from("conversations").insert({
        name: payload.name,
        type: "community",
        room_id: newRoom.id,
      }).select("id").single();

      // Add host as conversation member
      if (conv && hostAuthUid) {
        await admin.from("conversation_members").insert({ conversation_id: conv.id, user_id: hostAuthUid });
      }

      // Notify the applicant
      const apiKey = process.env.RESEND_API_KEY?.trim();
      if (apiKey && payload.applicantEmail) {
        const resend = new Resend(apiKey);
        await resend.emails.send({
          from: "QuantivTrade <notifications@quantiv.trade>",
          to: [payload.applicantEmail],
          subject: `Your community "${payload.name}" has been approved!`,
          html: `
            <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 20px; color: #e4e4e7; background: #0a0e17;">
              <div style="border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px; background: rgba(255,255,255,0.03);">
                <h1 style="font-size: 20px; color: #4ade80; margin: 0 0 12px;">Approved!</h1>
                <p style="font-size: 14px; color: #a1a1aa; line-height: 1.7; margin: 0 0 16px;">
                  Your community <strong style="color: #fff;">${payload.name}</strong> has been approved and is now live on QuantivTrade.
                </p>
                <a href="https://quantiv.trade/communities" style="display: inline-block; padding: 12px 24px; background: #e8846a; color: #000; font-weight: 700; text-decoration: none; border-radius: 10px; font-size: 13px;">
                  View Communities
                </a>
              </div>
            </div>
          `,
        }).catch(() => {});
      }

      return new NextResponse(page("Community Approved", `"${payload.name}" has been created and is now live. The applicant has been notified.`), { headers: { "Content-Type": "text/html" } });
    } catch (e) {
      return new NextResponse(page("Error", e instanceof Error ? e.message : "Unknown error"), { headers: { "Content-Type": "text/html" } });
    }
  }

  if (action === "decline") {
    // Notify the applicant
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (apiKey && payload.applicantEmail) {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: "QuantivTrade <notifications@quantiv.trade>",
        to: [payload.applicantEmail],
        subject: `Community application update: ${payload.name}`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 20px; color: #e4e4e7; background: #0a0e17;">
            <div style="border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px; background: rgba(255,255,255,0.03);">
              <h1 style="font-size: 20px; color: #f87171; margin: 0 0 12px;">Application Not Approved</h1>
              <p style="font-size: 14px; color: #a1a1aa; line-height: 1.7; margin: 0;">
                Your application for <strong style="color: #fff;">${payload.name}</strong> was not approved at this time. Feel free to reach out if you have questions.
              </p>
            </div>
          </div>
        `,
      }).catch(() => {});
    }

    return new NextResponse(page("Application Declined", `The application for "${payload.name}" has been declined. The applicant has been notified.`), { headers: { "Content-Type": "text/html" } });
  }

  return new NextResponse(page("Unknown Action", "Action must be 'approve' or 'decline'."), { headers: { "Content-Type": "text/html" } });
}

function page(title: string, message: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title} — QuantivTrade</title></head>
<body style="margin:0;padding:0;background:#0a0e17;color:#e4e4e7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="text-align:center;max-width:440px;padding:40px 24px;">
    <div style="width:56px;height:56px;margin:0 auto 20px;border-radius:14px;background:rgba(232,132,106,0.12);display:flex;align-items:center;justify-content:center;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e8846a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
    </div>
    <h1 style="font-size:22px;font-weight:700;color:#fff;margin:0 0 8px;">${title}</h1>
    <p style="font-size:14px;color:#a1a1aa;line-height:1.7;margin:0 0 24px;">${message}</p>
    <a href="https://quantiv.trade" style="color:#e8846a;font-size:13px;text-decoration:none;">← Back to QuantivTrade</a>
  </div>
</body></html>`;
}
