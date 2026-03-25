"use client";

import Link from "next/link";

export default function EthicsPage() {
  return (
    <main className="app-page min-h-screen px-6 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-100 sm:text-3xl">Trading Ethics & Conduct</h1>
          <p className="mt-2 text-sm text-zinc-400">
            QuantivTrade is built for serious market participants. We do not tolerate unethical behavior or market abuse on
            this platform.
          </p>
        </header>

        <section className="space-y-4 rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-100">What QuantivTrade will not tolerate</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>Pump‑and‑dump schemes, coordinated manipulation, or attempts to distort prices or liquidity.</li>
            <li>Falsifying trading performance, track records, or credentials to mislead other users.</li>
            <li>Sharing private or non‑public information in violation of laws, regulations, or firm policies.</li>
            <li>Targeting inexperienced users with deceptive promotions, signals, or paid groups.</li>
          </ul>
        </section>

        <section className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-100">How we expect people to use QuantivTrade</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>Share views, research, and trade ideas honestly, with appropriate context and risk framing.</li>
            <li>Make it clear when you are speculating, experimenting, or sharing hypothetical scenarios.</li>
            <li>Respect other traders, even when you disagree on markets, positioning, or style.</li>
          </ul>
        </section>

        <section className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-zinc-200">
          <h2 className="text-base font-semibold text-amber-300">Important disclaimers</h2>
          <p>
            QuantivTrade does not provide investment, legal, tax, or other professional advice. Content on this platform is
            for educational and informational purposes only and should not be interpreted as an offer, solicitation, or
            recommendation to buy or sell any security or instrument.
          </p>
          <p className="text-xs text-zinc-400">
            Always do your own research and consider consulting a qualified financial professional before making
            investment decisions.
          </p>
        </section>

        <div className="pt-2 text-sm text-zinc-500">
          <Link href="/feed" className="text-[var(--accent-color)] hover:underline">
            ← Back to feed
          </Link>
        </div>
      </div>
    </main>
  );
}

