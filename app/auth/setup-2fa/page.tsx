"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../components/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { QuantivTradeLogo } from "../../../components/XchangeLogo";

type Phase =
  | { id: "loading" }
  | { id: "disabled" }
  | { id: "enrolling"; factorId: string; qrCode: string; secret: string }
  | { id: "enabled"; factorId: string; friendlyName?: string }
  | { id: "disabling"; factorId: string };

export default function SetupTwoFactorPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ id: "loading" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    if (!user) { router.replace("/auth/sign-in"); return; }
    loadFactors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadFactors() {
    setPhase({ id: "loading" });
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) { setPhase({ id: "disabled" }); return; }
    const verified = data?.totp?.find((f) => f.status === "verified");
    if (verified) {
      setPhase({ id: "enabled", factorId: verified.id, friendlyName: verified.friendly_name ?? undefined });
    } else {
      setPhase({ id: "disabled" });
    }
  }

  function handleCodeChange(value: string) {
    setCode(value.replace(/\D/g, "").slice(0, 6));
  }

  async function startEnrollment() {
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      // Clean up any leftover unverified factors first (unverified factors live in `.all`, not `.totp`)
      const { data: existing } = await supabase.auth.mfa.listFactors();
      const unverified = existing?.all?.find((f) => f.factor_type === "totp" && f.status === "unverified");
      if (unverified) await supabase.auth.mfa.unenroll({ factorId: unverified.id });

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "QuantivTrade",
        friendlyName: user?.email ?? "QuantivTrade",
      });
      if (error) throw new Error(error.message);
      setPhase({
        id: "enrolling",
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
      setCode("");
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("Failed to start 2FA setup. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnrollment() {
    if (phase.id !== "enrolling") return;
    if (code.length !== 6) { setError("Enter the 6-digit code from your authenticator app."); return; }
    setError(null);
    setBusy(true);
    const factorId = phase.factorId;
    try {
      const supabase = createClient();
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw new Error(challengeError.message);
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });
      if (verifyError) throw new Error("Incorrect code. Please try again.");
      setPhase({ id: "enabled", factorId });
      setCode("");
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("Code incorrect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDisable() {
    if (phase.id !== "disabling") return;
    if (code.length !== 6) { setError("Enter the 6-digit code to confirm."); return; }
    setError(null);
    setBusy(true);
    const factorId = phase.factorId;
    try {
      const supabase = createClient();
      // Step 1: create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw new Error(challengeError.message);
      // Step 2: verify the code against the challenge
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });
      if (verifyError) throw new Error("Incorrect code. Try again.");
      // Step 3: unenroll — session is now proven AAL2
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollError) throw new Error(unenrollError.message);
      setCode("");
      await loadFactors();
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("Failed to disable 2FA. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function cancelEnrollment() {
    setError(null);
    setCode("");
    setPhase({ id: "disabled" });
  }

  function cancelDisable() {
    setBusy(false);
    setError(null);
    setCode("");
    if (phase.id === "disabling") {
      setPhase({ id: "enabled", factorId: phase.factorId });
    }
  }

  return (
    <div className="min-h-screen app-page font-[&quot;Times_New_Roman&quot;,serif]">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <header className="absolute left-6 top-6">
          <QuantivTradeLogo />
        </header>

        <div className="mb-6">
          <button
            type="button"
            onClick={() => router.push("/settings")}
            className="mb-4 flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Settings
          </button>
          <h1 className="text-2xl font-semibold text-zinc-50">Two-factor authentication</h1>
          <p className="mt-2 text-xs text-zinc-400">
            Add an extra layer of security to your account using an authenticator app.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-5 shadow-[0_0_40px_rgba(15,23,42,0.9)]">
          {/* Loading */}
          {phase.id === "loading" && (
            <p className="py-4 text-center text-xs text-zinc-500">Loading…</p>
          )}

          {/* Disabled */}
          {phase.id === "disabled" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
                  <svg className="h-4 w-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-200">2FA is not enabled</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    Use Google Authenticator, Authy, or any TOTP app to generate codes.
                  </p>
                </div>
              </div>
              {error && <p className="text-[11px] text-amber-300">{error}</p>}
              <button
                type="button"
                disabled={busy}
                onClick={startEnrollment}
                className="w-full rounded-full px-4 py-2 text-xs font-semibold text-[#020308] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                style={{ backgroundColor: "var(--accent-color)" }}
              >
                {busy ? "Setting up…" : "Enable 2FA"}
              </button>
            </div>
          )}

          {/* Enrolling — show QR code */}
          {phase.id === "enrolling" && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-medium text-zinc-200">Step 1 — Scan this QR code</p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Open your authenticator app and scan the code below.
                </p>
              </div>

              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={phase.qrCode}
                  alt="2FA QR code"
                  className="h-44 w-44 rounded-lg bg-white p-2"
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowSecret((s) => !s)}
                  className="text-[11px] text-zinc-500 underline hover:text-zinc-300 transition"
                >
                  {showSecret ? "Hide" : "Can't scan? Show"} manual entry key
                </button>
                {showSecret && (
                  <p className="mt-1.5 break-all rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-[11px] tracking-widest text-zinc-300">
                    {phase.secret}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-zinc-200">Step 2 — Enter the 6-digit code</p>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="000000"
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-center text-lg tracking-[0.5em] text-zinc-100 outline-none focus:border-[var(--accent-color)]/70"
                />
              </div>

              {error && <p className="text-[11px] text-amber-300">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={cancelEnrollment}
                  className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy || code.length !== 6}
                  onClick={confirmEnrollment}
                  className="flex-1 rounded-full px-4 py-2 text-xs font-semibold text-[#020308] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                  style={{ backgroundColor: "var(--accent-color)" }}
                >
                  {busy ? "Verifying…" : "Verify & Enable"}
                </button>
              </div>
            </div>
          )}

          {/* Enabled */}
          {phase.id === "enabled" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
                  <svg className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-200">2FA is enabled</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    Your account is protected. You&apos;ll need your authenticator app each time you sign in.
                  </p>
                </div>
              </div>
              {error && <p className="text-[11px] text-amber-300">{error}</p>}
              <button
                type="button"
                disabled={busy}
                onClick={() => { setError(null); setCode(""); setPhase({ id: "disabling", factorId: phase.factorId }); }}
                className="w-full rounded-full border border-red-500/40 px-4 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-60"
              >
                Disable 2FA
              </button>
            </div>
          )}

          {/* Disabling — confirm with code */}
          {phase.id === "disabling" && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-zinc-200">Confirm disabling 2FA</p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Enter your current authenticator code to confirm. This will remove 2FA from your account.
                </p>
              </div>

              <div className="space-y-1">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="000000"
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-center text-lg tracking-[0.5em] text-zinc-100 outline-none focus:border-[var(--accent-color)]/70"
                />
              </div>

              {error && <p className="text-[11px] text-amber-300">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cancelDisable}
                  className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={confirmDisable}
                  className="flex-1 rounded-full border border-red-500/40 px-4 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "Disabling…" : "Confirm Disable"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
