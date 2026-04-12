"use client";

import { useState, useCallback } from "react";
import { BROKER_TEAL } from "../lib/broker-connection";

interface ConnectBrokerModalProps {
  onClose: () => void;
  onConnect?: () => void;
}

export function ConnectBrokerModal({ onClose, onConnect }: ConnectBrokerModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const redirectURL = `${window.location.origin}/brokers/callback`;
      const res = await fetch("/api/snaptrade/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redirectURL }),
      });
      const data = await res.json();
      if (!data.portalUrl) { setError("Could not open connection portal. Try again."); return; }
      onClose();
      onConnect?.();
      window.location.href = data.portalUrl;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setConnecting(false);
    }
  }, [onClose, onConnect]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[var(--app-card)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end border-b border-white/10 p-3">
          <button type="button" onClick={onClose} className="rounded p-2 text-zinc-400 hover:bg-white/5 hover:text-zinc-200" aria-label="Close">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6">
          {step === 1 && (
            <>
              <h2 className="text-xl font-semibold text-zinc-100">Connect your brokerage</h2>
              <p className="mt-1 text-sm text-zinc-500">Read-only access. We never trade on your behalf.</p>

              <div className="mt-5 space-y-2.5 rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
                <p className="flex items-center gap-2">✓ Read-only access only</p>
                <p className="flex items-center gap-2">✓ We can never place trades</p>
                <p className="flex items-center gap-2">✓ 50+ brokerages supported</p>
                <p className="flex items-center gap-2">✓ Disconnect anytime instantly</p>
                <p className="flex items-center gap-2">✓ Get Verified Trader status</p>
              </div>

              <p className="mt-4 text-xs font-medium text-zinc-400">What we access:</p>
              <p className="text-xs text-zinc-500">Holdings, balances, trade history, P&amp;L data</p>
              <p className="mt-2 text-xs font-medium text-zinc-400">What we NEVER access:</p>
              <p className="text-xs text-zinc-500">Your password, ability to trade, banking info</p>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="mt-6 w-full rounded-lg py-2.5 text-sm font-semibold text-[#020308] transition hover:opacity-90"
                style={{ backgroundColor: BROKER_TEAL }}
              >
                Continue
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-xl font-semibold text-zinc-100">Select your brokerage</h2>
              <p className="mt-1 text-sm text-zinc-500">A secure connection portal will open in a new window.</p>

              {error && (
                <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
              )}

              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting}
                className="mt-6 w-full rounded-lg py-2.5 text-sm font-semibold text-[#020308] transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: BROKER_TEAL }}
              >
                {connecting ? "Opening portal…" : "Open Connection Portal"}
              </button>

              <button type="button" onClick={() => setStep(1)} className="mt-2 w-full rounded-lg border border-white/10 py-2 text-sm text-zinc-400 hover:text-zinc-200">
                Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
