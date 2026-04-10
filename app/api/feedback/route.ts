import { NextResponse } from "next/server";
import { Resend } from "resend";

const TO_EMAIL = "quantivtrade@gmail.com";

// In-memory rate limit: max 3 submissions per IP per hour
const ipLog = new Map<string, number[]>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const window = 60 * 60 * 1000; // 1 hour
  const hits = (ipLog.get(ip) ?? []).filter((t) => now - t < window);
  hits.push(now);
  ipLog.set(ip, hits);
  // Prune old IPs occasionally to avoid memory leak
  if (ipLog.size > 5000) {
    for (const [k, v] of ipLog) {
      if (v.every((t) => now - t >= window)) ipLog.delete(k);
    }
  }
  return hits.length > 3;
}

export async function POST(request: Request) {
  // IP rate limiting
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = (forwarded ? forwarded.split(",")[0] : "unknown").trim();
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 });
  }
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Email not configured. Add RESEND_API_KEY to .env.local." },
      { status: 503 }
    );
  }

  let body: { message?: string; replyEmail?: string; _trap?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Honeypot: bots fill hidden fields, humans don't
  if (body._trap) {
    return NextResponse.json({ ok: true }); // silent accept so bots don't know they were blocked
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const replyEmail = typeof body.replyEmail === "string" ? body.replyEmail.trim() : "";
  const resend = new Resend(apiKey);

  const textBody = [
    message,
    replyEmail ? `\n\n---\nReply to: ${replyEmail}` : "",
  ].join("");

  try {
    const { data, error } = await resend.emails.send({
      from: "QuantivTrade Feedback <noreply@quantiv.trade>",
      to: [TO_EMAIL],
      replyTo: replyEmail || undefined,
      subject: "QuantivTrade feedback",
      text: textBody,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to send";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
