import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createHmac } from "crypto";

const TO_EMAIL = "quantivtrade@gmail.com";

function getBaseUrl(request: Request): string {
  const host = request.headers.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

// Sign application data so the approve/decline links can't be forged
function signPayload(payload: string): string {
  const secret = process.env.ACCESS_CODE || process.env.SUPABASE_SERVICE_ROLE_KEY || "fallback-secret";
  return createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
}

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Email not configured." }, { status: 503 });
  }

  let body: {
    name?: string;
    description?: string;
    category?: string;
    pricing?: string;
    monthlyPrice?: number;
    applicantName?: string;
    applicantUsername?: string;
    applicantEmail?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const communityName = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const pricing = typeof body.pricing === "string" ? body.pricing : "free";
  const monthlyPrice = typeof body.monthlyPrice === "number" ? body.monthlyPrice : 0;
  const applicantName = typeof body.applicantName === "string" ? body.applicantName.trim() : "";
  const applicantUsername = typeof body.applicantUsername === "string" ? body.applicantUsername.trim() : "";
  const applicantEmail = typeof body.applicantEmail === "string" ? body.applicantEmail.trim() : "";

  if (!communityName) return NextResponse.json({ error: "Community name is required" }, { status: 400 });
  if (!description) return NextResponse.json({ error: "Description is required" }, { status: 400 });
  if (!applicantEmail) return NextResponse.json({ error: "Applicant email is required" }, { status: 400 });

  // Build signed action URLs
  const baseUrl = getBaseUrl(request);
  const payload = JSON.stringify({ name: communityName, description, category, pricing, monthlyPrice, applicantUsername, applicantEmail });
  const encoded = Buffer.from(payload).toString("base64url");
  const sig = signPayload(encoded);
  const approveUrl = `${baseUrl}/api/communities/apply/action?data=${encoded}&sig=${sig}&action=approve`;
  const declineUrl = `${baseUrl}/api/communities/apply/action?data=${encoded}&sig=${sig}&action=decline`;

  const resend = new Resend(apiKey);
  const isPaid = pricing === "paid";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 20px; color: #e4e4e7; background: #0a0e17;">
      <div style="border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px; background: rgba(255,255,255,0.03);">
        <p style="font-size: 10px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: #e8846a; margin: 0 0 16px;">New Community Application</p>

        <h1 style="font-size: 22px; font-weight: 700; color: #ffffff; margin: 0 0 4px;">${communityName}</h1>
        <p style="font-size: 13px; color: #71717a; margin: 0 0 20px;">${category || "General"} · ${isPaid ? `<span style="color: #fbbf24;">$${monthlyPrice}/mo</span>` : '<span style="color: #4ade80;">Free</span>'}</p>

        <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px; margin-bottom: 20px;">
          <p style="font-size: 13px; color: #a1a1aa; line-height: 1.7; margin: 0;">${description}</p>
        </div>

        <div style="border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px; margin-bottom: 24px; background: rgba(255,255,255,0.02);">
          <p style="font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #71717a; margin: 0 0 8px;">Applicant</p>
          <p style="font-size: 13px; color: #e4e4e7; margin: 0;">${applicantName || "—"} <span style="color: #71717a;">@${applicantUsername || "—"}</span></p>
          <p style="font-size: 12px; color: #71717a; margin: 4px 0 0;">${applicantEmail}</p>
        </div>

        <div style="display: flex; gap: 12px;">
          <a href="${approveUrl}" style="display: inline-block; padding: 12px 28px; background: #4ade80; color: #000000; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 10px; text-align: center;">
            Approve
          </a>
          <a href="${declineUrl}" style="display: inline-block; padding: 12px 28px; background: transparent; border: 1px solid rgba(248,113,113,0.4); color: #f87171; font-size: 13px; font-weight: 600; text-decoration: none; border-radius: 10px; text-align: center;">
            Decline
          </a>
        </div>
      </div>
      <p style="font-size: 11px; color: #3f3f46; text-align: center; margin-top: 16px;">QuantivTrade Community Application</p>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: "QuantivTrade Communities <notifications@quantiv.trade>",
      to: [TO_EMAIL],
      replyTo: applicantEmail,
      subject: `Community Application: ${communityName}`,
      html,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 502 });
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to send";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
