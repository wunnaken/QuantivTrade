"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { QuantivTradeLogoImage } from "../components/QuantivTradeLogoImage";
import "./landing.css";
import { SiteFooter } from "../components/SiteFooter";
import { NewsletterSignup } from "../components/NewsletterSignup";
import { WhatsNewTimeline } from "../components/WhatsNewTimeline";

// ─── Ticker background ────────────────────────────────────────────────────────

const TICKER_ROWS: { s: string; p: string; c: string; up: boolean }[][] = [
  [
    { s: "AAPL",     p: "178.52",    c: "+1.24", up: true  },
    { s: "MSFT",     p: "415.30",    c: "+0.63", up: true  },
    { s: "NVDA",     p: "875.40",    c: "+3.12", up: true  },
    { s: "TSLA",     p: "243.10",    c: "-0.87", up: false },
    { s: "AMZN",     p: "185.74",    c: "+1.05", up: true  },
    { s: "META",     p: "510.22",    c: "+2.18", up: true  },
    { s: "GOOGL",    p: "163.44",    c: "-0.31", up: false },
    { s: "SPY",      p: "521.80",    c: "+0.44", up: true  },
    { s: "QQQ",      p: "447.60",    c: "+0.78", up: true  },
    { s: "AMD",      p: "164.72",    c: "-1.42", up: false },
  ],
  [
    { s: "BTC/USD",  p: "67,420.00", c: "+2.85", up: true  },
    { s: "ETH/USD",  p: "3,512.40",  c: "+1.90", up: true  },
    { s: "SOL/USD",  p: "182.34",    c: "-0.55", up: false },
    { s: "BNB/USD",  p: "612.80",    c: "+0.72", up: true  },
    { s: "XRP/USD",  p: "0.5824",    c: "-1.10", up: false },
    { s: "ADA/USD",  p: "0.4491",    c: "+3.40", up: true  },
    { s: "DOGE/USD", p: "0.1622",    c: "+5.12", up: true  },
    { s: "AVAX/USD", p: "38.74",     c: "-0.90", up: false },
    { s: "LINK/USD", p: "14.82",     c: "+1.65", up: true  },
    { s: "DOT/USD",  p: "7.44",      c: "-2.01", up: false },
  ],
  [
    { s: "EUR/USD",  p: "1.0847",    c: "+0.12", up: true  },
    { s: "GBP/USD",  p: "1.2634",    c: "-0.08", up: false },
    { s: "USD/JPY",  p: "149.82",    c: "+0.31", up: true  },
    { s: "AUD/USD",  p: "0.6521",    c: "-0.19", up: false },
    { s: "USD/CHF",  p: "0.8944",    c: "+0.07", up: true  },
    { s: "USD/CAD",  p: "1.3612",    c: "-0.04", up: false },
    { s: "NZD/USD",  p: "0.5988",    c: "+0.22", up: true  },
    { s: "EUR/GBP",  p: "0.8582",    c: "+0.05", up: true  },
    { s: "USD/MXN",  p: "17.241",    c: "-0.14", up: false },
    { s: "EUR/JPY",  p: "162.44",    c: "+0.48", up: true  },
  ],
  [
    { s: "ES1!",     p: "5,284.25",  c: "+0.52", up: true  },
    { s: "NQ1!",     p: "18,422.00", c: "+0.89", up: true  },
    { s: "CL1!",     p: "82.14",     c: "-0.44", up: false },
    { s: "GC1!",     p: "2,321.40",  c: "+0.67", up: true  },
    { s: "SI1!",     p: "27.48",     c: "+1.22", up: true  },
    { s: "ZC1!",     p: "452.75",    c: "-0.31", up: false },
    { s: "ZS1!",     p: "1,187.50",  c: "+0.18", up: true  },
    { s: "NG1!",     p: "1.842",     c: "-2.14", up: false },
    { s: "HG1!",     p: "4.142",     c: "+0.95", up: true  },
    { s: "YM1!",     p: "39,184.00", c: "+0.38", up: true  },
  ],
  [
    { s: "JPM",      p: "198.44",    c: "+0.82", up: true  },
    { s: "BAC",      p: "38.72",     c: "-0.55", up: false },
    { s: "V",        p: "279.10",    c: "+0.44", up: true  },
    { s: "JNJ",      p: "152.34",    c: "-0.21", up: false },
    { s: "WMT",      p: "60.82",     c: "+1.14", up: true  },
    { s: "XOM",      p: "118.24",    c: "+0.73", up: true  },
    { s: "NFLX",     p: "628.40",    c: "+2.34", up: true  },
    { s: "DIS",      p: "113.62",    c: "-0.67", up: false },
    { s: "INTC",     p: "30.44",     c: "-1.82", up: false },
    { s: "BA",       p: "188.72",    c: "+0.59", up: true  },
  ],
  [
    { s: "LTC/USD",  p: "82.44",     c: "+1.34", up: true  },
    { s: "UNI/USD",  p: "8.142",     c: "+2.11", up: true  },
    { s: "ATOM/USD", p: "9.024",     c: "-1.44", up: false },
    { s: "NEAR/USD", p: "7.812",     c: "+4.02", up: true  },
    { s: "ARB/USD",  p: "1.124",     c: "-2.31", up: false },
    { s: "OP/USD",   p: "2.482",     c: "+1.77", up: true  },
    { s: "INJ/USD",  p: "28.44",     c: "+5.14", up: true  },
    { s: "TIA/USD",  p: "9.841",     c: "-0.72", up: false },
    { s: "MATIC",    p: "0.7821",    c: "-0.88", up: false },
    { s: "FIL/USD",  p: "6.341",     c: "+3.21", up: true  },
  ],
  [
    { s: "ZB1!",     p: "118.22",    c: "-0.18", up: false },
    { s: "ZN1!",     p: "109.16",    c: "-0.09", up: false },
    { s: "VIX",      p: "14.82",     c: "+3.44", up: true  },
    { s: "DX1!",     p: "104.420",   c: "+0.14", up: true  },
    { s: "RTY1!",    p: "2,084.60",  c: "-0.72", up: false },
    { s: "PYPL",     p: "64.82",     c: "+1.24", up: true  },
    { s: "SQ",       p: "74.10",     c: "-0.44", up: false },
    { s: "COIN",     p: "218.40",    c: "+3.82", up: true  },
    { s: "HOOD",     p: "18.24",     c: "+2.14", up: true  },
    { s: "MSTR",     p: "1,284.60",  c: "+4.22", up: true  },
  ],
  [
    { s: "UBER",     p: "72.44",     c: "+1.84", up: true  },
    { s: "ABNB",     p: "148.32",    c: "-0.92", up: false },
    { s: "SHOP",     p: "72.18",     c: "+2.44", up: true  },
    { s: "SPOT",     p: "298.40",    c: "+1.12", up: true  },
    { s: "NET",      p: "98.24",     c: "+3.11", up: true  },
    { s: "PLTR",     p: "24.82",     c: "+4.22", up: true  },
    { s: "RBLX",     p: "38.44",     c: "-1.34", up: false },
    { s: "DASH",     p: "118.72",    c: "-0.44", up: false },
    { s: "SNAP",     p: "12.84",     c: "+2.84", up: true  },
    { s: "PINS",     p: "34.22",     c: "+1.55", up: true  },
  ],
  [
    { s: "CRM",      p: "284.40",    c: "+0.88", up: true  },
    { s: "ORCL",     p: "124.82",    c: "+1.44", up: true  },
    { s: "ADBE",     p: "472.10",    c: "-0.62", up: false },
    { s: "NOW",      p: "748.24",    c: "+1.02", up: true  },
    { s: "ZM",       p: "62.44",     c: "-2.14", up: false },
    { s: "TWLO",     p: "58.84",     c: "+3.22", up: true  },
    { s: "DDOG",     p: "124.40",    c: "+2.84", up: true  },
    { s: "SNOW",     p: "148.22",    c: "-1.04", up: false },
    { s: "MDB",      p: "284.60",    c: "+1.74", up: true  },
    { s: "TTD",      p: "82.44",     c: "+2.11", up: true  },
  ],
  [
    { s: "GBP/JPY",  p: "189.42",    c: "+0.38", up: true  },
    { s: "AUD/JPY",  p: "97.84",     c: "-0.22", up: false },
    { s: "EUR/CHF",  p: "0.9682",    c: "+0.04", up: true  },
    { s: "EUR/AUD",  p: "1.6624",    c: "-0.11", up: false },
    { s: "GBP/CAD",  p: "1.7182",    c: "+0.14", up: true  },
    { s: "USD/SGD",  p: "1.3484",    c: "+0.06", up: true  },
    { s: "USD/HKD",  p: "7.8244",    c: "-0.01", up: false },
    { s: "USD/TRY",  p: "32.142",    c: "+0.44", up: true  },
    { s: "USD/ZAR",  p: "18.824",    c: "-0.34", up: false },
    { s: "USD/BRL",  p: "4.9842",    c: "+0.22", up: true  },
  ],
  [
    { s: "GLD",      p: "218.44",    c: "+0.58", up: true  },
    { s: "SLV",      p: "26.82",     c: "+1.14", up: true  },
    { s: "TLT",      p: "92.44",     c: "-0.34", up: false },
    { s: "IWM",      p: "202.84",    c: "-0.72", up: false },
    { s: "DIA",      p: "384.22",    c: "+0.41", up: true  },
    { s: "VTI",      p: "242.60",    c: "+0.55", up: true  },
    { s: "USO",      p: "74.82",     c: "-0.44", up: false },
    { s: "HYG",      p: "78.44",     c: "+0.12", up: true  },
    { s: "ROKU",     p: "62.44",     c: "+3.14", up: true  },
    { s: "ETSY",     p: "58.82",     c: "-1.22", up: false },
    { s: "XLF",      p: "42.84",     c: "+0.84", up: true  },
    { s: "XLE",      p: "94.22",     c: "-0.28", up: false },
    { s: "XLK",      p: "214.40",    c: "+1.02", up: true  },
    { s: "XLV",      p: "138.82",    c: "-0.14", up: false },
    { s: "XLI",      p: "128.44",    c: "+0.72", up: true  },
    { s: "XLY",      p: "192.24",    c: "+1.44", up: true  },
    { s: "XLB",      p: "94.82",     c: "-0.55", up: false },
    { s: "XLP",      p: "74.22",     c: "+0.18", up: true  },
    { s: "XLRE",     p: "38.84",     c: "-0.82", up: false },
    { s: "XLU",      p: "66.44",     c: "+0.34", up: true  },
  ],
];

const COLS = 15;
const CELL_H = 55;

type Cell = { s: string; p: string; c: string; up: boolean; flash: number };

// Canvas ticker background — 1 DOM node, rAF flash animation, zero React re-renders
function TickerBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const base = TICKER_ROWS.flat();
    let cells: Cell[] = [];
    let cellW = 0;
    let colCount = COLS;
    let raf: number;
    let lastFlash = 0;
    let dirty = true;

    const cvs = canvas; // non-null alias for use inside closures

    function build(w: number, h: number) {
      cvs.width = w;
      cvs.height = h;
      cellW = Math.floor(w / colCount);
      const rowCount = Math.ceil(h / CELL_H) + 1;
      cells = Array.from({ length: colCount * rowCount }, (_, i) => ({
        ...base[i % base.length], flash: 0,
      }));
      dirty = true;
    }

    build(parent.clientWidth, parent.clientHeight);

    const ro = new ResizeObserver(([e]) => {
      if (e) build(e.contentRect.width, e.contentRect.height);
    });
    ro.observe(parent);

    const ctx = cvs.getContext("2d")!;

    function draw(ts: number) {
      raf = requestAnimationFrame(draw);

      for (const c of cells) {
        if (c.flash > 0) { c.flash = Math.max(0, c.flash - 0.04); dirty = true; }
      }
      if (ts - lastFlash > 420) {
        const n = 6 + Math.floor(Math.random() * 8);
        for (let k = 0; k < n; k++) cells[Math.floor(Math.random() * cells.length)].flash = 1;
        lastFlash = ts;
        dirty = true;
      }
      if (!dirty) return;
      dirty = false;

      ctx.clearRect(0, 0, cvs.width, cvs.height);
      ctx.textAlign = "center";

      for (let i = 0; i < cells.length; i++) {
        const t = cells[i];
        const x = (i % colCount) * cellW + cellW / 2;
        const y = Math.floor(i / colCount) * CELL_H + 14;
        const f = t.flash;

        ctx.font = "600 9px monospace";
        ctx.fillStyle = f > 0
          ? (t.up ? `rgba(74,222,128,${0.38 + f * 0.57})` : `rgba(248,113,113,${0.38 + f * 0.57})`)
          : "rgba(255,255,255,0.26)";
        ctx.fillText(t.s, x, y);

        ctx.font = "8px monospace";
        ctx.fillStyle = `rgba(255,255,255,${0.13 + f * 0.35})`;
        ctx.fillText(t.p, x, y + 13);

        ctx.fillStyle = t.up
          ? `rgba(74,222,128,${0.35 + f * 0.5})`
          : `rgba(248,113,113,${0.35 + f * 0.5})`;
        ctx.fillText(`${t.up ? "▲" : "▼"} ${t.c}%`, x, y + 24);
      }
    }

    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <canvas ref={canvasRef} style={{
      position: "absolute", top: 0, left: 0,
      zIndex: 1, filter: "blur(0.6px)", opacity: 0.65, pointerEvents: "none",
    }} />
  );
}

// ─── Section 1: Hero ──────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section
      className="relative flex flex-col items-center"
    >
      <div className="relative z-10 flex flex-col items-center gap-6 w-full" style={{ paddingTop: "3vh" }}>
        <span
          aria-hidden
          style={{
            display: "block",
            width: "clamp(64px, 8vw, 110px)",
            height: "clamp(64px, 8vw, 110px)",
            backgroundColor: "var(--accent-color)",
            WebkitMaskImage: "url(/quantivtrade-logo.png)",
            WebkitMaskSize: "contain",
            WebkitMaskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            maskImage: "url(/quantivtrade-logo.png)",
            maskSize: "contain",
            maskPosition: "center",
            maskRepeat: "no-repeat",
            opacity: 0.9,
            animation: "logo-spin 24s linear infinite",
            willChange: "transform",
          }}
        />
        <span
          className="landing-hero-headline font-bold tracking-tight text-white"
          style={{ fontSize: "clamp(32px, 4.5vw, 56px)", letterSpacing: "-0.01em" }}
        >
          QuantivTrade
        </span>

        {/* Three cards row */}
        <div style={{
          marginTop: "8px",
          display: "flex",
          gap: "12px",
          width: "min(96vw, 1300px)",
          alignItems: "stretch",
        }}>
          {/* Card 1 — Community */}
          <div style={{
            flex: 1,
            padding: "36px 36px",
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(12px)",
            textAlign: "left",
            overflow: "visible",
          }}>
            <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--accent-color)", opacity: 0.8, marginBottom: "10px" }}>Community</p>
            <p style={{ fontFamily: "var(--font-lora), Georgia, serif", fontSize: "clamp(15px, 1.6vw, 20px)", fontWeight: 600, color: "#ffffff", lineHeight: 1.35, marginBottom: "14px" }}>
              Trade alongside people who get it.
            </p>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.32)", lineHeight: 1.8 }}>
              Follow traders, share ideas, and build your edge alongside a community that moves with the market.
            </p>
            <div style={{ marginTop: "14px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {["Follow Traders", "Share Ideas", "Feed"].map(t => (
                <span key={t} style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)" }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Card 2 — Data */}
          <div style={{
            flex: 1,
            padding: "36px 36px",
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(12px)",
            textAlign: "left",
            overflow: "visible",
          }}>
            <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--accent-color)", opacity: 0.8, marginBottom: "10px" }}>Market Data</p>
            <p style={{ fontFamily: "var(--font-lora), Georgia, serif", fontSize: "clamp(15px, 1.6vw, 20px)", fontWeight: 600, color: "#ffffff", lineHeight: 1.35, marginBottom: "14px" }}>
              Live quotes across every asset class.
            </p>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.32)", lineHeight: 1.8 }}>
              Stocks, crypto, forex, and futures — real-time prices, charts, and macro data all in one place.
            </p>
            <div style={{ marginTop: "14px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {["Real-Time", "Multi-Asset", "Macro"].map(t => (
                <span key={t} style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)" }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Card 3 — Platform */}
          <div style={{
            flex: 1,
            padding: "36px 36px",
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(12px)",
            textAlign: "left",
            overflow: "visible",
          }}>
            <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--accent-color)", opacity: 0.8, marginBottom: "10px" }}>Platform</p>
            <p style={{ fontFamily: "var(--font-lora), Georgia, serif", fontSize: "clamp(15px, 1.6vw, 20px)", fontWeight: 600, color: "#ffffff", lineHeight: 1.35, marginBottom: "14px" }}>
              Your edge, built in.
            </p>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.32)", lineHeight: 1.8 }}>
              Dashboards, analytics, broker tools, and AI insights — everything a serious trader needs, unified and fast.
            </p>
            <div style={{ marginTop: "14px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {["Analytics", "Insights", "Brokers"].map(t => (
                <span key={t} style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)" }}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Screenshot showcase — right after three cards */}
        <ScreenshotShowcase />

        {/* Bento grid inside hero background */}
        <BentoSection />

        {/* Take a Tour CTA */}
        <div style={{ width: "min(96vw, 1300px)", margin: "0 auto", padding: "20px 0 4px", textAlign: "center" }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
            <p className="overline-label" style={{ marginBottom: "14px" }}>See it in action</p>
            <motion.a href="/social-feed" whileHover={{ scale: 1.04, boxShadow: "0 0 32px rgba(232,132,106,0.35)" }} whileTap={{ scale: 0.97 }}
              style={{
                display: "inline-flex", alignItems: "center", gap: "10px",
                background: "transparent",
                border: "1.5px solid var(--accent-color)",
                color: "var(--accent-color)",
                fontFamily: "var(--font-lora)",
                fontSize: "15px", fontWeight: 600,
                letterSpacing: "0.03em",
                padding: "12px 32px",
                borderRadius: "12px",
                textDecoration: "none",
                transition: "background 0.2s",
                willChange: "transform",
              }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
              </svg>
              Take a Tour
            </motion.a>
          </motion.div>
        </div>

        {/* Pricing plans */}
        <PricingPlans />

        {/* Security trust bar */}
        <SecuritySection />

        {/* Toolbar showcase inside hero background */}
        <ToolbarShowcaseInner />
      </div>
    </section>
  );
}

// ─── Section 2: Bento Grid ─────────────────────────────────────────────────────

function MiniFeedPost({ color, lines }: { color: string; lines: number[] }) {
  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
      <div style={{ width: 24, height: 24, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", paddingTop: "2px" }}>
        {lines.map((w, i) => (
          <div key={i} style={{ height: "6px", borderRadius: "3px", background: "rgba(255,255,255,0.08)", width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

// Mini line chart for Live Room + Brokerage
function MiniLineChart({ color, points, fill }: { color: string; points: number[]; fill?: boolean }) {
  const w = 200, h = 52;
  const min = Math.min(...points), max = Math.max(...points);
  const xs = points.map((_, i) => (i / (points.length - 1)) * w);
  const ys = points.map(p => h - ((p - min) / (max - min + 0.001)) * (h - 4) - 2);
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const fillPath = `${d} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "52px" }} preserveAspectRatio="none">
      {fill && <path d={fillPath} fill={color} fillOpacity="0.08" />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Animated live chart line that redraws
function AnimatedChart() {
  const [pts, setPts] = useState([42, 45, 43, 48, 46, 51, 49, 54, 52, 57, 55, 60]);
  useEffect(() => {
    const id = setInterval(() => {
      setPts(prev => {
        const next = [...prev.slice(1), Math.max(30, Math.min(80, prev[prev.length - 1] + (Math.random() - 0.46) * 4))];
        return next;
      });
    }, 800);
    return () => clearInterval(id);
  }, []);
  return <MiniLineChart color="rgba(74,222,128,0.9)" points={pts} fill />;
}

const CARD_BASE = { borderRadius: "16px", border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", backdropFilter: "blur(12px)", overflow: "hidden" as const, cursor: "default" };

function BentoSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  const card = (key: string, delay: number, style: React.CSSProperties, children: React.ReactNode) => (
    <motion.div key={key}
      initial={{ opacity: 0, y: 18 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ borderColor: "rgba(232,132,106,0.3)", boxShadow: "0 0 32px rgba(232,132,106,0.07)" }}
      style={{ ...CARD_BASE, ...style, borderColor: "rgba(255,255,255,0.07)" }}
    >
      {children}
    </motion.div>
  );

  const label = (text: string, sub: string) => (
    <div style={{ padding: "14px 20px 18px" }}>
      <p style={{ fontFamily: "var(--font-lora), Georgia, serif", fontSize: "15px", fontWeight: 600, color: "#fff", marginBottom: "3px" }}>{text}</p>
      <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>{sub}</p>
    </div>
  );

  return (
    <div ref={ref} className="relative px-6" style={{ paddingTop: "40px", paddingBottom: "32px" }}>
      <div className="mx-auto" style={{ maxWidth: "min(96vw, 1300px)", display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gridTemplateRows: "auto auto", gap: "12px" }}>

        {/* Marketplace — 5 cols */}
        {card("market", 0, { gridColumn: "span 5" }, <>
          <div style={{ padding: "20px 20px 10px", display: "flex", flexDirection: "column", gap: "7px" }}>
            {[
              { title: "SPY Momentum System", tag: "Strategy" },
              { title: "Crypto Swing Masterclass", tag: "Indicator" },
              { title: "Options Income Playbook", tag: "Course" },
            ].map(({ title, tag }) => (
              <div key={title} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>{title}</p>
                </div>
                {/* Verified badge */}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.85 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                <span style={{ fontSize: "9px", padding: "2px 7px", borderRadius: "4px", background: "rgba(232,132,106,0.1)", color: "var(--accent-color)", border: "1px solid rgba(232,132,106,0.2)", flexShrink: 0 }}>{tag}</span>
              </div>
            ))}
          </div>
          {label("Marketplace", "Courses & strategies from verified traders")}
        </>)}

        {/* Social Feed — 4 cols */}
        {card("feed", 0.08, { gridColumn: "span 4" }, <>
          <div style={{ padding: "20px 20px 10px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <MiniFeedPost color="rgba(232,132,106,0.8)" lines={[80, 60]} />
            <MiniFeedPost color="rgba(74,222,128,0.6)" lines={[65, 45, 30]} />
            <MiniFeedPost color="rgba(147,197,253,0.6)" lines={[55, 70]} />
          </div>
          {label("Social Feed", "Real-time takes from the community")}
        </>)}

        {/* Live Room — 3 cols (chart + chat) */}
        {card("live", 0.14, { gridColumn: "span 3" }, <>
          <div style={{ padding: "14px 16px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>AAPL · 1m</span>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent-color)", display: "inline-block" }} />
                <span style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "0.12em", color: "var(--accent-color)" }}>LIVE</span>
              </div>
            </div>
            <AnimatedChart />
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "8px" }}>
              {[["rgba(147,197,253,0.7)", "breakout confirmed ✓"], ["rgba(232,132,106,0.8)", "watching 178 resistance"], ["rgba(74,222,128,0.6)", "in at 175.40 🔥"]].map(([c, msg], i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: c as string, flexShrink: 0 }} />
                  <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)" }}>{msg}</span>
                </div>
              ))}
            </div>
          </div>
          {label("Live Room", "Chart + chat, trade with others in real time")}
        </>)}

        {/* Community — 3 cols */}
        {card("community", 0.18, { gridColumn: "span 3" }, <>
          <div style={{ padding: "14px 16px 10px", display: "flex", flexDirection: "column", gap: "5px" }}>
            {[
              { name: "Options Flow", members: "12.4k", color: "rgba(232,132,106,0.85)" },
              { name: "Crypto Traders", members: "8.1k", color: "rgba(147,197,253,0.65)" },
              { name: "Day Trading", members: "21k", color: "rgba(74,222,128,0.65)" },
              { name: "Macro & Rates", members: "5.3k", color: "rgba(251,191,36,0.65)" },
            ].map(({ name, members, color }, i) => (
              <div key={name}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", borderRadius: "8px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", animation: `community-pulse ${3 + i * 0.5}s ease-in-out ${i * 0.4}s infinite` }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.65)", flex: 1 }}>{name}</span>
                <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)" }}>{members}</span>
              </div>
            ))}
          </div>
          {label("Community", "Join groups, follow traders")}
        </>)}

        {/* Verified — 5 cols */}
        {card("verified", 0.22, { gridColumn: "span 5" }, <>
          <div style={{ padding: "18px 20px 10px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {/* Application card */}
            <div style={{ padding: "12px 14px", borderRadius: "10px", background: "rgba(232,132,106,0.05)", border: "1px solid rgba(232,132,106,0.15)", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>Apply for Verification</p>
                <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>Submit track record · Get reviewed · Earn the badge</p>
              </div>
            </div>
            {/* Sell knowledge row */}
            <div style={{ padding: "10px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: "10px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(251,191,36,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>Once verified, <span style={{ color: "rgba(255,255,255,0.6)" }}>sell your strategies, courses, and insights</span> directly to the community.</p>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {[["Track Record", "rgba(74,222,128,0.7)"], ["Risk Review", "rgba(147,197,253,0.7)"], ["Badge Issued", "rgba(232,132,106,0.8)"]].map(([t, c]) => (
                <div key={t as string} style={{ flex: 1, padding: "6px 8px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
                  <span style={{ fontSize: "8px", fontWeight: 600, color: c as string, letterSpacing: "0.08em" }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
          {label("Get Verified", "Earn your badge · sell your knowledge")}
        </>)}

        {/* Brokerage — 4 cols, animated line graph */}
        {card("broker", 0.26, { gridColumn: "span 4" }, <>
          <div style={{ padding: "14px 16px 0" }}>
            <div style={{ marginBottom: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>Portfolio</span>
            </div>
            <MiniLineChart color="var(--accent-color)" points={[50, 54, 48, 52, 44, 49, 55, 51, 58, 53, 47, 52, 60, 56, 63, 58, 66, 62, 57, 64, 70, 65, 72, 68]} fill />
            <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
              {[["IBKR", "rgba(232,132,106,0.7)"], ["TD", "rgba(147,197,253,0.6)"], ["Schwab", "rgba(74,222,128,0.6)"], ["+ More", "rgba(255,255,255,0.2)"]].map(([name, c]) => (
                <div key={name as string} style={{ flex: 1, padding: "5px 4px", borderRadius: "6px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
                  <span style={{ fontSize: "8px", fontWeight: 600, color: c as string }}>{name}</span>
                </div>
              ))}
            </div>
          </div>
          {label("Connect Brokerage", "Link accounts, track P&L in one place")}
        </>)}


      </div>
    </div>
  );
}

// ─── Screenshot Showcase ──────────────────────────────────────────────────────

const SCREENSHOTS = [
  { src: "/ss-dashboard.png",    label: "Dashboard",    desc: "Everything at a glance" },
  { src: "/ss-marketplace.png",  label: "Marketplace",  desc: "Strategies from verified traders" },
  { src: "/ss-greeks.png",       label: "Greeks & Options", desc: "Coming soon — derivatives intelligence" },
  { src: "/ss-social-feed.png",  label: "Social Feed",  desc: "Real-time takes from the community" },
  { src: "/ss-profile.png",      label: "Profile",      desc: "Your identity on the platform" },
];

function ScreenshotShowcase() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [active, setActive] = useState(0);

  const prev = () => setActive(i => (i - 1 + SCREENSHOTS.length) % SCREENSHOTS.length);
  const next = () => setActive(i => (i + 1) % SCREENSHOTS.length);

  return (
    <div ref={ref} style={{ width: "min(96vw, 1300px)", margin: "0 auto", padding: "56px 0 12px" }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }}
        style={{ textAlign: "center", marginBottom: "36px" }}>
        <p className="overline-label" style={{ marginBottom: "12px" }}>Preview</p>
        <p style={{ fontFamily: "var(--font-lora), Georgia, serif", fontSize: "clamp(20px, 2.4vw, 28px)", fontWeight: 600, color: "#fff" }}>
          Our Platform
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.1, duration: 0.5 }}>
        {/* Main screenshot */}
        <div style={{ position: "relative", borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.09)", boxShadow: "0 8px 60px rgba(0,0,0,0.6)" }}>
          <motion.img
            key={active}
            src={SCREENSHOTS[active].src}
            alt={SCREENSHOTS[active].label}
            initial={{ opacity: 0, scale: 1.01 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            style={{ width: "100%", display: "block", aspectRatio: "16/9", objectFit: "cover", objectPosition: "top left" }}
          />
          {/* Bottom gradient + label overlay */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "32px 28px 22px", background: "linear-gradient(to top, rgba(8,13,20,0.92) 0%, rgba(8,13,20,0.4) 60%, transparent 100%)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <p style={{ fontFamily: "var(--font-lora), Georgia, serif", fontSize: "18px", fontWeight: 600, color: "#fff" }}>{SCREENSHOTS[active].label}</p>
              {SCREENSHOTS[active].desc.toLowerCase().includes("coming soon") && (
                <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(251,191,36,0.9)", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)", padding: "2px 8px", borderRadius: "6px" }}>Coming Soon</span>
              )}
            </div>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>{SCREENSHOTS[active].desc}</p>
          </div>
          {/* Prev / next arrow buttons */}
          {([["←", prev, "left: 16px"], ["→", next, "right: 16px"]] as const).map(([arrow, fn, pos]) => (
            <button key={arrow as string} onClick={fn as () => void}
              style={{
                position: "absolute", top: "50%", transform: "translateY(-50%)", ...(Object.fromEntries([(pos as string).split(": ") as [string, string]])),
                width: 40, height: 40, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(8,13,20,0.7)", backdropFilter: "blur(8px)", color: "#fff",
                fontSize: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "border-color 0.2s, background 0.2s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(232,132,106,0.5)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(232,132,106,0.12)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(8,13,20,0.7)"; }}
            >{arrow}</button>
          ))}
        </div>

        {/* Dot + thumbnail nav */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "20px", alignItems: "center" }}>
          {SCREENSHOTS.map(({ src, label }, i) => (
            <button key={label} onClick={() => setActive(i)}
              style={{
                padding: 0, border: `2px solid ${active === i ? "var(--accent-color)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: "8px", overflow: "hidden", cursor: "pointer", opacity: active === i ? 1 : 0.45,
                transition: "border-color 0.2s, opacity 0.2s", width: 80, height: 50, flexShrink: 0,
              }}>
              <img src={src} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top left", display: "block" }} />
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Pricing Plans ────────────────────────────────────────────────────────────

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

const LANDING_PLANS = [
  { name: "Starter", tagline: "For the committed.",          price: 19,  glow: "rgba(232,132,106,0.12)", badge: null as string | null, highlight: false, key: "starter" as const },
  { name: "Pro",     tagline: "Serious edge. No excuses.",   price: 29,  glow: "rgba(232,132,106,0.18)", badge: "Most Popular",         highlight: true,  key: "pro"     as const },
  { name: "Elite",   tagline: "Built for serious traders.", price: 89, glow: "rgba(232,132,106,0.12)", badge: null as string | null, highlight: false, key: "elite"   as const },
] as const;

function PricingPlans() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [hovered, setHovered] = useState<string | null>(null);

  const featureVal = (val: string | boolean) => {
    if (val === false) return null;
    if (val === true) return true;
    return val as string;
  };

  return (
    <div ref={ref} style={{ width: "min(96vw, 1300px)", margin: "0 auto", padding: "56px 0 48px" }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }}
        style={{ textAlign: "center", marginBottom: "48px" }}>
        <h2 style={{ fontFamily: "var(--font-lora), Georgia, serif", fontSize: "clamp(26px, 3vw, 38px)", fontWeight: 600, color: "#fff", marginBottom: "0", letterSpacing: "-0.01em" }}>
          Pricing
        </h2>
      </motion.div>

      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
        {LANDING_PLANS.map(({ name, tagline, price, glow, badge, highlight, key }, i) => (
          <motion.div key={name}
            initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            onMouseEnter={() => setHovered(name)} onMouseLeave={() => setHovered(null)}
            style={{
              position: "relative", overflow: "hidden",
              borderRadius: "16px",
              border: `1px solid ${highlight ? "rgba(232,132,106,0.3)" : hovered === name ? "rgba(232,132,106,0.18)" : "rgba(255,255,255,0.07)"}`,
              background: highlight ? "rgba(232,132,106,0.04)" : "rgba(255,255,255,0.02)",
              backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
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
              </div>

              {/* Name + tagline */}
              <p style={{ fontFamily: "var(--font-lora), Georgia, serif", fontSize: "clamp(20px, 2.2vw, 26px)", fontWeight: 600, color: "#fff", marginBottom: "4px", lineHeight: 1.1 }}>{name}</p>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)", marginBottom: "20px", letterSpacing: "0.04em" }}>{tagline}</p>

              {/* Price */}
              <div style={{ display: "flex", alignItems: "baseline", gap: "2px", marginBottom: "20px" }}>
                <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>$</span>
                <span style={{ fontFamily: "var(--font-lora), Georgia, serif", fontSize: "clamp(36px, 4vw, 48px)", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>{price}</span>
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)", marginLeft: "3px" }}>/ month</span>
              </div>

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
              <motion.a href="/pricing"
                whileHover={{ scale: 1.03, boxShadow: "0 0 28px rgba(232,132,106,0.6)" }}
                whileTap={{ scale: 0.97 }}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  width: "100%", padding: "13px 0", borderRadius: "10px",
                  border: "1.5px solid var(--accent-color)",
                  background: highlight ? "rgba(232,132,106,0.12)" : "transparent",
                  color: "var(--accent-color)",
                  fontFamily: "var(--font-lora)",
                  fontSize: "13px", fontWeight: 600, letterSpacing: "0.03em",
                  textDecoration: "none", cursor: "pointer",
                  willChange: "transform",
                }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                Get {name}
              </motion.a>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Footer note */}
      <motion.p initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ delay: 0.4 }}
        style={{ textAlign: "center", marginTop: "24px", fontSize: "11px", color: "rgba(255,255,255,0.18)", letterSpacing: "0.06em" }}>
        Cancel anytime · Stripe-secured · Instant access on activation
      </motion.p>
    </div>
  );
}

// ─── Section 3: Toolbar Showcase ──────────────────────────────────────────────

const W = { borderRadius: "12px", border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.025)", overflow: "hidden" as const, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" };
const wVis = (children: React.ReactNode) => (
  <div style={{ padding: "10px 12px 4px", minHeight: 64 }}>{children}</div>
);
const miniRow = (left: string, right: string, color?: string) => (
  <div key={left} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
    <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)" }}>{left}</span>
    <span style={{ fontSize: "9px", fontWeight: 600, color: color ?? "rgba(255,255,255,0.3)" }}>{right}</span>
  </div>
);
const miniBar = (pct: number, color: string) => (
  <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", marginBottom: 5 }}>
    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }} style={{ height: "100%", borderRadius: 3, background: color }} />
  </div>
);

function ShowcaseWidget({ name, desc, badge, delay, inView, children }: { name: string; desc: string; badge?: { label: string; color: string; bg: string }; delay: number; inView: boolean; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.4 }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ ...W, transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s", borderColor: hov ? "rgba(232,132,106,0.3)" : "rgba(255,255,255,0.07)", boxShadow: hov ? "0 0 24px rgba(232,132,106,0.1)" : "none", transform: hov ? "translateY(-2px)" : "none" }}
    >
      {wVis(children)}
      <div style={{ padding: "8px 12px 11px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
          <p style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>{name}</p>
          {badge && (
            <span style={{ fontSize: "7px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: badge.color, background: badge.bg, padding: "1px 5px", borderRadius: "4px", flexShrink: 0 }}>{badge.label}</span>
          )}
        </div>
        <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.22)", lineHeight: 1.4 }}>{desc}</p>
      </div>
    </motion.div>
  );
}

function SectionGroup({ title, color, cols, delay, inView, items }: { title: string; color: string; cols: number; delay: number; inView: boolean; items: { name: string; desc: string; badge?: { label: string; color: string; bg: string }; vis: React.ReactNode }[] }) {
  return (
    <div style={{ marginBottom: "40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
        <span style={{ fontFamily: "var(--font-lora), Georgia, serif", fontSize: "16px", fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>{title}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "10px" }}>
        {items.map((item, i) => (
          <ShowcaseWidget key={item.name} name={item.name} desc={item.desc} badge={item.badge} delay={delay + i * 0.04} inView={inView}>{item.vis}</ShowcaseWidget>
        ))}
      </div>
    </div>
  );
}

function ToolbarShowcaseInner() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  const marketsItems = [
    { name: "News", desc: "Curated headlines, live", vis: <>
      {[["MARKETS","Fed holds rates steady"],["CRYPTO","BTC breaks $68k"],["TECH","NVDA earnings beat"]].map(([tag,head],i)=>(
        <motion.div key={head} initial={{opacity:0,x:-6}} animate={{opacity:1,x:0}} transition={{delay:i*0.1,duration:0.3}}
          style={{display:"flex",gap:5,marginBottom:5,alignItems:"flex-start"}}>
          <span style={{fontSize:"7px",padding:"1px 4px",borderRadius:3,background:"rgba(232,132,106,0.12)",color:"var(--accent-color)",flexShrink:0,marginTop:1}}>{tag}</span>
          <span style={{fontSize:"8px",color:"rgba(255,255,255,0.38)",lineHeight:1.3}}>{head}</span>
        </motion.div>
      ))}
    </> },
    { name: "Maps", desc: "Sector heatmap & flows", vis: <>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {[0.9,0.4,0.7,0.2,0.8,0.5,0.3,0.6,0.9,0.1,0.7,0.4,0.8,0.2,0.3,0.6,0.9,0.5,0.7,0.4,0.8].map((v,i)=>(
          <motion.div key={i} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.02,duration:0.3}}
            style={{height:8,borderRadius:2,background:`rgba(${v>0.5?"74,222,128":"248,113,113"},${v*0.8})`}}/>
        ))}
      </div>
    </> },
    { name: "Bonds", desc: "Yield curves & treasury rates", vis: <MiniLineChart color="rgba(147,197,253,0.8)" points={[30,32,31,35,38,36,40,39,43,42,45,44]} /> },
    { name: "Dividends", desc: "Yields, ex-dates & history", vis: <>
      {[["AAPL","0.92%","rgba(74,222,128,0.7)"],["JNJ","3.14%","rgba(74,222,128,0.7)"],["XOM","3.82%","rgba(74,222,128,0.7)"]].map(([s,v,c],i)=>(
        <motion.div key={s} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.1}}>
          {miniRow(s,v,c)}
        </motion.div>
      ))}
    </> },
    { name: "Forex", desc: "Major currency pair rates", vis: <>
      {[["EUR/USD","+0.12%",true],["GBP/USD","-0.08%",false],["USD/JPY","+0.31%",true]].map(([p,c,u],i)=>(
        <div key={p as string} style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
          <span style={{fontSize:"8px",color:"rgba(255,255,255,0.4)",fontFamily:"monospace"}}>{p as string}</span>
          <motion.span animate={{opacity:[0.7,1,0.7]}} transition={{duration:2.5+i*0.4,repeat:Infinity,ease:"easeInOut"}}
            style={{fontSize:"8px",fontWeight:600,color:u?"rgba(74,222,128,0.8)":"rgba(248,113,113,0.8)"}}>{c as string}</motion.span>
        </div>
      ))}
    </> },
    { name: "Futures", desc: "Index & commodity contracts", vis: <>
      {[["ES1!","5,284",true],["NQ1!","18,422",true],["CL1!","82.14",false]].map(([s,p,u],i)=>(
        <div key={s as string} style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
          <span style={{fontSize:"8px",color:"rgba(255,255,255,0.35)",fontFamily:"monospace"}}>{s as string}</span>
          <motion.span animate={{opacity:[0.6,1,0.6]}} transition={{duration:3+i*0.5,repeat:Infinity}}
            style={{fontSize:"8px",color:u?"rgba(74,222,128,0.7)":"rgba(248,113,113,0.7)"}}>{p as string}</motion.span>
        </div>
      ))}
    </> },
    { name: "Crypto", desc: "Top coins, prices & moves", vis: <>
      {[["BTC","+2.8%",true],["ETH","+1.9%",true],["SOL","-0.6%",false]].map(([s,c,u],i)=>(
        <div key={s as string} style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
          <span style={{fontSize:"8px",fontWeight:700,color:"rgba(255,255,255,0.5)"}}>{s as string}</span>
          <motion.span animate={{opacity:[0.7,1,0.7]}} transition={{duration:2+i*0.3,repeat:Infinity}}
            style={{fontSize:"8px",fontWeight:600,color:u?"rgba(74,222,128,0.8)":"rgba(248,113,113,0.8)"}}>{c as string}</motion.span>
        </div>
      ))}
    </> },
    { name: "Market Relations", desc: "Stock correlation network", vis: <>
      <svg viewBox="0 0 80 55" style={{width:"100%",height:55}}>
        {[[40,27],[15,12],[65,12],[15,44],[65,44]].map(([x,y],i)=>(
          <g key={i}>
            <line x1={40} y1={27} x2={x} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth={1}/>
            <motion.circle cx={x} cy={y} r={5} fill={["rgba(232,132,106,0.6)","rgba(74,222,128,0.5)","rgba(147,197,253,0.5)","rgba(251,191,36,0.5)"][i%4]}
              animate={{r:[4,6,4]}} transition={{duration:2+i*0.4,repeat:Infinity,ease:"easeInOut"}}/>
          </g>
        ))}
        <motion.circle cx={40} cy={27} r={7} fill="rgba(232,132,106,0.4)" stroke="rgba(232,132,106,0.6)" strokeWidth={1}
          animate={{r:[6,8,6]}} transition={{duration:2,repeat:Infinity,ease:"easeInOut"}}/>
      </svg>
    </> },
    { name: "Greeks & Options", desc: "Volatility, greeks & exposure", badge: { label: "Soon", color: "rgba(251,191,36,0.9)", bg: "rgba(251,191,36,0.1)" }, vis: <>
      {/* VIX headline */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5}}>
        <div style={{display:"flex",alignItems:"baseline",gap:4}}>
          <span style={{fontSize:"7px",color:"rgba(255,255,255,0.3)"}}>VIX</span>
          <motion.span animate={{opacity:[0.8,1,0.8]}} transition={{duration:2.5,repeat:Infinity}}
            style={{fontSize:"13px",fontWeight:800,color:"rgba(74,222,128,0.9)"}} >18.4</motion.span>
        </div>
        <span style={{fontSize:"7px",fontWeight:600,color:"rgba(74,222,128,0.6)",background:"rgba(74,222,128,0.08)",padding:"1px 4px",borderRadius:3}}>Contango</span>
      </div>
      {/* Term structure mini */}
      <div style={{display:"flex",alignItems:"flex-end",gap:2,height:22,marginBottom:5}}>
        {[{l:"9D",h:72},{l:"30",h:58},{l:"3M",h:50},{l:"6M",h:46},{l:"1Y",h:42}].map(({l,h},i)=>(
          <div key={l} style={{flex:1,textAlign:"center"}}>
            <motion.div initial={{height:0}} animate={{height:`${h}%`}} transition={{delay:i*0.08,duration:0.5,ease:"easeOut"}}
              style={{width:"100%",borderRadius:"2px 2px 0 0",background:`rgba(239,68,68,${0.3+i*0.1})`,margin:"0 auto"}}/>
          </div>
        ))}
      </div>
      {/* Cross-asset vol bars */}
      {[["S&P",32,"rgba(96,165,250,0.6)"],["Gold",18,"rgba(251,191,36,0.5)"],["Bonds",14,"rgba(147,197,253,0.5)"]].map(([n,w,c])=>(
        <div key={n as string} style={{display:"flex",alignItems:"center",gap:4,marginBottom:3}}>
          <span style={{fontSize:"7px",color:"rgba(255,255,255,0.25)",width:22,flexShrink:0}}>{n as string}</span>
          <div style={{flex:1,height:3,borderRadius:2,background:"rgba(255,255,255,0.04)"}}>
            <motion.div initial={{width:0}} animate={{width:`${w as number}%`}} transition={{duration:0.7,ease:"easeOut"}}
              style={{height:"100%",borderRadius:2,background:c as string}}/>
          </div>
          <span style={{fontSize:"6px",color:"rgba(255,255,255,0.2)",width:18,textAlign:"right"}}>{w as number}%</span>
        </div>
      ))}
    </> },
    { name: "Building Data", desc: "Commercial real estate metrics", vis: <>
      <div style={{display:"flex",alignItems:"flex-end",gap:3,height:44}}>
        {[60,45,70,55,80,65,50,75,60,40].map((h,i)=>(
          <motion.div key={i} initial={{height:0}} animate={{height:`${h}%`}} transition={{delay:i*0.05,duration:0.5,ease:"easeOut"}}
            style={{flex:1,borderRadius:"2px 2px 0 0",background:`rgba(147,197,253,${0.3+i*0.04})`}}/>
        ))}
      </div>
    </> },
    { name: "Sentiment Radar", desc: "Crowd bullish/bearish breakdown", vis: <>
      <div style={{height:8,borderRadius:4,background:"rgba(255,255,255,0.06)",overflow:"hidden",marginBottom:5,display:"flex"}}>
        <motion.div initial={{width:0}} animate={{width:"68%"}} transition={{duration:0.9,ease:"easeOut"}} style={{height:"100%",background:"rgba(74,222,128,0.7)"}}/>
        <motion.div initial={{width:0}} animate={{width:"22%"}} transition={{duration:0.9,delay:0.1,ease:"easeOut"}} style={{height:"100%",background:"rgba(248,113,113,0.7)"}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        <span style={{fontSize:"8px",color:"rgba(74,222,128,0.7)"}}>68% Bullish</span>
        <span style={{fontSize:"8px",color:"rgba(248,113,113,0.7)"}}>22% Bearish</span>
      </div>
    </> },
    { name: "Insider Trades", desc: "SEC filings, exec buy/sell", vis: <>
      {[["NVDA","CEO","$4.2M BUY"],["META","CFO","$1.8M SELL"],["AAPL","Dir","$920K BUY"]].map(([t,r,a],i)=>(
        <motion.div key={t as string} animate={{opacity:[0.7,1,0.7]}} transition={{duration:3+i*0.6,repeat:Infinity,ease:"easeInOut"}}
          style={{display:"flex",gap:5,marginBottom:5,alignItems:"center"}}>
          <span style={{fontSize:"8px",fontWeight:700,color:"rgba(255,255,255,0.5)",width:28}}>{t as string}</span>
          <span style={{fontSize:"7px",color:"rgba(255,255,255,0.25)",flex:1}}>{r as string}</span>
          <span style={{fontSize:"7px",fontWeight:600,color:(a as string).includes("BUY")?"rgba(74,222,128,0.8)":"rgba(248,113,113,0.8)"}}>{a as string}</span>
        </motion.div>
      ))}
    </> },
    { name: "Fiscal Watch", desc: "Government spending tracker", vis: <>
      {[["Defense",78],["Healthcare",62],["Infrastructure",45],["Education",38]].map(([l,p])=>(
        <div key={l as string} style={{marginBottom:4}}>
          <span style={{fontSize:"7px",color:"rgba(255,255,255,0.3)"}}>{l as string}</span>
          {miniBar(p as number,"rgba(147,197,253,0.5)")}
        </div>
      ))}
    </> },
    { name: "Portfolios", desc: "Multi-account allocation view", vis: <>
      {[["AAPL",30,"rgba(232,132,106,0.8)"],["NVDA",22,"rgba(74,222,128,0.7)"],["BTC",18,"rgba(147,197,253,0.7)"],["Cash",12,"rgba(251,191,36,0.6)"],["Other",18,"rgba(255,255,255,0.18)"]].map(([n,p,c],i)=>(
        <div key={n as string} style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
          <span style={{fontSize:"7px",color:"rgba(255,255,255,0.35)",width:26,flexShrink:0}}>{n as string}</span>
          <div style={{flex:1,height:5,borderRadius:3,background:"rgba(255,255,255,0.05)"}}>
            <motion.div initial={{width:0}} animate={{width:`${(p as number)/30*100}%`}} transition={{delay:i*0.08,duration:0.6,ease:"easeOut"}}
              style={{height:"100%",borderRadius:3,background:c as string}}/>
          </div>
          <span style={{fontSize:"7px",color:"rgba(255,255,255,0.28)",width:20,textAlign:"right",flexShrink:0}}>{p as number}%</span>
        </div>
      ))}
    </> },
  ];

  const analyticsItems = [
    { name: "CEOs", desc: "Executive profiles & activity", vis: <>
      {[["Jensen Huang","NVDA"],["Tim Cook","AAPL"],["Elon Musk","TSLA"]].map(([n,t],i)=>(
        <motion.div key={n as string} animate={{opacity:[0.65,1,0.65]}} transition={{duration:3+i*0.7,repeat:Infinity,ease:"easeInOut"}}
          style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
          <div style={{width:16,height:16,borderRadius:"50%",background:"rgba(232,132,106,0.25)",flexShrink:0}}/>
          <span style={{fontSize:"9px",color:"rgba(255,255,255,0.45)",flex:1}}>{n as string}</span>
          <span style={{fontSize:"8px",color:"rgba(255,255,255,0.22)"}}>{t as string}</span>
        </motion.div>
      ))}
    </> },
    { name: "Calendar", desc: "Earnings & economic events", vis: <>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {Array.from({length:28},(_,i)=>{
          const hasEvent=[3,7,12,15,19,22,26].includes(i);
          return hasEvent
            ? <motion.div key={i} animate={{opacity:[0.5,1,0.5]}} transition={{duration:2,repeat:Infinity,delay:i*0.05,ease:"easeInOut"}}
                style={{height:8,borderRadius:2,background:"rgba(232,132,106,0.55)"}}/>
            : <div key={i} style={{height:8,borderRadius:2,background:"rgba(255,255,255,0.05)"}}/>;
        })}
      </div>
    </> },
    { name: "Screener", desc: "Filter stocks by any metric", vis: <>
      <div style={{display:"flex",gap:3,marginBottom:6,flexWrap:"wrap"}}>
        {["P/E < 20","Div > 2%","Cap > 1B"].map((f,i)=>(
          <motion.span key={f} initial={{opacity:0,scale:0.8}} animate={{opacity:1,scale:1}} transition={{delay:i*0.08}}
            style={{fontSize:"7px",padding:"2px 5px",borderRadius:4,background:"rgba(232,132,106,0.1)",color:"var(--accent-color)",border:"1px solid rgba(232,132,106,0.2)"}}>{f}</motion.span>
        ))}
      </div>
      {[["AAPL","28.4"],["MSFT","34.1"],["V","29.8"]].map(([s,v])=>miniRow(s as string,v as string))}
    </> },
    { name: "Supply Chain", desc: "Upstream & downstream map", vis: <>
      <svg viewBox="0 0 112 56" style={{width:"100%",height:56}}>
        {[{x:10,label:"Raw"},{x:38,label:"Mfg"},{x:66,label:"Dist"},{x:94,label:"Retail"}].map(({x,label},i)=>(
          <g key={i}>
            <motion.rect x={x-8} y={14} width={20} height={20} rx={3}
              fill="rgba(255,255,255,0.04)" stroke={["rgba(232,132,106,0.6)","rgba(147,197,253,0.5)","rgba(74,222,128,0.5)","rgba(251,191,36,0.5)"][i]} strokeWidth={1}
              animate={{opacity:[0.5,1,0.5]}} transition={{duration:1.8,repeat:Infinity,delay:i*0.45,ease:"easeInOut"}}/>
            <text x={x+2} y={28} textAnchor="middle" fontSize={5} fill="rgba(255,255,255,0.4)">{label}</text>
            {i<3&&(
              <>
                <line x1={x+12} y1={24} x2={x+30} y2={24} stroke="rgba(255,255,255,0.1)" strokeWidth={1}/>
                <motion.circle r={2.5} cy={24} fill="var(--accent-color)"
                  initial={{cx: x+12, opacity: 0}}
                  animate={{cx:[x+12, x+21, x+30], opacity:[0, 1, 0]}}
                  transition={{duration:0.8, delay:i*0.45, repeat:Infinity, repeatDelay:1.2, ease:"linear"}}/>
              </>
            )}
          </g>
        ))}
      </svg>
    </> },
    { name: "Backtest", desc: "Test strategies on history", vis: <>
      <MiniLineChart color="rgba(74,222,128,0.8)" points={[40,38,43,37,45,42,49,46,53,50,56,54,59,57,62,59,66,63,69]} fill />
      <div style={{display:"flex",gap:4,marginTop:5}}>
        {[["Win","68%","rgba(74,222,128,0.8)"],["DD","-12%","rgba(248,113,113,0.7)"],["Sharpe","1.84","rgba(147,197,253,0.7)"]].map(([l,v,c])=>(
          <div key={l as string} style={{flex:1,borderRadius:4,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.05)",padding:"3px 4px",textAlign:"center"}}>
            <p style={{fontSize:"7px",color:"rgba(255,255,255,0.25)",marginBottom:1}}>{l as string}</p>
            <p style={{fontSize:"9px",fontWeight:700,color:c as string}}>{v as string}</p>
          </div>
        ))}
      </div>
    </> },
    { name: "Archive", desc: "Strategy guides & research library", vis: <>
      {[["Options Flow Strategies","5d"],["Crypto Swing Guide","12d"],["Macro Playbook","18d"]].map(([t,d],i)=>(
        <motion.div key={t} initial={{opacity:0,x:-5}} animate={{opacity:1,x:0}} transition={{delay:i*0.09}}
          style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <span style={{fontSize:"8px",color:"rgba(255,255,255,0.4)",flex:1,paddingRight:6,lineHeight:1.3}}>{t}</span>
          <span style={{fontSize:"7px",color:"rgba(255,255,255,0.2)",flexShrink:0}}>{d}</span>
        </motion.div>
      ))}
    </> },
  ];

  const personalItems = [
    { name: "Journal", desc: "Trade log, analytics & P&L analysis", vis: <>
      {/* Mini calendar */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:6}}>
        {Array.from({length:21}).map((_,i)=>{
          const active=[2,5,8,11,14,17,18,20].includes(i);
          const profit=[2,8,14,18].includes(i);
          return <div key={i} style={{height:6,borderRadius:1.5,background:active?(profit?"rgba(0,200,150,0.55)":"rgba(239,68,68,0.45)"):"rgba(255,255,255,0.06)"}} />;
        })}
      </div>
      {/* Mini sparkline */}
      <svg width="100%" height="22" viewBox="0 0 80 22" preserveAspectRatio="none">
        <polyline points="0,18 12,14 24,16 36,9 48,11 60,5 72,7 80,3" fill="none" stroke="rgba(232,132,106,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="0,18 12,14 24,16 36,9 48,11 60,5 72,7 80,3 80,22 0,22" fill="rgba(232,132,106,0.08)" stroke="none"/>
      </svg>
    </> },
    { name: "Prediction Markets", desc: "Community odds on key events", badge: { label: "Beta", color: "rgba(147,197,253,0.9)", bg: "rgba(147,197,253,0.1)" }, vis: <>
      {[["Fed cuts in June?",72],["BTC > 80k by EOY?",58],["NVDA beats Q2?",84]].map(([q,p])=>(
        <div key={q as string} style={{marginBottom:5}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
            <span style={{fontSize:"7px",color:"rgba(255,255,255,0.3)",flex:1}}>{q as string}</span>
            <span style={{fontSize:"7px",fontWeight:700,color:"rgba(74,222,128,0.8)"}}>{p as number}%</span>
          </div>
          {miniBar(p as number,"rgba(74,222,128,0.5)")}
        </div>
      ))}
    </> },
    { name: "My Watchlist", desc: "Your saved tickers at a glance", vis: <>
      {[["NVDA","+3.1%",true],["BTC/USD","+2.8%",true],["TSLA","-0.9%",false]].map(([s,c,u],i)=>(
        <div key={s as string} style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
          <span style={{fontSize:"9px",fontWeight:600,color:"rgba(255,255,255,0.5)"}}>{s as string}</span>
          <motion.span animate={{opacity:[0.7,1,0.7]}} transition={{duration:2.2+i*0.4,repeat:Infinity,ease:"easeInOut"}}
            style={{fontSize:"9px",fontWeight:600,color:u?"rgba(74,222,128,0.8)":"rgba(248,113,113,0.8)"}}>{c as string}</motion.span>
        </div>
      ))}
    </> },
    { name: "Workspace", desc: "Custom dashboard layouts", vis: <>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:3}}>
        {(["rgba(232,132,106,0.15)","rgba(147,197,253,0.12)","rgba(74,222,128,0.12)","rgba(251,191,36,0.1)"] as string[]).map((bg,i)=>(
          <motion.div key={i} initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} transition={{delay:i*0.08,duration:0.3}}
            style={{height:22,borderRadius:4,background:bg,border:"1px solid rgba(255,255,255,0.06)"}}/>
        ))}
      </div>
    </> },
    { name: "Taxes", desc: "P&L tracking & tax estimates", badge: { label: "Soon", color: "rgba(251,191,36,0.9)", bg: "rgba(251,191,36,0.1)" }, vis: <>
      {[["Short-term","$12,440","rgba(248,113,113,0.7)"],["Long-term","$8,220","rgba(74,222,128,0.7)"],["Dividends","$1,840","rgba(147,197,253,0.7)"],["Est. owed","$4,180","rgba(251,191,36,0.8)"]].map(([l,v,c],i)=>(
        <motion.div key={l as string} initial={{opacity:0,x:4}} animate={{opacity:1,x:0}} transition={{delay:i*0.07}}>
          {miniRow(l as string,v as string,c as string)}
        </motion.div>
      ))}
    </> },
  ];

  return (
    <div ref={ref} style={{ width: "min(96vw, 1300px)", margin: "0 auto", paddingBottom: "48px" }}>

      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        style={{ textAlign: "center", marginBottom: "36px" }}
      >
        <p className="overline-label" style={{ marginBottom: "12px" }}>Explore the toolkit</p>
        <p style={{ fontFamily: "var(--font-lora), Georgia, serif", fontSize: "clamp(20px, 2.4vw, 28px)", fontWeight: 600, color: "#fff" }}>
          Some of our features
        </p>
      </motion.div>

      {/* Whiteboard — full-width feature card */}
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        style={{ ...W, marginBottom: "40px" }}
      >
        <div style={{ padding: "18px 20px 0", display: "flex", gap: "20px", alignItems: "flex-start" }}>
          {/* Canvas mock */}
          <div style={{ flex: 1, borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", position: "relative", height: "130px" }}>
            <svg width="100%" height="100%" viewBox="0 0 600 130" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
              {[1,2,3,4,5].map(i => <line key={`h${i}`} x1="0" y1={i*22} x2="600" y2={i*22} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>)}
              {[1,2,3,4,5,6,7,8,9,10,11].map(i => <line key={`v${i}`} x1={i*54} y1="0" x2={i*54} y2="130" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>)}
              <polyline points="0,95 60,88 120,92 180,75 240,80 300,62 360,68 420,50 480,55 540,42 600,38" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5"/>
              <line x1="30" y1="100" x2="580" y2="45" stroke="rgba(147,197,253,0.55)" strokeWidth="1.8" strokeDasharray="6 3"/>
              <rect x="280" y="30" width="180" height="22" rx="3" fill="rgba(251,191,36,0.07)" stroke="rgba(251,191,36,0.3)" strokeWidth="1"/>
              <text x="370" y="44" textAnchor="middle" fill="rgba(251,191,36,0.7)" fontSize="8" fontFamily="monospace">resistance zone</text>
              <line x1="420" y1="115" x2="420" y2="58" stroke="rgba(74,222,128,0.5)" strokeWidth="1.5"/>
              <polygon points="414,60 420,48 426,60" fill="rgba(74,222,128,0.5)"/>
              <text x="434" y="90" fill="rgba(74,222,128,0.6)" fontSize="8" fontFamily="monospace">entry</text>
              <rect x="18" y="10" width="80" height="36" rx="3" fill="rgba(232,132,106,0.12)" stroke="rgba(232,132,106,0.25)" strokeWidth="1"/>
              <text x="58" y="25" textAnchor="middle" fill="rgba(232,132,106,0.8)" fontSize="7.5" fontFamily="monospace" fontWeight="600">key support</text>
              <text x="58" y="38" textAnchor="middle" fill="rgba(232,132,106,0.5)" fontSize="7" fontFamily="monospace">~$178</text>
            </svg>
            {[
              { x: "22%", y: "68%", color: "rgba(147,197,253,0.9)", label: "mk" },
              { x: "68%", y: "22%", color: "rgba(251,191,36,0.9)", label: "rx" },
              { x: "84%", y: "55%", color: "rgba(74,222,128,0.9)", label: "jd" },
            ].map(({ x, y, color, label }) => (
              <div key={label} style={{ position: "absolute", left: x, top: y, display: "flex", alignItems: "center", gap: "3px" }}>
                <svg width="10" height="12" viewBox="0 0 10 12" fill={color}><path d="M0 0l10 7-5 1-2 4z"/></svg>
                <span style={{ fontSize: "8px", fontWeight: 700, color, background: "rgba(0,0,0,0.5)", padding: "1px 4px", borderRadius: "3px" }}>{label}</span>
              </div>
            ))}
          </div>
          {/* Right text */}
          <div style={{ width: "220px", flexShrink: 0, paddingTop: "4px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {["Draw", "Annotate", "Vote on levels"].map(t => (
                <span key={t} style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", padding: "3px 7px", borderRadius: "4px" }}>{t}</span>
              ))}
            </div>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", lineHeight: 1.7 }}>
              A shared canvas for your community. Sketch trade ideas, mark support and resistance, drop sticky notes — all in real time with your group.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {["rgba(147,197,253,0.8)", "rgba(251,191,36,0.8)", "rgba(74,222,128,0.8)", "rgba(232,132,106,0.8)"].map((c, i) => (
                <div key={i} style={{ width: 20, height: 20, borderRadius: "50%", background: c, border: "1.5px solid rgba(0,0,0,0.4)", marginLeft: i > 0 ? "-6px" : 0 }} />
              ))}
              <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.28)", marginLeft: "4px" }}>3 drawing now</span>
            </div>
          </div>
        </div>
        <div style={{ padding: "14px 20px 18px" }}>
          <p style={{ fontFamily: "var(--font-lora), Georgia, serif", fontSize: "15px", fontWeight: 600, color: "#fff", marginBottom: "3px" }}>Community Whiteboard</p>
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>Collaborate on charts and trade ideas in real time</p>
        </div>
      </motion.div>

      <SectionGroup title="Markets" color="rgba(147,197,253,0.8)" cols={5} delay={0} inView={inView} items={marketsItems} />
      <SectionGroup title="Analytics" color="rgba(74,222,128,0.8)" cols={6} delay={0.05} inView={inView} items={analyticsItems} />
      <SectionGroup title="Personal" color="rgba(196,181,253,0.8)" cols={5} delay={0.1} inView={inView} items={personalItems} />
    </div>
  );
}

// ─── Section 4: Newsletter ────────────────────────────────────────────────────

function NewsletterSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="relative py-24 px-6">
      <div className="max-w-xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55 }}
        >
          <p className="overline-label mb-4">Stay in the loop</p>
          <p className="mb-5" style={{ color: "rgba(255,255,255,0.45)", fontSize: "15px", lineHeight: 1.7 }}>
            We ship new features every month with constant refinements — new tools, smarter analytics, and platform improvements based on what traders actually need.
          </p>
          <h2 className="font-black tracking-tight text-white mb-3"
            style={{ fontSize: "clamp(24px, 3.5vw, 38px)", letterSpacing: "-0.02em" }}>
            Get notified on new releases
          </h2>
          <p className="mb-8" style={{ color: "rgba(255,255,255,0.38)", fontSize: "14px" }}>
            Subscribe and we&apos;ll email you whenever a new version drops.
          </p>
          <div className="max-w-sm mx-auto">
            <NewsletterSignup />
          </div>
          <p className="mt-4 text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
            No spam. Unsubscribe anytime.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Security Trust Bar ───────────────────────────────────────────────────────

const SECURITY_FEATURES = [
  {
    title: "Two-Factor Authentication",
    desc: "Secure your account with a TOTP authenticator app or SMS code on every login.",
    tag: "2FA",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        <circle cx="12" cy="16" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: "AES-256 Encryption",
    desc: "All trade records, personal data, and API keys are encrypted at rest and in transit using bank-grade AES-256.",
    tag: "Encryption",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Active Session Guard",
    desc: "Every login is tracked by device and location. Suspicious sessions are flagged and revoked automatically.",
    tag: "Sessions",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
        <path d="M19.5 4.5l-15 15" stroke="rgba(74,222,128,0.7)" strokeWidth="1.4" />
      </svg>
    ),
  },
] as const;

function SecuritySection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section ref={ref} className="relative px-6 py-20">
      <div className="mx-auto" style={{ maxWidth: "min(96vw, 1300px)" }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          style={{ textAlign: "center", marginBottom: "40px" }}
        >
          <p className="overline-label" style={{ marginBottom: "10px" }}>Built for trust</p>
          <p style={{ fontFamily: "var(--font-lora), Georgia, serif", fontSize: "clamp(20px, 2.4vw, 28px)", fontWeight: 600, color: "#fff" }}>
            Your account, locked down.
          </p>
        </motion.div>

        {/* Three cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
          {SECURITY_FEATURES.map(({ title, desc, tag, icon }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              style={{
                padding: "28px 28px 24px",
                borderRadius: "16px",
                border: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(255,255,255,0.025)",
                backdropFilter: "blur(12px)",
                display: "flex", flexDirection: "column", gap: "14px",
              }}
            >
              {/* Icon + tag row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{
                  width: 42, height: 42, borderRadius: "10px",
                  background: "rgba(232,132,106,0.08)",
                  border: "1px solid rgba(232,132,106,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--accent-color)",
                  flexShrink: 0,
                }}>
                  {icon}
                </div>
                <span style={{
                  fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
                  color: "rgba(74,222,128,0.8)",
                  background: "rgba(74,222,128,0.07)",
                  border: "1px solid rgba(74,222,128,0.18)",
                  padding: "3px 8px", borderRadius: "5px",
                }}>{tag}</span>
              </div>
              {/* Text */}
              <div>
                <p style={{ fontFamily: "var(--font-lora), Georgia, serif", fontSize: "15px", fontWeight: 600, color: "#fff", marginBottom: "8px" }}>{title}</p>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.32)", lineHeight: 1.75 }}>{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section 3: Investor Quiz CTA ─────────────────────────────────────────────

function QuizCTASection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section ref={ref} className="relative flex items-center justify-center overflow-hidden py-40 px-6">
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(232,132,106,0.04) 0%, transparent 70%)",
      }} />
      <div className="relative z-10 text-center max-w-2xl mx-auto">
        <motion.h2 initial={{ opacity: 0, y: 22 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65 }}
          className="font-black tracking-tight text-white mb-5"
          style={{ fontSize: "clamp(40px, 6.5vw, 72px)", letterSpacing: "-0.025em" }}>
          Connection.<br />Trade.<br />Grow.
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 14 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.18, duration: 0.5 }}
          className="mb-10" style={{ color: "rgba(255,255,255,0.32)", fontSize: "15px" }}>
          Answer a few questions and we&apos;ll match you to the right plan.
        </motion.p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <motion.a href="/onboarding"
            whileHover={{ scale: 1.04, boxShadow: "0 0 32px rgba(232,132,106,0.35)" }}
            whileTap={{ scale: 0.97 }}
            initial={{ opacity: 0, y: 12 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ default: { duration: 0.18, ease: "easeOut" }, opacity: { delay: 0.3, duration: 0.48 }, y: { delay: 0.3, duration: 0.48 } }}
            style={{
              display: "inline-flex", alignItems: "center", gap: "10px",
              background: "transparent",
              border: "1.5px solid var(--accent-color)",
              color: "var(--accent-color)",
              fontFamily: "var(--font-lora)",
              fontSize: "15px", fontWeight: 600,
              letterSpacing: "0.03em",
              padding: "12px 32px",
              borderRadius: "12px",
              textDecoration: "none",
              transition: "background 0.2s",
              willChange: "transform",
            }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <path d="M9 12h6M9 16h4" />
            </svg>
            Take the Investor Quiz
          </motion.a>
        </div>
      </div>
    </section>
  );
}

// ─── What's New Panel ─────────────────────────────────────────────────────────

function WhatsNewPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          />
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: "100%" }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            style={{
              position: "fixed", top: 0, right: 0, bottom: 0, width: "min(520px, 92vw)", zIndex: 9999,
              background: "var(--app-bg, #0a0e17)", borderLeft: "1px solid rgba(255,255,255,0.08)",
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <h2 style={{ fontFamily: "var(--font-lora), Georgia, serif", fontSize: "18px", fontWeight: 600, color: "#fff", margin: 0 }}>What&apos;s New</h2>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginTop: "4px" }}>A running log of every update, improvement, and fix.</p>
              </div>
              <button onClick={onClose} style={{
                width: 32, height: 32, borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                transition: "border-color 0.2s, color 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(232,132,106,0.4)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
              <WhatsNewTimeline />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [ready, setReady] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);

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
        <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--app-bg)" }}>
          <div className="font-black tracking-tight text-white badge-pulse" style={{ fontSize: "24px", letterSpacing: "-0.02em" }}>
            Quantiv
          </div>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          {/* Ticker background scoped to content — stops before footer */}
          <TickerBackground />
          <div style={{ position: "relative", zIndex: 2 }}>
            <HeroSection />
            <NewsletterSection />
            <QuizCTASection />
          </div>
        </div>
      )}

      {/* What's New floating button — always visible */}
      {ready && (
        <motion.button
          onClick={() => setWhatsNewOpen(true)}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          whileHover={{ scale: 1.08, boxShadow: "0 0 28px rgba(232,132,106,0.4)", transition: { duration: 0.15 } }}
          whileTap={{ scale: 0.95, transition: { duration: 0.08 } }}
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 900,
            display: "flex", alignItems: "center", gap: "8px",
            padding: "10px 18px", borderRadius: "12px",
            border: "1px solid rgba(232,132,106,0.3)",
            background: "rgba(10,14,23,0.85)", backdropFilter: "blur(12px)",
            color: "var(--accent-color)", cursor: "pointer",
            fontFamily: "var(--font-lora)", fontSize: "13px", fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          What&apos;s New
        </motion.button>
      )}

      {/* What's New slide-out panel */}
      <WhatsNewPanel open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />

      <SiteFooter />
    </div>
  );
}
