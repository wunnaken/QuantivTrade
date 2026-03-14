"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "../../components/AuthContext";
import { XchangeLogoImage } from "../../components/XchangeLogoImage";
import { WelcomeAnimation } from "../../components/WelcomeAnimation";

const WELCOMED_KEY = "xchange-welcomed";

const TOTAL_STEPS = 7;
const BG = "#0A0E1A";
const ACCENT = "var(--accent-color)";

type Experience = "beginner" | "some" | "intermediate" | "advanced" | null;
type TimeHorizon = "short" | "medium" | "long" | "very-long" | null;
type RiskReaction = "sell-all" | "sell-some" | "hold" | "buy-more" | null;
type Goal = "save-big" | "grow-wealth" | "passive-income" | "maximize" | null;

const MARKET_TAGS = [
  "US Stocks",
  "Crypto",
  "Forex",
  "ETFs",
  "Commodities",
  "Options",
  "Real Estate",
  "International Markets",
] as const;

type ProfileType = "conservative" | "moderate" | "aggressive";

const PROFILES: Record<
  ProfileType,
  { name: string; badge: string; description: string; assets: string[]; badgeColor: string }
> = {
  conservative: {
    name: "Conservative",
    badge: "Safe Harbor",
    description: "You prefer stability and capital preservation. We'll focus on lower-volatility ideas and risk-aware content.",
    assets: ["Bonds", "Dividend stocks", "Index funds", "Cash equivalents"],
    badgeColor: "bg-[var(--accent-color)]/20 text-[var(--accent-color)] border-[var(--accent-color)]/40",
  },
  moderate: {
    name: "Moderate",
    badge: "Balanced Growth",
    description: "You're looking for a balance of growth and stability. We'll mix core holdings with selective opportunities.",
    assets: ["ETFs", "Blue chips", "Sector funds", "Some bonds"],
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-400/40",
  },
  aggressive: {
    name: "Aggressive",
    badge: "High Voltage",
    description: "You're comfortable with volatility and chasing higher returns. We'll surface momentum and higher-conviction ideas.",
    assets: ["Growth stocks", "Crypto", "Options", "Leveraged ETFs"],
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-400/40",
  },
};

function getProfile(
  experience: Experience,
  riskReaction: RiskReaction,
  goal: Goal
): ProfileType {
  let score = 0;
  // Experience: 0–3
  if (experience === "beginner") score += 0;
  else if (experience === "some") score += 1;
  else if (experience === "intermediate") score += 2;
  else if (experience === "advanced") score += 3;
  // Risk: 0–3
  if (riskReaction === "sell-all") score += 0;
  else if (riskReaction === "sell-some") score += 1;
  else if (riskReaction === "hold") score += 2;
  else if (riskReaction === "buy-more") score += 3;
  // Goal: 0–3
  if (goal === "save-big") score += 0;
  else if (goal === "grow-wealth") score += 1;
  else if (goal === "passive-income") score += 1;
  else if (goal === "maximize") score += 3;
  // Max 9; 0–2 conservative, 3–6 moderate, 7–9 aggressive
  if (score <= 2) return "conservative";
  if (score >= 7) return "aggressive";
  return "moderate";
}

export default function OnboardingPage() {
  const router = useRouter();
  const { updateProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [experience, setExperience] = useState<Experience>(null);
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>(null);
  const [riskReaction, setRiskReaction] = useState<RiskReaction>(null);
  const [goal, setGoal] = useState<Goal>(null);
  const [marketInterests, setMarketInterests] = useState<string[]>([]);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [showWelcomeAnimation, setShowWelcomeAnimation] = useState(false);

  const progress = (step / TOTAL_STEPS) * 100;

  const goNext = () => {
    setDirection("next");
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const goBack = () => {
    setDirection("prev");
    setStep((s) => Math.max(s - 1, 1));
  };

  const toggleMarket = (tag: string) => {
    setMarketInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleFinish = () => {
    const profile = getProfile(experience, riskReaction, goal);
    const riskMap: Record<ProfileType, "passive" | "moderate" | "aggressive"> = {
      conservative: "passive",
      moderate: "moderate",
      aggressive: "aggressive",
    };
    updateProfile({ riskProfile: riskMap[profile] });
    if (typeof window !== "undefined" && window.localStorage.getItem(WELCOMED_KEY)) {
      router.push("/feed");
      return;
    }
    setShowWelcomeAnimation(true);
  };

  const handleWelcomeComplete = () => {
    if (typeof window !== "undefined") window.localStorage.setItem(WELCOMED_KEY, "1");
    router.push("/feed");
  };

  const canProceedStep2 = experience !== null;
  const canProceedStep3 = timeHorizon !== null;
  const canProceedStep4 = riskReaction !== null;
  const canProceedStep5 = goal !== null;
  const canProceedStep6 = marketInterests.length >= 1;

  if (showWelcomeAnimation) {
    return <WelcomeAnimation onComplete={handleWelcomeComplete} />;
  }

  return (
    <div
      className="min-h-screen text-zinc-100 font-[&quot;Times_New_Roman&quot;,serif]"
      style={{ backgroundColor: BG }}
    >
      {/* Progress bar */}
      <div className="fixed left-0 right-0 top-0 z-10 h-1 bg-white/5">
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%`, backgroundColor: ACCENT }}
        />
      </div>

      <div className="mx-auto flex min-h-screen max-w-[600px] flex-col px-6 pt-12 pb-16">
        {/* Step content with fade/slide */}
        <div
          key={step}
          className={`flex flex-1 flex-col ${direction === "next" ? "onboarding-step-enter" : "onboarding-step-enter-prev"}`}
        >
          {step === 1 && (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center">
                <XchangeLogoImage size={58} />
              </div>
              <span className="mt-4 text-2xl font-semibold tracking-tight text-[var(--accent-color)]">Xchange</span>
              <h1 className="mt-10 text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
                Let&apos;s build your investor profile
              </h1>
              <p className="mt-4 max-w-md text-base text-zinc-400">
                5 quick questions. No wrong answers. We&apos;ll personalize everything to match how you think.
              </p>
              <button
                type="button"
                onClick={goNext}
                className="mt-12 rounded-full px-10 py-4 text-lg font-semibold text-[#020308] transition-all duration-200 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2 focus:ring-offset-[#0A0E1A]"
                style={{ backgroundColor: ACCENT }}
              >
                Let&apos;s go
              </button>
            </div>
          )}

          {step === 2 && (
            <>
              {step > 1 && (
                <button
                  type="button"
                  onClick={goBack}
                  className="mb-6 self-start rounded-full p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
                  aria-label="Back"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
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
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setExperience(opt.id)}
                    className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 ${
                      experience === opt.id
                        ? "border-[var(--accent-color)]/60 bg-[var(--accent-color)]/10 shadow-[0_0_30px_rgba(0,200,150,0.15)]"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    }`}
                  >
                    <span className="text-2xl">{opt.icon}</span>
                    <div>
                      <p className="font-semibold text-zinc-100">{opt.title}</p>
                      <p className="text-sm text-zinc-400">{opt.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={goNext}
                disabled={!canProceedStep2}
                className="mt-10 w-full rounded-full py-3.5 font-semibold text-[#020308] transition-all disabled:opacity-40"
                style={{ backgroundColor: canProceedStep2 ? ACCENT : "#334155" }}
              >
                Next
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <button
                type="button"
                onClick={goBack}
                className="mb-6 self-start rounded-full p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
                aria-label="Back"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
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
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTimeHorizon(opt.id)}
                    className={`rounded-2xl border p-4 text-left transition-all duration-200 ${
                      timeHorizon === opt.id
                        ? "border-[var(--accent-color)]/60 bg-[var(--accent-color)]/10 shadow-[0_0_30px_rgba(0,200,150,0.15)]"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    }`}
                  >
                    <p className="font-semibold text-zinc-100">{opt.title}</p>
                    <p className="text-sm text-zinc-400">{opt.sub}</p>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={goNext}
                disabled={!canProceedStep3}
                className="mt-10 w-full rounded-full py-3.5 font-semibold text-[#020308] transition-all disabled:opacity-40"
                style={{ backgroundColor: canProceedStep3 ? ACCENT : "#334155" }}
              >
                Next
              </button>
            </>
          )}

          {step === 4 && (
            <>
              <button
                type="button"
                onClick={goBack}
                className="mb-6 self-start rounded-full p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
                aria-label="Back"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
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
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRiskReaction(opt.id)}
                    className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 ${
                      riskReaction === opt.id
                        ? "border-[var(--accent-color)]/60 bg-[var(--accent-color)]/10 shadow-[0_0_30px_rgba(0,200,150,0.15)]"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    }`}
                  >
                    <span className="text-2xl">{opt.icon}</span>
                    <div>
                      <p className="font-semibold text-zinc-100">{opt.title}</p>
                      <p className="text-sm text-zinc-400">{opt.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={goNext}
                disabled={!canProceedStep4}
                className="mt-10 w-full rounded-full py-3.5 font-semibold text-[#020308] transition-all disabled:opacity-40"
                style={{ backgroundColor: canProceedStep4 ? ACCENT : "#334155" }}
              >
                Next
              </button>
            </>
          )}

          {step === 5 && (
            <>
              <button
                type="button"
                onClick={goBack}
                className="mb-6 self-start rounded-full p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
                aria-label="Back"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
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
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setGoal(opt.id)}
                    className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 ${
                      goal === opt.id
                        ? "border-[var(--accent-color)]/60 bg-[var(--accent-color)]/10 shadow-[0_0_30px_rgba(0,200,150,0.15)]"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    }`}
                  >
                    <span className="text-2xl">{opt.icon}</span>
                    <div>
                      <p className="font-semibold text-zinc-100">{opt.title}</p>
                      {opt.sub && <p className="text-sm text-zinc-400">{opt.sub}</p>}
                    </div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={goNext}
                disabled={!canProceedStep5}
                className="mt-10 w-full rounded-full py-3.5 font-semibold text-[#020308] transition-all disabled:opacity-40"
                style={{ backgroundColor: canProceedStep5 ? ACCENT : "#334155" }}
              >
                Next
              </button>
            </>
          )}

          {step === 6 && (
            <>
              <button
                type="button"
                onClick={goBack}
                className="mb-6 self-start rounded-full p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
                aria-label="Back"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-50">
                What markets interest you?
              </h2>
              <p className="mt-2 text-sm text-zinc-400">Select all that apply (at least one)</p>
              <div className="mt-6 flex flex-wrap gap-3">
                {MARKET_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleMarket(tag)}
                    className={`rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                      marketInterests.includes(tag)
                        ? "border-[var(--accent-color)]/60 bg-[var(--accent-color)]/10 text-[var(--accent-color)]"
                        : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/20"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={goNext}
                disabled={!canProceedStep6}
                className="mt-10 w-full rounded-full py-3.5 font-semibold text-[#020308] transition-all disabled:opacity-40"
                style={{ backgroundColor: canProceedStep6 ? ACCENT : "#334155" }}
              >
                Next
              </button>
            </>
          )}

          {step === 7 && (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <h1 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
                Your profile is ready.
              </h1>
              {(() => {
                const profileType = getProfile(experience, riskReaction, goal);
                const p = PROFILES[profileType];
                return (
                  <div className="mt-8 w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
                    <span
                      className={`inline-block rounded-full border px-3 py-1 text-sm font-medium ${p.badgeColor}`}
                    >
                      {p.name} · {p.badge}
                    </span>
                    <p className="mt-4 text-sm text-zinc-300">{p.description}</p>
                    <p className="mt-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Example focus
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">{p.assets.join(", ")}</p>
                  </div>
                );
              })()}
              <button
                type="button"
                onClick={handleFinish}
                className="mt-10 rounded-full px-10 py-4 text-lg font-semibold text-[#020308] transition-all duration-200 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2 focus:ring-offset-[#0A0E1A]"
                style={{ backgroundColor: ACCENT }}
              >
                Enter Xchange
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
