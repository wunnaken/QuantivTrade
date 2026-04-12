"use client";

import { useState, useRef } from "react";

export default function AccessPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (res.ok) {
        window.location.href = "/";
      } else {
        const data = await res.json();
        setError(data.error ?? "Invalid code. Try again.");
        setCode("");
        inputRef.current?.focus();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#070B14",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: "2rem",
    }}>
      {/* Subtle grid background */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "400px" }}>

        {/* Logo mark */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 48, height: 48, borderRadius: 14,
            background: "rgba(234,100,71,0.15)",
            border: "1px solid rgba(234,100,71,0.3)",
            marginBottom: "1rem",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 17l4-8 4 4 4-6 4 6" stroke="#EA6447" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{ color: "#f4f4f5", fontSize: "1.5rem", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
            Xchange
          </h1>
          <p style={{ color: "#52525b", fontSize: "0.875rem", marginTop: "0.5rem" }}>
            Early access
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          padding: "2rem",
        }}>
          <h2 style={{ color: "#f4f4f5", fontSize: "1.125rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
            Enter your access code
          </h2>
          <p style={{ color: "#71717a", fontSize: "0.8125rem", margin: "0 0 1.5rem", lineHeight: 1.6 }}>
            Xchange is currently invite-only. Enter your code to unlock the platform.
          </p>

          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="XXXX-XXXX-XXXX"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${error ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 12,
                padding: "0.75rem 1rem",
                color: "#f4f4f5",
                fontSize: "1rem",
                fontFamily: "inherit",
                letterSpacing: "0.05em",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              onFocus={e => { if (!error) e.target.style.borderColor = "rgba(234,100,71,0.5)"; }}
              onBlur={e => { if (!error) e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
            />

            {error && (
              <p style={{ color: "#f87171", fontSize: "0.8rem", margin: "0.5rem 0 0", letterSpacing: 0 }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !code.trim()}
              style={{
                width: "100%",
                marginTop: "1rem",
                padding: "0.75rem",
                background: loading || !code.trim() ? "rgba(234,100,71,0.4)" : "#EA6447",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontSize: "0.9375rem",
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: loading || !code.trim() ? "not-allowed" : "pointer",
                transition: "opacity 0.15s",
              }}
            >
              {loading ? "Verifying…" : "Unlock Access"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", color: "#3f3f46", fontSize: "0.75rem", marginTop: "1.5rem" }}>
          Don&apos;t have a code?{" "}
          <a href="mailto:quantivtrade@gmail.com" style={{ color: "#71717a", textDecoration: "underline" }}>
            Request access
          </a>
        </p>
      </div>
    </div>
  );
}
