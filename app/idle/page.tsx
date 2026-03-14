"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { XchangeLogoImage } from "../../components/XchangeLogoImage";

/* Scattered positions for star dots (left/top %). Some slightly larger (size 3). */
const STAR_POSITIONS: { left: number; top: number; size?: number }[] = [
  { left: 4, top: 6 }, { left: 12, top: 14 }, { left: 22, top: 8 }, { left: 31, top: 18 }, { left: 8, top: 24 },
  { left: 18, top: 32 }, { left: 28, top: 26 }, { left: 38, top: 12 }, { left: 45, top: 22 }, { left: 52, top: 7 },
  { left: 58, top: 28 }, { left: 68, top: 16 }, { left: 75, top: 34 }, { left: 82, top: 10 }, { left: 90, top: 20 },
  { left: 6, top: 42 }, { left: 14, top: 52 }, { left: 24, top: 48 }, { left: 35, top: 58 }, { left: 44, top: 44 },
  { left: 56, top: 52 }, { left: 64, top: 46 }, { left: 74, top: 56 }, { left: 86, top: 42 }, { left: 92, top: 50 },
  { left: 10, top: 68 }, { left: 20, top: 72 }, { left: 32, top: 78 }, { left: 42, top: 66 }, { left: 50, top: 74 },
  { left: 62, top: 68 }, { left: 72, top: 82 }, { left: 80, top: 70 }, { left: 88, top: 76 }, { left: 5, top: 88 },
  { left: 16, top: 92 }, { left: 26, top: 86 }, { left: 40, top: 90 }, { left: 55, top: 88 }, { left: 70, top: 92 },
  { left: 84, top: 86 }, { left: 94, top: 94 },
  // More stars
  { left: 7, top: 11 }, { left: 41, top: 5 }, { left: 63, top: 12 }, { left: 88, top: 15 }, { left: 11, top: 38 },
  { left: 49, top: 32 }, { left: 71, top: 40 }, { left: 3, top: 62 }, { left: 37, top: 72 }, { left: 59, top: 62 },
  { left: 93, top: 68 }, { left: 19, top: 84 }, { left: 53, top: 82 }, { left: 77, top: 88 }, { left: 33, top: 22 },
  { left: 67, top: 54 }, { left: 9, top: 48 }, { left: 85, top: 32 }, { left: 25, top: 64 },
  // A few slightly brighter "larger" stars
  ...([{ left: 48, top: 38, size: 3 }, { left: 15, top: 55, size: 3 }, { left: 78, top: 62, size: 3 }] as const),
];

const BOUNCE_SPEED = 1.2 / 3;

export default function IdlePage() {
  const [logoSize, setLogoSize] = useState(140);
  const logoRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef<{ x: number; y: number; dx: number; dy: number; inited: boolean }>({
    x: 0,
    y: 0,
    dx: BOUNCE_SPEED,
    dy: -BOUNCE_SPEED * 0.7,
    inited: false,
  });

  useEffect(() => {
    const update = () => setLogoSize(Math.min(window.innerWidth, window.innerHeight) * 0.25);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      const el = logoRef.current;
      const m = motionRef.current;
      if (!el) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const W = window.innerWidth;
      const H = window.innerHeight;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w === 0 || h === 0) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      if (!m.inited) {
        m.x = Math.max(0, (W - w) / 2);
        m.y = Math.max(0, (H - h) / 2);
        m.inited = true;
      }
      m.x += m.dx;
      m.y += m.dy;
      if (m.x <= 0) {
        m.x = 0;
        m.dx = Math.abs(m.dx);
      }
      if (m.x >= W - w) {
        m.x = W - w;
        m.dx = -Math.abs(m.dx);
      }
      if (m.y <= 0) {
        m.y = 0;
        m.dy = Math.abs(m.dy);
      }
      if (m.y >= H - h) {
        m.y = H - h;
        m.dy = -Math.abs(m.dy);
      }
      el.style.left = `${m.x}px`;
      el.style.top = `${m.y}px`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: "#000000" }}
    >
      {/* Starfield: little white dots that slowly twinkle */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {STAR_POSITIONS.map((pos, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white will-change-opacity"
            style={{
              left: `${pos.left}%`,
              top: `${pos.top}%`,
              width: pos.size ?? 2,
              height: pos.size ?? 2,
              animation: "idle-star-twinkle 3s ease-in-out infinite",
              animationDelay: `${(i * 0.12) % 4}s`,
            }}
          />
        ))}
      </div>

      {/* Logo: DVD-style bounce off walls (3x slower than previous text) */}
      <div
        ref={logoRef}
        className="absolute z-10 flex items-center justify-center"
        style={{
          left: 0,
          top: 0,
          animation: "idle-logo-spin 40s linear infinite",
        }}
      >
        <XchangeLogoImage size={logoSize} />
      </div>

      {/* Subtle back link */}
      <Link
        href="/"
        className="absolute left-6 top-6 z-10 text-xs text-zinc-500 transition-colors hover:text-[var(--accent-color)]"
      >
        ← Back
      </Link>
    </div>
  );
}
