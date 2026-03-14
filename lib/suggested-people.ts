export type RiskProfileLabel = "Conservative" | "Moderate" | "Aggressive";

export type SuggestedUser = {
  id: string;
  name: string;
  handle: string;
  riskProfile: RiskProfileLabel;
  interests: string[];
};

export const SUGGESTED_PEOPLE: SuggestedUser[] = [
  { id: "sarah_macro", name: "Sarah Chen", handle: "sarah_macro", riskProfile: "Moderate", interests: ["Global Macro", "Rates", "ETFs"] },
  { id: "torres_flow", name: "Mike Torres", handle: "torres_flow", riskProfile: "Aggressive", interests: ["Equities", "Options", "Crypto"] },
  { id: "alex_fx", name: "Alex Rivera", handle: "alex_fx", riskProfile: "Moderate", interests: ["Forex", "Commodities"] },
  { id: "lee_crypto", name: "Jordan Lee", handle: "lee_crypto", riskProfile: "Aggressive", interests: ["Crypto", "Tech"] },
  { id: "jordan_vol", name: "Casey Kim", handle: "jordan_vol", riskProfile: "Conservative", interests: ["Volatility", "ETFs"] },
  { id: "mike_rates", name: "Mike Walsh", handle: "mike_rates", riskProfile: "Conservative", interests: ["Rates", "Bonds", "Macro"] },
  { id: "priya_etf", name: "Priya Sharma", handle: "priya_etf", riskProfile: "Moderate", interests: ["ETFs", "Index", "Dividends"] },
  { id: "dan_growth", name: "Dan Park", handle: "dan_growth", riskProfile: "Aggressive", interests: ["Growth", "Tech", "Crypto"] },
  { id: "emma_value", name: "Emma Ross", handle: "emma_value", riskProfile: "Conservative", interests: ["Value", "Dividends"] },
  { id: "jay_quant", name: "Jay Patel", handle: "jay_quant", riskProfile: "Moderate", interests: ["Quant", "Options", "ETFs"] },
];

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
