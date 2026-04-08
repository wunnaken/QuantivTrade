"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const SECTIONS = [
  { id: "collect", title: "Information We Collect" },
  { id: "use", title: "How We Use Your Information" },
  { id: "storage", title: "Data Storage and Security" },
  { id: "cookies", title: "Cookies and Local Storage" },
  { id: "third", title: "Third Party Services" },
  { id: "rights", title: "Your Rights" },
  { id: "gdpr", title: "GDPR (EU Users)" },
  { id: "ccpa", title: "CCPA (California Users)" },
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
            <p className="mt-2 text-sm text-zinc-500">Last updated: March 2026</p>
            <p className="mt-4 text-zinc-400">
              Your privacy matters to us.
            </p>

            <section id="collect" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                1. Information We Collect
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-300">
                <li>Account info: name, email, username</li>
                <li>Profile info: bio, photo, trading style</li>
                <li>Usage data: pages visited, features used</li>
                <li>Trade journal data (stored locally)</li>
                <li>Watchlist and preferences</li>
                <li>Communications via feedback form</li>
              </ul>
            </section>

            <section id="use" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                2. How We Use Your Information
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-300">
                <li>To provide and improve the platform</li>
                <li>To personalize your experience</li>
                <li>To send important account notifications</li>
                <li>To send optional email digests (you can unsubscribe anytime)</li>
                <li>We never sell your personal data</li>
                <li>We never share data with advertisers</li>
              </ul>
            </section>

            <section id="storage" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                3. Data Storage and Security
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-300">
                <li>Account data stored securely via Supabase</li>
                <li>Passwords are encrypted and never stored in plain text</li>
                <li>API keys and sensitive data are never exposed client-side</li>
                <li>We use industry standard encryption</li>
              </ul>
            </section>

            <section id="cookies" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                4. Cookies and Local Storage
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-300">
                <li>We use localStorage for preferences, theme settings, and cached data</li>
                <li>No third party advertising cookies</li>
                <li>Essential cookies only for authentication</li>
              </ul>
            </section>

            <section id="third" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                5. Third Party Services
              </h2>
              <p className="mt-3 text-zinc-300">
                We use these third party services:
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-300">
                <li>Supabase (database and authentication)</li>
                <li>Vercel (hosting)</li>
                <li>Anthropic Claude (AI analysis)</li>
                <li>Finnhub (market data)</li>
                <li>NewsAPI (news content)</li>
                <li>Resend (email delivery)</li>
                <li>CoinGecko (crypto data)</li>
              </ul>
              <p className="mt-2 text-zinc-400 text-sm">Each has their own privacy policy.</p>
            </section>

            <section id="rights" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                6. Your Rights
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-300">
                <li>Access your data anytime</li>
                <li>Export your data on request</li>
                <li>Delete your account and data</li>
                <li>Opt out of email communications</li>
                <li>Update your information anytime</li>
              </ul>
            </section>

            <section id="gdpr" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                7. GDPR (EU Users)
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-300">
                <li>Legal basis for processing: contract performance and legitimate interest</li>
                <li>Right to erasure (right to be forgotten)</li>
                <li>Data portability rights</li>
                <li>Contact us for any GDPR requests</li>
              </ul>
            </section>

            <section id="ccpa" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                8. CCPA (California Users)
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-300">
                <li>We do not sell personal information</li>
                <li>Right to know what data we collect</li>
                <li>Right to delete your data</li>
                <li>No discrimination for exercising rights</li>
              </ul>
            </section>

            <section id="children" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                9. Children&apos;s Privacy
              </h2>
              <p className="mt-3 text-zinc-300">
                QuantivTrade is not intended for users under 18 years of age. We do not knowingly collect data from minors.
              </p>
            </section>

            <section id="changes" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                10. Changes to Privacy Policy
              </h2>
              <p className="mt-3 text-zinc-300">
                We will notify users of significant changes via email or platform notification.
              </p>
            </section>

            <section id="contact" className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-semibold text-white" style={{ color: "var(--accent-color)" }}>
                11. Contact
              </h2>
              <p className="mt-3 text-zinc-300">
                Privacy questions: use the <Link href="/feedback" className="text-[var(--accent-color)] hover:underline">Feedback</Link> page or email us directly.
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
