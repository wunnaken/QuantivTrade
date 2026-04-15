"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { QuantivTradeLogoImage } from "./QuantivTradeLogoImage";
import { useAuth } from "./AuthContext";
import { APP_VERSION } from "../lib/version";

const FOOTER_BG = "var(--app-bg)";
const FOOTER_TEXT = "#6B7280";

const SOCIAL_LINKS = [
  { label: "Instagram", href: "https://www.instagram.com/quantivtrade", aria: "Instagram" },
  { label: "X", href: "https://x.com/quantivtrade", aria: "X (Twitter)" },
  { label: "YouTube", href: "https://www.youtube.com/@quantivtrade", aria: "YouTube" },
];

const PLATFORM_LINKS = [
  { label: "Dashboard", href: "/feed" },
  { label: "Communities", href: "/communities" },
  { label: "Trade Journal", href: "/journal" },

  { label: "Morning Briefing", href: "/feed" },
  { label: "Market Map", href: "/map" },
];

const PLANS_LINKS = [
  { label: "Pricing", href: "/pricing" },
  { label: "Starter · $19/mo", href: "/pricing" },
  { label: "Pro · $29/mo", href: "/pricing" },
  { label: "Elite · $89/mo", href: "/pricing" },
  { label: "Verified Trader · $9/mo", href: "/verify" },
];

const RESOURCES_LINKS = [
  { label: "Getting Started (coming soon)", href: "#" },
  { label: "How to Use the Journal (coming soon)", href: "#" },
  { label: "API & Data Sources (coming soon)", href: "#" },
  { label: "Changelog (coming soon)", href: "#" },
  { label: "Trading Ethics & Conduct", href: "/ethics" },
  { label: "Idle", href: "/idle" },
];

const COMPANY_LINKS_BASE = [
  { label: "Terms of Service", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Feedback", href: "/feedback" },
];

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white">
        {title}
      </h3>
      <ul className="mt-4 space-y-3">
        {links.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="text-sm text-zinc-400 transition-colors hover:text-[var(--accent-color)]"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  const { user } = useAuth();
  const [apiStatus, setApiStatus] = useState<"ok" | "delayed" | "error" | null>(null);
  const [apiLabel, setApiLabel] = useState<string>("");
  const companyLinks = useMemo(
    () => [{ label: "Home", href: "/" }, ...COMPANY_LINKS_BASE],
    []
  );

  useEffect(() => {
    fetch("/api/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setApiStatus(d?.status ?? "error");
        setApiLabel(d?.label ?? "Data issues — we're on it");
      })
      .catch(() => {
        setApiStatus("error");
        setApiLabel("Data issues — we're on it");
      });
  }, []);

  const statusColor = apiStatus === "ok" ? "bg-emerald-500" : apiStatus === "delayed" ? "bg-amber-500" : apiStatus === "error" ? "bg-red-500" : "bg-zinc-500";

  return (
    <footer
      className="w-full border-t pt-10 pb-8"
      style={{
        backgroundColor: FOOTER_BG,
        borderColor: "color-mix(in srgb, var(--accent-color) 15%, transparent)",
      }}
      role="contentinfo"
    >
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Column 1 — Brand */}
          <div className="flex flex-col gap-4 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <QuantivTradeLogoImage size={36} />
              <span className="text-lg font-semibold" style={{ color: "var(--accent-color)" }}>
                QuantivTrade
              </span>
            </div>
            <p className="text-sm font-medium text-white/90">
              Where the World Trades Ideas
            </p>
            <p className="text-sm max-w-[240px]" style={{ color: FOOTER_TEXT }}>
              The social trading intelligence platform for investors of every level.
            </p>
            <div className="flex gap-4">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.aria}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#6B7280] transition-colors hover:text-[var(--accent-color)]"
                >
                  {s.label === "Instagram" && (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
                    </svg>
                  )}
                  {s.label === "YouTube" && (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  )}
                  {s.label === "X" && (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  )}
                </a>
              ))}
            </div>
          </div>

          <FooterColumn title="Platform" links={PLATFORM_LINKS} />
          <FooterColumn title="Plans" links={PLANS_LINKS} />
          <FooterColumn title="Resources" links={RESOURCES_LINKS} />
          <FooterColumn title="Company" links={companyLinks} />
        </div>

        {/* Bottom bar */}
        <div
          className="mt-10 flex flex-col gap-3 border-t pt-5 text-center text-sm md:flex-row md:items-center md:justify-between md:text-left"
          style={{
            borderColor: "color-mix(in srgb, var(--accent-color) 12%, transparent)",
            color: FOOTER_TEXT,
          }}
        >
          <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
            <span>© 2026 QuantivTrade. All rights reserved.</span>
            <span className="text-xs text-zinc-600">v{APP_VERSION}</span>
            {apiStatus && (
              <span className="flex items-center gap-1.5" title={apiLabel}>
                <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${statusColor}`} aria-hidden />
                <span className="text-xs">{apiLabel}</span>
              </span>
            )}
          </div>
          <span>Not financial advice. For educational purposes only.</span>
          <span>Built for traders, by traders.</span>
        </div>
      </div>
    </footer>
  );
}
