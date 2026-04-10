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
  { id: "marketplace", title: "Marketplace" },
  { id: "subscription", title: "Subscription and Payments" },
  { id: "ip", title: "Intellectual Property" },
  { id: "termination", title: "Termination" },
  { id: "warranties", title: "Disclaimer of Warranties" },
  { id: "liability", title: "Limitation of Liability" },
  { id: "disputes", title: "Dispute Resolution" },
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
            <p className="mt-2 text-sm text-zinc-500">Last updated: April 2026</p>
            <p className="mt-4 text-zinc-400">
              Please read these Terms of Service (&quot;Terms&quot;) carefully before using QuantivTrade (&quot;Platform&quot;), operated by QuantivTrade (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). These Terms constitute a legally binding agreement between you and QuantivTrade.
            </p>

            <section id="acceptance" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                1. Acceptance of Terms
              </h2>
              <p className="mt-3 text-zinc-300">
                By accessing or using QuantivTrade at quantiv.trade, you confirm that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you do not agree to these Terms in their entirety, you must immediately stop using the Platform. Your continued use of the Platform after any modification to these Terms constitutes your acceptance of the revised Terms.
              </p>
            </section>

            <section id="description" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                2. Description of Service
              </h2>
              <p className="mt-3 text-zinc-300">
                QuantivTrade is a social trading intelligence platform that provides market data, AI-powered analysis, community features, educational investment tools, a digital marketplace for trading resources, and related services. The Platform includes features such as social feeds, trade rooms, market data visualization, portfolio tracking, prediction markets (virtual only), and content from community members.
              </p>
              <p className="mt-3 text-zinc-300">
                QuantivTrade does not provide financial advice and is not a registered investment advisor, broker-dealer, commodity trading advisor, or financial institution of any kind. We are not regulated by the SEC, FINRA, or any financial regulatory authority.
              </p>
            </section>

            <section id="not-advice" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                3. Not Financial Advice
              </h2>
              <div className="mt-4 rounded-lg border-2 border-amber-500/60 bg-amber-500/10 p-4 text-amber-200">
                <p className="font-semibold uppercase tracking-wide">Important Disclaimer</p>
                <p className="mt-2 text-sm leading-relaxed">
                  All content on QuantivTrade — including posts, analysis, AI-generated insights, market data, charts, trade ideas, and community discussions — is for educational and informational purposes only. Nothing on this Platform constitutes financial, investment, legal, or tax advice, and nothing should be construed as a recommendation to buy, sell, or hold any security, cryptocurrency, or other financial instrument.
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  Always consult a qualified, licensed financial advisor before making investment decisions. Past performance does not guarantee future results. All investing involves risk, including the possible loss of principal. You are solely responsible for your own investment decisions.
                </p>
              </div>
            </section>

            <section id="accounts" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                4. User Accounts
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-300">
                <li>You must be at least 18 years of age to create an account and use the Platform.</li>
                <li>You agree to provide accurate, current, and complete information during registration and to keep it updated.</li>
                <li>You are solely responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.</li>
                <li>You may maintain only one account per person. Creating multiple accounts to circumvent restrictions or bans is prohibited.</li>
                <li>You must notify us immediately of any unauthorized access to your account.</li>
                <li>We reserve the right to suspend or permanently terminate accounts that violate these Terms, engage in fraudulent activity, or are otherwise harmful to the Platform or its users.</li>
              </ul>
            </section>

            <section id="content" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                5. User Content
              </h2>
              <p className="mt-3 text-zinc-300">
                You retain ownership of content you post on QuantivTrade. By posting, you grant QuantivTrade a worldwide, non-exclusive, royalty-free license to use, display, reproduce, and distribute your content solely for the purpose of operating and improving the Platform.
              </p>
              <p className="mt-3 text-zinc-300">You may not post content that:</p>
              <ul className="mt-2 list-inside list-disc space-y-2 text-zinc-300">
                <li>Contains false, misleading, or manipulative financial information intended to influence market prices</li>
                <li>Constitutes securities fraud, pump-and-dump schemes, or market manipulation</li>
                <li>Harasses, threatens, or defames other users</li>
                <li>Infringes on any third-party intellectual property rights</li>
                <li>Contains spam, unsolicited advertising, or pyramid schemes</li>
                <li>Violates any applicable law or regulation</li>
                <li>Contains malicious code, viruses, or other harmful components</li>
              </ul>
              <p className="mt-3 text-zinc-300">
                We reserve the right to remove any content that violates these Terms without prior notice.
              </p>
            </section>

            <section id="verified" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                6. Verified Trader Program
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-300">
                <li>Verified status is a platform designation only and does not constitute endorsement of any trader&apos;s strategies, performance, or advice.</li>
                <li>Performance statistics displayed by verified traders are self-reported unless explicitly noted as broker-verified.</li>
                <li>Verified status may be revoked at any time for violations of these Terms or platform guidelines.</li>
                <li>QuantivTrade is not liable for any trading losses or decisions made based on content from verified traders.</li>
                <li>Users must not impersonate or misrepresent their verified status on other platforms.</li>
              </ul>
            </section>

            <section id="prediction" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                7. Prediction Markets
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-300">
                <li>All prediction markets on QuantivTrade use virtual points only and involve no real money or monetary value of any kind.</li>
                <li>Virtual points cannot be redeemed, transferred, or exchanged for currency, goods, or services.</li>
                <li>Prediction markets are provided for entertainment and educational purposes only.</li>
                <li>Results and outcomes are not guaranteed and carry no financial implication.</li>
                <li>We reserve the right to void, adjust, or close any prediction market at our discretion.</li>
              </ul>
            </section>

            <section id="marketplace" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                8. Marketplace
              </h2>
              <p className="mt-3 text-zinc-300">
                The QuantivTrade Marketplace allows users to buy and sell digital trading resources, including educational content, templates, and tools.
              </p>
              <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-300">
                <li>Sellers are responsible for ensuring their listings are accurate, lawful, and do not infringe third-party rights.</li>
                <li>QuantivTrade is not a party to transactions between buyers and sellers and does not guarantee the quality, accuracy, or performance of any marketplace listing.</li>
                <li>All sales are final unless otherwise specified in the listing or required by applicable law.</li>
                <li>Marketplace content must not constitute regulated financial advice or investment solicitation.</li>
                <li>We reserve the right to remove any listing and suspend any seller who violates these Terms.</li>
                <li>Payment processing is handled by Stripe. By purchasing, you agree to Stripe&apos;s terms of service.</li>
              </ul>
            </section>

            <section id="subscription" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                9. Subscription and Payments
              </h2>
              <p className="mt-3 text-zinc-300">
                QuantivTrade offers the following subscription tiers: Free, Verified, Starter, Pro, and Elite. Paid tiers provide access to additional features as described on the pricing page.
              </p>
              <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-300">
                <li>Paid subscriptions are billed on a recurring monthly basis via Stripe.</li>
                <li>You may cancel your subscription at any time through your account settings. Access continues until the end of the current billing period.</li>
                <li>We do not provide refunds for partial billing periods except where required by applicable law.</li>
                <li>We reserve the right to change subscription prices with at least 30 days&apos; notice. Continued use after the effective date constitutes acceptance of the new price.</li>
                <li>Free trial terms, where applicable, are stated at signup. Your subscription will auto-renew after the trial unless cancelled.</li>
                <li>Failure to pay may result in downgrade to the Free tier or suspension of your account.</li>
              </ul>
            </section>

            <section id="ip" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                10. Intellectual Property
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-300">
                <li>The QuantivTrade name, logo, platform design, and all proprietary software are owned by QuantivTrade and protected by applicable intellectual property laws.</li>
                <li>You may not copy, modify, distribute, or create derivative works of the Platform or its proprietary content without our express written permission.</li>
                <li>User-generated content remains the property of the user who created it, subject to the license granted in Section 5.</li>
                <li>AI-generated analysis and insights produced by the Platform are provided for educational use only and are the property of QuantivTrade.</li>
              </ul>
            </section>

            <section id="termination" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                11. Termination
              </h2>
              <p className="mt-3 text-zinc-300">
                We reserve the right to suspend or terminate your access to the Platform at any time, with or without cause, and with or without notice. Grounds for termination include, but are not limited to, violation of these Terms, fraudulent activity, or conduct harmful to the Platform or other users.
              </p>
              <p className="mt-3 text-zinc-300">
                You may close your account at any time through your account settings. Upon termination, your right to use the Platform ceases immediately. Sections of these Terms that by their nature should survive termination (including Sections 3, 10, 12, 13, 14, and 15) will remain in effect.
              </p>
            </section>

            <section id="warranties" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                12. Disclaimer of Warranties
              </h2>
              <p className="mt-3 text-zinc-300">
                THE PLATFORM IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
              </p>
              <p className="mt-3 text-zinc-300">
                Market data may be delayed or inaccurate. AI analysis may contain errors. We make no guarantee as to the accuracy, completeness, or timeliness of any information on the Platform.
              </p>
            </section>

            <section id="liability" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                13. Limitation of Liability
              </h2>
              <p className="mt-3 text-zinc-300">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, QUANTIVTRADE AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO TRADING LOSSES, LOSS OF PROFITS, LOSS OF DATA, OR DAMAGES ARISING FROM YOUR USE OF OR INABILITY TO USE THE PLATFORM, WHETHER BASED ON WARRANTY, CONTRACT, TORT, OR ANY OTHER LEGAL THEORY.
              </p>
              <p className="mt-3 text-zinc-300">
                IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU EXCEED THE GREATER OF THE AMOUNT YOU PAID TO US IN THE TWELVE MONTHS PRECEDING THE CLAIM OR ONE HUNDRED U.S. DOLLARS ($100).
              </p>
            </section>

            <section id="disputes" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                14. Dispute Resolution
              </h2>
              <p className="mt-3 text-zinc-300">
                Before initiating any formal legal proceedings, you agree to contact us at quantivtrade@gmail.com to attempt to resolve any dispute informally. We will make a good faith effort to resolve disputes within 30 days.
              </p>
              <p className="mt-3 text-zinc-300">
                If a dispute cannot be resolved informally, you agree to submit it to binding arbitration on an individual basis rather than in a class action or representative proceeding, to the extent permitted by applicable law.
              </p>
            </section>

            <section id="governing" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                15. Governing Law
              </h2>
              <p className="mt-3 text-zinc-300">
                These Terms are governed by and construed in accordance with the laws of the United States, without regard to conflict of law principles. You consent to exclusive jurisdiction in the federal and state courts located in the United States for any disputes arising under these Terms that are not subject to arbitration.
              </p>
            </section>

            <section id="changes" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                16. Changes to Terms
              </h2>
              <p className="mt-3 text-zinc-300">
                We may update these Terms at any time. We will notify users of material changes via email or a prominent notice on the Platform at least 14 days before the changes take effect. Your continued use of the Platform after the effective date constitutes your acceptance of the revised Terms. If you do not agree to the revised Terms, you must stop using the Platform.
              </p>
            </section>

            <section id="contact" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                17. Contact
              </h2>
              <p className="mt-3 text-zinc-300">
                For questions about these Terms, contact us at{" "}
                <a href="mailto:quantivtrade@gmail.com" className="text-[var(--accent-color)] hover:underline">
                  quantivtrade@gmail.com
                </a>{" "}
                or through the <Link href="/feedback" className="text-[var(--accent-color)] hover:underline">Feedback</Link> page.
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
