"use client";

import { useState, useCallback } from "react";
import { BROKER_TEAL, addBrokerNotifyEmail, connectBroker, getBrokerNotifyEmails } from "../lib/broker-connection";

const BROKERS = [
  { id: "robinhood", name: "Robinhood", popular: true },
  { id: "webull", name: "Webull", popular: true },
  { id: "td", name: "TD Ameritrade", popular: false },
  { id: "ibkr", name: "Interactive Brokers", popular: false },
  { id: "alpaca", name: "Alpaca", popular: false },
  { id: "tradier", name: "Tradier", popular: false },
];

interface ConnectBrokerModalProps {
  onClose: () => void;
  onConnect?: (brokerName: string) => void;
}

export function ConnectBrokerModal({ onClose, onConnect }: ConnectBrokerModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedBroker, setSelectedBroker] = useState<typeof BROKERS[0] | null>(null);
  const [email, setEmail] = useState("");
  const [notifySubmitted, setNotifySubmitted] = useState(false);

  const handleSelectBroker = useCallback((broker: typeof BROKERS[0]) => {
    setSelectedBroker(broker);
    setStep(2);
  }, []);

  const handleContinue = useCallback(() => {
    if (selectedBroker) setStep(3);
  }, [selectedBroker]);

  const handleNotifySubmit = useCallback(() => {
    if (!selectedBroker || !email.trim()) return;
    addBrokerNotifyEmail(selectedBroker.id, email.trim());
    setNotifySubmitted(true);
  }, [selectedBroker, email]);

  const existingEmail = selectedBroker ? getBrokerNotifyEmails()[selectedBroker.id] : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0F1520] shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex justify-end border-b border-white/10 bg-[#0F1520] p-3">
          <button type="button" onClick={onClose} className="rounded p-2 text-zinc-400 hover:bg-white/5 hover:text-zinc-200" aria-label="Close">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6">
          {step === 1 && (
            <>
              <h2 className="text-xl font-semibold text-zinc-100">Connect your brokerage</h2>
              <p className="mt-1 text-sm text-zinc-500">Read-only access. We never trade on your behalf.</p>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {BROKERS.map((broker) => (
                  <button
                    key={broker.id}
                    type="button"
                    onClick={() => handleSelectBroker(broker)}
                    className="flex flex-col items-center gap-2 rounded-xl border-2 border-white/10 bg-white/5 p-4 text-center transition hover:border-[#14B8A6]/50 hover:bg-[#14B8A6]/10"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full text-lg" style={{ backgroundColor: `${BROKER_TEAL}20`, color: BROKER_TEAL }}>🔗</span>
                    <span className="text-sm font-medium text-zinc-200">{broker.name}</span>
                    {broker.popular && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-400">Popular</span>}
                  </button>
                ))}
                <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center opacity-60">
                  <span className="text-2xl">⋯</span>
                  <span className="text-xs text-zinc-500">More coming soon...</span>
                </div>
              </div>
            </>
          )}

          {step === 2 && selectedBroker && (
            <>
              <h2 className="text-xl font-semibold text-zinc-100">How it works</h2>
              <div className="mt-4 space-y-3 rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
                <p className="flex items-center gap-2">✓ Read-only access only</p>
                <p className="flex items-center gap-2">✓ We can never place trades</p>
                <p className="flex items-center gap-2">✓ Your credentials are encrypted</p>
                <p className="flex items-center gap-2">✓ Disconnect anytime instantly</p>
                <p className="flex items-center gap-2">✓ Data used only to verify your trades</p>
              </div>
              <p className="mt-4 text-xs font-medium text-zinc-400">What we access:</p>
              <p className="text-xs text-zinc-500">Trade history (entries and exits), position sizes, P&L data</p>
              <p className="mt-3 text-xs font-medium text-zinc-400">What we NEVER access:</p>
              <p className="text-xs text-zinc-500">Your password, ability to trade, personal banking info, social security number</p>
              <div className="mt-6 flex gap-2">
                <button type="button" onClick={() => setStep(1)} className="rounded-lg border border-white/20 px-4 py-2 text-sm text-zinc-300">Back</button>
                <button type="button" onClick={handleContinue} className="flex-1 rounded-lg py-2.5 text-sm font-medium text-[#020308] transition hover:opacity-90" style={{ backgroundColor: BROKER_TEAL }}>
                  Continue with {selectedBroker.name}
                </button>
              </div>
            </>
          )}

          {step === 3 && selectedBroker && (
            <>
              <div className="flex flex-col items-center text-center">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-full text-2xl animate-pulse" style={{ backgroundColor: `${BROKER_TEAL}20`, color: BROKER_TEAL }}>🔗</span>
                <h2 className="mt-4 text-xl font-semibold text-zinc-100">Broker connection coming soon</h2>
                <p className="mt-2 text-sm text-zinc-400">We&apos;re building secure integrations with all major brokerages.</p>
                <p className="mt-4 text-sm text-zinc-300">Be the first to know when {selectedBroker.name} integration launches:</p>
              </div>
              {notifySubmitted ? (
                <div className="mt-6 space-y-3">
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                    ✓ You&apos;re on the list! We&apos;ll notify you at {existingEmail ?? email} when broker connection launches.
                  </div>
                  <p className="text-center text-xs text-zinc-500">Preview the connected experience (placeholder):</p>
                  <button
                    type="button"
                    onClick={() => {
                      connectBroker(selectedBroker.name);
                      onConnect?.(selectedBroker.name);
                      onClose();
                    }}
                    className="w-full rounded-lg border border-white/20 py-2 text-sm text-zinc-300 hover:bg-white/5"
                  >
                    Preview connected UI
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-4 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-zinc-100 placeholder:text-zinc-500"
                  />
                  <button
                    type="button"
                    onClick={handleNotifySubmit}
                    disabled={!email.trim()}
                    className="mt-3 w-full rounded-lg py-2.5 text-sm font-medium text-[#020308] disabled:opacity-50"
                    style={{ backgroundColor: BROKER_TEAL }}
                  >
                    Notify me
                  </button>
                </>
              )}
              <p className="mt-4 text-center text-xs text-zinc-500">This will be available at full launch.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
