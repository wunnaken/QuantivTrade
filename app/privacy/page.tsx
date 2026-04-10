"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const SECTIONS = [
  { id: "collect", title: "Information We Collect" },
  { id: "use", title: "How We Use Your Information" },
  { id: "storage", title: "Data Storage and Security" },
  { id: "retention", title: "Data Retention" },
  { id: "cookies", title: "Cookies and Local Storage" },
  { id: "third", title: "Third-Party Services" },
  { id: "rights", title: "Your Rights" },
  { id: "gdpr", title: "GDPR (EU Users)" },
  { id: "ccpa", title: "CCPA (California Users)" },
  { id: "dnt", title: "Do Not Track" },
  { id: "children", title: "Children's Privacy" },
  { id: "changes", title: "Changes to Privacy Policy" },
  { id: "contact", title: "Contact" },
];

export default function PrivacyPage() {
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
            <span className="text-zinc-400">Privacy Policy</span>
          </nav>

          <article className="mx-auto max-w-[800px] leading-relaxed print:max-w-none">
            <h1 className="text-3xl font-bold text-white" style={{ color: "var(--accent-color)" }}>
              Privacy Policy
            </h1>
            <p className="mt-2 text-sm text-zinc-500">Last updated: April 2026</p>
            <p className="mt-4 text-zinc-400">
              This Privacy Policy explains how QuantivTrade (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) collects, uses, stores, and protects your personal information when you use our platform at quantiv.trade. By using QuantivTrade, you agree to the practices described in this policy.
            </p>

            <section id="collect" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                1. Information We Collect
              </h2>
              <p className="mt-3 text-zinc-300 font-medium">Information you provide directly:</p>
              <ul className="mt-2 list-inside list-disc space-y-2 text-zinc-300">
                <li>Account information: name, email address, username, and password</li>
                <li>Profile information: bio, profile photo, banner image, and trading style</li>
                <li>Payment information: billing details processed by Stripe (we do not store card numbers)</li>
                <li>Communications: messages sent through our feedback form or support channels</li>
                <li>User content: posts, comments, trade ideas, and community contributions</li>
              </ul>
              <p className="mt-3 text-zinc-300 font-medium">Information collected automatically:</p>
              <ul className="mt-2 list-inside list-disc space-y-2 text-zinc-300">
                <li>Usage data: pages visited, features used, time spent on the Platform</li>
                <li>Device and browser information: browser type, operating system, IP address</li>
                <li>Authentication tokens stored in cookies for session management</li>
                <li>UI preferences: sidebar configuration, theme settings, and display preferences stored in our database</li>
              </ul>
            </section>

            <section id="use" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                2. How We Use Your Information
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-300">
                <li>To create and manage your account and provide Platform services</li>
                <li>To personalize your experience and remember your preferences</li>
                <li>To process subscription payments and marketplace transactions</li>
                <li>To send transactional emails (account confirmations, billing receipts, security alerts)</li>
                <li>To send optional product updates and newsletters — you may unsubscribe at any time</li>
                <li>To improve the Platform through aggregate usage analysis</li>
                <li>To enforce our Terms of Service and protect the safety of our community</li>
                <li>To comply with applicable legal obligations</li>
              </ul>
              <p className="mt-3 text-zinc-300 font-medium">We will never:</p>
              <ul className="mt-2 list-inside list-disc space-y-2 text-zinc-300">
                <li>Sell your personal data to third parties</li>
                <li>Share your data with advertisers or ad networks</li>
                <li>Use your data to target you with third-party advertising</li>
              </ul>
            </section>

            <section id="storage" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                3. Data Storage and Security
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-300">
                <li>Account and profile data is stored securely via Supabase with row-level security policies</li>
                <li>Passwords are hashed using industry-standard bcrypt encryption and are never stored in plain text</li>
                <li>All data in transit is encrypted using TLS 1.2 or higher</li>
                <li>API keys and sensitive credentials are stored as server-side environment variables and are never exposed to the client</li>
                <li>Payment data is processed and stored by Stripe; we do not store credit card numbers or full payment details</li>
                <li>We implement security headers (HSTS, CSP, X-Frame-Options) to protect against common web vulnerabilities</li>
              </ul>
              <p className="mt-3 text-zinc-300">
                Despite these measures, no system is 100% secure. If you believe your account has been compromised, please contact us immediately at{" "}
                <a href="mailto:quantivtrade@gmail.com" className="text-[var(--accent-color)] hover:underline">
                  quantivtrade@gmail.com
                </a>.
              </p>
            </section>

            <section id="retention" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                4. Data Retention
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-300">
                <li>We retain your account data for as long as your account is active or as needed to provide services.</li>
                <li>When you delete your account, we delete your personal data within 30 days, except where we are required by law to retain it longer.</li>
                <li>Anonymized or aggregated data (which cannot identify you) may be retained indefinitely for analytics purposes.</li>
                <li>Billing records may be retained for up to 7 years to comply with tax and accounting regulations.</li>
              </ul>
            </section>

            <section id="cookies" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                5. Cookies and Local Storage
              </h2>
              <p className="mt-3 text-zinc-300 font-medium">Cookies we use:</p>
              <ul className="mt-2 list-inside list-disc space-y-2 text-zinc-300">
                <li>Authentication cookies to maintain your logged-in session (essential, cannot be disabled)</li>
                <li>No third-party advertising or tracking cookies</li>
              </ul>
              <p className="mt-3 text-zinc-300 font-medium">Local storage and database:</p>
              <ul className="mt-2 list-inside list-disc space-y-2 text-zinc-300">
                <li>UI preferences such as sidebar layout, theme, and collapsed sections are stored both in your browser&apos;s local storage and synced to our database for authenticated users, so your settings are preserved across devices</li>
                <li>Cached market data and temporary app state are stored in browser local storage and cleared when you clear your browser data</li>
              </ul>
              <p className="mt-3 text-zinc-300">
                You can clear browser local storage at any time through your browser&apos;s settings. This will reset your local preferences but your synced preferences will be restored on next login.
              </p>
            </section>

            <section id="third" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                6. Third-Party Services
              </h2>
              <p className="mt-3 text-zinc-300">
                We use the following third-party services to operate the Platform. Each has its own privacy policy governing how they handle data:
              </p>
              <ul className="mt-2 list-inside list-disc space-y-2 text-zinc-300">
                <li><span className="font-medium text-zinc-200">Supabase</span> — database, authentication, and real-time features</li>
                <li><span className="font-medium text-zinc-200">Stripe</span> — payment processing and subscription billing</li>
                <li><span className="font-medium text-zinc-200">Railway</span> — backend infrastructure hosting</li>
                <li><span className="font-medium text-zinc-200">Anthropic Claude</span> — AI-powered analysis features</li>
                <li><span className="font-medium text-zinc-200">Finnhub</span> — real-time stock and market data</li>
                <li><span className="font-medium text-zinc-200">NewsAPI</span> — financial news content</li>
                <li><span className="font-medium text-zinc-200">CoinGecko</span> — cryptocurrency market data</li>
                <li><span className="font-medium text-zinc-200">Resend</span> — transactional email delivery</li>
              </ul>
              <p className="mt-3 text-zinc-400 text-sm">
                We only share the minimum data necessary with each provider to deliver their respective services.
              </p>
            </section>

            <section id="rights" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                7. Your Rights
              </h2>
              <p className="mt-3 text-zinc-300">You have the following rights with respect to your personal data:</p>
              <ul className="mt-2 list-inside list-disc space-y-2 text-zinc-300">
                <li><span className="font-medium text-zinc-200">Access:</span> Request a copy of the personal data we hold about you</li>
                <li><span className="font-medium text-zinc-200">Correction:</span> Update or correct inaccurate information through your account settings or by contacting us</li>
                <li><span className="font-medium text-zinc-200">Deletion:</span> Delete your account and associated data through your account settings</li>
                <li><span className="font-medium text-zinc-200">Portability:</span> Request an export of your data in a machine-readable format</li>
                <li><span className="font-medium text-zinc-200">Opt-out:</span> Unsubscribe from marketing emails at any time via the unsubscribe link or account settings</li>
                <li><span className="font-medium text-zinc-200">Restriction:</span> Request that we restrict processing of your data in certain circumstances</li>
              </ul>
              <p className="mt-3 text-zinc-300">
                To exercise any of these rights, contact us at{" "}
                <a href="mailto:quantivtrade@gmail.com" className="text-[var(--accent-color)] hover:underline">
                  quantivtrade@gmail.com
                </a>. We will respond within 30 days.
              </p>
            </section>

            <section id="gdpr" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                8. GDPR (EU Users)
              </h2>
              <p className="mt-3 text-zinc-300">
                If you are located in the European Economic Area (EEA), we process your personal data under the following legal bases:
              </p>
              <ul className="mt-2 list-inside list-disc space-y-2 text-zinc-300">
                <li><span className="font-medium text-zinc-200">Contract performance:</span> Processing necessary to provide you with the Platform services</li>
                <li><span className="font-medium text-zinc-200">Legitimate interests:</span> Improving the Platform, preventing fraud, and maintaining security</li>
                <li><span className="font-medium text-zinc-200">Consent:</span> Marketing communications, where you have opted in</li>
                <li><span className="font-medium text-zinc-200">Legal obligation:</span> Compliance with applicable laws</li>
              </ul>
              <p className="mt-3 text-zinc-300">
                In addition to the rights listed in Section 7, EU users have the right to erasure (&quot;right to be forgotten&quot;), the right to restrict processing, and the right to lodge a complaint with your local data protection authority.
              </p>
              <p className="mt-3 text-zinc-300">
                Data transfers outside the EEA are made pursuant to appropriate safeguards, including standard contractual clauses where required.
              </p>
            </section>

            <section id="ccpa" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                9. CCPA (California Users)
              </h2>
              <p className="mt-3 text-zinc-300">
                If you are a California resident, the California Consumer Privacy Act (CCPA) provides you with additional rights:
              </p>
              <ul className="mt-2 list-inside list-disc space-y-2 text-zinc-300">
                <li>We do not sell personal information as defined by the CCPA</li>
                <li>Right to know what categories of personal information we collect and how it is used</li>
                <li>Right to delete your personal information (subject to certain exceptions)</li>
                <li>Right to opt out of the sale of personal information (not applicable as we do not sell data)</li>
                <li>Right to non-discrimination for exercising your CCPA rights</li>
              </ul>
              <p className="mt-3 text-zinc-300">
                To submit a CCPA request, contact us at{" "}
                <a href="mailto:quantivtrade@gmail.com" className="text-[var(--accent-color)] hover:underline">
                  quantivtrade@gmail.com
                </a>.
              </p>
            </section>

            <section id="dnt" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                10. Do Not Track
              </h2>
              <p className="mt-3 text-zinc-300">
                We do not use cross-site tracking technologies and do not track users across third-party websites. We do not respond to Do Not Track (DNT) signals because we do not engage in the type of tracking DNT is intended to prevent.
              </p>
            </section>

            <section id="children" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                11. Children&apos;s Privacy
              </h2>
              <p className="mt-3 text-zinc-300">
                QuantivTrade is not directed to or intended for use by individuals under the age of 18. We do not knowingly collect, use, or disclose personal information from minors. If we become aware that we have collected personal data from a person under 18, we will promptly delete that information. If you believe we have inadvertently collected data from a minor, please contact us immediately at{" "}
                <a href="mailto:quantivtrade@gmail.com" className="text-[var(--accent-color)] hover:underline">
                  quantivtrade@gmail.com
                </a>.
              </p>
            </section>

            <section id="changes" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                12. Changes to Privacy Policy
              </h2>
              <p className="mt-3 text-zinc-300">
                We may update this Privacy Policy from time to time. When we make material changes, we will notify you by email and/or by posting a prominent notice on the Platform at least 14 days before the changes take effect. The &quot;Last updated&quot; date at the top of this page reflects the most recent revision. Your continued use of the Platform after changes take effect constitutes your acceptance of the revised policy.
              </p>
            </section>

            <section id="contact" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold" style={{ color: "var(--accent-color)" }}>
                13. Contact
              </h2>
              <p className="mt-3 text-zinc-300">
                For privacy-related questions, data requests, or to report a concern, contact us at:
              </p>
              <p className="mt-2 text-zinc-300">
                Email:{" "}
                <a href="mailto:quantivtrade@gmail.com" className="text-[var(--accent-color)] hover:underline">
                  quantivtrade@gmail.com
                </a>
              </p>
              <p className="mt-1 text-zinc-300">
                Or use the <Link href="/feedback" className="text-[var(--accent-color)] hover:underline">Feedback</Link> page on the Platform.
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
