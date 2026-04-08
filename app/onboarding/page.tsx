"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "../../components/AuthContext";
import { QuantivTradeLogoImage } from "../../components/XchangeLogoImage";
import { WelcomeAnimation } from "../../components/WelcomeAnimation";

const WELCOMED_KEY = "quantivtrade-welcomed";

const TOTAL_STEPS = 7;
const BG = "var(--app-bg)";
const ACCENT = "var(--accent-color)";

type Experience = "beginner" | "some" | "intermediate" | "advanced" | null;
type TimeHorizon = "short" | "medium" | "long" | "very-long" | null;
type RiskReaction = "sell-all" | "sell-some" | "hold" | "buy-more" | null;
type Goal = "save-big" | "grow-wealth" | "passive-income" | "maximize" | null;

const MARKET_TAGS = [
  "US Stocks", "Crypto", "Forex", "ETFs",
  "Commodities", "Options", "Real Estate", "International Markets",
] as const;

// ─── Personalised tips ────────────────────────────────────────────────────────

function getStartingTip(experience: Experience): { emoji: string; heading: string; body: string } {
  if (experience === "beginner") return {
    emoji: "🌱",
    heading: "Where to start",
    body: "Head to the Dashboard first. You'll see top market movers, a morning briefing, and trending ideas from other traders — no jargon, just what's happening.",
  };
  if (experience === "some") return {
    emoji: "📰",
    heading: "Your daily routine",
    body: "Open the News & Calendar each morning to catch macro events. Pair it with the Market Map to see which sectors are reacting — a 5-minute habit that keeps you sharp.",
  };
  return {
    emoji: "⚡",
    heading: "Power up your workflow",
    body: "Set up your Watchlist, run a Backtest on your strategy, and follow analysts in Communities whose reasoning you trust. The DataHub has deep historical data when you need it.",
  };
}

function getGoalTip(goal: Goal): { emoji: string; heading: string; body: string } {
  if (goal === "save-big") return {
    emoji: "🏠",
    heading: "Saving for a goal",
    body: "Use the Screener to filter for low-volatility ETFs and dividend stocks. Consistency beats timing — small, regular positions add up fast.",
  };
  if (goal === "passive-income") return {
    emoji: "💸",
    heading: "Building passive income",
    body: "The Portfolios section surfaces dividend-focused and income-generating ideas. Watch for yield and payout consistency, not just price movement.",
  };
  if (goal === "maximize") return {
    emoji: "🚀",
    heading: "Chasing maximum returns",
    body: "The Futures and Crypto sections carry the highest upside — and the highest risk. Use Backtesting to pressure-test your ideas before sizing up.",
  };
  return {
    emoji: "📈",
    heading: "Growing your wealth",
    body: "Follow high-conviction traders in Communities to see how they think, not just what they buy. Combine that with the Market Relations chart to stay ahead of macro shifts.",
  };
}

// ─── Step 7: Breakdown card ───────────────────────────────────────────────────

function BreakdownStep({
  experience, goal, marketInterests, isSignedIn, authLoading,
  onEnter,
}: {
  experience: Experience;
  goal: Goal;
  marketInterests: string[];
  isSignedIn: boolean;
  authLoading: boolean;
  onEnter: () => void;
}) {
  const startTip = getStartingTip(experience);
  const goalTip = getGoalTip(goal);
  const topMarkets = marketInterests.slice(0, 4);

  const tips = [startTip, goalTip];

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-50">
        Here&apos;s your personal roadmap.
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        Based on your answers, here&apos;s how to get the most out of QuantivTrade.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        {tips.map((tip) => (
          <div
            key={tip.heading}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{tip.emoji}</span>
              <p className="font-semibold text-zinc-100 text-sm">{tip.heading}</p>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">{tip.body}</p>
          </div>
        ))}

        {topMarkets.length > 0 && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🎯</span>
              <p className="font-semibold text-zinc-100 text-sm">Your selected markets</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {topMarkets.map((m) => (
                <span
                  key={m}
                  className="rounded-full border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/10 px-3 py-1 text-xs font-medium text-[var(--accent-color)]"
                >
                  {m}
                </span>
              ))}
              {marketInterests.length > 4 && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-400">
                  +{marketInterests.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onEnter}
        disabled={authLoading}
        className="mt-10 w-full rounded-full py-3.5 text-base font-semibold text-[#020308] transition-all duration-200 hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: ACCENT }}
      >
        {authLoading ? "Loading…" : isSignedIn ? "Enter QuantivTrade →" : "Create your account →"}
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { user, authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [experience, setExperience] = useState<Experience>(null);
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>(null);
  const [riskReaction, setRiskReaction] = useState<RiskReaction>(null);
  const [goal, setGoal] = useState<Goal>(null);
  const [marketInterests, setMarketInterests] = useState<string[]>([]);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [showWelcomeAnimation, setShowWelcomeAnimation] = useState(false);

  const progress = (step / TOTAL_STEPS) * 100;

  const goNext = () => { setDirection("next"); setStep((s) => Math.min(s + 1, TOTAL_STEPS)); };
  const goBack = () => { setDirection("prev"); setStep((s) => Math.max(s - 1, 1)); };
  const toggleMarket = (tag: string) => {
    setMarketInterests((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const handleEnter = () => {
    // Already signed in — go straight to the app, no animation needed
    if (user) {
      router.push("/feed");
      return;
    }
    // Not signed in — show the welcome animation, then go to sign-up
    if (typeof window !== "undefined" && window.localStorage.getItem(WELCOMED_KEY)) {
      router.push("/auth/sign-up?from=onboarding");
      return;
    }
    setShowWelcomeAnimation(true);
  };

  const handleWelcomeComplete = () => {
    if (typeof window !== "undefined") window.localStorage.setItem(WELCOMED_KEY, "1");
    router.push("/auth/sign-up?from=onboarding");
  };

  const canProceedStep2 = experience !== null;
  const canProceedStep3 = timeHorizon !== null;
  const canProceedStep4 = riskReaction !== null;
  const canProceedStep5 = goal !== null;
  const canProceedStep6 = marketInterests.length >= 1;

  if (showWelcomeAnimation) {
    return <WelcomeAnimation onComplete={handleWelcomeComplete} />;
  }

  const BackBtn = () => (
    <button type="button" onClick={goBack}
      className="mb-6 self-start rounded-full p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
      aria-label="Back">
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  );

  return (
    <div className="min-h-screen text-zinc-100" style={{ backgroundColor: BG }}>
      {/* Progress bar */}
      <div className="fixed left-0 right-0 top-0 z-10 h-1 bg-white/5">
        <div className="h-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%`, backgroundColor: ACCENT }} />
      </div>

      <div className="mx-auto flex min-h-screen max-w-[600px] flex-col px-6 pt-12 pb-16">
        <div key={step}
          className={`flex flex-1 flex-col ${direction === "next" ? "onboarding-step-enter" : "onboarding-step-enter-prev"}`}>

          {/* ── Step 1: Welcome ── */}
          {step === 1 && (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center">
                <QuantivTradeLogoImage size={58} />
              </div>
              <span className="mt-4 text-2xl font-semibold tracking-tight text-[var(--accent-color)]">QuantivTrade</span>
              <h1 className="mt-10 text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
                Let&apos;s build your investor profile
              </h1>
              <p className="mt-4 max-w-md text-base text-zinc-400">
                5 quick questions. No wrong answers. We&apos;ll personalize everything to match how you think.
              </p>
              <button type="button" onClick={goNext}
                className="mt-12 rounded-full px-10 py-4 text-lg font-semibold text-[#020308] transition-all duration-200 hover:opacity-90"
                style={{ backgroundColor: ACCENT }}>
                Let&apos;s go
              </button>
            </div>
          )}

          {/* ── Step 2: Experience ── */}
          {step === 2 && (
            <>
              <BackBtn />
              <h2 className="text-2xl font-bold tracking-tight text-zinc-50">
                How would you describe your investing experience?
              </h2>
              <div className="mt-8 grid gap-4">
                {[
                  { id: "beginner" as const, icon: "🌱", title: "Complete Beginner", sub: "I'm just getting started" },
                  { id: "some" as const, icon: "📚", title: "Some Knowledge", sub: "I understand the basics" },
                  { id: "intermediate" as const, icon: "📊", title: "Intermediate", sub: "I follow markets regularly" },
                  { id: "advanced" as const, icon: "⚡", title: "Advanced", sub: "I trade actively and understand risk" },
                ].map((opt) => (
                  <button key={opt.id} type="button" onClick={() => setExperience(opt.id)}
                    className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 ${experience === opt.id ? "border-[var(--accent-color)]/60 bg-[var(--accent-color)]/10" : "border-white/10 bg-white/5 hover:border-white/20"}`}>
                    <span className="text-2xl">{opt.icon}</span>
                    <div><p className="font-semibold text-zinc-100">{opt.title}</p><p className="text-sm text-zinc-400">{opt.sub}</p></div>
                  </button>
                ))}
              </div>
              <button type="button" onClick={goNext} disabled={!canProceedStep2}
                className="mt-10 w-full rounded-full py-3.5 font-semibold text-[#020308] transition-all disabled:opacity-40"
                style={{ backgroundColor: canProceedStep2 ? ACCENT : "#334155" }}>Next</button>
            </>
          )}

          {/* ── Step 3: Time horizon ── */}
          {step === 3 && (
            <>
              <BackBtn />
              <h2 className="text-2xl font-bold tracking-tight text-zinc-50">
                How long are you planning to invest for?
              </h2>
              <div className="mt-8 grid gap-4">
                {[
                  { id: "short" as const, title: "Short Term", sub: "Under 1 year" },
                  { id: "medium" as const, title: "Medium Term", sub: "1–3 years" },
                  { id: "long" as const, title: "Long Term", sub: "3–10 years" },
                  { id: "very-long" as const, title: "Very Long Term", sub: "10+ years" },
                ].map((opt) => (
                  <button key={opt.id} type="button" onClick={() => setTimeHorizon(opt.id)}
                    className={`rounded-2xl border p-4 text-left transition-all duration-200 ${timeHorizon === opt.id ? "border-[var(--accent-color)]/60 bg-[var(--accent-color)]/10" : "border-white/10 bg-white/5 hover:border-white/20"}`}>
                    <p className="font-semibold text-zinc-100">{opt.title}</p>
                    <p className="text-sm text-zinc-400">{opt.sub}</p>
                  </button>
                ))}
              </div>
              <button type="button" onClick={goNext} disabled={!canProceedStep3}
                className="mt-10 w-full rounded-full py-3.5 font-semibold text-[#020308] transition-all disabled:opacity-40"
                style={{ backgroundColor: canProceedStep3 ? ACCENT : "#334155" }}>Next</button>
            </>
          )}

          {/* ── Step 4: Risk reaction ── */}
          {step === 4 && (
            <>
              <BackBtn />
              <h2 className="text-2xl font-bold tracking-tight text-zinc-50">
                If your portfolio dropped 20% in a month, what would you do?
              </h2>
              <div className="mt-8 grid gap-4">
                {[
                  { id: "sell-all" as const, icon: "😰", title: "Sell everything", sub: "I can't handle that loss" },
                  { id: "sell-some" as const, icon: "😟", title: "Sell some", sub: "Reduce my exposure" },
                  { id: "hold" as const, icon: "😐", title: "Hold", sub: "Stick to my plan" },
                  { id: "buy-more" as const, icon: "😎", title: "Buy more", sub: "It's a discount" },
                ].map((opt) => (
                  <button key={opt.id} type="button" onClick={() => setRiskReaction(opt.id)}
                    className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 ${riskReaction === opt.id ? "border-[var(--accent-color)]/60 bg-[var(--accent-color)]/10" : "border-white/10 bg-white/5 hover:border-white/20"}`}>
                    <span className="text-2xl">{opt.icon}</span>
                    <div><p className="font-semibold text-zinc-100">{opt.title}</p><p className="text-sm text-zinc-400">{opt.sub}</p></div>
                  </button>
                ))}
              </div>
              <button type="button" onClick={goNext} disabled={!canProceedStep4}
                className="mt-10 w-full rounded-full py-3.5 font-semibold text-[#020308] transition-all disabled:opacity-40"
                style={{ backgroundColor: canProceedStep4 ? ACCENT : "#334155" }}>Next</button>
            </>
          )}

          {/* ── Step 5: Goal ── */}
          {step === 5 && (
            <>
              <BackBtn />
              <h2 className="text-2xl font-bold tracking-tight text-zinc-50">
                What&apos;s your main investing goal?
              </h2>
              <div className="mt-8 grid gap-4">
                {[
                  { id: "save-big" as const, icon: "🏠", title: "Save for something big", sub: "House, car, tuition" },
                  { id: "grow-wealth" as const, icon: "📈", title: "Grow my wealth over time", sub: "" },
                  { id: "passive-income" as const, icon: "💸", title: "Generate passive income", sub: "" },
                  { id: "maximize" as const, icon: "🚀", title: "Maximize returns", sub: "I accept high risk" },
                ].map((opt) => (
                  <button key={opt.id} type="button" onClick={() => setGoal(opt.id)}
                    className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 ${goal === opt.id ? "border-[var(--accent-color)]/60 bg-[var(--accent-color)]/10" : "border-white/10 bg-white/5 hover:border-white/20"}`}>
                    <span className="text-2xl">{opt.icon}</span>
                    <div><p className="font-semibold text-zinc-100">{opt.title}</p>{opt.sub && <p className="text-sm text-zinc-400">{opt.sub}</p>}</div>
                  </button>
                ))}
              </div>
              <button type="button" onClick={goNext} disabled={!canProceedStep5}
                className="mt-10 w-full rounded-full py-3.5 font-semibold text-[#020308] transition-all disabled:opacity-40"
                style={{ backgroundColor: canProceedStep5 ? ACCENT : "#334155" }}>Next</button>
            </>
          )}

          {/* ── Step 6: Market interests ── */}
          {step === 6 && (
            <>
              <BackBtn />
              <h2 className="text-2xl font-bold tracking-tight text-zinc-50">
                What markets interest you?
              </h2>
              <p className="mt-2 text-sm text-zinc-400">Select all that apply (at least one)</p>
              <div className="mt-6 flex flex-wrap gap-3">
                {MARKET_TAGS.map((tag) => (
                  <button key={tag} type="button" onClick={() => toggleMarket(tag)}
                    className={`rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-200 ${marketInterests.includes(tag) ? "border-[var(--accent-color)]/60 bg-[var(--accent-color)]/10 text-[var(--accent-color)]" : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/20"}`}>
                    {tag}
                  </button>
                ))}
              </div>
              <button type="button" onClick={goNext} disabled={!canProceedStep6}
                className="mt-10 w-full rounded-full py-3.5 font-semibold text-[#020308] transition-all disabled:opacity-40"
                style={{ backgroundColor: canProceedStep6 ? ACCENT : "#334155" }}>
                See my results
              </button>
            </>
          )}

          {/* ── Step 7: Personalised breakdown ── */}
          {step === 7 && (
            <BreakdownStep
              experience={experience}
              goal={goal}
              marketInterests={marketInterests}
              isSignedIn={!authLoading && !!user}
              authLoading={authLoading}
              onEnter={handleEnter}
            />
          )}

        </div>
      </div>
    </div>
  );
}
