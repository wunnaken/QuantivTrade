"use client";

import { BROKER_TEAL } from "../lib/broker-connection";

interface TrackRecordVerifiedBadgeProps {
  size?: number;
  showLabel?: boolean;
  /** "Track Verified" (short) or "Verified Track Record" (feed) or "Track Record Verified" (default) */
  label?: string;
  className?: string;
  title?: string;
}

export function TrackRecordVerifiedBadge({ size = 14, showLabel = false, label = "Track Record Verified", className = "", title }: TrackRecordVerifiedBadgeProps) {
  const tooltip = title ?? "This trader's performance is verified via connected brokerage";
  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      title={tooltip}
    >
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full"
        style={{ width: size, height: size, backgroundColor: `${BROKER_TEAL}30`, color: BROKER_TEAL }}
        aria-hidden
      >
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12l2 2 4-4" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      </span>
      {showLabel && (
        <span className="text-xs font-medium" style={{ color: BROKER_TEAL }}>
          {label}
        </span>
      )}
    </span>
  );
}
