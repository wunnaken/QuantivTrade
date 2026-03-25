import { NextResponse } from "next/server";
import { Resend } from "resend";

const TO_EMAIL = "zack.mutz01@gmail.com";

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Email not configured. Add RESEND_API_KEY to .env.local." },
      { status: 503 }
    );
  }

  let body: { message?: string; replyEmail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
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
      from: "QuantivTrade Feedback <onboarding@resend.dev>",
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
