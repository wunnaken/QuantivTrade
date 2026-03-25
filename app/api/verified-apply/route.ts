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

  let body: { email?: string; name?: string; username?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const resend = new Resend(apiKey);
  const textBody = [
    "Verified Trader application submitted.",
    "",
    `Name: ${name || "—"}`,
    `Username: @${username || "—"}`,
    `Email: ${email}`,
    "",
    "Applicant has met all platform requirements and requested verification.",
  ].join("\n");

  try {
    const { data, error } = await resend.emails.send({
      from: "QuantivTrade Verified <onboarding@resend.dev>",
      to: [TO_EMAIL],
      replyTo: email,
      subject: "QuantivTrade: Verified Trader application",
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
