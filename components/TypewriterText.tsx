"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders `text` with a fast typewriter animation.
 * Completes in ≤ 500 ms. Shows a blinking cursor while typing.
 * Pass `startDelay` (ms) to chain fields sequentially.
 */
export function TypewriterText({
  text,
  className,
  tag: Tag = "span",
  onDone,
  startDelay = 0,
}: {
  text: string;
  className?: string;
  tag?: "span" | "p";
  onDone?: () => void;
  startDelay?: number;
}) {
  const [displayed, setDisplayed] = useState("");
  const [active, setActive] = useState(startDelay === 0);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!text) {
      setDisplayed("");
      setDone(false);
      setActive(startDelay === 0);
      return;
    }

    setDisplayed("");
    setDone(false);
    setActive(false);

    delayRef.current = setTimeout(() => {
      setActive(true);
      const TARGET_MS = 500;
      const INTERVAL_MS = 16;
      const charsPerFrame = Math.max(1, Math.ceil(text.length / (TARGET_MS / INTERVAL_MS)));
      let i = 0;

      intervalRef.current = setInterval(() => {
        i = Math.min(i + charsPerFrame, text.length);
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setDone(true);
          onDone?.();
        }
      }, INTERVAL_MS);
    }, startDelay);

    return () => {
      if (delayRef.current) clearTimeout(delayRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, startDelay]);

  return (
    <Tag className={className}>
      {displayed}
      {active && !done && (
        <span className="animate-pulse opacity-60" aria-hidden>
          ▊
        </span>
      )}
    </Tag>
  );
}
