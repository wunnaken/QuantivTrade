"use client";

import { useRef, useEffect } from "react";

interface Star {
  angle: number;
  radius: number;
  speed: number;
  brightness: number;
  blue: boolean;
}

export default function ParticleField({ dense = false, mobile: _mobile = false }: { dense?: boolean; mobile?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const COUNT = dense ? 320 : 220;

    function maxR(w: number, h: number) {
      return Math.sqrt(w * w + h * h) / 2 + 40;
    }

    function makeStars(w: number, h: number): Star[] {
      const mr = maxR(w, h);
      return Array.from({ length: COUNT }, () => ({
        angle: Math.random() * Math.PI * 2,
        radius: Math.random() * mr * 0.9,
        speed: 0.25 + Math.random() * 0.65,
        brightness: 0.35 + Math.random() * 0.65,
        blue: Math.random() > 0.72,
      }));
    }

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    resize();
    starsRef.current = makeStars(canvas.width, canvas.height);

    const ro = new ResizeObserver(() => {
      resize();
      if (canvas) starsRef.current = makeStars(canvas.width, canvas.height);
    });
    ro.observe(canvas);

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const mr = maxR(w, h);

      ctx.clearRect(0, 0, w, h);

      for (const s of starsRef.current) {
        // Accelerate outward
        const accel = 1 + (s.radius / mr) * 3.5;
        const stepSize = s.speed * accel;
        s.radius += stepSize;

        // Reset to centre when off-screen
        if (s.radius > mr) {
          s.radius = Math.random() * mr * 0.06;
          s.angle = Math.random() * Math.PI * 2;
        }

        // Trail — line from previous position to current
        const trailLen = stepSize * (6 + (s.radius / mr) * 22);
        const prevR = Math.max(0, s.radius - trailLen);
        const cos = Math.cos(s.angle);
        const sin = Math.sin(s.angle);
        const x = cx + s.radius * cos;
        const y = cy + s.radius * sin;
        const px = cx + prevR * cos;
        const py = cy + prevR * sin;

        const progress = s.radius / mr;
        const opacity = Math.min(1, progress * 2.2) * s.brightness;
        const lineW = Math.min(1.6, 0.25 + progress * 1.4);

        const grad = ctx.createLinearGradient(px, py, x, y);
        if (s.blue) {
          grad.addColorStop(0, `rgba(120,180,255,0)`);
          grad.addColorStop(1, `rgba(160,210,255,${opacity})`);
        } else {
          grad.addColorStop(0, `rgba(210,225,255,0)`);
          grad.addColorStop(1, `rgba(240,248,255,${opacity})`);
        }

        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = lineW;
        ctx.lineCap = "round";
        ctx.stroke();

        // Bright tip (small circle at head of streak)
        if (progress > 0.15) {
          const tipR = lineW * 0.9;
          const tipGrad = ctx.createRadialGradient(x, y, 0, x, y, tipR * 3);
          if (s.blue) {
            tipGrad.addColorStop(0, `rgba(180,220,255,${opacity})`);
          } else {
            tipGrad.addColorStop(0, `rgba(255,255,255,${opacity})`);
          }
          tipGrad.addColorStop(1, "rgba(255,255,255,0)");
          ctx.beginPath();
          ctx.arc(x, y, tipR * 3, 0, Math.PI * 2);
          ctx.fillStyle = tipGrad;
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [dense]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
