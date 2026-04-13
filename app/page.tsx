"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { QuantivTradeLogoImage } from "../components/XchangeLogoImage";
import "./landing.css";
import { SiteFooter } from "../components/SiteFooter";
import { NewsletterSignup } from "../components/NewsletterSignup";

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

type Ticker = { s: string; p: string; c: string; up: boolean; base: number; chg: number };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmtPrice(n: number, base: number): string {
  if (base >= 10000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (base >= 1000)  return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (base < 1)      return n.toFixed(4);
  return n.toFixed(2);
}

function initTicker(t: { s: string; p: string; c: string; up: boolean }): Ticker {
  const base = parseFloat(t.p.replace(/,/g, ""));
  const chg  = parseFloat(t.c.replace("+", ""));
  return { ...t, base, chg };
}

const COLS = 15;
const ROWS = 6;
const TILE_ROWS = 150; // enough to fill full page height

function TickerBackground() {
  const base = TICKER_ROWS.flat();
  const [tickers, setTickers] = useState<Ticker[]>(() =>
    Array.from({ length: COLS * TILE_ROWS }, (_, i) => initTicker(base[i % base.length]))
  );
  const [flashing, setFlashing] = useState<Set<number>>(new Set());

  useEffect(() => {
    const id = setInterval(() => {
      const count = Math.floor(Math.random() * 7) + 6;
      const indices: number[] = [];

      setTickers(prev => {
        const next = [...prev];
        for (let k = 0; k < count; k++) {
          const i = Math.floor(Math.random() * next.length);
          indices.push(i);
          const t = next[i];
          const delta = (Math.random() - 0.5) * 1.2;
          const newChg = parseFloat((t.chg + delta).toFixed(2));
          const newPrice = t.base * (1 + newChg / 100);
          const clampedPrice = Math.max(t.base * 0.92, Math.min(t.base * 1.08, newPrice));
          const clampedChg = parseFloat(((clampedPrice / t.base - 1) * 100).toFixed(2));
          next[i] = {
            ...t,
            chg: clampedChg,
            p: fmtPrice(clampedPrice, t.base),
            c: (clampedChg >= 0 ? "+" : "") + clampedChg.toFixed(2),
            up: clampedChg >= 0,
          };
        }
        return next;
      });

      setFlashing(prev => new Set([...prev, ...indices]));
      setTimeout(() => setFlashing(prev => {
        const next = new Set(prev);
        indices.forEach(i => next.delete(i));
        return next;
      }), 600);
    }, 250);

    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 1,
        overflow: "hidden",
        filter: "blur(1px)",
        opacity: 0.7,
        display: "grid",
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gridAutoRows: "55px",
        alignContent: "start",
      }}
    >
      {tickers.map((t, i) => {
        const lit = flashing.has(i);
        return (
          <div key={i} className="font-mono flex flex-col items-center justify-center" style={{ gap: "1px" }}>
            <span style={{
              fontSize: "9px", fontWeight: 600, letterSpacing: "0.03em", lineHeight: 1.2,
              color: lit ? (t.up ? "rgba(74,222,128,0.95)" : "rgba(248,113,113,0.95)") : "rgba(255,255,255,0.28)",
              transition: "color 0.4s ease",
            }}>{t.s}</span>
            <span style={{
              fontSize: "8px", lineHeight: 1.2,
              color: lit ? (t.up ? "rgba(74,222,128,0.6)" : "rgba(248,113,113,0.6)") : "rgba(255,255,255,0.14)",
              transition: "color 0.4s ease",
            }}>{t.p}</span>
            <span style={{
              fontSize: "8px", lineHeight: 1.2,
              color: t.up
                ? (lit ? "rgba(74,222,128,0.9)" : "rgba(74,222,128,0.38)")
                : (lit ? "rgba(248,113,113,0.9)" : "rgba(248,113,113,0.38)"),
              transition: "color 0.4s ease",
            }}>{t.up ? "▲" : "▼"} {t.c}%</span>
          </div>
        );
      })}
    </div>
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
            WebkitMaskImage: "url(/xchange-logo.png)",
            WebkitMaskSize: "contain",
            WebkitMaskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            maskImage: "url(/xchange-logo.png)",
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
  const [hovered, setHovered] = useState<string | null>(null);

  const card = (key: string, delay: number, style: React.CSSProperties, children: React.ReactNode) => (
    <motion.div key={key}
      initial={{ opacity: 0, y: 18 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.5 }}
      onMouseEnter={() => setHovered(key)} onMouseLeave={() => setHovered(null)}
      style={{ ...CARD_BASE, ...style, transition: "border-color 0.25s, box-shadow 0.25s", borderColor: hovered === key ? "rgba(232,132,106,0.3)" : "rgba(255,255,255,0.07)", boxShadow: hovered === key ? "0 0 32px rgba(232,132,106,0.07)" : "none" }}
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
              <motion.div key={name}
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", borderRadius: "8px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.65)", flex: 1 }}>{name}</span>
                <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)" }}>{members}</span>
              </motion.div>
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
        <p className="overline-label" style={{ marginBottom: "12px" }}>The Platform</p>
        <p style={{ fontFamily: "var(--font-lora), Georgia, serif", fontSize: "clamp(20px, 2.4vw, 28px)", fontWeight: 600, color: "#fff" }}>
          The platform you&apos;ll open every morning.
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
            <p style={{ fontFamily: "var(--font-lora), Georgia, serif", fontSize: "18px", fontWeight: 600, color: "#fff", marginBottom: "4px" }}>{SCREENSHOTS[active].label}</p>
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
  { label: "Marketplace selling",             starter: false,          pro: "80% rev share",     elite: "80% rev share" },
  { label: "Verified Trader badge",           starter: false,          pro: true,                elite: "Auto-verified" },
  { label: "Marketplace discount",            starter: false,          pro: false,               elite: "25% off" },
  { label: "Full API access",                 starter: false,          pro: false,               elite: true },
  { label: "White-glove support",             starter: false,          pro: false,               elite: true },
];

const LANDING_PLANS = [
  { name: "Starter", tagline: "For the committed.",          price: 19,  glow: "rgba(232,132,106,0.12)", badge: null as string | null, highlight: false, key: "starter" as const },
  { name: "Pro",     tagline: "Serious edge. No excuses.",   price: 29,  glow: "rgba(232,132,106,0.18)", badge: "Most Popular",         highlight: true,  key: "pro"     as const },
  { name: "Elite",   tagline: "Institutional. No compromises.", price: 89, glow: "rgba(232,132,106,0.12)", badge: null as string | null, highlight: false, key: "elite"   as const },
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
        <p className="overline-label" style={{ marginBottom: "14px" }}>Pricing</p>
        <h2 style={{ fontFamily: "var(--font-lora), Georgia, serif", fontSize: "clamp(26px, 3vw, 38px)", fontWeight: 600, color: "#fff", marginBottom: "12px", letterSpacing: "-0.01em" }}>
          Choose your level.
        </h2>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)", maxWidth: "420px", margin: "0 auto", lineHeight: 1.8 }}>
          Start lean, grow into it. Every tier unlocks more of the platform — more tools, more reach, more credibility.
        </p>
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
              <a href="/pricing" style={{
                display: "block", textAlign: "center", padding: "13px 0", borderRadius: "10px",
                border: highlight ? "none" : "1px solid rgba(232,132,106,0.25)",
                background: highlight ? "var(--accent-color)" : "rgba(232,132,106,0.06)",
                color: highlight ? "#fff" : "var(--accent-color)",
                fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                textDecoration: "none", cursor: "pointer", transition: "opacity 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                Get {name}
              </a>
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
    { name: "Journal", desc: "Trade log & reflection notes", vis: <>
      {[85,70,90,60,80].map((w,i)=>(
        <motion.div key={i} initial={{width:0}} animate={{width:`${w}%`}} transition={{delay:i*0.07,duration:0.5,ease:"easeOut"}}
          style={{height:5,borderRadius:3,background:"rgba(255,255,255,0.07)",marginBottom:5}}/>
      ))}
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
          <h2 className="font-black tracking-tight text-white mb-3"
            style={{ fontSize: "clamp(24px, 3.5vw, 38px)", letterSpacing: "-0.02em" }}>
            Get notified on new releases
          </h2>
          <p className="mb-8" style={{ color: "rgba(255,255,255,0.38)", fontSize: "14px" }}>
            We ship fast. Subscribe and we&apos;ll email you whenever a new version drops.
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
          Your Edge<br />Starts Here.
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 14 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.18, duration: 0.5 }}
          className="mb-10" style={{ color: "rgba(255,255,255,0.32)", fontSize: "15px" }}>
          Answer a few questions and we&apos;ll match you to the right plan.
        </motion.p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <motion.a href="/onboarding"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            initial={{ opacity: 0, y: 12 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.48 }}
            className="inline-block cta-primary text-base font-semibold px-10 py-4 rounded-xl">
            Take the Investor Quiz
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
        <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--app-bg)" }}>
          <motion.div animate={{ opacity: [0.15, 0.5, 0.15] }} transition={{ duration: 2, repeat: Infinity }}
            className="font-black tracking-tight text-white" style={{ fontSize: "24px", letterSpacing: "-0.02em" }}>
            Quantiv
          </motion.div>
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
      <SiteFooter />
    </div>
  );
}
