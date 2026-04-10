"use client";

import { useState } from "react";

const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes between submissions
const LS_KEY = "feedback_last_sent";

function getCooldownRemaining(): number {
  try {
    const last = parseInt(localStorage.getItem(LS_KEY) ?? "0", 10);
    const remaining = COOLDOWN_MS - (Date.now() - last);
    return remaining > 0 ? remaining : 0;
  } catch {
    return 0;
  }
}

export default function FeedbackPage() {
  const [message, setMessage] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    const remaining = getCooldownRemaining();
    if (remaining > 0) {
      const secs = Math.ceil(remaining / 1000);
      setError(`Please wait ${secs}s before sending another message.`);
      return;
    }

    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          replyEmail: replyEmail.trim() || undefined,
          _trap: undefined, // honeypot — always undefined from real users
        }),
      });
      try { localStorage.setItem(LS_KEY, String(Date.now())); } catch { /* private browsing */ }
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      setSent(true);
      setMessage("");
      setReplyEmail("");
      setTimeout(() => setSent(false), 3000);
    } catch {
      setError("Could not send. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-100">Send feedback</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        We appreciate you using QuantivTrade and would love to hear from you. Your feedback helps us
        improve the product.
      </p>

      {/* Founder message */}
      <div className="mt-6 rounded-2xl border border-[var(--accent-color)]/20 bg-[var(--app-card)] px-5 py-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-color)]">A note from the founder</p>
        <p className="text-sm leading-relaxed text-zinc-300">
          Dear users of QuantivTrade, thank you for taking the time to submit any feedback you may have.
          It is just me running and working on this site, and I will try to get to as many concerns as possible.
          I apologize in advance for any annoying bugs or inconsistencies. By giving me your feedback, this site
          will get better every day at connecting people and giving them access to market knowledge to further
          their investments.
        </p>
        <p className="mt-3 text-sm font-medium text-zinc-400">— Wunnaken</p>
      </div>

      <div className="mt-8 space-y-4">
        {/* Honeypot — hidden from humans, bots fill it */}
        <input
          aria-hidden="true"
          tabIndex={-1}
          autoComplete="off"
          name="_trap"
          style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", opacity: 0 }}
          defaultValue=""
        />
        <div>
          <label htmlFor="feedback-message" className="block text-sm font-medium text-zinc-300">
            Your message
          </label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us what you think, what you'd like to see, or report an issue..."
            rows={5}
            disabled={sending}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-[var(--app-card)] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition-colors focus:border-[var(--accent-color)]/50 disabled:opacity-60"
          />
        </div>
        <div>
          <label htmlFor="feedback-reply" className="block text-sm font-medium text-zinc-300">
            Your email (optional — if you’d like a reply)
          </label>
          <input
            id="feedback-reply"
            type="email"
            value={replyEmail}
            onChange={(e) => setReplyEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={sending}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-[var(--app-card)] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition-colors focus:border-[var(--accent-color)]/50 disabled:opacity-60"
          />
        </div>
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !message.trim()}
          className="w-full rounded-full bg-[var(--accent-color)] py-3 text-sm font-semibold text-[#020308] transition-colors hover:bg-[var(--accent-color)]/90 disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send feedback"}
        </button>
      </div>

      {/* Success popup */}
      {sent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="alert"
          aria-live="polite"
        >
          <div className="rounded-2xl border border-[var(--accent-color)]/30 bg-[var(--app-card)] px-8 py-6 text-center shadow-xl">
            <p className="text-lg font-semibold text-[var(--accent-color)]">Feedback sent!</p>
            <p className="mt-1 text-sm text-zinc-400">Thank you — we’ll read it soon.</p>
          </div>
        </div>
      )}
    </div>
  );
}
