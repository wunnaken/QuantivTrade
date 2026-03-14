"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../components/AuthContext";

type ProfileKey = "passive" | "moderate" | "aggressive";

const PROFILE_CONFIG: Record<ProfileKey, { label: string; years: number; annualReturn: number; instruments: string[] }> = {
  passive: {
    label: "Passive · Long Term",
    years: 10,
    annualReturn: 0.06,
    instruments: ["SPY", "Total Market ETF", "Investment-Grade Bonds", "Gold"],
  },
  moderate: {
    label: "Moderate · Medium Term",
    years: 7,
    annualReturn: 0.09,
    instruments: ["SPY", "QQQ", "Sector ETFs", "Gold"],
  },
  aggressive: {
    label: "Aggressive · Short Term",
    years: 3,
    annualReturn: 0.14,
    instruments: ["QQQ", "High-Beta Stocks", "Futures", "Thematic ETFs"],
  },
};

export default function ProfilesPage() {
  const { user, updateProfile } = useAuth();
  const router = useRouter();
  const [selectedProfile, setSelectedProfile] = useState<ProfileKey>(
    (user?.riskProfile as ProfileKey) ?? "passive"
  );
  const MONTHLY_CONTRIBUTION = 400;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    const key = user?.riskProfile;
    if (key === "passive" || key === "moderate" || key === "aggressive")
      queueMicrotask(() => setSelectedProfile(key));
  }, [user?.riskProfile]);

  const config = PROFILE_CONFIG[selectedProfile];

  const { growth, savings } = useMemo(() => {
    const months = config.years * 12;
    const monthlyRate = config.annualReturn / 12;
    const savingsRate = 0.02 / 12; // simple savings account assumption (2%/yr)

    const growthValues: number[] = [];
    const savingsValues: number[] = [];

    let growthBalance = 0;
    let savingsBalance = 0;

    for (let m = 1; m <= months; m++) {
      growthBalance = growthBalance * (1 + monthlyRate) + MONTHLY_CONTRIBUTION;
      savingsBalance = savingsBalance * (1 + savingsRate) + MONTHLY_CONTRIBUTION;
      if (m % 12 === 0) {
        growthValues.push(growthBalance);
        savingsValues.push(savingsBalance);
      }
    }
    return { growth: growthValues, savings: savingsValues };
  }, [config.years, config.annualReturn, MONTHLY_CONTRIBUTION]);

  const maxValue = Math.max(...growth, ...savings, 1);

  return (
    <div className="min-h-screen app-page font-[&quot;Times_New_Roman&quot;,serif]">
      <div className="mx-auto max-w-5xl px-6 py-12 lg:px-8 lg:py-16">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-[#11c60f]/80">
            Growth Profiles
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Choose how you grow in the markets.
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-zinc-400 sm:text-base">
            Each profile balances potential return and risk differently. Use
            these as starting points only — they are{" "}
            <span className="font-semibold text-zinc-300">
              not financial advice
            </span>{" "}
            and carry real-world risk, including loss of capital.
          </p>
        </div>

        <p className="mb-8 text-[11px] text-zinc-400 sm:text-xs">
          Younger investors with long time horizons often lean toward{" "}
          <span className="text-emerald-300">Passive</span> or{" "}
          <span className="text-cyan-300">Moderate</span> profiles, while those
          closer to major goals or retirement are more likely to prefer{" "}
          <span className="text-emerald-300">Passive</span>. The{" "}
          <span className="text-amber-300">Aggressive</span> profile tends to
          fit a smaller group of experienced traders who are very comfortable
          with large swings in account value.
        </p>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Passive, long term */}
          <section
            className={`relative flex cursor-pointer flex-col rounded-2xl border  p-5 shadow-[0_0_35px_rgba(34,197,94,0.35)] transition ${
              selectedProfile === "passive"
                ? "border-[#11c60f]/80 bg-white/10"
                : "border-white/5 bg-white/5 hover:border-[#11c60f]/70"
            }`}
            onClick={() => setSelectedProfile("passive")}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-zinc-50">
                  Passive · Long Term
                </h2>
                <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/80">
                  7–10+ year horizon
                </p>
              </div>
              <div className="group relative mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-500/70 text-[11px] text-zinc-200">
                i
                <div className="pointer-events-none absolute left-1/2 top-7 z-10 hidden w-40 -translate-x-1/2 rounded-md border border-white/10 bg-black/90 px-2 py-1 text-[10px] leading-snug text-zinc-200 group-hover:block">
                  Lower likelihood of large capital loss, but downturns can still
                  hurt if you sell early.
                </div>
              </div>
            </div>
            <p className="text-xs text-zinc-400">
              Focused on diversified, broad-market exposure (like index funds
              and high-quality bonds) with lower volatility and slower but
              steadier growth expectations.
            </p>
            <p className="mt-3 text-[11px] text-amber-300/90">
              Risk: market downturns can still cause significant temporary
              losses. Requires patience and the ability to stay invested through
              cycles.
            </p>
          </section>

          {/* Moderate, average time */}
          <section
            className={`relative flex cursor-pointer flex-col rounded-2xl border  p-5 shadow-[0_0_35px_rgba(56,189,248,0.32)] transition ${
              selectedProfile === "moderate"
                ? "border-cyan-300/80 bg-white/10"
                : "border-white/5 bg-white/[0.04] hover:border-cyan-300/70"
            }`}
            onClick={() => setSelectedProfile("moderate")}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-zinc-50">
                  Moderate · Medium Term
                </h2>
                <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/80">
                  3–7 year horizon
                </p>
              </div>
              <div className="group relative mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-500/70 text-[11px] text-zinc-200">
                i
                <div className="pointer-events-none absolute left-1/2 top-7 z-10 hidden w-40 -translate-x-1/2 rounded-md border border-white/10 bg-black/90 px-2 py-1 text-[10px] leading-snug text-zinc-200 group-hover:block">
                  Moderate chance of capital loss, especially in concentrated
                  themes or shorter holding periods.
                </div>
              </div>
            </div>
            <p className="text-xs text-zinc-400">
              Mix of diversified core holdings plus selected growth or sector
              ideas. Aims to balance drawdowns with the potential for
              above-market returns.
            </p>
            <p className="mt-3 text-[11px] text-amber-300/90">
              Risk: deeper swings than passive; concentration in themes or
              sectors can amplify losses if narratives reverse.
            </p>
          </section>

          {/* Risky, short term */}
          <section
            className={`relative flex cursor-pointer flex-col rounded-2xl border bg-[#0b0507] p-5 shadow-[0_0_40px_rgba(248,113,113,0.65)] transition ${
              selectedProfile === "aggressive"
                ? "border-red-400/80"
                : "border-[#ef4444]/40 hover:border-red-400/80"
            }`}
            onClick={() => setSelectedProfile("aggressive")}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-zinc-50">
                  Aggressive · Short Term
                </h2>
                <p className="text-[11px] uppercase tracking-[0.18em] text-rose-300/80">
                  Days–2 year horizon
                </p>
              </div>
              <div className="group relative mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-rose-400/80 text-[11px] text-rose-100">
                i
                <div className="pointer-events-none absolute left-1/2 top-7 z-10 hidden w-40 -translate-x-1/2 rounded-md border border-rose-400/40 bg-black/90 px-2 py-1 text-[10px] leading-snug text-rose-50 group-hover:block">
                  Very high chance of sharp drawdowns and permanent loss of
                  capital. Only for money you can afford to lose.
                </div>
              </div>
            </div>
            <p className="text-xs text-zinc-300">
              Targets fast moves using concentrated positions, high-beta names,
              or leverage. Suitable only for experienced traders comfortable
              with rapid swings.
            </p>
            <p className="mt-3 text-[11px] text-amber-300/90">
              Risk: high probability of sharp drawdowns and permanent capital
              loss. Never allocate money you cannot afford to lose.
            </p>
          </section>
        </div>

        {user && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => {
                updateProfile({ riskProfile: selectedProfile });
                router.push("/profile");
              }}
              className="rounded-full bg-[#11c60f] px-5 py-2 text-xs font-semibold text-[#020308] shadow-lg shadow-[#11c60f]/40 transition hover:bg-[#13e211]"
            >
              Save &quot;{config.label}&quot; to my profile
            </button>
          </div>
        )}

        {/* Projection controls + simple chart */}
        <section className="mt-10 rounded-2xl border border-white/5 bg-black/30 p-5">
          <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#11c60f]/80">
                Projection
              </p>
              <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">
                {config.label} – {config.years} year example path
              </h2>
              <p className="mt-1 text-[11px] text-zinc-400">
                Based on a fixed{" "}
                <span className="font-semibold text-zinc-200">
                  $400/month contribution
                </span>{" "}
                and a simplified average annual return. Real markets are more
                volatile.
              </p>
            </div>
            <div className="text-right text-[11px] text-zinc-300">
              <p>
                Yearly contribution:{" "}
                <span className="font-semibold text-zinc-100">
                  $
                  {(MONTHLY_CONTRIBUTION * 12).toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </span>
              </p>
              <p className="mt-1">
                Final profile balance:{" "}
                <span className="font-semibold text-zinc-100">
                  $
                  {growth.length
                    ? growth[growth.length - 1].toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })
                    : "0"}
                </span>
              </p>
              <p className="mt-1 text-zinc-400">
                Final savings balance:{" "}
                <span className="font-semibold text-zinc-200">
                  $
                  {savings.length
                    ? savings[savings.length - 1].toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })
                    : "0"}
                </span>
              </p>
            </div>
          </header>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-400">
            <div>
              <span className="font-medium text-zinc-200">Example mix: </span>
              <span>{config.instruments.join(" · ")}</span>
            </div>
            <div>
              <span className="font-medium text-zinc-200">
                Approx. annualised return:
              </span>{" "}
              <span>{Math.round(config.annualReturn * 100)}%</span>
            </div>
          </div>

          {/* Simple line chart with growth vs savings */}
          <div className="mt-4 rounded-xl border border-white/5 bg-gradient-to-t from-slate-950 via-slate-900 to-slate-800 px-4 py-4">
            <div
              className="relative h-56 w-full"
              onMouseLeave={() => setHoverIndex(null)}
            >
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="h-full w-full text-xs text-zinc-500"
              >
                {/* Grid lines */}
                <line
                  x1="0"
                  y1="0"
                  x2="100"
                  y2="0"
                  stroke="rgba(148,163,184,0.25)"
                  strokeWidth="0.3"
                />
                <line
                  x1="0"
                  y1="50"
                  x2="100"
                  y2="50"
                  stroke="rgba(148,163,184,0.18)"
                  strokeWidth="0.3"
                />
                <line
                  x1="0"
                  y1="100"
                  x2="100"
                  y2="100"
                  stroke="rgba(148,163,184,0.35)"
                  strokeWidth="0.4"
                />

                {growth.length > 1 && (
                  <>
                    {/* Savings line */}
                    <polyline
                      fill="none"
                      stroke="rgba(250,250,250,0.6)"
                      strokeWidth="0.8"
                      points={savings
                        .map((value, index) => {
                          const x =
                            (index / (growth.length - 1 || 1)) * 100;
                          const y = 100 - (value / maxValue) * 100;
                          return `${x},${isFinite(y) ? y : 100}`;
                        })
                        .join(" ")}
                    />
                    {/* Growth line */}
                    <polyline
                      fill="none"
                      stroke={
                        selectedProfile === "passive"
                          ? "rgb(34,197,94)"
                          : selectedProfile === "moderate"
                          ? "rgb(56,189,248)"
                          : "rgb(250,204,21)"
                      }
                      strokeWidth="1.2"
                      points={growth
                        .map((value, index) => {
                          const x =
                            (index / (growth.length - 1 || 1)) * 100;
                          const y = 100 - (value / maxValue) * 100;
                          return `${x},${isFinite(y) ? y : 100}`;
                        })
                        .join(" ")}
                    />

                    {/* Active point markers when hovering */}
                    {hoverIndex !== null && hoverIndex >= 0 && (
                      <>
                        {(() => {
                          const i = hoverIndex;
                          const x =
                            (i / (growth.length - 1 || 1)) * 100;
                          const growthY =
                            100 - (growth[i] / maxValue) * 100;
                          const savingsY =
                            100 - (savings[i] / maxValue) * 100;
                          return (
                            <>
                              {/* Vertical hover guide */}
                              <line
                                x1={x}
                                y1="0"
                                x2={x}
                                y2="100"
                                stroke="rgba(148,163,184,0.45)"
                                strokeDasharray="1.5 2"
                                strokeWidth="0.6"
                              />
                              {/* Growth point */}
                              <circle
                                cx={x}
                                cy={isFinite(growthY) ? growthY : 100}
                                r="1.6"
                                fill={
                                  selectedProfile === "passive"
                                    ? "rgb(34,197,94)"
                                    : selectedProfile === "moderate"
                                    ? "rgb(56,189,248)"
                                    : "rgb(250,204,21)"
                                }
                              />
                              {/* Savings point */}
                              <circle
                                cx={x}
                                cy={isFinite(savingsY) ? savingsY : 100}
                                r="1.4"
                                fill="rgba(250,250,250,0.85)"
                              />
                            </>
                          );
                        })()}
                      </>
                    )}
                  </>
                )}
              </svg>

              {/* Hover capture layer */}
              <div
                className="absolute inset-0 cursor-crosshair"
                onMouseMove={(e) => {
                  if (!growth.length) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const relativeX = e.clientX - rect.left;
                  const ratio = Math.min(
                    1,
                    Math.max(0, relativeX / rect.width)
                  );
                  const index = Math.round(
                    ratio * (growth.length - 1 || 0)
                  );
                  setHoverIndex(index);
                }}
              />

              {/* X-axis labels */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between px-1 text-[9px] text-zinc-500">
                {growth.map((_, index) => (
                  <span key={index}>Y{index + 1}</span>
                ))}
              </div>

              {/* Hover tooltip */}
              {hoverIndex !== null &&
                hoverIndex >= 0 &&
                hoverIndex < growth.length && (
                  <div
                    className="pointer-events-none absolute -top-1 left-0 right-0 flex justify-center text-[10px]"
                    style={{
                      transform: `translateX(${
                        growth.length > 1
                          ? (hoverIndex / (growth.length - 1)) * 100 - 50
                          : 0
                      }%)`,
                    }}
                  >
                    <div className="rounded-md border border-white/10 bg-black/85 px-3 py-2 text-left text-zinc-100 shadow-lg shadow-black/60">
                      <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-400">
                        Year {hoverIndex + 1}
                      </p>
                      <p className="mt-1 text-[10px]">
                        Profile:{" "}
                        <span className="font-semibold">
                          $
                          {growth[hoverIndex].toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}
                        </span>
                      </p>
                      <p className="text-[10px] text-zinc-300">
                        Savings:{" "}
                        <span className="font-semibold">
                          $
                          {savings[hoverIndex].toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}
                        </span>
                      </p>
                      <p className="mt-1 text-[10px] text-emerald-300">
                        Difference:{" "}
                        <span className="font-semibold">
                          $
                          {(growth[hoverIndex] - savings[hoverIndex]).toLocaleString(
                            undefined,
                            {
                              maximumFractionDigits: 0,
                            }
                          )}
                        </span>
                      </p>
                    </div>
                  </div>
                )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
            <p>
              Final projected balance after {config.years} years:{" "}
              <span className="font-semibold text-zinc-100">
                $
                {growth.length
                  ? growth[growth.length - 1].toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })
                  : "0"}
              </span>
            </p>
            <p className="text-zinc-500">
              This is a simplified model and not a guarantee of results.
            </p>
          </div>
        </section>

        <p className="mt-6 text-[11px] text-zinc-500">
          These profiles are illustrative only and do not represent
          recommendations or personalized investment advice.
        </p>

        <div className="mt-6 flex justify-center">
          <Link
            href="/plans"
            className="rounded-full bg-[#11c60f] px-8 py-2.5 text-sm font-semibold text-[#020308] shadow-lg shadow-[#11c60f]/40 transition hover:bg-[#13e211]"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}

