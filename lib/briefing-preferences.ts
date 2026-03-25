export type BriefingPreferences = {
  tradingStyle: string; // "day-trading" | "swing-trading" | "long-term" | "options" | ""
  assetClasses: string[]; // stocks, crypto, forex, commodities, etfs, futures
  sectors: string[]; // tech, energy, healthcare, financials, consumer, industrials, real-estate
  watchTickers: string; // comma-separated ticker symbols
  riskTolerance: string; // "conservative" | "moderate" | "aggressive" | ""
  additionalContext: string;
};

export const EMPTY_PREFERENCES: BriefingPreferences = {
  tradingStyle: "",
  assetClasses: [],
  sectors: [],
  watchTickers: "",
  riskTolerance: "",
  additionalContext: "",
};

export function hasPreferences(prefs: BriefingPreferences | null | undefined): boolean {
  if (!prefs) return false;
  return !!(
    prefs.tradingStyle ||
    prefs.assetClasses.length ||
    prefs.sectors.length ||
    prefs.watchTickers ||
    prefs.riskTolerance
  );
}

export function buildPreferencesSummary(prefs: BriefingPreferences): string {
  const parts: string[] = [];
  if (prefs.tradingStyle) parts.push(`Trading style: ${prefs.tradingStyle.replace(/-/g, " ")}`);
  if (prefs.assetClasses.length) parts.push(`Asset classes: ${prefs.assetClasses.join(", ")}`);
  if (prefs.sectors.length) parts.push(`Sectors of interest: ${prefs.sectors.join(", ")}`);
  if (prefs.watchTickers) parts.push(`Watchlist: ${prefs.watchTickers}`);
  if (prefs.riskTolerance) parts.push(`Risk tolerance: ${prefs.riskTolerance}`);
  if (prefs.additionalContext) parts.push(`Additional context: ${prefs.additionalContext}`);
  return parts.join(". ");
}

/** Fetch preferences from the database (client-side). Returns null if not set or error. */
export async function fetchBriefingPreferences(): Promise<BriefingPreferences | null> {
  try {
    const res = await fetch("/api/profile/briefing-preferences", { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.preferences as BriefingPreferences) ?? null;
  } catch {
    return null;
  }
}

/** Save preferences to the database (client-side). */
export async function saveBriefingPreferences(prefs: BriefingPreferences): Promise<boolean> {
  try {
    const res = await fetch("/api/profile/briefing-preferences", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: prefs }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
