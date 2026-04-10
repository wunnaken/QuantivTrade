"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

export function NewsletterSignup({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email ?? "");
  const [status, setStatus] = useState<"idle" | "loading" | "checking" | "success" | "unsubscribing" | "error">("checking");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const emailToCheck = user?.email ?? "";
    if (!emailToCheck) {
      setStatus("idle");
      return;
    }
    setEmail(emailToCheck);
    fetch(`/api/newsletter/status?email=${encodeURIComponent(emailToCheck)}`)
      .then((r) => r.json())
      .then((d) => setStatus(d.subscribed ? "success" : "idle"))
      .catch(() => setStatus("idle"));
  }, [user?.email]);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong.");
        setStatus("error");
      } else {
        setStatus("success");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  async function handleUnsubscribe() {
    setStatus("unsubscribing");
    try {
      await fetch("/api/newsletter/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setStatus("idle");
    } catch {
      setStatus("success"); // revert on error
    }
  }

  if (status === "checking") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-zinc-500 text-xs">Checking…</span>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className={`flex items-center gap-3 ${compact ? "flex-row" : "flex-col sm:flex-row"}`}>
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
          <span className="text-emerald-400 font-medium text-sm">Subscribed</span>
        </div>
        <button
          type="button"
          onClick={handleUnsubscribe}
          className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-300 transition-colors"
        >
          Unsubscribe
        </button>
      </div>
    );
  }

  if (status === "unsubscribing") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-zinc-500 text-xs">Unsubscribing…</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubscribe} className={`flex ${compact ? "flex-row gap-2" : "flex-col gap-3"} w-full`}>
      <input
        type="email"
        required
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={status === "loading"}
        className={`rounded-xl border bg-white/5 px-4 text-sm text-zinc-200 placeholder-zinc-500 outline-none transition focus:border-[var(--accent-color)]/60 focus:ring-1 focus:ring-[var(--accent-color)]/30 disabled:opacity-50 ${compact ? "h-9 flex-1" : "h-11 w-full"}`}
        style={{ borderColor: "rgba(255,255,255,0.1)" }}
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className={`shrink-0 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 ${compact ? "h-9 px-4" : "h-11 w-full"}`}
        style={{
          background: "rgba(232,132,106,0.15)",
          border: "1px solid rgba(232,132,106,0.35)",
          color: "#e8846a",
        }}
      >
        {status === "loading" ? "Subscribing…" : "Subscribe"}
      </button>
      {status === "error" && (
        <p className="text-xs text-red-400 mt-1">{errorMsg}</p>
      )}
    </form>
  );
}
