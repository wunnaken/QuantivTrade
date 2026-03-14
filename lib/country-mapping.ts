/**
 * Map country names (as in world-atlas / Natural Earth) to ISO 3166-1 alpha-2
 * for NewsAPI and to main equity index symbols for Finnhub.
 */
export const COUNTRY_TO_ISO: Record<string, string> = {
  "United States of America": "us",
  "United States": "us",
  USA: "us",
  "U.S.A.": "us",
  "U.S.": "us",
  Germany: "de",
  France: "fr",
  "United Kingdom": "gb",
  Japan: "jp",
  China: "cn",
  India: "in",
  Canada: "ca",
  Australia: "au",
  Brazil: "br",
  "South Korea": "kr",
  Korea: "kr",
  "Korea, Republic of": "kr",
  "Republic of Korea": "kr",
  Italy: "it",
  Spain: "es",
  Mexico: "mx",
  Indonesia: "id",
  Netherlands: "nl",
  Turkey: "tr",
  "Saudi Arabia": "sa",
  Switzerland: "ch",
  Taiwan: "tw",
  Poland: "pl",
  Sweden: "se",
  Belgium: "be",
  Argentina: "ar",
  Austria: "at",
  Norway: "no",
  "United Arab Emirates": "ae",
  Israel: "il",
  "South Africa": "za",
  Ireland: "ie",
  Singapore: "sg",
  Malaysia: "my",
  Philippines: "ph",
  Portugal: "pt",
  Greece: "gr",
  "Czech Republic": "cz",
  Czechia: "cz",
  Romania: "ro",
  "New Zealand": "nz",
  Hungary: "hu",
  Egypt: "eg",
  Nigeria: "ng",
  Pakistan: "pk",
  Bangladesh: "bd",
  Vietnam: "vn",
  "Viet Nam": "vn",
  Thailand: "th",
  Russia: "ru",
  "Russian Federation": "ru",
  Ukraine: "ua",
  Iran: "ir",
  "Iran (Islamic Republic of)": "ir",
  Iraq: "iq",
  Colombia: "co",
  Chile: "cl",
  Peru: "pe",
  "Hong Kong": "hk",
  Venezuela: "ve",
  Morocco: "ma",
  Bulgaria: "bg",
  Lithuania: "lt",
  Latvia: "lv",
  Slovenia: "si",
  Slovakia: "sk",
  Serbia: "rs",
  Cuba: "cu",
};

/** Main equity index symbol per country for Finnhub (US ETFs/indices where no direct index). */
export const COUNTRY_TO_INDEX_SYMBOL: Record<string, string> = {
  "United States of America": "SPY",
  "United States": "SPY",
  Germany: "GDAXI",
  France: "FCHI",
  "United Kingdom": "FTSE",
  Japan: "N225",
  China: "000001.SS",
  India: "BSESN",
  Canada: "GSPTSE",
  Australia: "AXJO",
  Brazil: "BVSP",
  "South Korea": "KS11",
  Korea: "KS11",
  Italy: "FTMIB",
  Spain: "IBEX35",
  Mexico: "MXX",
  Indonesia: "JKSE",
  Netherlands: "AEX",
  Turkey: "XU100",
  "Saudi Arabia": "TADAWUL",
  Switzerland: "SSMI",
  Taiwan: "TWII",
  Poland: "WIG20",
  Sweden: "OMXSTO30",
  Belgium: "BFX",
  Argentina: "MERV",
  Austria: "ATX",
  Norway: "OSEAX",
  "United Arab Emirates": "DFM",
  Israel: "TA125",
  "South Africa": "JN0",
  Ireland: "ISEQ",
  Singapore: "STI",
  Malaysia: "KLSE",
  Philippines: "PSEI",
  Portugal: "PSI20",
  Greece: "ATG",
  "Czech Republic": "PX",
  Romania: "BET",
  "New Zealand": "NZ50",
  Hungary: "BUX",
  Egypt: "CASE30",
  Nigeria: "NGX",
  Russia: "IMOEX",
  "Hong Kong": "HSI",
};

export function countryToIso(name: string): string | null {
  const normalized = name.trim();
  return COUNTRY_TO_ISO[normalized] ?? null;
}

/** Try exact match, then case-insensitive match. Use for APIs where map names may vary. */
export function countryToIsoLoose(name: string): string | null {
  const normalized = name.trim();
  const exact = COUNTRY_TO_ISO[normalized];
  if (exact) return exact;
  const lower = normalized.toLowerCase();
  const key = Object.keys(COUNTRY_TO_ISO).find((k) => k.toLowerCase() === lower);
  return key ? COUNTRY_TO_ISO[key] : null;
}

/** ISO 3166-1 alpha-3 for World Bank API (use lowercase in URL: usa, gbr, etc.). */
export const COUNTRY_TO_ISO3: Record<string, string> = {
  "United States of America": "usa",
  "United States": "usa",
  Germany: "deu",
  France: "fra",
  "United Kingdom": "gbr",
  Japan: "jpn",
  China: "chn",
  India: "ind",
  Canada: "can",
  Australia: "aus",
  Brazil: "bra",
  "South Korea": "kor",
  Korea: "kor",
  Italy: "ita",
  Spain: "esp",
  Mexico: "mex",
  Indonesia: "idn",
  Netherlands: "nld",
  Turkey: "tur",
  "Saudi Arabia": "sau",
  Switzerland: "che",
  Taiwan: "twn",
  Poland: "pol",
  Sweden: "swe",
  Belgium: "bel",
  Argentina: "arg",
  Austria: "aut",
  Norway: "nor",
  "United Arab Emirates": "are",
  Israel: "isr",
  "South Africa": "zaf",
  Ireland: "irl",
  Singapore: "sgp",
  Malaysia: "mys",
  Philippines: "phl",
  Portugal: "prt",
  Greece: "grc",
  "Czech Republic": "cze",
  Romania: "rou",
  "New Zealand": "nzl",
  Hungary: "hun",
  Egypt: "egy",
  Nigeria: "nga",
  Pakistan: "pak",
  Bangladesh: "bgd",
  Vietnam: "vnm",
  Thailand: "tha",
  Russia: "rus",
  Ukraine: "ukr",
  Iran: "irn",
  Iraq: "irq",
  Colombia: "col",
  Chile: "chl",
  Peru: "per",
  "Hong Kong": "hkg",
};

export function countryToIndexSymbol(name: string): string | null {
  const normalized = name.trim();
  return COUNTRY_TO_INDEX_SYMBOL[normalized] ?? null;
}

export function countryToIso3(name: string): string | null {
  const normalized = name.trim();
  return COUNTRY_TO_ISO3[normalized] ?? null;
}

/** Panel display: main index symbol for Finnhub (USA→SPY, UK→ISF.L, etc.). Other countries show "Index data coming soon". */
export const COUNTRY_TO_PANEL_INDEX: Record<string, string> = {
  "United States of America": "SPY",
  "United States": "SPY",
  "United Kingdom": "ISF.L",
  Germany: "GDAXI",
  Japan: "EWJ",
  China: "FXI",
  France: "EWQ",
  India: "INDY",
  Brazil: "EWZ",
  Canada: "EWC",
  Australia: "EWA",
  "South Korea": "EWY",
  Korea: "EWY",
};

/** Flag emoji for panel header (subset; others can use 🌐 or country name). */
export const COUNTRY_TO_FLAG: Record<string, string> = {
  "United States of America": "🇺🇸",
  "United States": "🇺🇸",
  "United Kingdom": "🇬🇧",
  Germany: "🇩🇪",
  Japan: "🇯🇵",
  China: "🇨🇳",
  France: "🇫🇷",
  India: "🇮🇳",
  Brazil: "🇧🇷",
  Canada: "🇨🇦",
  Australia: "🇦🇺",
  "South Korea": "🇰🇷",
  Korea: "🇰🇷",
};

export function countryToPanelIndex(name: string): string | null {
  return COUNTRY_TO_PANEL_INDEX[name.trim()] ?? null;
}

export function countryToFlag(name: string): string {
  return COUNTRY_TO_FLAG[name.trim()] ?? "🌐";
}
