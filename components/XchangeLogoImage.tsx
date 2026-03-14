"use client";

/**
 * Renders the Xchange logo with no background. Uses the logo PNG as a mask
 * so the visible color is the accent color — same shape, dynamic color.
 * The logo asset should have a transparent background for correct masking.
 */
export function XchangeLogoImage({
  size,
  className = "",
}: {
  size: number;
  className?: string;
}) {
  return (
    <span
      className={`block flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: "var(--accent-color)",
        WebkitMaskImage: "url(/xchange-logo.png)",
        WebkitMaskSize: "contain",
        WebkitMaskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        maskImage: "url(/xchange-logo.png)",
        maskSize: "contain",
        maskPosition: "center",
        maskRepeat: "no-repeat",
      }}
      aria-hidden
    />
  );
}
