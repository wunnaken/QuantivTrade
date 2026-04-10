import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServerClient } from "../../../lib/supabase/server";
import { APP_VERSION } from "../../../lib/version";

export async function POST(request: Request) {
  // Verify deploy secret
  const secret = process.env.DEPLOY_NOTIFY_SECRET?.trim();
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Optional release notes in body
  let notes = "Bug fixes and improvements.";
  try {
    const body = await request.json();
    if (typeof body.notes === "string" && body.notes.trim()) {
      notes = body.notes.trim();
    }
  } catch {
    // no body — use default notes
  }

  const supabase = await createServerClient();

  // Check if this version was already notified
  const { data: config } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "last_notified_version")
    .single();

  if (config?.value === APP_VERSION) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Version already notified" });
  }

  // Fetch all subscribers
  const { data: subscribers, error: subError } = await supabase
    .from("newsletter_subscribers")
    .select("email, unsubscribe_token");

  if (subError) {
    return NextResponse.json({ error: "Failed to fetch subscribers" }, { status: 500 });
  }

  if (!subscribers || subscribers.length === 0) {
    await supabase
      .from("app_config")
      .update({ value: APP_VERSION, updated_at: new Date().toISOString() })
      .eq("key", "last_notified_version");
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 503 });
  }

  const resend = new Resend(apiKey);
  let sent = 0;

  for (const sub of subscribers) {
    const unsubscribeUrl = `https://quantiv.trade/api/newsletter/unsubscribe?token=${sub.unsubscribe_token}`;
    try {
      await resend.emails.send({
        from: "QuantivTrade <noreply@quantiv.trade>",
        to: [sub.email],
        subject: `QuantivTrade v${APP_VERSION} is live`,
        html: buildEmail(APP_VERSION, notes, unsubscribeUrl),
      });
      sent++;
    } catch {
      // continue sending to remaining subscribers
    }
  }

  // Mark this version as notified
  await supabase
    .from("app_config")
    .update({ value: APP_VERSION, updated_at: new Date().toISOString() })
    .eq("key", "last_notified_version");

  return NextResponse.json({ ok: true, sent, version: APP_VERSION });
}

function buildEmail(version: string, notes: string, unsubscribeUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>QuantivTrade v${version}</title>
</head>
<body style="margin:0;padding:0;background:#0d0d10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d10;min-height:100vh;padding:48px 16px">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:32px;text-align:center">
              <img src="https://quantiv.trade/xchange-logo.png" alt="" width="32" height="32" style="display:inline-block;vertical-align:middle;margin-right:8px;border-radius:6px" />
              <span style="font-size:22px;font-weight:800;color:#e8846a;letter-spacing:-0.5px;vertical-align:middle">QuantivTrade</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#16161c;border:1px solid rgba(232,132,106,0.15);border-radius:16px;padding:40px 36px">

              <!-- Version badge -->
              <div style="text-align:center;margin-bottom:28px">
                <span style="display:inline-block;background:rgba(232,132,106,0.12);border:1px solid rgba(232,132,106,0.3);border-radius:999px;padding:6px 18px;font-size:12px;font-weight:600;color:#e8846a;letter-spacing:0.06em;text-transform:uppercase">
                  Version ${version}
                </span>
              </div>

              <!-- Title -->
              <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#ffffff;text-align:center;letter-spacing:-0.5px;line-height:1.2">
                A new update is live
              </h1>
              <p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.45);text-align:center;line-height:1.6">
                QuantivTrade v${version} has been deployed and is ready for you.
              </p>

              <!-- Divider -->
              <div style="border-top:1px solid rgba(255,255,255,0.07);margin-bottom:28px"></div>

              <!-- Release notes -->
              <div style="margin-bottom:32px">
                <p style="margin:0 0 10px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.08em">
                  What&apos;s new
                </p>
                <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.7">
                  ${notes.replace(/\n/g, "<br>")}
                </p>
              </div>

              <!-- CTA -->
              <div style="text-align:center">
                <a href="https://quantiv.trade/feed"
                   style="display:inline-block;background:#e8846a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 36px;border-radius:999px;letter-spacing:0.01em">
                  Open QuantivTrade →
                </a>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:28px;text-align:center">
              <p style="margin:0 0 8px;font-size:12px;color:rgba(255,255,255,0.2)">
                You&apos;re receiving this because you subscribed to QuantivTrade updates.
              </p>
              <a href="${unsubscribeUrl}"
                 style="font-size:12px;color:rgba(232,132,106,0.5);text-decoration:underline">
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
