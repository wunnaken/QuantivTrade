"use client";

import { useEffect, useRef, useState } from "react";

export type PriceDisplayProps = {
  price: number | null;
  change: number | null;
  changePercent: number | null;
  symbol?: string;
  /** "compact" = no decimals for large numbers, "full" = always show decimals */
  format?: "compact" | "full";
  className?: string;
  priceClassName?: string;
  changeClassName?: string;
  showChange?: boolean;
};

function formatPriceValue(price: number, symbol?: string): string {
  if (symbol === "BTC" || symbol === "ETH") {
    return price >= 1000 ? `${(price / 1000).toFixed(1)}k` : price.toFixed(0);
  }
  if (symbol === "EURUSD" || symbol === "DXY") return price.toFixed(4);
  return price >= 1 ? price.toFixed(2) : price.toFixed(4);
}

export function PriceDisplay({
  price,
  change,
  changePercent,
  symbol = "",
  format = "full",
  className = "",
  priceClassName = "",
  changeClassName = "",
  showChange = true,
}: PriceDisplayProps) {
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const [fading, setFading] = useState(false);
  const prevPriceRef = useRef<number | null>(null);
  const t1Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t2Ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (price == null) return;
    const prev = prevPriceRef.current;
    prevPriceRef.current = price;
    if (prev != null && prev !== price) {
      if (t1Ref.current) clearTimeout(t1Ref.current);
      if (t2Ref.current) clearTimeout(t2Ref.current);
      setFading(false);
      setFlashColor(price > prev ? "#34d399" : "#f87171");
      t1Ref.current = setTimeout(() => setFading(true), 80);
      t2Ref.current = setTimeout(() => { setFlashColor(null); setFading(false); }, 700);
    }
    return () => {
      if (t1Ref.current) clearTimeout(t1Ref.current);
      if (t2Ref.current) clearTimeout(t2Ref.current);
    };
  }, [price]);

  if (price == null && changePercent == null) {
    return <span className={className}>—</span>;
  }

  const isPositive = changePercent != null && changePercent >= 0;
  const isZero = changePercent != null && changePercent === 0;

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {price != null && (
        <span
          className={priceClassName}
          style={flashColor ? { color: flashColor, transition: fading ? "color 0.55s ease-out" : "none" } : undefined}
        >
          ${format === "compact" ? formatPriceValue(price, symbol) : price >= 1 ? price.toFixed(2) : price.toFixed(4)}
        </span>
      )}
      {showChange && changePercent != null && (
        <span
          className={
            changeClassName ||
            (isZero ? "text-zinc-500" : isPositive ? "text-emerald-400" : "text-red-400")
          }
        >
          {isPositive ? "+" : ""}
          {changePercent.toFixed(2)}%
        </span>
      )}
    </span>
  );
}
