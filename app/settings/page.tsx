"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth } from "../../components/AuthContext";
import { useTheme } from "../../components/ThemeContext";
import { createClient } from "../../lib/supabase/client";
import { getBrokerConnection, disconnectBroker, BROKER_TEAL } from "../../lib/broker-connection";
import { ConnectBrokerModal } from "../../components/ConnectBrokerModal";
import { NewsletterSignup } from "../../components/NewsletterSignup";
import { BriefingPreferencesForm } from "../../components/BriefingPreferencesForm";
import { fetchBriefingPreferences, type BriefingPreferences } from "../../lib/briefing-preferences";

export default function SettingsPage() {
  const { user, authLoading, deleteAccount, signInWithGoogle, signInWithApple } = useAuth();
  const { theme, setTheme } = useTheme();
  const [brokerState, setBrokerState] = useState(getBrokerConnection());
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [briefingPrefs, setBriefingPrefs] = useState<BriefingPreferences | null>(null);
  const [briefingPrefsSaved, setBriefingPrefsSaved] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [oauthLinkError, setOauthLinkError] = useState<string | null>(null);
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [stripeOnboarded, setStripeOnboarded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setBrokerState(getBrokerConnection());
    const onStorage = () => setBrokerState(getBrokerConnection());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!user?.isVerified) return;
    fetchBriefingPreferences().then((p) => { if (p) setBriefingPrefs(p); });
  }, [user?.isVerified]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (error) { setMfaEnabled(false); return; }
      const hasVerified = (data?.totp ?? []).some((f) => f.status === "verified");
      setMfaEnabled(hasVerified);
    }).catch(() => setMfaEnabled(false));
    // Load stripe_onboarded status
    supabase.from("profiles").select("stripe_onboarded").eq("user_id", user.id).single()
      .then(({ data }) => { if (data?.stripe_onboarded) setStripeOnboarded(true); });
    // Check if returning from Stripe Connect onboarding
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("connected") === "true") {
        setStripeConnected(true);
        window.history.replaceState({}, "", "/settings");
      }
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent-color)]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-zinc-100">Settings</h1>
        <p className="mt-2 text-sm text-zinc-400">
          You need to be signed in to manage your settings.{" "}
          <Link href="/auth/sign-in" className="text-[var(--accent-color)] hover:underline">
            Sign in
          </Link>
          .
        </p>
      </div>
    );
  }

  const handleDeleteAccount = async () => {
    if (
      typeof window !== "undefined" &&
      window.confirm("Are you sure you want to permanently delete your account and all associated data?")
    ) {
      await deleteAccount();
      window.location.href = "/";
    }
  };

  return (
    <main className="app-page min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-100">Settings</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Manage your appearance, risk preferences, and account in one place.
          </p>
        </header>

        {/* Security */}
        <section
          className="rounded-2xl border p-5 transition-colors duration-300"
          style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-card)" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--app-text)" }}>Security</h2>
          <p className="mt-1 text-[11px]" style={{ color: "var(--app-text-muted)" }}>
            Protect your account with two-factor authentication.
          </p>

          {/* Recommendation banner — shown only when 2FA is off */}
          {mfaEnabled === false && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/8 px-3 py-2.5">
              <svg className="mt-px h-3.5 w-3.5 shrink-0 text-amber-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <p className="text-[11px] leading-relaxed text-amber-300">
                <span className="font-semibold">QuantivTrade recommends enabling 2FA.</span>{" "}
                Two-factor authentication adds a second layer of protection to your account and trades.
              </p>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {mfaEnabled === null ? (
                <span className="text-[11px] text-zinc-500">Loading…</span>
              ) : mfaEnabled ? (
                <>
                  <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-xs text-zinc-300">2FA enabled</span>
                </>
              ) : (
                <>
                  <span className="flex h-2 w-2 rounded-full bg-amber-400" />
                  <span className="text-xs text-zinc-400">2FA not enabled</span>
                </>
              )}
            </div>
            <Link
              href="/auth/setup-2fa"
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-zinc-300 transition hover:bg-white/10"
            >
              {mfaEnabled ? "Manage 2FA" : "Enable 2FA"}
            </Link>
          </div>
        </section>

        {/* Newsletter */}
        <section
          className="rounded-2xl border p-5 transition-colors duration-300"
          style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-card)" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--app-text)" }}>Product Updates</h2>
          <p className="mt-1 text-[11px]" style={{ color: "var(--app-text-muted)" }}>
            Get notified by email when a new version of QuantivTrade is released.
          </p>
          <div className="mt-4 max-w-sm">
            <NewsletterSignup compact />
          </div>
        </section>

        {/* Connected Accounts */}
        <section
          className="rounded-2xl border p-5 transition-colors duration-300"
          style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-card)" }}
        >
          <h2 className="text-sm font-semibold text-zinc-50">Connected Accounts</h2>
          <p className="mt-1 text-xs text-zinc-500">Link social or broker accounts. Your data is encrypted and read-only.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {brokerState.connected ? (
              <>
                <span className="rounded-lg border px-3 py-2 text-sm text-zinc-300" style={{ borderColor: `${BROKER_TEAL}40` }}>
                  Broker: {brokerState.brokerName ?? "Connected"}
                </span>
                <button
                  type="button"
                  onClick={() => { disconnectBroker(); setBrokerState(getBrokerConnection()); }}
                  className="text-sm text-zinc-500 hover:text-zinc-300 underline"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConnectModalOpen(true)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[#020308] transition hover:opacity-90"
                style={{ backgroundColor: BROKER_TEAL }}
              >
                Connect Broker
              </button>
            )}
          </div>
          {/* Stripe Connect — seller payouts */}
          <div className="mt-4 border-t border-white/5 pt-4">
            <p className="text-xs font-medium text-zinc-300">Sell on Marketplace</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">Connect a Stripe account to receive payouts when buyers purchase your listings.</p>
            <div className="mt-3 flex items-center gap-3">
              {stripeOnboarded ? (
                <span className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  Stripe Connected
                </span>
              ) : (
                <button
                  type="button"
                  disabled={stripeConnecting}
                  onClick={async () => {
                    setStripeConnecting(true);
                    try {
                      const res = await fetch("/api/stripe/connect", { method: "POST" });
                      const data = await res.json();
                      if (data.url) window.location.href = data.url;
                    } catch { /* ignore */ } finally { setStripeConnecting(false); }
                  }}
                  className="rounded-lg px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: "var(--accent-color)", color: "#fff" }}
                >
                  {stripeConnecting ? "Redirecting…" : "Connect Stripe"}
                </button>
              )}
              {stripeConnected && !stripeOnboarded && (
                <span className="text-[11px] text-amber-400">Onboarding submitted — pending Stripe verification</span>
              )}
              {stripeConnected && stripeOnboarded && (
                <span className="text-[11px] text-emerald-400">Successfully connected!</span>
              )}
            </div>
          </div>

          <p className="mt-4 text-[11px] text-zinc-500">Link a sign-in provider to use with this account:</p>
          {oauthLinkError && (
            <p className="mt-1 text-[11px] text-amber-300">{oauthLinkError}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                setOauthLinkError(null);
                try { await signInWithGoogle(); }
                catch (err) { setOauthLinkError(err instanceof Error ? err.message : "Failed to link Google account."); }
              }}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/10"
            >
              <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" aria-hidden>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Link Google account
            </button>
          </div>
        </section>


        {/* Appearance */}
        <section
          className="rounded-2xl border p-5 transition-colors duration-300"
          style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-card)" }}
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--app-text)" }}>
            <span aria-hidden>
              {theme === "dark" ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              )}
            </span>
            Appearance
          </h2>
          <p className="mt-1 text-[11px]" style={{ color: "var(--app-text-muted)" }}>
            Choose how QuantivTrade looks. Dark is easier on the eyes in low light.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 focus:ring-offset-2 focus:ring-offset-[var(--app-bg)] ${
                theme === "dark"
                  ? "border-[var(--accent-color)]/50 bg-[var(--accent-color)]/10 text-[var(--accent-color)]"
                  : "border-transparent opacity-70 hover:opacity-100"
              }`}
              style={theme !== "dark" ? { borderColor: "var(--app-border)", color: "var(--app-text)" } : undefined}
            >
              Dark Mode
            </button>
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 focus:ring-offset-2 focus:ring-offset-[var(--app-bg)] ${
                theme === "light"
                  ? "border-[var(--accent-color)]/50 bg-[var(--accent-color)]/10 text-[var(--accent-color)]"
                  : "border-transparent opacity-70 hover:opacity-100"
              }`}
              style={theme !== "light" ? { borderColor: "var(--app-border)", color: "var(--app-text)" } : undefined}
            >
              Light Mode
            </button>
          </div>
        </section>

        {/* Morning Briefing Preferences — premium users only */}
        {user.isVerified && (
          <section
            className="rounded-2xl border p-5 transition-colors duration-300"
            style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-card)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: "var(--app-text)" }}>
                  Morning Briefing Preferences
                </h2>
                <p className="mt-1 text-[11px]" style={{ color: "var(--app-text-muted)" }}>
                  Your daily briefing is personalized based on these preferences. The AI will prioritize your watchlist, sectors, and trading style.
                </p>
              </div>
              {briefingPrefsSaved && (
                <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-400">
                  Saved
                </span>
              )}
            </div>
            <div className="mt-5">
              <BriefingPreferencesForm
                initialPrefs={briefingPrefs}
                onSave={(p) => {
                  setBriefingPrefs(p);
                  setBriefingPrefsSaved(true);
                  setTimeout(() => setBriefingPrefsSaved(false), 3000);
                }}
              />
            </div>
          </section>
        )}

        {/* Account */}
        <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 transition-colors duration-300">
          <h2 className="text-sm font-semibold text-zinc-50">Account</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Permanently delete your account and all associated data from this demo. This cannot be undone.
          </p>
          <button
            type="button"
            onClick={handleDeleteAccount}
            className="mt-4 rounded-full border border-red-500/60 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/15 focus:outline-none focus:ring-2 focus:ring-red-500/60 focus:ring-offset-2 focus:ring-offset-[var(--app-bg)]"
          >
            Delete account
          </button>
        </section>
      </div>
      {connectModalOpen && <ConnectBrokerModal onClose={() => { setConnectModalOpen(false); setBrokerState(getBrokerConnection()); }} onConnect={() => setBrokerState(getBrokerConnection())} />}
    </main>
  );
}
