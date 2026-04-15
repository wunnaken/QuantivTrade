import Link from "next/link";
import { QuantivTradeLogoImage } from "./QuantivTradeLogoImage";

export function QuantivTradeLogo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-3.5 transition opacity-90 hover:opacity-100"
      aria-label="QuantivTrade – Home"
    >
      <QuantivTradeLogoImage size={46} />
      <span className="text-2xl font-semibold tracking-tight text-[var(--accent-color)]" style={{ fontFamily: "var(--font-lora), Georgia, serif" }}>
        QuantivTrade
      </span>
    </Link>
  );
}
