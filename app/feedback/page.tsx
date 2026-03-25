"use client";

import { useState } from "react";

export default function FeedbackPage() {
  const [message, setMessage] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          replyEmail: replyEmail.trim() || undefined,
        }),
      });
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

      <div className="mt-8 space-y-4">
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
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#0F1520] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition-colors focus:border-[var(--accent-color)]/50 disabled:opacity-60"
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
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#0F1520] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition-colors focus:border-[var(--accent-color)]/50 disabled:opacity-60"
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
          <div className="rounded-2xl border border-[var(--accent-color)]/30 bg-[#0F1520] px-8 py-6 text-center shadow-xl">
            <p className="text-lg font-semibold text-[var(--accent-color)]">Feedback sent!</p>
            <p className="mt-1 text-sm text-zinc-400">Thank you — we’ll read it soon.</p>
          </div>
        </div>
      )}
    </div>
  );
}
