/**
 * Canonical mapping from human-friendly indicator names to FRED series IDs.
 *
 * Used by:
 *   - app/api/calendar/fred/route.ts          (server: fetch observations for a chart)
 *   - app/calendar/EconomicDetailModal.tsx    (client: pick a series for the detail chart)
 *   - app/api/calendar/economic/route.ts      (server: pull latest+prev for a release)
 *
 * Keep this map specific. Loose matches (e.g. mapping "ism manufacturing" to a
 * FRED series that isn't actually the ISM PMI) make the chart silently lie.
 */

export const FRED_SERIES_MAP: Record<string, string> = {
  // Inflation
  "core cpi": "CPILFESL",
  "cpi": "CPIAUCSL",
  "consumer price": "CPIAUCSL",
  "inflation": "CPIAUCSL",
  "core pce": "PCEPILFE",
  "pce inflation": "PCEPI",
  "pce": "PCEPI",
  "personal income": "PCEPI",

  // Producer prices
  "ppi": "PPIACO",
  "producer price": "PPIACO",

  // Rates / Fed
  "fed funds": "FEDFUNDS",
  "fomc": "FEDFUNDS",
  "federal reserve": "FEDFUNDS",
  "rate decision": "FEDFUNDS",

  // Yields
  "10y": "DGS10",
  "10 year": "DGS10",
  "treasury 10": "DGS10",
  "2y": "DGS2",
  "2 year": "DGS2",
  "treasury 2": "DGS2",
  "yield curve": "T10Y2Y",

  // Labor
  "unemployment": "UNRATE",
  "nonfarm payrolls": "PAYEMS",
  "nonfarm payroll": "PAYEMS",
  "nfp": "PAYEMS",
  "jobs report": "PAYEMS",
  "payrolls": "PAYEMS",
  "initial jobless claims": "ICSA",
  "jobless claims": "ICSA",
  "state unemployment": "ICSA",

  // Activity / output
  "gdp": "A191RL1Q225SBEA",
  "industrial production": "INDPRO",
  "retail sales": "RSXFS",

  // Surveys (FRED-tracked)
  "consumer sentiment": "UMCSENT",
  "consumer confidence": "UMCSENT",
  "chicago fed": "CFNAI",

  // Trade
  "trade balance": "BOPGSTB",
  "advance trade": "BOPTEXP",
  "durable goods": "DGORDER",

  // Housing
  "housing starts": "HOUST",

  // NOTE: ISM Manufacturing PMI / ISM Services PMI have no free FRED series.
  // We deliberately do NOT map them — getSeriesId will return null and the
  // detail chart will show "No historical data for this indicator" rather
  // than a misleading proxy series.
};

/** Match an event/indicator name (case-insensitive substring) → FRED series. */
export function getFredSeriesId(eventName: string): string | null {
  const n = eventName.toLowerCase();
  // Iterate in declaration order — more specific keys (e.g. "core cpi") are
  // listed before broader ones (e.g. "cpi") so they win.
  for (const [key, id] of Object.entries(FRED_SERIES_MAP)) {
    if (n.includes(key)) return id;
  }
  return null;
}
