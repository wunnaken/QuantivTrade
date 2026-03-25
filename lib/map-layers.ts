/**
 * Map data layers: definitions, color scales, legend config.
 * World Bank indicators and hardcoded data (temporary until real feeds).
 */

export const NO_DATA_COLOR = "#374151";

export type LayerId =
  | "markets"
  | "gdp"
  | "inflation"
  | "population"
  | "unemployment"
  | "interest"
  | "currency"
  | "trade"
  | "political"
  | "sentiment";

export type Layer = {
  id: LayerId;
  label: string;
  icon: string;
  /** World Bank indicator code; if set, data fetched from WB API */
  wbIndicator?: string;
  /** For layers without WB: use getHardcodedData */
  legend: {
    title: string;
    /** Gradient CSS or stops for legend bar */
    gradient: string;
    /** Labels for min/mid/max or scale description */
    lowLabel: string;
    highLabel: string;
    unit?: string;
  };
  /** Map raw value to 0–1 for gradient, or to hex. Returns hex. */
  valueToColor: (value: number | null) => string;
  /** Format value for display */
  formatValue: (value: number | null) => string;
  /** Optional: 5-year history key for sparkline (same WB indicator) */
  sparklineIndicator?: string;
};

function lerpColor(hex1: string, hex2: string, t: number): string {
  const parse = (h: string) => {
    const n = h.replace("#", "");
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parse(hex1);
  const [r2, g2, b2] = parse(hex2);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** GDP Growth: dark green >4%, light green 2–4%, yellow 0–2%, orange -2–0%, red <-2% */
function gdpColor(v: number | null): string {
  if (v == null) return NO_DATA_COLOR;
  if (v > 4) return "#065f46";
  if (v >= 2) return "#10b981";
  if (v >= 0) return "#eab308";
  if (v >= -2) return "#f97316";
  return "#dc2626";
}

/** Inflation: green <2%, yellow 2–5%, orange 5–10%, red >10%, dark red >20% */
function inflationColor(v: number | null): string {
  if (v == null) return NO_DATA_COLOR;
  if (v < 2) return "#10b981";
  if (v < 5) return "#eab308";
  if (v < 10) return "#f97316";
  if (v < 20) return "#dc2626";
  return "#7f1d1d";
}

/** Population: lightness scale by size */
function populationColor(v: number | null): string {
  if (v == null) return NO_DATA_COLOR;
  const log = Math.log10(Math.max(1, v / 1e6));
  if (log < 1) return "#f3f4f6";
  if (log < 1.7) return "#d1d5db";
  if (log < 2.3) return "#9ca3af";
  if (log < 2.7) return "#4b5563";
  return "#1f2937";
}

/** Unemployment: green <4%, yellow 4–7%, orange 7–12%, red >12% */
function unemploymentColor(v: number | null): string {
  if (v == null) return NO_DATA_COLOR;
  if (v < 4) return "#10b981";
  if (v < 7) return "#eab308";
  if (v < 12) return "#f97316";
  return "#dc2626";
}

/** Interest rates: dark blue <1%, light blue 1–3%, yellow 3–5%, orange 5–8%, red >8% */
function interestColor(v: number | null): string {
  if (v == null) return NO_DATA_COLOR;
  if (v < 1) return "#1e3a5f";
  if (v < 3) return "#3b82f6";
  if (v < 5) return "#eab308";
  if (v < 8) return "#f97316";
  return "#dc2626";
}

/** Currency: green = strengthened vs USD, red = weakened */
function currencyColor(v: number | null): string {
  if (v == null) return NO_DATA_COLOR;
  if (v >= 0) return v > 2 ? "#065f46" : "#10b981";
  return v < -5 ? "#7f1d1d" : "#dc2626";
}

/** Trade balance: green surplus, red deficit, intensity by size */
function tradeColor(v: number | null): string {
  if (v == null) return NO_DATA_COLOR;
  if (v > 0) return v > 50e9 ? "#065f46" : "#10b981";
  return v < -50e9 ? "#7f1d1d" : "#dc2626";
}

/** Political risk: green stable → dark red conflict */
function politicalColor(v: number | null): string {
  if (v == null) return NO_DATA_COLOR;
  if (v <= 2) return "#065f46";
  if (v <= 4) return "#10b981";
  if (v <= 6) return "#eab308";
  if (v <= 8) return "#f97316";
  return "#7f1d1d";
}

/** Consumer sentiment: green >100, yellow 80–100, red <80 */
function sentimentColor(v: number | null): string {
  if (v == null) return NO_DATA_COLOR;
  if (v > 100) return "#10b981";
  if (v >= 80) return "#eab308";
  return "#dc2626";
}

/** Markets: green positive, red negative, gray no data */
function marketsColor(v: number | null): string {
  if (v == null) return NO_DATA_COLOR;
  if (v > 0) return "#10b981";
  if (v < 0) return "#dc2626";
  return "#6b7280";
}

export const LAYERS: Layer[] = [
  {
    id: "markets",
    label: "Markets",
    icon: "📈",
    legend: {
      title: "Stock market % change",
      gradient: "linear-gradient(90deg, #dc2626, #6b7280, #10b981)",
      lowLabel: "Negative",
      highLabel: "Positive",
      unit: "%",
    },
    valueToColor: marketsColor,
    formatValue: (v) => (v != null ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` : "—"),
  },
  {
    id: "gdp",
    label: "GDP Growth",
    icon: "💰",
    wbIndicator: "NY.GDP.MKTP.KD.ZG",
    legend: {
      title: "GDP growth (annual %)",
      gradient: "linear-gradient(90deg, #dc2626, #f97316, #eab308, #10b981, #065f46)",
      lowLabel: "<-2%",
      highLabel: ">4%",
      unit: "%",
    },
    valueToColor: gdpColor,
    formatValue: (v) => (v != null ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : "—"),
    sparklineIndicator: "NY.GDP.MKTP.KD.ZG",
  },
  {
    id: "inflation",
    label: "Inflation",
    icon: "📊",
    wbIndicator: "FP.CPI.TOTL.ZG",
    legend: {
      title: "Inflation (annual %)",
      gradient: "linear-gradient(90deg, #10b981, #eab308, #f97316, #dc2626, #7f1d1d)",
      lowLabel: "<2%",
      highLabel: ">20%",
      unit: "%",
    },
    valueToColor: inflationColor,
    formatValue: (v) => (v != null ? `${v.toFixed(1)}%` : "—"),
    sparklineIndicator: "FP.CPI.TOTL.ZG",
  },
  {
    id: "population",
    label: "Population",
    icon: "👥",
    wbIndicator: "SP.POP.TOTL",
    legend: {
      title: "Population",
      gradient: "linear-gradient(90deg, #f3f4f6, #9ca3af, #1f2937)",
      lowLabel: "<10M",
      highLabel: ">500M",
    },
    valueToColor: populationColor,
    formatValue: (v) => (v != null ? (v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : `${(v / 1e3).toFixed(0)}k`) : "—"),
    sparklineIndicator: "SP.POP.TOTL",
  },
  {
    id: "unemployment",
    label: "Unemployment",
    icon: "💼",
    wbIndicator: "SL.UEM.TOTL.ZS",
    legend: {
      title: "Unemployment rate (%)",
      gradient: "linear-gradient(90deg, #10b981, #eab308, #f97316, #dc2626)",
      lowLabel: "<4%",
      highLabel: ">12%",
      unit: "%",
    },
    valueToColor: unemploymentColor,
    formatValue: (v) => (v != null ? `${v.toFixed(1)}%` : "—"),
    sparklineIndicator: "SL.UEM.TOTL.ZS",
  },
  {
    id: "interest",
    label: "Interest Rates",
    icon: "🏦",
    legend: {
      title: "Central bank rate (%)",
      gradient: "linear-gradient(90deg, #1e3a5f, #3b82f6, #eab308, #f97316, #dc2626)",
      lowLabel: "<1%",
      highLabel: ">8%",
      unit: "%",
    },
    valueToColor: interestColor,
    formatValue: (v) => (v != null ? `${v.toFixed(2)}%` : "—"),
  },
  {
    id: "currency",
    label: "Currency Strength",
    icon: "💱",
    legend: {
      title: "% change vs USD (1Y)",
      gradient: "linear-gradient(90deg, #7f1d1d, #dc2626, #6b7280, #10b981, #065f46)",
      lowLabel: "Weaker",
      highLabel: "Stronger",
      unit: "%",
    },
    valueToColor: currencyColor,
    formatValue: (v) => (v != null ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : "—"),
  },
  {
    id: "trade",
    label: "Trade Balance",
    icon: "🌐",
    wbIndicator: "BN.CAB.XOKA.CD",
    legend: {
      title: "Current account balance",
      gradient: "linear-gradient(90deg, #dc2626, #6b7280, #10b981)",
      lowLabel: "Deficit",
      highLabel: "Surplus",
    },
    valueToColor: tradeColor,
    formatValue: (v) => (v != null ? (Math.abs(v) >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${(v / 1e6).toFixed(0)}M`) : "—"),
    sparklineIndicator: "BN.CAB.XOKA.CD",
  },
  {
    id: "political",
    label: "Political Risk",
    icon: "⚠️",
    legend: {
      title: "Stability (1=low risk, 10=high)",
      gradient: "linear-gradient(90deg, #065f46, #10b981, #eab308, #f97316, #7f1d1d)",
      lowLabel: "Stable",
      highLabel: "Conflict",
    },
    valueToColor: politicalColor,
    formatValue: (v) => (v != null ? `${v.toFixed(1)}/10` : "—"),
  },
  {
    id: "sentiment",
    label: "Consumer Sentiment",
    icon: "😊",
    legend: {
      title: "Consumer confidence (index)",
      gradient: "linear-gradient(90deg, #dc2626, #eab308, #10b981)",
      lowLabel: "<80",
      highLabel: ">100",
    },
    valueToColor: sentimentColor,
    formatValue: (v) => (v != null ? v.toFixed(0) : "—"),
  },
];

/** Hardcoded central bank rates (temporary). Key = country name as in geography. */
export const HARDCODED_INTEREST: Record<string, number> = {
  "United States of America": 5.25,
  "United States": 5.25,
  "Germany": 4.5,
  "France": 4.5,
  "United Kingdom": 5.25,
  Japan: 0.1,
  China: 3.45,
  India: 6.5,
  Canada: 4.75,
  Australia: 4.35,
  Brazil: 10.5,
  "South Korea": 3.5,
  Korea: 3.5,
  Italy: 4.5,
  Spain: 4.5,
  Mexico: 11.0,
  Indonesia: 6.0,
  Netherlands: 4.5,
  Turkey: 45.0,
  Switzerland: 1.5,
  "Saudi Arabia": 6.0,
  "South Africa": 8.25,
  Russia: 21.0,
  Norway: 4.5,
  "New Zealand": 5.5,
  Sweden: 4.0,
};

/** Hardcoded % change vs USD last year (temporary). */
export const HARDCODED_CURRENCY: Record<string, number> = {
  "United States of America": 0,
  "United States": 0,
  "United Kingdom": 2.1,
  "Euro Area": -1.5,
  Germany: -1.5,
  France: -1.5,
  Japan: -8.2,
  China: -4.1,
  India: 0.5,
  Canada: -2.0,
  Australia: -3.2,
  Brazil: 6.1,
  "South Korea": -5.0,
  Mexico: -1.8,
  Switzerland: 3.2,
  "Saudi Arabia": 0.2,
};

/** Political risk score 1–10 (temporary). */
export const HARDCODED_POLITICAL: Record<string, number> = {
  Norway: 1.2,
  Switzerland: 1.3,
  "United States of America": 2.5,
  "United States": 2.5,
  Germany: 2.0,
  "United Kingdom": 2.2,
  Japan: 1.8,
  Canada: 2.0,
  Australia: 2.0,
  France: 2.5,
  Netherlands: 2.0,
  Sweden: 1.8,
  "South Korea": 3.0,
  Brazil: 5.5,
  India: 5.0,
  Turkey: 6.5,
  Pakistan: 7.0,
  Venezuela: 9.0,
  Myanmar: 8.5,
  Russia: 7.5,
  Ukraine: 8.0,
  Iran: 7.5,
  Iraq: 8.0,
  "South Africa": 5.5,
  Nigeria: 6.5,
  Egypt: 6.0,
  Argentina: 6.5,
  Mexico: 5.0,
  Indonesia: 4.5,
  Thailand: 4.0,
  Philippines: 5.0,
  Poland: 3.5,
  Spain: 3.0,
  Italy: 3.5,
};

/** Consumer confidence index (temporary). */
export const HARDCODED_SENTIMENT: Record<string, number> = {
  "United States of America": 102,
  "United States": 102,
  "United Kingdom": 92,
  Germany: 88,
  France: 91,
  Japan: 95,
  China: 98,
  India: 105,
  Canada: 97,
  Australia: 96,
  Brazil: 88,
  "South Korea": 92,
  Italy: 90,
  Spain: 89,
  Mexico: 85,
};

const MAP_LAYER_STORAGE_KEY = "quantivtrade-map-layer";

export function getStoredLayerId(): LayerId | null {
  if (typeof window === "undefined") return null;
  try {
    const s = window.localStorage.getItem(MAP_LAYER_STORAGE_KEY);
    if (s && LAYERS.some((l) => l.id === s)) return s as LayerId;
  } catch {}
  return null;
}

export function setStoredLayerId(id: LayerId): void {
  try {
    window.localStorage.setItem(MAP_LAYER_STORAGE_KEY, id);
  } catch {}
}
