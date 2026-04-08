"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const SECTIONS = [
  { id: "acceptance", title: "Acceptance of Terms" },
  { id: "description", title: "Description of Service" },
  { id: "not-advice", title: "Not Financial Advice" },
  { id: "accounts", title: "User Accounts" },
  { id: "content", title: "User Content" },
  { id: "verified", title: "Verified Trader Program" },
  { id: "prediction", title: "Prediction Markets" },
  { id: "subscription", title: "Subscription and Payments" },
  { id: "ip", title: "Intellectual Property" },
  { id: "warranties", title: "Disclaimer of Warranties" },
  { id: "liability", title: "Limitation of Liability" },
  { id: "governing", title: "Governing Law" },
  { id: "changes", title: "Changes to Terms" },
  { id: "contact", title: "Contact" },
];

export default function TermsPage() {
  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="legal-page-print min-h-screen bg-[var(--app-bg)] text-zinc-200">
      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-8 lg:px-8">
        {/* Sticky TOC - desktop */}
        <aside className="hidden w-52 shrink-0 lg:block print:hidden">
          <nav className="sticky top-24 space-y-1" aria-label="Table of contents">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollTo(s.id)}
                className="block w-full rounded px-2 py-1.5 text-left text-sm text-zinc-400 transition hover:text-[var(--accent-color)]"
              >
                {s.title}
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <nav className="mb-8 text-sm text-zinc-500 print:mb-4">
            <Link href="/" className="hover:text-[var(--accent-color)]">Home</Link>
            <span className="mx-2">›</span>
            <span className="text-zinc-400">Terms of Service</span>
          </nav>

          <article className="mx-auto max-w-[800px] leading-relaxed print:max-w-none">
            <h1 className="text-3xl font-bold text-white" style={{ color: "var(--accent-color)" }}>
              Terms of Service
            </h1>
            <p className="mt-2 text-sm text-zinc-500">Last updated: March 2026</p>
            <p className="mt-4 text-zinc-400">
              Please read these terms carefully before using QuantivTrade.
            </p>

            <section id="acceptance" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                1. Acceptance of Terms
              </h2>
              <p className="mt-3 text-zinc-300">
                By accessing or using QuantivTrade you agree to be bound by these Terms of Service. If you do not agree, do not use the platform.
              </p>
            </section>

            <section id="description" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                2. Description of Service
              </h2>
              <p className="mt-3 text-zinc-300">
                QuantivTrade is a social trading intelligence platform that provides market data, AI-powered analysis, community features, and educational investment tools. QuantivTrade does not provide financial advice and is not a registered investment advisor, broker-dealer, or financial institution.
              </p>
            </section>

            <section id="not-advice" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                3. Not Financial Advice
              </h2>
              <div className="mt-4 rounded-lg border-2 border-amber-500/60 bg-amber-500/10 p-4 text-amber-200">
                <p className="font-semibold uppercase tracking-wide">Important</p>
                <p className="mt-2 text-sm leading-relaxed">
                  All content on QuantivTrade is for educational and informational purposes only. Nothing on this platform constitutes financial, investment, legal, or tax advice. Always consult a qualified financial advisor before making investment decisions. Past performance does not guarantee future results. Investing involves risk including the possible loss of principal.
                </p>
              </div>
            </section>

            <section id="accounts" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                4. User Accounts
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-300">
                <li>You must be 18 or older to create an account.</li>
                <li>You are responsible for maintaining account security.</li>
                <li>One account per person.</li>
                <li>You must provide accurate information.</li>
                <li>We reserve the right to suspend accounts that violate these terms.</li>
              </ul>
            </section>

            <section id="content" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                5. User Content
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-300">
                <li>You own content you post on QuantivTrade.</li>
                <li>By posting you grant QuantivTrade a license to display and distribute your content.</li>
                <li>You are responsible for what you post.</li>
                <li>You may not post: false financial information, market manipulation, spam, harassment, illegal content, or misleading trade claims.</li>
              </ul>
            </section>

            <section id="verified" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                6. Verified Trader Program
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-300">
                <li>Verification does not constitute endorsement.</li>
                <li>Verified status can be revoked for violations.</li>
                <li>Performance stats are self-reported unless broker-verified.</li>
                <li>QuantivTrade is not liable for advice from verified traders.</li>
              </ul>
            </section>

            <section id="prediction" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                7. Prediction Markets
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-300">
                <li>All prediction markets use virtual points only.</li>
                <li>No real money is involved.</li>
                <li>Virtual points have no monetary value.</li>
                <li>Results are for entertainment and educational purposes only.</li>
              </ul>
            </section>

            <section id="subscription" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                8. Subscription and Payments
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-300">
                <li>Pro and Verified tiers are billed monthly.</li>
                <li>Cancel anytime; no refunds for partial months.</li>
                <li>Prices subject to change with 30 days notice.</li>
                <li>Free trial terms apply as stated at signup.</li>
              </ul>
            </section>

            <section id="ip" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                9. Intellectual Property
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-300">
                <li>QuantivTrade name, logo, and platform are owned by QuantivTrade.</li>
                <li>User content remains owned by the user.</li>
                <li>AI-generated content on the platform is provided for educational use only.</li>
              </ul>
            </section>

            <section id="warranties" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                10. Disclaimer of Warranties
              </h2>
              <p className="mt-3 text-zinc-300">
                The platform is provided as-is without warranties of any kind. Market data may be delayed. AI analysis may contain errors. We do not guarantee accuracy of any information on the platform.
              </p>
            </section>

            <section id="liability" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                11. Limitation of Liability
              </h2>
              <p className="mt-3 text-zinc-300">
                QuantivTrade is not liable for any trading losses, financial decisions made based on platform content, or damages arising from use of the platform.
              </p>
            </section>

            <section id="governing" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                12. Governing Law
              </h2>
              <p className="mt-3 text-zinc-300">
                These terms are governed by the laws of the United States.
              </p>
            </section>

            <section id="changes" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                13. Changes to Terms
              </h2>
              <p className="mt-3 text-zinc-300">
                We may update these terms at any time. Continued use of the platform constitutes acceptance of updated terms.
              </p>
            </section>

            <section id="contact" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                14. Contact
              </h2>
              <p className="mt-3 text-zinc-300">
                For questions about these terms contact us through the <Link href="/feedback" className="text-[var(--accent-color)] hover:underline">Feedback</Link> page.
              </p>
            </section>
          </article>

          {showBackToTop && (
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="fixed bottom-8 right-8 rounded-full bg-[var(--accent-color)]/20 px-4 py-2 text-sm font-medium text-[var(--accent-color)] shadow-lg hover:bg-[var(--accent-color)]/30 print:hidden"
              aria-label="Back to top"
            >
              Back to top
            </button>
          )}
        </main>
      </div>

    </div>
  );
}
