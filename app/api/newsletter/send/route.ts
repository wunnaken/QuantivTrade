import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServerClient } from "../../../../lib/supabase/server";

export async function POST(request: Request) {
  const secret = process.env.DEPLOY_NOTIFY_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: { subject?: string; title?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subject = typeof body.subject === "string" && body.subject.trim() ? body.subject.trim() : "";
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "";
  const content = typeof body.content === "string" && body.content.trim() ? body.content.trim() : "";

  if (!subject || !title || !content) {
    return NextResponse.json({ error: "subject, title, and content are required" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 503 });
  }

  const supabase = await createServerClient();
  const { data: subscribers, error } = await supabase
    .from("newsletter_subscribers")
    .select("email, unsubscribe_token");

  if (error) {
    return NextResponse.json({ error: "Failed to fetch subscribers" }, { status: 500 });
  }

  if (!subscribers?.length) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const resend = new Resend(apiKey);
  let sent = 0;

  for (const sub of subscribers) {
    const unsubUrl = `https://quantiv.trade/api/newsletter/unsubscribe?token=${sub.unsubscribe_token}`;
    try {
      await resend.emails.send({
        from: "QuantivTrade <noreply@quantiv.trade>",
        to: [sub.email],
        subject,
        html: buildEmail(title, content, unsubUrl),
      });
      sent++;
    } catch {
      // continue for remaining subscribers
    }
  }

  return NextResponse.json({ ok: true, sent });
}

function buildEmail(title: string, content: string, unsubscribeUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0d0d10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d10;min-height:100vh;padding:48px 16px">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
          <tr>
            <td style="padding-bottom:32px;text-align:center">
              <span style="font-size:22px;font-weight:800;color:#e8846a;letter-spacing:-0.5px">QuantivTrade</span>
            </td>
          </tr>
          <tr>
            <td style="background:#16161c;border:1px solid rgba(232,132,106,0.15);border-radius:16px;padding:40px 36px">
              <h1 style="margin:0 0 20px;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;line-height:1.25">
                ${title}
              </h1>
              <div style="border-top:1px solid rgba(255,255,255,0.07);margin-bottom:24px"></div>
              <div style="font-size:15px;color:rgba(255,255,255,0.7);line-height:1.75">
                ${content.replace(/\n\n/g, '</p><p style="margin:0 0 16px;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.75">').replace(/\n/g, "<br>")}
              </div>
              <div style="margin-top:32px;text-align:center">
                <a href="https://quantiv.trade/feed"
                   style="display:inline-block;background:#e8846a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 36px;border-radius:999px;letter-spacing:0.01em">
                  Open QuantivTrade →
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding-top:28px;text-align:center">
              <p style="margin:0 0 8px;font-size:12px;color:rgba(255,255,255,0.2)">
                You&apos;re receiving this because you subscribed to QuantivTrade updates.
              </p>
              <a href="${unsubscribeUrl}" style="font-size:12px;color:rgba(232,132,106,0.5);text-decoration:underline">
                Unsubscribe
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
