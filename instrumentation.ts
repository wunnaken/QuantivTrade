export async function register() {
  // Only run in Node.js runtime on the server, not in Edge or during builds
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const [{ createClient }, { Resend }, { APP_VERSION }] = await Promise.all([
      import("@supabase/supabase-js"),
      import("resend"),
      import("./lib/version"),
    ]);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendKey = process.env.RESEND_API_KEY?.trim();

    if (!supabaseUrl || !serviceKey || !resendKey) return;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Only send if the version has changed since last notification
    const { data: config } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "last_notified_version")
      .single();

    if (config?.value === APP_VERSION) return;

    const { data: subscribers } = await supabase
      .from("newsletter_subscribers")
      .select("email, unsubscribe_token");

    // Update version record regardless of whether there are subscribers
    await supabase
      .from("app_config")
      .update({ value: APP_VERSION, updated_at: new Date().toISOString() })
      .eq("key", "last_notified_version");

    if (!subscribers?.length) return;

    const resend = new Resend(resendKey);

    for (const sub of subscribers) {
      const unsubUrl = `https://quantiv.trade/api/newsletter/unsubscribe?token=${sub.unsubscribe_token}`;
      try {
        await resend.emails.send({
          from: "QuantivTrade <noreply@quantiv.trade>",
          to: [sub.email],
          subject: `QuantivTrade v${APP_VERSION} is live`,
          html: buildEmail(APP_VERSION, unsubUrl),
        });
      } catch {
        // continue for remaining subscribers
      }
    }
  } catch {
    // never crash the server over a notification failure
  }
}

function buildEmail(version: string, unsubscribeUrl: string): string {
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
          <tr>
            <td style="padding-bottom:32px;text-align:center">
              <img src="https://quantiv.trade/quantivtrade-logo.png" alt="" width="32" height="32" style="display:inline-block;vertical-align:middle;margin-right:8px;border-radius:6px" />
              <span style="font-size:22px;font-weight:800;color:#e8846a;letter-spacing:-0.5px;vertical-align:middle">QuantivTrade</span>
            </td>
          </tr>
          <tr>
            <td style="background:#16161c;border:1px solid rgba(232,132,106,0.15);border-radius:16px;padding:40px 36px">
              <div style="text-align:center;margin-bottom:28px">
                <span style="display:inline-block;background:rgba(232,132,106,0.12);border:1px solid rgba(232,132,106,0.3);border-radius:999px;padding:6px 18px;font-size:12px;font-weight:600;color:#e8846a;letter-spacing:0.06em;text-transform:uppercase">
                  Version ${version}
                </span>
              </div>
              <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#ffffff;text-align:center;letter-spacing:-0.5px;line-height:1.2">
                A new update is live
              </h1>
              <p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.45);text-align:center;line-height:1.6">
                QuantivTrade v${version} has been deployed and is ready for you.
              </p>
              <div style="border-top:1px solid rgba(255,255,255,0.07);margin-bottom:32px"></div>
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
