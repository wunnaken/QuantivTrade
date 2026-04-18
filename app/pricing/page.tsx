"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import type { SubscriptionTier } from "@/hooks/useSubscription";

// ─── Plan data (matches landing page) ────────────────────────────────────────

const PLAN_FEATURES: { label: string; starter: string | boolean; pro: string | boolean; elite: string | boolean }[] = [
  { label: "Market dashboards & data",       starter: true,           pro: true,                elite: true },
  { label: "News & economic calendar",        starter: true,           pro: true,                elite: true },
  { label: "Watchlist items",                 starter: "25 items",     pro: "Unlimited",         elite: "Unlimited" },
  { label: "Backtests per day",               starter: "10 / day",     pro: "Unlimited",         elite: "Unlimited" },
  { label: "Priority support",                starter: true,           pro: true,                elite: true },
  { label: "Host trade rooms",                starter: false,          pro: true,                elite: true },
  { label: "Marketplace selling",             starter: false,          pro: "80% rev share",     elite: "90% rev share" },
  { label: "Verified Trader badge",           starter: false,          pro: true,                elite: "Auto-verified" },
  { label: "Marketplace discount",            starter: false,          pro: false,               elite: "25% off" },
  { label: "Full API access",                 starter: false,          pro: false,               elite: true },
  { label: "White-glove support",             starter: false,          pro: false,               elite: true },
];

const PLANS = [
  { name: "Starter", tagline: "For the committed.",          price: 19, annual: 190, glow: "rgba(232,132,106,0.12)", badge: null as string | null, highlight: false, key: "starter" as const, tier: "starter" as SubscriptionTier },
  { name: "Pro",     tagline: "Serious edge. No excuses.",   price: 29, annual: 290, glow: "rgba(232,132,106,0.18)", badge: "Most Popular",         highlight: true,  key: "pro"     as const, tier: "pro"     as SubscriptionTier },
  { name: "Elite",   tagline: "Built for serious traders.", price: 89, annual: 890, glow: "rgba(232,132,106,0.12)", badge: null as string | null, highlight: false, key: "elite"   as const, tier: "elite"   as SubscriptionTier },
] as const;

type Interval = "month" | "year";

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [interval, setInterval] = useState<Interval>("month");
  const [loading, setLoading] = useState(false);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [hasSubscription, setHasSubscription] = useState(false);

  const currentTier = ((user as any)?.subscription_tier as SubscriptionTier) ?? "free";
  const currentStatus: string = (user as any)?.subscription_status ?? "free";

  useEffect(() => {
    setHasSubscription(
      currentTier !== "free" && (currentStatus === "active" || currentStatus === "past_due")
    );
  }, [currentTier, currentStatus]);

  async function handleSelect(tier: SubscriptionTier) {
    if (!user) { router.push("/auth/sign-in"); return; }
    setLoading(true);
    setLoadingTier(tier);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, interval }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
      else alert(data.error ?? "Something went wrong");
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setLoading(false);
      setLoadingTier(null);
    }
  }

  async function handleManage() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
      else alert(data.error ?? "Could not open billing portal");
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const featureVal = (val: string | boolean) => {
    if (val === false) return null;
    if (val === true) return true;
    return val as string;
  };

  return (
    <div className="min-h-screen app-page">
      <div style={{ width: "min(96vw, 1300px)", margin: "0 auto", padding: "56px 16px 80px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <p className="overline-label" style={{ marginBottom: "12px", fontSize: "10px", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--accent-color)", opacity: 0.8 }}>Pricing</p>
          <h1 style={{ fontFamily: "var(--font-lora), Georgia, serif", fontSize: "clamp(26px, 3vw, 38px)", fontWeight: 600, color: "#fff", marginBottom: "12px", letterSpacing: "-0.01em" }}>
            Choose your plan
          </h1>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)" }}>
            No free tier. No compromises. Pick the edge you need.
          </p>
        </div>

        {/* Interval toggle */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "40px" }}>
          <div style={{ display: "flex", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: "4px" }}>
            {(["month", "year"] as const).map((iv) => (
              <button key={iv} onClick={() => setInterval(iv)}
                style={{
                  position: "relative", padding: "8px 20px", borderRadius: "8px",
                  fontSize: "12px", fontWeight: 500, border: "none", cursor: "pointer",
                  background: interval === iv ? "var(--accent-color)" : "transparent",
                  color: interval === iv ? "#0a0e17" : "rgba(255,255,255,0.35)",
                  transition: "all 0.2s",
                }}>
                {iv === "year" ? "Annual" : "Monthly"}
                {iv === "year" && interval !== "year" && (
                  <span style={{
                    position: "absolute", right: "-8px", top: "-8px",
                    background: "#4ade80", color: "#000", borderRadius: "999px",
                    padding: "1px 6px", fontSize: "8px", fontWeight: 700,
                  }}>-17%</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Cards — same layout as landing page */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          {PLANS.map(({ name, tagline, price, annual, glow, badge, highlight, key, tier }) => {
            const isCurrent = currentTier === tier;
            const displayPrice = interval === "year" ? annual : price;
            const monthlyEquiv = interval === "year" ? Math.round(annual / 12) : null;
            const saving = interval === "year" ? price * 12 - annual : 0;

            return (
              <div key={name}
                onMouseEnter={() => setHovered(name)} onMouseLeave={() => setHovered(null)}
                style={{
                  position: "relative", overflow: "hidden",
                  borderRadius: "16px",
                  border: `1px solid ${highlight ? "rgba(232,132,106,0.3)" : hovered === name ? "rgba(232,132,106,0.18)" : "rgba(255,255,255,0.07)"}`,
                  background: highlight ? "rgba(232,132,106,0.04)" : "rgba(255,255,255,0.02)",
                  backdropFilter: "blur(16px)",
                  boxShadow: highlight ? "0 0 60px rgba(232,132,106,0.08)" : "none",
                  display: "flex", flexDirection: "column",
                  transition: "border-color 0.25s, box-shadow 0.25s",
                }}>
                {/* Glow */}
                <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 70% 45% at 50% 0%, ${glow} 0%, transparent 70%)`, opacity: hovered === name ? 1 : highlight ? 0.6 : 0, transition: "opacity 0.4s", pointerEvents: "none" }} />

                <div style={{ padding: "28px 28px 24px", display: "flex", flexDirection: "column", flex: 1, position: "relative" }}>
                  {/* Badge */}
                  <div style={{ height: "22px", marginBottom: "16px" }}>
                    {badge && <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--accent-color)", background: "rgba(232,132,106,0.1)", border: "1px solid rgba(232,132,106,0.2)", padding: "3px 8px", borderRadius: "6px" }}>{badge}</span>}
                    {isCurrent && <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#4ade80", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", padding: "3px 8px", borderRadius: "6px" }}>Current Plan</span>}
                  </div>

                  {/* Name + tagline */}
                  <p style={{ fontFamily: "var(--font-lora), Georgia, serif", fontSize: "clamp(20px, 2.2vw, 26px)", fontWeight: 600, color: "#fff", marginBottom: "4px", lineHeight: 1.1 }}>{name}</p>
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)", marginBottom: "20px", letterSpacing: "0.04em" }}>{tagline}</p>

                  {/* Price */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: "2px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>$</span>
                    <span style={{ fontFamily: "var(--font-lora), Georgia, serif", fontSize: "clamp(36px, 4vw, 48px)", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>{displayPrice}</span>
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)", marginLeft: "3px" }}>/ {interval === "year" ? "yr" : "mo"}</span>
                  </div>
                  {monthlyEquiv && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                      <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>${monthlyEquiv}/mo billed annually</span>
                      {saving > 0 && <span style={{ fontSize: "9px", fontWeight: 700, color: "#4ade80", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", padding: "2px 6px", borderRadius: "4px" }}>Save ${saving}</span>}
                    </div>
                  )}
                  {!monthlyEquiv && <div style={{ marginBottom: "16px" }} />}

                  {/* Divider */}
                  <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", marginBottom: "18px" }} />

                  {/* Feature list */}
                  <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "8px", flex: 1, marginBottom: "24px" }}>
                    {PLAN_FEATURES.map(feat => {
                      const val = featureVal(feat[key]);
                      const included = val !== null;
                      return (
                        <li key={feat.label} style={{ display: "flex", alignItems: "center", gap: "9px", opacity: included ? 1 : 0.35 }}>
                          {included ? (
                            <svg width="13" height="13" viewBox="0 0 13 13" style={{ flexShrink: 0 }}>
                              <circle cx="6.5" cy="6.5" r="6" fill="none" stroke="rgba(232,132,106,0.4)" strokeWidth="1"/>
                              <path d="M4 6.5l1.8 1.8L9 4.5" stroke="var(--accent-color)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 13 13" style={{ flexShrink: 0 }}>
                              <circle cx="6.5" cy="6.5" r="6" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
                              <path d="M4.5 4.5l4 4M8.5 4.5l-4 4" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" strokeLinecap="round"/>
                            </svg>
                          )}
                          <span style={{ fontSize: "11px", lineHeight: 1.45, color: included ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.22)" }}>
                            {typeof val === "string" ? <><span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{val}</span> {feat.label.toLowerCase()}</> : feat.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {/* CTA */}
                  {isCurrent ? (
                    <button disabled style={{
                      width: "100%", padding: "13px 0", borderRadius: "10px",
                      border: "1.5px solid rgba(255,255,255,0.1)", background: "transparent",
                      color: "rgba(255,255,255,0.25)", fontSize: "13px", fontWeight: 600,
                      fontFamily: "var(--font-lora)", cursor: "default",
                    }}>
                      Current Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSelect(tier)}
                      disabled={loading && loadingTier === tier}
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
                        width: "100%", padding: "13px 0", borderRadius: "10px",
                        border: "1.5px solid var(--accent-color)",
                        background: highlight ? "rgba(232,132,106,0.12)" : "transparent",
                        color: "var(--accent-color)",
                        fontFamily: "var(--font-lora)",
                        fontSize: "13px", fontWeight: 600, letterSpacing: "0.03em",
                        cursor: loading ? "not-allowed" : "pointer",
                        opacity: loading && loadingTier === tier ? 0.5 : 1,
                        transition: "background 0.2s, transform 0.1s",
                      }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                      {loading && loadingTier === tier ? "Redirecting..." : `Get ${name}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Manage subscription */}
        {hasSubscription && (
          <div style={{ textAlign: "center", marginTop: "24px" }}>
            <button onClick={handleManage} disabled={loading}
              style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", background: "none", border: "none", cursor: "pointer", transition: "color 0.2s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.25)"; }}>
              Manage subscription / Cancel
            </button>
          </div>
        )}

        {/* Footer note */}
        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "11px", color: "rgba(255,255,255,0.18)", letterSpacing: "0.06em" }}>
          Cancel anytime · Stripe-secured · Instant access on activation
        </p>
      </div>
    </div>
  );
}
