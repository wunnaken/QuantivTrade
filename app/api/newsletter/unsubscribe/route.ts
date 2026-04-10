import { NextResponse } from "next/server";
import { createServerClient } from "../../../../lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return new Response(unsubscribePage("Missing unsubscribe token."), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("newsletter_subscribers")
    .delete()
    .eq("unsubscribe_token", token);

  if (error) {
    return new Response(unsubscribePage("Something went wrong. Please try again."), {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }

  return new Response(unsubscribePage(null), {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

function unsubscribePage(errorMsg: string | null): string {
  const content = errorMsg
    ? `<p style="color:#f87171">${errorMsg}</p>`
    : `<p style="color:#86efac">You've been unsubscribed successfully.</p><p style="color:rgba(255,255,255,0.45);font-size:13px;margin-top:8px">You won't receive any more emails from QuantivTrade.</p>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Unsubscribe · QuantivTrade</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#0d0d10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">
  <div style="text-align:center;max-width:420px;padding:40px 24px">
    <div style="font-size:22px;font-weight:700;color:#e8846a;margin-bottom:20px">QuantivTrade</div>
    ${content}
    <a href="https://quantiv.trade" style="display:inline-block;margin-top:28px;padding:10px 24px;background:rgba(232,132,106,0.15);border:1px solid rgba(232,132,106,0.3);border-radius:999px;color:#e8846a;text-decoration:none;font-size:13px;font-weight:500">Back to QuantivTrade</a>
  </div>
</body>
</html>`;
}
