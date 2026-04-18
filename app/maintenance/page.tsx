"use client";

import { useState, useRef, useEffect } from "react";

export default function AccessPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animated particle background (matches landing page)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf: number;
    const particles: Array<{ x: number; y: number; vx: number; vy: number; r: number; o: number }> = [];
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5,
        o: Math.random() * 0.3 + 0.05,
      });
    }
    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas!.width;
        if (p.x > canvas!.width) p.x = 0;
        if (p.y < 0) p.y = canvas!.height;
        if (p.y > canvas!.height) p.y = 0;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(232,132,106,${p.o})`;
        ctx!.fill();
      }
      // Draw faint connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i]!.x - particles[j]!.x;
          const dy = particles[i]!.y - particles[j]!.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx!.beginPath();
            ctx!.moveTo(particles[i]!.x, particles[i]!.y);
            ctx!.lineTo(particles[j]!.x, particles[j]!.y);
            ctx!.strokeStyle = `rgba(232,132,106,${0.04 * (1 - dist / 120)})`;
            ctx!.lineWidth = 0.5;
            ctx!.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

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
        // Flag for elite upgrade on next sign-in if not yet logged in
        try { localStorage.setItem("quantivtrade-access-elite", "1"); } catch {}
        setSuccess(true);
        setTimeout(() => { window.location.href = "/"; }, 600);
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
      background: "var(--app-bg, #070B14)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Particle canvas */}
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />

      {/* Radial glow */}
      <div style={{
        position: "fixed", top: "30%", left: "50%", transform: "translate(-50%, -50%)",
        width: "600px", height: "600px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(232,132,106,0.06) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{
        position: "relative", zIndex: 1, width: "100%", maxWidth: "440px", padding: "2rem",
        opacity: success ? 0 : 1, transform: success ? "scale(0.96)" : "scale(1)",
        transition: "opacity 0.4s, transform 0.4s",
      }}>
        {/* Logo + brand */}
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{
            display: "inline-block",
            width: "clamp(56px, 7vw, 80px)",
            height: "clamp(56px, 7vw, 80px)",
            backgroundColor: "var(--accent-color, #e8846a)",
            WebkitMaskImage: "url(/quantivtrade-logo.png)",
            WebkitMaskSize: "contain",
            WebkitMaskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            maskImage: "url(/quantivtrade-logo.png)",
            maskSize: "contain",
            maskPosition: "center",
            maskRepeat: "no-repeat",
            opacity: 0.9,
            marginBottom: "1.25rem",
          }} />
          <h1 style={{
            color: "var(--accent-color, #e8846a)",
            fontSize: "1.75rem",
            fontWeight: 700,
            fontFamily: "var(--font-lora), Georgia, serif",
            letterSpacing: "-0.02em",
            margin: 0,
          }}>
            QuantivTrade
          </h1>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.8125rem", marginTop: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 500 }}>
            Early Access
          </p>
        </div>

        {/* Access code card */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "20px",
          padding: "2.25rem 2rem",
          backdropFilter: "blur(12px)",
        }}>
          <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 44, height: 44, borderRadius: 12,
              background: "rgba(232,132,106,0.1)",
              border: "1px solid rgba(232,132,106,0.2)",
              marginBottom: "1rem",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color, #e8846a)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 style={{ color: "#f4f4f5", fontSize: "1.125rem", fontWeight: 600, margin: "0 0 0.5rem", letterSpacing: "-0.01em" }}>
              Enter your access code
            </h2>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.8125rem", margin: 0, lineHeight: 1.6 }}>
              QuantivTrade is currently invite-only. Enter your code below to unlock the platform.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Enter access code"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${error ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 12,
                padding: "0.875rem 1rem",
                color: "#f4f4f5",
                fontSize: "1rem",
                fontFamily: "inherit",
                letterSpacing: "0.04em",
                outline: "none",
                boxSizing: "border-box",
                textAlign: "center",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
              onFocus={e => { if (!error) { e.target.style.borderColor = "rgba(232,132,106,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(232,132,106,0.08)"; } }}
              onBlur={e => { if (!error) { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.boxShadow = "none"; } }}
            />

            {error && (
              <p style={{ color: "#f87171", fontSize: "0.8rem", margin: "0.625rem 0 0", textAlign: "center" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !code.trim()}
              style={{
                width: "100%",
                marginTop: "1.25rem",
                padding: "0.875rem",
                background: loading || !code.trim() ? "rgba(232,132,106,0.35)" : "var(--accent-color, #e8846a)",
                color: loading || !code.trim() ? "rgba(255,255,255,0.5)" : "#0a0e17",
                border: "none",
                borderRadius: 12,
                fontSize: "0.9375rem",
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: loading || !code.trim() ? "not-allowed" : "pointer",
                transition: "background 0.2s, transform 0.1s",
                letterSpacing: "-0.01em",
              }}
            >
              {loading ? "Verifying..." : "Unlock Access"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.18)", fontSize: "0.75rem", marginTop: "2rem", lineHeight: 1.7 }}>
          Don&apos;t have a code?{" "}
          <a href="mailto:quantivtrade@gmail.com" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "underline", textUnderlineOffset: "2px" }}>
            Request access
          </a>
        </p>
      </div>
    </div>
  );
}
