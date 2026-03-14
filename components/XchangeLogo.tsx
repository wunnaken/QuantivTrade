import Link from "next/link";
import { XchangeLogoImage } from "./XchangeLogoImage";

export function XchangeLogo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-3.5 transition opacity-90 hover:opacity-100"
      aria-label="Xchange – Home"
    >
      <XchangeLogoImage size={46} />
      <span className="text-2xl font-semibold tracking-tight text-[var(--accent-color)]">
        Xchange
      </span>
    </Link>
  );
}
