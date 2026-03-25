import Link from "next/link";
import { QuantivTradeLogoImage } from "./XchangeLogoImage";

export function QuantivTradeLogo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-3.5 transition opacity-90 hover:opacity-100"
      aria-label="QuantivTrade – Home"
    >
      <QuantivTradeLogoImage size={46} />
      <span className="text-2xl font-semibold tracking-tight text-[var(--accent-color)]">
        QuantivTrade
      </span>
    </Link>
  );
}
