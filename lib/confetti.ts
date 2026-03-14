/**
 * Trigger confetti for milestones. Uses canvas-confetti.
 */

export type ConfettiOptions = {
  colors?: string[];
  duration?: number;
};

const DEFAULT_COLORS = [
  "var(--accent-color)",
  "#11c60f",
  "#fbbf24",
  "#f59e0b",
  "#ffffff",
  "#e5e7eb",
];

export function triggerConfetti(options: ConfettiOptions = {}): void {
  if (typeof window === "undefined") return;
  import("canvas-confetti").then((confetti) => {
    const colors = options.colors ?? DEFAULT_COLORS;
    const duration = options.duration ?? 2500;
    const end = Date.now() + duration;

    const frame = () => {
      confetti.default({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0.4, y: 0.6 },
        colors,
      });
      confetti.default({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 0.6, y: 0.6 },
        colors,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  });
}
