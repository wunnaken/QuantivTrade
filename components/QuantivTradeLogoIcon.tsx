"use client";

/**
 * Inline SVG logo: wireframe globe + decorative frame.
 * Uses currentColor so parent can set color (e.g. var(--accent-color)).
 * viewBox 0 0 64 64 with content centered at (32,32) for correct alignment.
 */
export function QuantivTradeLogoIcon({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* Decorative outer frame */}
      <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 2" fill="none" />
      {/* Cardinal accents */}
      <circle cx="32" cy="4" r="2" fill="currentColor" />
      <circle cx="32" cy="60" r="2" fill="currentColor" />
      <circle cx="4" cy="32" r="2" fill="currentColor" />
      <circle cx="60" cy="32" r="2" fill="currentColor" />
      {/* Globe outline (front hemisphere) */}
      <circle cx="32" cy="32" r="18" stroke="currentColor" strokeWidth="1" fill="none" />
      {/* Equator */}
      <line x1="14" y1="32" x2="50" y2="32" stroke="currentColor" strokeWidth="0.7" />
      {/* Latitude arcs (ellipses) */}
      <ellipse cx="32" cy="24" rx="16" ry="6" stroke="currentColor" strokeWidth="0.6" fill="none" />
      <ellipse cx="32" cy="40" rx="16" ry="6" stroke="currentColor" strokeWidth="0.6" fill="none" />
      {/* Longitude arcs (half-ellipses) */}
      <path d="M 50 32 A 18 18 0 0 1 14 32" stroke="currentColor" strokeWidth="0.7" fill="none" />
      <path d="M 50 32 A 18 18 0 0 0 14 32" stroke="currentColor" strokeWidth="0.7" fill="none" />
    </svg>
  );
}
