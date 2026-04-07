"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, useInView } from "framer-motion";
import "./landing.css";
import { SiteFooter } from "../components/SiteFooter";

const ParticleField = dynamic(() => import("../components/landing/ParticleField"), {
  ssr: false,
  loading: () => null,
});

// ─── Animated counter ─────────────────────────────────────────────────────────

function AnimatedNumber({ value }: { value: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [displayed, setDisplayed] = useState("0");

  useEffect(() => {
    if (!inView) return;
    const num = parseInt(value.replace(/[^0-9]/g, ""), 10);
    if (isNaN(num)) { setDisplayed(value); return; }
    const suffix = value.replace(/[0-9]/g, "");
    let cur = 0;
    const step = Math.ceil(num / 40);
    const id = setInterval(() => {
      cur = Math.min(cur + step, num);
      setDisplayed(cur + suffix);
      if (cur >= num) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, [inView, value]);

  return <span ref={ref}>{displayed}</span>;
}

// ─── Section 1: Hero ──────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section
      className="relative flex flex-col items-center justify-center overflow-hidden"
      style={{ minHeight: "100vh", background: "#000000" }}
    >
      <ParticleField />

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl mx-auto w-full">

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <span className="hero-badge badge-pulse">
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4f9cf9", display: "inline-block", flexShrink: 0 }} />
            Next-Generation Trading Intelligence
          </span>
        </motion.div>

        {/* Headline */}
        <div className="mb-6" style={{ lineHeight: 0.92 }}>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          >
            <span
              className="block font-black text-white"
              style={{ fontSize: "clamp(56px, 9vw, 96px)", letterSpacing: "-0.02em" }}
            >
              Trade Smarter.
            </span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.13, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Extra bottom padding so descenders (y, g) don't get clipped */}
            <span
              className="hero-accent font-black"
              style={{ fontSize: "clamp(56px, 9vw, 96px)", letterSpacing: "-0.02em", lineHeight: 1, paddingBottom: "0.12em" }}
            >
              See Everything.
            </span>
          </motion.div>
        </div>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="max-w-xl leading-relaxed mb-10"
          style={{ fontSize: "clamp(14px, 1.5vw, 17px)", color: "rgba(255,255,255,0.4)" }}
        >
          The only platform combining live global intelligence, AI-powered analysis,
          and institutional-grade tools — all under $29/month.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.55 }}
          className="flex flex-col sm:flex-row items-center gap-3"
        >
          <motion.a
            href="/auth/sign-up"
            whileHover={{ scale: 1.04, boxShadow: "0 0 32px rgba(79,156,249,0.5)" }}
            whileTap={{ scale: 0.97 }}
            className="cta-primary px-8 py-4 rounded-xl text-sm"
          >
            Start Free Today →
          </motion.a>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            className="cta-secondary px-8 py-4 rounded-xl text-sm cursor-pointer"
          >
            Explore Platform
          </motion.button>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5"
      >
        <div className="w-px h-10 relative" style={{ background: "linear-gradient(to bottom, transparent, rgba(79,156,249,0.25))" }}>
          <div className="scroll-dot w-1 h-1 rounded-full absolute left-1/2 -translate-x-1/2 top-0" style={{ background: "#4f9cf9" }} />
        </div>
      </motion.div>
    </section>
  );
}

// ─── Section 2: Bento Features ────────────────────────────────────────────────

function AnimatedChart() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const pts = [10, 20, 15, 35, 28, 50, 42, 68, 55, 85, 72, 95];
  const w = 190, h = 68;
  const min = Math.min(...pts), max = Math.max(...pts);
  const d = pts.map((v, i) => `${i === 0 ? "M" : "L"} ${(i / (pts.length - 1)) * w} ${h - ((v - min) / (max - min)) * h}`).join(" ");
  return (
    <div ref={ref} className="flex flex-col gap-1">
      <svg width={w} height={h} className="overflow-visible">
        <motion.path d={d} fill="none" stroke="rgba(79,156,249,0.7)" strokeWidth={1.5}
          initial={{ pathLength: 0 }} animate={{ pathLength: inView ? 1 : 0 }}
          transition={{ duration: 1.8, ease: "easeInOut", delay: 0.3 }} />
      </svg>
      <span style={{ color: "rgba(79,156,249,0.6)", fontSize: "10px", fontFamily: "monospace" }}>+240% return</span>
    </div>
  );
}

function ChatBubbles() {
  const trades = [
    { ticker: "AAPL", dir: "Long", price: "$185", up: true },
    { ticker: "NVDA", dir: "Short", price: "$432", up: false },
    { ticker: "SPY", dir: "Long", price: "$498", up: true },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      {trades.map((t, i) => (
        <motion.div key={t.ticker}
          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.55 + 0.2, duration: 0.3 }}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-mono"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <span style={{ color: "rgba(255,255,255,0.65)" }}>{t.ticker}</span>
          <span style={{ color: "rgba(255,255,255,0.28)" }}>{t.dir}</span>
          <span style={{ color: "rgba(255,255,255,0.45)" }}>{t.price}</span>
          <span style={{ color: t.up ? "rgba(74,222,128,0.8)" : "rgba(248,113,113,0.8)" }}>{t.up ? "▲" : "▼"}</span>
        </motion.div>
      ))}
    </div>
  );
}

function YieldCurve() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const pts = [3.2, 3.5, 3.8, 4.0, 4.2, 4.35, 4.4, 4.45, 4.5];
  const w = 145, h = 52;
  const min = Math.min(...pts), max = Math.max(...pts);
  const d = pts.map((v, i) => `${i === 0 ? "M" : "L"} ${(i / (pts.length - 1)) * w} ${h - ((v - min) / (max - min)) * (h * 0.8) - 3}`).join(" ");
  return (
    <div ref={ref}>
      <svg width={w} height={h}>
        <motion.path d={d} fill="none" stroke="rgba(79,156,249,0.5)" strokeWidth={1.5}
          initial={{ pathLength: 0 }} animate={{ pathLength: inView ? 1 : 0 }}
          transition={{ duration: 1.4, ease: "easeInOut", delay: 0.2 }} />
      </svg>
      <div className="flex gap-3 mt-1" style={{ fontSize: "9px", color: "rgba(255,255,255,0.22)", fontFamily: "monospace" }}>
        {["2Y","5Y","10Y","30Y"].map(l => <span key={l}>{l}</span>)}
      </div>
    </div>
  );
}

function ForexTicker() {
  const pairs = [
    { pair: "EUR/USD", val: "1.0847", up: true },
    { pair: "GBP/USD", val: "1.2634", up: false },
    { pair: "USD/JPY", val: "149.82", up: true },
  ];
  return (
    <div className="flex flex-col gap-2">
      {pairs.map(p => (
        <div key={p.pair} className="flex items-center justify-between text-xs font-mono">
          <span style={{ color: "rgba(255,255,255,0.32)" }}>{p.pair}</span>
          <span style={{ color: "rgba(255,255,255,0.6)" }}>{p.val}</span>
          <span style={{ color: p.up ? "rgba(74,222,128,0.75)" : "rgba(248,113,113,0.75)" }}>{p.up ? "▲" : "▼"}</span>
        </div>
      ))}
    </div>
  );
}

function AiTypewriter() {
  const text = "NVDA showing bullish divergence on 4H RSI. Key resistance at $445. Volume confirms accumulation pattern...";
  const [displayed, setDisplayed] = useState("");
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let i = 0;
    const id = setInterval(() => {
      setDisplayed(text.slice(0, i));
      i++;
      if (i > text.length) clearInterval(id);
    }, 36);
    return () => clearInterval(id);
  }, [inView]);
  return (
    <div ref={ref} className="leading-relaxed font-mono" style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>
      {displayed}
      <span className="typewriter-cursor inline-block w-px h-3 ml-0.5 align-middle" style={{ background: "#4f9cf9" }} />
    </div>
  );
}

function ScreenerRows() {
  const stocks = [
    { sym: "NVDA", score: 96, change: "+2.1%" },
    { sym: "AAPL", score: 92, change: "+1.4%" },
    { sym: "MSFT", score: 88, change: "+0.9%" },
    { sym: "META", score: 85, change: "+1.7%" },
  ];
  return (
    <div className="flex flex-col gap-1">
      {stocks.map((s, i) => (
        <motion.div key={s.sym}
          initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.11 + 0.2, duration: 0.28 }}
          className="flex items-center gap-2 px-2 py-1 rounded text-xs font-mono"
          style={{ background: "rgba(255,255,255,0.025)" }}>
          <span className="w-9" style={{ color: "rgba(255,255,255,0.55)" }}>{s.sym}</span>
          <div className="flex-1 h-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
            <motion.div className="h-full rounded-full"
              style={{ background: "rgba(79,156,249,0.5)" }}
              initial={{ width: 0 }} animate={{ width: `${s.score}%` }}
              transition={{ delay: i * 0.11 + 0.38, duration: 0.55 }} />
          </div>
          <span style={{ color: "rgba(74,222,128,0.7)" }}>{s.change}</span>
        </motion.div>
      ))}
    </div>
  );
}

const BENTO_ITEMS = [
  { id: "backtest",   label: "Institutional Backtesting", desc: "Equity curves, Sharpe ratio, drawdown", content: <AnimatedChart /> },
  { id: "traderooms", label: "Live Trade Rooms",          desc: "Real-time calls from top traders",      content: <ChatBubbles /> },
  { id: "bonds",      label: "Fixed Income",              desc: "Yield curves, spreads, CB data",        content: <YieldCurve /> },
  { id: "forex",      label: "FX Markets",                desc: "Real-time pairs and cross rates",       content: <ForexTicker /> },
  { id: "ai",         label: "AI Insights",               desc: "Claude-powered market analysis",        content: <AiTypewriter /> },
  { id: "screener",   label: "Stock Screener",            desc: "Filter 10,000+ stocks instantly",       content: <ScreenerRows /> },
];

function FeaturesSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="features" ref={ref} className="relative py-32 px-6" style={{ background: "#000000" }}>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(79,156,249,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div className="relative max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }} className="text-center mb-16">
          <p className="overline-label mb-4">Platform</p>
          <h2 className="font-black tracking-tight mb-4 text-white"
            style={{ fontSize: "clamp(32px, 5vw, 54px)", letterSpacing: "-0.02em" }}>
            Everything You Need
          </h2>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "15px" }}>27 pages of live intelligence. One platform.</p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 auto-rows-[148px]">
          {/* Globe — 2×2 */}
          <motion.div
            initial={{ opacity: 0, y: 18 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: 0.05 }}
            whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
            className="glass-card rounded-2xl p-5 col-span-2 row-span-2 flex flex-col justify-between overflow-hidden relative cursor-default"
          >
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="rounded-full" style={{
                width: "240px", height: "240px", opacity: 0.1,
                background: "radial-gradient(circle at 38% 38%, rgba(79,156,249,0.9), rgba(79,156,249,0.2), transparent 65%)",
              }} />
            </div>
            <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.05, pointerEvents: "none" }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <ellipse key={i} cx="50%" cy={`${14 + i * 14}%`} rx="34%" ry="3%" fill="none" stroke="#4f9cf9" strokeWidth="0.5" />
              ))}
              {Array.from({ length: 5 }).map((_, i) => (
                <line key={i} x1={`${18 + i * 16}%`} y1="4%" x2={`${18 + i * 16}%`} y2="96%" stroke="#4f9cf9" strokeWidth="0.5" />
              ))}
            </svg>
            <div className="relative z-10">
              <p className="overline-label mb-1">Live</p>
              <h3 className="font-bold text-white text-lg">Global Market Intelligence</h3>
            </div>
            <p className="relative z-10 text-sm" style={{ color: "rgba(255,255,255,0.28)" }}>
              Live country-level data across 180+ nations
            </p>
          </motion.div>

          {BENTO_ITEMS.map((card, i) => (
            <motion.div key={card.id}
              initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.065 }}
              whileHover={{ scale: 1.025, transition: { duration: 0.18 } }}
              className="glass-card rounded-2xl p-4 flex flex-col justify-between overflow-hidden cursor-default"
            >
              <div className="flex-1 mb-2">{card.content}</div>
              <div>
                <p className="text-white font-semibold" style={{ fontSize: "11px" }}>{card.label}</p>
                <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)" }}>{card.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section 3: Globe Showcase ────────────────────────────────────────────────

function GlobeSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  const bullets = [
    "Live country-level market data across 180+ nations",
    "International trade routes with real vessel tracking",
    "Geopolitical risk zones updated by AI",
    "Yield curves and central bank rates for 20+ countries",
  ];

  return (
    <section id="markets" ref={ref} className="relative py-32 px-6" style={{ background: "#000000" }}>
      <hr className="section-rule" />
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-20 pt-32">
        <div className="flex-1">
          <motion.div initial={{ opacity: 0, x: -24 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.65 }}>
            <p className="overline-label mb-5">Live Intelligence</p>
            <h2 className="font-black tracking-tight leading-[1.04] mb-7"
              style={{ fontSize: "clamp(28px, 4.5vw, 48px)", color: "#ffffff", letterSpacing: "-0.02em" }}>
              The World's Markets.{" "}
              <span className="hero-accent">All at Once.</span>
            </h2>
            <ul className="flex flex-col gap-4 mb-10">
              {bullets.map((b, i) => (
                <motion.li key={i}
                  initial={{ opacity: 0, x: -14 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.15 + i * 0.08, duration: 0.42 }}
                  className="flex items-start gap-3 text-sm"
                  style={{ color: "rgba(255,255,255,0.4)" }}>
                  <span className="shrink-0 mt-0.5" style={{ color: "#4f9cf9", opacity: 0.6 }}>—</span>
                  {b}
                </motion.li>
              ))}
            </ul>
            <motion.a href="/map"
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ delay: 0.55 }}
              className="cta-secondary inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm">
              Explore the Globe →
            </motion.a>
          </motion.div>
        </div>

        <motion.div className="flex-1 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.85 }} animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}>
          <div className="relative" style={{ width: "340px", height: "340px" }}>
            {/* Outer glow ring */}
            <div className="absolute inset-0 rounded-full" style={{
              background: "radial-gradient(circle, transparent 45%, rgba(79,156,249,0.06) 65%, transparent 80%)",
            }} />
            {/* Globe */}
            <div className="absolute inset-4 rounded-full overflow-hidden" style={{
              background: "radial-gradient(circle at 35% 32%, rgba(79,156,249,0.14) 0%, rgba(79,156,249,0.03) 45%, transparent 65%)",
              border: "1px solid rgba(79,156,249,0.12)",
              boxShadow: "0 0 50px rgba(79,156,249,0.06)",
            }}>
              <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.08 }} viewBox="0 0 320 320">
                {Array.from({ length: 7 }).map((_, i) => (
                  <ellipse key={i} cx="160" cy="160" rx={18 + i * 22} ry="7" fill="none" stroke="#4f9cf9" strokeWidth="0.6" />
                ))}
                {Array.from({ length: 8 }).map((_, i) => (
                  <line key={i} x1={40 * i} y1="0" x2={40 * i} y2="320" stroke="#4f9cf9" strokeWidth="0.5" />
                ))}
              </svg>
              {[
                { t: "22%", l: "30%" }, { t: "38%", l: "55%" }, { t: "58%", l: "40%" },
                { t: "44%", l: "72%" }, { t: "68%", l: "62%" }, { t: "28%", l: "76%" },
              ].map((d, i) => (
                <motion.div key={i} className="absolute rounded-full"
                  style={{ top: d.t, left: d.l, width: 6, height: 6, background: "#4f9cf9", opacity: 0.7 }}
                  animate={{ scale: [1, 2, 1], opacity: [0.7, 0.15, 0.7] }}
                  transition={{ duration: 2.4 + i * 0.3, repeat: Infinity, ease: "easeInOut" }} />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Section 4: Social Proof ──────────────────────────────────────────────────

// TODO: replace with real testimonials
const TESTIMONIALS = [
  {
    initials: "JR", name: "James R.", role: "Day Trader · 8 years",
    quote: "Quantiv replaced four separate subscriptions. The global macro view alone is worth the price — I finally understand why my trades move the way they do.",
  },
  {
    initials: "SL", name: "Sarah L.", role: "Hedge Fund Analyst",
    quote: "The backtester is institutional quality. The bond market section surfaces things I used to spend hours finding manually. Genuinely impressive.",
  },
  {
    initials: "MK", name: "Marcus K.", role: "Quant Trader · 5 years",
    quote: "I was skeptical about another trading platform, but the AI analysis and screener combo is legitimately different. The UI is beautiful.",
  },
];

const STATS = [
  { value: "27+", label: "Pages of intelligence" },
  { value: "180+", label: "Countries tracked" },
  { value: "10k+", label: "Backtests run" },
  { value: "$0", label: "Hidden fees" },
];

function SocialProofSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="relative py-32 px-6" style={{ background: "#000000" }}>
      <hr className="section-rule mb-32" />
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55 }} className="text-center mb-14">
          <p className="overline-label mb-4">Testimonials</p>
          <h2 className="font-black tracking-tight text-white"
            style={{ fontSize: "clamp(28px, 4vw, 46px)", letterSpacing: "-0.02em" }}>
            Built for Serious Traders
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-20">
          {TESTIMONIALS.map((t, i) => (
            <motion.div key={t.name}
              initial={{ opacity: 0, y: 22 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="glass-card rounded-2xl p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: "rgba(79,156,249,0.08)", color: "rgba(79,156,249,0.8)", border: "1px solid rgba(79,156,249,0.15)" }}>
                  {t.initials}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{t.name}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.28)" }}>{t.role}</p>
                </div>
              </div>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, s) => (
                  <span key={s} style={{ color: "rgba(79,156,249,0.45)", fontSize: "12px" }}>★</span>
                ))}
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.42)" }}>{t.quote}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 12 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.3 + i * 0.07, duration: 0.45 }}
              className="flex flex-col gap-1">
              <span className="font-black tracking-tight" style={{ fontSize: "clamp(28px, 3.5vw, 42px)", color: "#4f9cf9" }}>
                <AnimatedNumber value={s.value} />
              </span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.28)" }}>{s.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section 5: Pricing ───────────────────────────────────────────────────────

const PLANS = [
  {
    name: "Starter",
    price: { monthly: "$19", annual: "$15" },
    period: "/month",
    features: ["12 pages of data", "Advanced screener", "5 watchlists", "Basic backtester", "Forex & bond data"],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Pro",
    price: { monthly: "$29", annual: "$24" },
    period: "/month",
    features: ["All 27 pages", "Unlimited backtesting", "AI analysis (50/mo)", "Live trade rooms", "Global macro map", "Priority support"],
    cta: "Get Started",
    highlight: true,
    badge: "Most Popular",
  },
  {
    name: "Elite",
    price: { monthly: "$89", annual: "$74" },
    period: "/month",
    features: ["Everything in Pro", "Unlimited AI analysis", "API access", "Custom alerts", "White-glove onboarding", "1-on-1 strategy session"],
    cta: "Get Started",
    highlight: false,
  },
];

function PricingSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" ref={ref} className="relative py-32 px-6" style={{ background: "#000000" }}>
      <hr className="section-rule mb-32" />
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55 }} className="text-center mb-12">
          <p className="overline-label mb-4">Pricing</p>
          <h2 className="font-black tracking-tight text-white mb-3"
            style={{ fontSize: "clamp(28px, 4vw, 46px)", letterSpacing: "-0.02em" }}>
            Simple, Transparent Pricing
          </h2>
          <p style={{ color: "rgba(255,255,255,0.28)", fontSize: "14px" }}>No hidden fees. Cancel anytime.</p>
        </motion.div>

        {/* Annual / Monthly toggle */}
        <motion.div initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ delay: 0.2 }}
          className="flex items-center justify-center gap-4 mb-12">
          <span className="text-sm" style={{ color: !annual ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.22)" }}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            className="toggle-track"
            style={{ background: annual ? "rgba(79,156,249,0.25)" : "rgba(255,255,255,0.07)" }}
            aria-label="Toggle annual billing"
          >
            <span className="toggle-thumb" style={{ left: annual ? "23px" : "3px" }} />
          </button>
          <span className="text-sm" style={{ color: annual ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.22)" }}>
            Annual{" "}
            <span style={{ color: "#4f9cf9", fontSize: "11px", fontWeight: 600 }}>· 2 months free</span>
          </span>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan, i) => (
            <motion.div key={plan.name}
              initial={{ opacity: 0, y: 26 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.1, duration: 0.52 }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className={`relative rounded-2xl p-7 flex flex-col gap-5 ${plan.highlight ? "pricing-card-pro" : "glass-card"}`}>
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap"
                    style={{ background: "rgba(79,156,249,0.15)", color: "#4f9cf9", border: "1px solid rgba(79,156,249,0.25)" }}>
                    {plan.badge}
                  </span>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: "rgba(255,255,255,0.28)" }}>{plan.name}</p>
                <div className="flex items-baseline gap-1">
                  <span className="font-black text-white" style={{ fontSize: "38px", letterSpacing: "-0.02em" }}>
                    {annual ? plan.price.annual : plan.price.monthly}
                  </span>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.28)" }}>{plan.period}</span>
                </div>
              </div>
              <ul className="flex flex-col gap-2.5 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-xs" style={{ color: "rgba(255,255,255,0.42)" }}>
                    <span className="shrink-0 mt-px" style={{ color: "#4f9cf9", opacity: 0.7 }}>—</span>
                    {f}
                  </li>
                ))}
              </ul>
              <motion.a href="/auth/sign-up"
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className={`block text-center text-sm font-semibold py-3 px-4 rounded-xl ${plan.highlight ? "cta-primary" : "cta-secondary"}`}>
                {plan.cta}
              </motion.a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section 6: CTA ───────────────────────────────────────────────────────────

function CTASection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section ref={ref} className="relative flex items-center justify-center overflow-hidden py-40 px-6"
      style={{ background: "#000000" }}>
      <ParticleField dense />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(79,156,249,0.04) 0%, transparent 70%)",
      }} />
      <div className="relative z-10 text-center max-w-2xl mx-auto">
        <motion.h2 initial={{ opacity: 0, y: 22 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65 }}
          className="font-black tracking-tight text-white mb-5"
          style={{ fontSize: "clamp(40px, 6.5vw, 72px)", letterSpacing: "-0.025em" }}>
          Your Edge<br />Starts Here.
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 14 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.18, duration: 0.5 }}
          className="mb-10" style={{ color: "rgba(255,255,255,0.32)", fontSize: "15px" }}>
          Join traders who see the market differently.
        </motion.p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <motion.a href="/auth/sign-up"
            whileHover={{ scale: 1.04, boxShadow: "0 0 36px rgba(79,156,249,0.5)" }}
            whileTap={{ scale: 0.97 }}
            initial={{ opacity: 0, y: 12 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.48 }}
            className="inline-block cta-primary text-base font-bold px-10 py-4 rounded-xl">
            Start Free Today →
          </motion.a>
          <motion.a href="/onboarding"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            initial={{ opacity: 0, y: 12 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.42, duration: 0.48 }}
            className="inline-block cta-secondary text-base font-semibold px-10 py-4 rounded-xl">
            Take the investor quiz
          </motion.a>
        </div>
      </div>
    </section>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // If Supabase redirected an OAuth code to this page instead of /auth/callback,
    // forward it so the session can be completed.
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      window.location.replace(`/auth/callback?code=${encodeURIComponent(code)}`);
      return;
    }
    const t = setTimeout(() => setReady(true), 120);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="landing-page">
      {!ready ? (
        <div className="flex min-h-screen items-center justify-center" style={{ background: "#000000" }}>
          <motion.div animate={{ opacity: [0.15, 0.5, 0.15] }} transition={{ duration: 2, repeat: Infinity }}
            className="font-black tracking-tight text-white" style={{ fontSize: "24px", letterSpacing: "-0.02em" }}>
            Quantiv
          </motion.div>
        </div>
      ) : (
        <>
          <HeroSection />
          <FeaturesSection />
          <GlobeSection />
          <SocialProofSection />
          <PricingSection />
          <CTASection />
        </>
      )}
      <SiteFooter />
    </div>
  );
}
