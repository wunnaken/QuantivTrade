import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServerClient } from "../../../../lib/supabase/server";

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .insert({ email })
    .select("unsubscribe_token")
    .single();

  if (error) {
    if (error.code === "23505") {
      // Already subscribed — treat as success, no welcome email
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }

  // Send welcome email
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey && data?.unsubscribe_token) {
    const resend = new Resend(apiKey);
    const unsubUrl = `https://quantiv.trade/api/newsletter/unsubscribe?token=${data.unsubscribe_token}`;
    await resend.emails.send({
      from: "QuantivTrade <noreply@quantiv.trade>",
      to: [email],
      subject: "You're subscribed to QuantivTrade updates",
      html: buildWelcomeEmail(unsubUrl),
    }).catch(() => { /* don't fail the subscription if email fails */ });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("newsletter_subscribers")
    .delete()
    .eq("email", email);

  if (error) {
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
  }

  // Send unsubscribe confirmation email
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey) {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "QuantivTrade <noreply@quantiv.trade>",
      to: [email],
      subject: "You've been unsubscribed from QuantivTrade",
      html: buildUnsubscribeEmail(),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

function buildUnsubscribeEmail(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Unsubscribed from QuantivTrade</title>
</head>
<body style="margin:0;padding:0;background:#0d0d10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d10;min-height:100vh;padding:48px 16px">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
          <tr>
            <td style="padding-bottom:32px;text-align:center">
              <img src="https://quantiv.trade/xchange-logo.png" alt="" width="32" height="32" style="display:inline-block;vertical-align:middle;margin-right:8px;border-radius:6px" />
              <span style="font-size:22px;font-weight:800;color:#e8846a;letter-spacing:-0.5px;vertical-align:middle">QuantivTrade</span>
            </td>
          </tr>
          <tr>
            <td style="background:#16161c;border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:40px 36px">
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:#ffffff;text-align:center;letter-spacing:-0.5px;line-height:1.2">
                You&apos;ve been unsubscribed
              </h1>
              <p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.45);text-align:center;line-height:1.6">
                You won&apos;t receive any more emails from QuantivTrade. We&apos;re sorry to see you go.
              </p>
              <div style="border-top:1px solid rgba(255,255,255,0.07);margin-bottom:28px"></div>
              <p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,0.4);text-align:center;line-height:1.6">
                Changed your mind? You can resubscribe anytime from your settings.
              </p>
              <div style="text-align:center">
                <a href="https://quantiv.trade/settings"
                   style="display:inline-block;background:rgba(232,132,106,0.15);color:#e8846a;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:999px;border:1px solid rgba(232,132,106,0.3)">
                  Go to Settings
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding-top:28px;text-align:center">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.2)">
                QuantivTrade · quantiv.trade
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildWelcomeEmail(unsubscribeUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Welcome to QuantivTrade Updates</title>
</head>
<body style="margin:0;padding:0;background:#0d0d10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d10;min-height:100vh;padding:48px 16px">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
          <tr>
            <td style="padding-bottom:32px;text-align:center">
              <img src="https://quantiv.trade/xchange-logo.png" alt="" width="32" height="32" style="display:inline-block;vertical-align:middle;margin-right:8px;border-radius:6px" />
              <span style="font-size:22px;font-weight:800;color:#e8846a;letter-spacing:-0.5px;vertical-align:middle">QuantivTrade</span>
            </td>
          </tr>
          <tr>
            <td style="background:#16161c;border:1px solid rgba(232,132,106,0.15);border-radius:16px;padding:40px 36px">
              <div style="text-align:center;margin-bottom:24px">
                <img src="https://quantiv.trade/xchange-logo.png" alt="QuantivTrade" width="52" height="52" style="display:inline-block;border-radius:50%;background:rgba(232,132,106,0.12);padding:8px;border:1px solid rgba(232,132,106,0.25)" />
              </div>
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:#ffffff;text-align:center;letter-spacing:-0.5px;line-height:1.2">
                You&apos;re subscribed
              </h1>
              <p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.45);text-align:center;line-height:1.6">
                You&apos;ll get an email whenever we ship a new version of QuantivTrade or send a market update.
              </p>
              <div style="border-top:1px solid rgba(255,255,255,0.07);margin-bottom:28px"></div>
              <p style="margin:0 0 20px;font-size:14px;color:rgba(255,255,255,0.55);line-height:1.7;text-align:center">
                In the meantime, explore the platform and let us know what you think.
              </p>
              <div style="text-align:center">
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
                You&apos;re receiving this because you just subscribed to QuantivTrade updates.
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
