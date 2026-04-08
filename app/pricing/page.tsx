"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import type { SubscriptionTier } from "@/hooks/useSubscription";

type Interval = "month" | "year";

// ─── Plan data ────────────────────────────────────────────────────────────────

const PLANS = [
  {
    tier: "starter" as SubscriptionTier,
    name: "STARTER",
    tagline: "For the committed.",
    monthly: 19,
    annual: 190,
    accentColor: "#e8846a",
    glowColor: "rgba(232,132,106,0.18)",
    features: [
      "Full map & all data layers",
      "Unlimited news & economic calendar",
      "25 watchlist items",
      "10 backtests per day",
      "All market dashboards",
      "Priority support",
    ],
  },
  {
    tier: "pro" as SubscriptionTier,
    name: "PRO",
    tagline: "Serious edge. No excuses.",
    monthly: 29,
    annual: 290,
    highlight: true,
    badge: "MOST POPULAR",
    accentColor: "#00e5ff",
    glowColor: "rgba(0,229,255,0.22)",
    features: [
      "Everything in Starter",
      "Host & moderate trade rooms",
      "Sell on Marketplace — 80% rev share",
      "Unlimited backtests",
      "Verified Trader badge",
      "Advanced analytics suite",
    ],
  },
  {
    tier: "elite" as SubscriptionTier,
    name: "ELITE",
    tagline: "Institutional. No compromises.",
    monthly: 89,
    annual: 890,
    badge: "MAXIMUM EDGE",
    accentColor: "#c8a96e",
    glowColor: "rgba(200,169,110,0.18)",
    features: [
      "Everything in Pro",
      "Auto-verified status",
      "25% discount on all Marketplace buys",
      "Full API access",
      "Priority onboarding call",
      "White-glove support",
    ],
  },
] as const;

// ─── Animated counter ─────────────────────────────────────────────────────────

function AnimatedPrice({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    const start = prev.current;
    const end = value;
    const dur = 340;
    const startTime = performance.now();
    const run = (now: number) => {
      const t = Math.min((now - startTime) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(start + (end - start) * eased));
      if (t < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
    prev.current = value;
  }, [value]);
  return <>{displayed}</>;
}

// ─── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  interval,
  currentTier,
  loading,
  onSelect,
  index,
}: {
  plan: typeof PLANS[number];
  interval: Interval;
  currentTier: SubscriptionTier;
  loading: boolean;
  onSelect: (tier: SubscriptionTier) => void;
  index: number;
}) {
  const isCurrent = currentTier === plan.tier;
  const price = interval === "year" ? plan.annual : plan.monthly;
  const monthlyEquiv = interval === "year" ? Math.round(plan.annual / 12) : null;
  const saving = interval === "year" ? plan.monthly * 12 - plan.annual : 0;
  const [hovered, setHovered] = useState(false);
  const [glowPos, setGlowPos] = useState({ x: 50, y: 30 });
  const cardRef = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setGlowPos({ x, y });
  }

  return (
    <div
      ref={cardRef}
      className="relative flex flex-col overflow-hidden"
      style={{
        borderRight: index < 2 ? "1px solid rgba(255,255,255,0.06)" : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={handleMouseMove}
    >
      {/* Animated mouse-tracking glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 60% 50% at ${glowPos.x}% ${glowPos.y}%, ${plan.glowColor} 0%, transparent 70%)`,
          opacity: hovered ? 1 : 0,
          transition: hovered ? "opacity 0.35s ease" : "opacity 0.6s ease",
        }}
      />
      {/* Top accent line */}
      <div
        className="h-px w-full"
        style={{
          background: hovered
            ? `linear-gradient(90deg, transparent 0%, ${plan.accentColor} 50%, transparent 100%)`
            : `linear-gradient(90deg, transparent 0%, ${plan.accentColor}40 50%, transparent 100%)`,
          transition: "background 0.3s ease",
        }}
      />

      {/* Badge */}
      <div className="h-8 flex items-center px-8 pt-1">
        {"badge" in plan && plan.badge && (
          <span
            className="text-[9px] font-black tracking-[0.35em] uppercase"
            style={{ color: plan.accentColor, opacity: 0.9 }}
          >
            {plan.badge}
          </span>
        )}
      </div>

      <div className="px-8 pb-10 flex flex-col flex-1">
        {/* Plan name */}
        <p
          className="mb-1 font-bold tracking-[-0.01em] leading-none select-none"
          style={{
            fontSize: "clamp(28px, 4vw, 40px)",
            color: hovered ? plan.accentColor : "rgba(255,255,255,0.85)",
            transition: "color 0.35s ease",
          }}
        >
          {plan.name}
        </p>

        <p
          className="mb-8 text-[11px] tracking-[0.08em] font-medium"
          style={{ color: "rgba(255,255,255,0.22)" }}
        >
          {plan.tagline}
        </p>

        {/* Price */}
        <div className="mb-2 flex items-start gap-1.5">
          <span
            className="mt-2 text-sm font-semibold"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            $
          </span>
          <span
            className="font-extrabold tracking-[-0.03em] leading-none"
            style={{
              fontSize: "clamp(48px, 7vw, 68px)",
              color: "#ffffff",
            }}
          >
            <AnimatedPrice value={price} />
          </span>
          <span
            className="mt-auto mb-2 text-xs font-medium"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            /{interval === "year" ? "yr" : "mo"}
          </span>
        </div>

        {monthlyEquiv && (
          <div className="mb-6 flex items-center gap-2">
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              ${monthlyEquiv}/mo billed annually
            </span>
            {saving > 0 && (
              <span
                className="rounded-sm px-1.5 py-0.5 text-[9px] font-black tracking-widest uppercase"
                style={{
                  background: "rgba(79,249,140,0.08)",
                  border: "1px solid rgba(79,249,140,0.2)",
                  color: "#4ff98c",
                }}
              >
                −${saving}
              </span>
            )}
          </div>
        )}

        {/* Divider */}
        <div
          className="mb-7 h-px"
          style={{ background: "rgba(255,255,255,0.06)" }}
        />

        {/* Features */}
        <ul className="space-y-3.5 flex-1 mb-8">
          {plan.features.map((f) => (
            <li
              key={f}
              className="flex items-start gap-3 text-[12px] leading-relaxed"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              <span
                className="mt-[3px] shrink-0 text-[10px] font-bold"
                style={{ color: plan.accentColor, opacity: 0.8 }}
              >
                →
              </span>
              {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        {isCurrent ? (
          <button
            disabled
            className="w-full py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] cursor-default"
            style={{
              border: "1px solid rgba(255,255,255,0.07)",
              color: "rgba(255,255,255,0.2)",
            }}
          >
            Current Plan
          </button>
        ) : (
          <button
            onClick={() => onSelect(plan.tier)}
            disabled={loading}
            className="group/btn relative w-full overflow-hidden py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-all duration-200 disabled:opacity-40 active:scale-[0.99]"
            style={
              "highlight" in plan && plan.highlight
                ? {
                    background: plan.accentColor,
                    color: "#000000",
                  }
                : {
                    border: `1px solid ${plan.accentColor}40`,
                    color: plan.accentColor,
                    background: "transparent",
                  }
            }
            onMouseEnter={(e) => {
              if (!("highlight" in plan && plan.highlight)) {
                (e.currentTarget as HTMLButtonElement).style.background = `${plan.accentColor}12`;
                (e.currentTarget as HTMLButtonElement).style.borderColor = `${plan.accentColor}80`;
              }
            }}
            onMouseLeave={(e) => {
              if (!("highlight" in plan && plan.highlight)) {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                (e.currentTarget as HTMLButtonElement).style.borderColor = `${plan.accentColor}40`;
              }
            }}
          >
            <span className="relative z-10">
              {loading ? "Redirecting…" : `Activate ${plan.name}`}
            </span>
            {/* Shimmer sweep */}
            {"highlight" in plan && plan.highlight && (
              <span className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover/btn:translate-x-[100%]" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Comparison table ─────────────────────────────────────────────────────────

const COMPARISON_ROWS = [
  { label: "Map & data layers",     s: "Full",        p: "Full",              e: "Full" },
  { label: "News & calendar",       s: "Unlimited",   p: "Unlimited",         e: "Unlimited" },
  { label: "Watchlist items",       s: "25",          p: "Unlimited",         e: "Unlimited" },
  { label: "Backtests / day",       s: "10",          p: "Unlimited",         e: "Unlimited" },
  { label: "Trade room hosting",    s: "—",           p: "✓",                 e: "✓" },
  { label: "Marketplace selling",   s: "—",           p: "80% rev share",     e: "80% rev share" },
  { label: "Marketplace buying",    s: "Full price",  p: "Full price",        e: "25% discount" },
  { label: "Verified badge",        s: "—",           p: "✓",                 e: "Auto" },
  { label: "API access",            s: "—",           p: "—",                 e: "✓" },
  { label: "Support",               s: "Priority",    p: "Priority",          e: "White-glove" },
];

function ComparisonTable({ plans }: { plans: typeof PLANS }) {
  return (
    <div className="mt-28">
      {/* Section label */}
      <div className="mb-10 flex items-center gap-4">
        <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
        <span className="text-[9px] font-bold uppercase tracking-[0.35em]" style={{ color: "rgba(255,255,255,0.2)" }}>
          Full Comparison
        </span>
        <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <th className="pb-5 text-left text-[10px] font-bold uppercase tracking-[0.2em] w-[38%]"
                style={{ color: "rgba(255,255,255,0.2)" }}>
                Feature
              </th>
              {plans.map((p) => (
                <th key={p.tier} className="pb-5 text-center text-[11px] font-black uppercase tracking-[0.15em]"
                  style={{ color: p.accentColor }}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row) => (
              <tr
                key={row.label}
                className="group/row transition-colors"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.015)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                }}
              >
                <td className="py-3.5 pl-2 text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {row.label}
                </td>
                {[row.s, row.p, row.e].map((val, ci) => (
                  <td key={ci} className="py-3.5 text-center text-[11px]"
                    style={{ color: val === "—" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.6)" }}>
                    {val === "✓" ? (
                      <span style={{ color: "#4ff98c" }}>✓</span>
                    ) : val}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [interval, setIntervalState] = useState<Interval>("month");
  const [loading, setLoading] = useState(false);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
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

  return (
    <div
      className="relative min-h-screen overflow-x-hidden"
      style={{ background: "#000000", color: "#ffffff" }}
    >
      {/* ── Keyframe styles ── */}
      <style>{`
        @keyframes aurora-shift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes aurora-pulse {
          0%, 100% { opacity: 0.55; transform: scaleY(1); }
          50%       { opacity: 0.85; transform: scaleY(1.08); }
        }
        @keyframes aurora-pulse-2 {
          0%, 100% { opacity: 0.3; }
          60%       { opacity: 0.55; }
        }
        @keyframes scanline-fall {
          0%   { background-position: 0 0; }
          100% { background-position: 0 64px; }
        }
      `}</style>

      {/* ── Scanline drift ── */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.007) 3px, rgba(255,255,255,0.007) 4px)",
          animation: "scanline-fall 16s linear infinite",
        }}
      />

      {/* ── Top edge neon line ── */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-px z-50"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, #e8846a 30%, #00e5ff 50%, #e8846a 70%, transparent 100%)",
          opacity: 0.7,
        }}
      />

      {/* ── Aurora layer 1 — wide horizontal sweep ── */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-0"
        style={{
          height: "55vh",
          background:
            "linear-gradient(135deg, rgba(232,132,106,0) 0%, rgba(232,132,106,0.12) 30%, rgba(0,229,255,0.09) 55%, rgba(232,132,106,0.06) 75%, rgba(232,132,106,0) 100%)",
          backgroundSize: "300% 300%",
          animation: "aurora-shift 20s ease-in-out infinite, aurora-pulse 12s ease-in-out infinite",
          filter: "blur(48px)",
        }}
      />

      {/* ── Aurora layer 2 — tighter, offset phase ── */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-0"
        style={{
          height: "40vh",
          background:
            "linear-gradient(110deg, rgba(0,229,255,0) 0%, rgba(0,229,255,0.07) 40%, rgba(120,80,255,0.05) 65%, rgba(0,229,255,0) 100%)",
          backgroundSize: "250% 250%",
          animation: "aurora-shift 28s ease-in-out infinite reverse, aurora-pulse-2 18s ease-in-out infinite",
          filter: "blur(64px)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-20 pb-32">

        {/* ── Header ── */}
        <div className="mb-20 text-center">

          {/* System identifier */}
          <div className="mb-10 flex items-center justify-center gap-4">
            <div className="h-px w-16" style={{ background: "rgba(232,132,106,0.35)" }} />
            <span
              className="text-[9px] font-bold uppercase tracking-[0.4em]"
              style={{ color: "rgba(232,132,106,0.7)" }}
            >
              QUANTIV // ACCESS TIERS
            </span>
            <div className="h-px w-16" style={{ background: "rgba(232,132,106,0.35)" }} />
          </div>

          {/* Headline */}
          <h1
            className="mb-6 font-extrabold tracking-[-0.02em]"
            style={{ fontSize: "clamp(46px, 8vw, 84px)", lineHeight: 1.05 }}
          >
            <span className="block text-white" style={{ lineHeight: 0.95 }}>Select</span>
            <span
              style={{
                background:
                  "linear-gradient(135deg, #ffffff 0%, #f0c4b8 40%, #e8846a 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                paddingBottom: "0.22em",
                paddingTop: "0.04em",
                display: "inline-block",
                lineHeight: 1.05,
              }}
            >
              your level.
            </span>
          </h1>

          <p
            className="text-[11px] tracking-[0.12em] font-medium"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            No free tier. No compromises. Pick the edge you deserve.
          </p>
        </div>

        {/* ── Interval toggle ── */}
        <div className="mb-14 flex justify-center">
          <div
            className="relative flex items-center"
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            {(["month", "year"] as const).map((iv) => (
              <button
                key={iv}
                onClick={() => setIntervalState(iv)}
                className="relative px-8 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-all duration-200"
                style={{
                  color: interval === iv ? "#000000" : "rgba(255,255,255,0.3)",
                  background:
                    interval === iv ? "#e8846a" : "transparent",
                  transition: "all 0.2s ease",
                }}
              >
                {iv === "year" ? "Annual" : "Monthly"}
                {iv === "year" && interval !== "year" && (
                  <span
                    className="absolute -right-4 -top-3 px-1.5 py-0.5 text-[8px] font-black"
                    style={{
                      background: "#4ff98c",
                      color: "#000000",
                    }}
                  >
                    −17%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Plan cards ── */}
        <div
          className="grid grid-cols-1 md:grid-cols-3"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {PLANS.map((plan, i) => (
            <PlanCard
              key={plan.tier}
              plan={plan}
              interval={interval}
              currentTier={currentTier}
              loading={loading && loadingTier === plan.tier}
              onSelect={handleSelect}
              index={i}
            />
          ))}
        </div>

        {/* ── Manage subscription ── */}
        {hasSubscription && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={handleManage}
              disabled={loading}
              className="text-[10px] font-bold uppercase tracking-[0.25em] transition-colors disabled:opacity-50"
              style={{ color: "rgba(255,255,255,0.2)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.2)";
              }}
            >
              Manage subscription / Cancel →
            </button>
          </div>
        )}

        {/* ── Comparison table ── */}
        <ComparisonTable plans={PLANS} />

        {/* ── Trust row ── */}
        <div
          className="mt-20 pt-8 flex flex-wrap items-center justify-center gap-10"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          {[
            "Stripe-secured payments",
            "Cancel anytime",
            "Instant access on activation",
            "No hidden fees",
          ].map((label) => (
            <span
              key={label}
              className="text-[10px] font-medium uppercase tracking-[0.15em]"
              style={{ color: "rgba(255,255,255,0.15)" }}
            >
              {label}
            </span>
          ))}
        </div>

      </div>
    </div>
  );
}
