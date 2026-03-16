"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth } from "../../components/AuthContext";
import { useTheme } from "../../components/ThemeContext";
import type { RiskProfileKey } from "../../components/AuthContext";
import { getBrokerConnection, disconnectBroker, BROKER_TEAL } from "../../lib/broker-connection";
import { ConnectBrokerModal } from "../../components/ConnectBrokerModal";

const RISK_PROFILES: Record<
  RiskProfileKey,
  { label: string; subtitle: string; equities: number; fixedIncome: number; alternatives: number }
> = {
  passive: { label: "Passive · Long Term", subtitle: "7–10+ year horizon", equities: 50, fixedIncome: 40, alternatives: 10 },
  moderate: { label: "Balanced · Medium Term", subtitle: "3–7 year horizon", equities: 60, fixedIncome: 30, alternatives: 10 },
  aggressive: { label: "Aggressive · Short Term", subtitle: "Days–2 year horizon", equities: 80, fixedIncome: 10, alternatives: 10 },
};

export default function SettingsPage() {
  const { user, deleteAccount, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [brokerState, setBrokerState] = useState(getBrokerConnection());
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setBrokerState(getBrokerConnection());
    const onStorage = () => setBrokerState(getBrokerConnection());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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

  const riskKey: RiskProfileKey = user.riskProfile ?? "moderate";
  const risk = RISK_PROFILES[riskKey];

  const handleRiskChange = (next: RiskProfileKey) => {
    updateProfile({ riskProfile: next });
  };

  const handleDeleteAccount = () => {
    if (
      typeof window !== "undefined" &&
      window.confirm("Are you sure you want to permanently delete your account and all associated data?")
    ) {
      deleteAccount();
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
            Choose how Xchange looks. Dark is easier on the eyes in low light.
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
          <p className="mt-3 text-[11px] text-zinc-500">Link sign-in providers (use one account everywhere):</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => typeof window !== "undefined" && window.alert("Link Google account — coming soon. OAuth must be configured (e.g. Supabase Auth or NextAuth).")}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/10"
            >
              Link Google account
            </button>
            <button
              type="button"
              onClick={() => typeof window !== "undefined" && window.alert("Link Apple account — coming soon. OAuth must be configured (e.g. Supabase Auth or NextAuth).")}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/10"
            >
              Link Apple account
            </button>
          </div>
        </section>

        {/* Risk profile */}
        <section
          className="rounded-2xl border p-5 transition-colors duration-300"
          style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-card)" }}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-50">Your risk profile</h2>
            <Link
              href="/growth#choose-profile"
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-zinc-300 transition-colors duration-200 hover:border-[var(--accent-color)]/40 hover:text-[var(--accent-color)]"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Learn more
            </Link>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            Set how aggressive or conservative you want your default guidance to be.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(RISK_PROFILES) as RiskProfileKey[]).map((key) => {
              const p = RISK_PROFILES[key];
              const active = key === riskKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleRiskChange(key)}
                  className={`min-w-[140px] flex-1 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                    active
                      ? "border-[var(--accent-color)]/60 bg-[var(--accent-color)]/10 text-[var(--accent-color)]"
                      : "border-white/10 bg-black/20 text-zinc-300 hover:border-[var(--accent-color)]/40 hover:text-[var(--accent-color)]"
                  }`}
                >
                  <div className="font-semibold">{p.label}</div>
                  <div className="mt-0.5 text-[10px] text-zinc-500">{p.subtitle}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-4 space-y-1 text-[11px] text-zinc-500">
            <div className="flex justify-between">
              <span>Equities</span>
              <span>{risk.equities}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full bg-[var(--accent-color)]" style={{ width: `${risk.equities}%` }} />
            </div>
            <div className="flex justify-between">
              <span>Fixed Income</span>
              <span>{risk.fixedIncome}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full bg-gradient-to-r from-cyan-400 to-cyan-500" style={{ width: `${risk.fixedIncome}%` }} />
            </div>
            <div className="flex justify-between">
              <span>Alternatives</span>
              <span>{risk.alternatives}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full bg-gradient-to-r from-fuchsia-400 to-fuchsia-500" style={{ width: `${risk.alternatives}%` }} />
            </div>
          </div>
        </section>

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
