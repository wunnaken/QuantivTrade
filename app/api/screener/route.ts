import { NextRequest, NextResponse } from "next/server";

// force-dynamic so live filter params are honored on every request.
export const dynamic = "force-dynamic";

/**
 * Screener API.
 *
 * Primary source: FMP `/api/v3/stock-screener` — gives the full US universe
 * (~6000+ tickers) and accepts our filter params natively.
 *
 * Fallback: a hardcoded popular-stocks universe enriched via Finnhub. This
 * runs whenever FMP returns nothing (free-tier quota, exchange-name mismatch,
 * etc.) so the page never shows "0 stocks" purely because of a config issue.
 *
 * Live price + day change is enriched from Finnhub for the top-200 by market
 * cap (avoids fanning out 5k Finnhub calls).
 */

const FMP_BASE = "https://financialmodelingprep.com/api/v3";
const FINNHUB_BASE = "https://finnhub.io/api/v1";

// Hardcoded fallback universe (~250 large/popular US stocks). Used when the
// FMP screener returns nothing, so the page always has data to render.
const FALLBACK_UNIVERSE = [
  "AAPL","MSFT","NVDA","GOOGL","GOOG","AMZN","META","TSLA","AVGO","ORCL",
  "JPM","V","MA","BAC","WFC","GS","MS","BLK","SCHW","AXP","C","USB","PNC","TFC","COF",
  "UNH","JNJ","LLY","ABBV","MRK","TMO","ABT","DHR","BMY","AMGN","GILD","CVS","CI","HUM","ELV",
  "HD","MCD","NKE","SBUX","TGT","COST","WMT","PG","KO","PEP","PM","MO","CL","GIS","K","CPB",
  "CAT","DE","HON","UPS","FDX","BA","GE","MMM","LMT","RTX","NOC","GD","ETN","EMR","PH","ROK","CMI","PCAR",
  "XOM","CVX","COP","EOG","SLB","OXY","MPC","PSX","VLO","HAL","BKR","DVN","FANG",
  "LIN","APD","SHW","FCX","NEM","NUE","STLD","VMC","MLM","ALB","CF","MOS",
  "AMT","PLD","CCI","EQIX","SPG","O","WELL","DLR","PSA","AVB","EQR","VTR","ARE",
  "NEE","SO","DUK","D","AEP","EXC","XEL","SRE","WEC","ES",
  "NFLX","DIS","CMCSA","T","VZ","TMUS","CHTR","EA","TTWO",
  "AMD","INTC","QCOM","TXN","MU","AMAT","LRCX","KLAC","MRVL","ON","MCHP","ADI","NXPI","STX","WDC",
  "CRM","ADBE","NOW","INTU","WDAY","TEAM","PANW","CRWD","ZS","SNOW","DDOG","NET","MDB","HUBS",
  "MRNA","BIIB","REGN","VRTX","ILMN","ISRG","EW","ZBH","BSX","BDX","BAX","ZTS","IDXX",
  "LOW","TJX","BKNG","ABNB","EBAY","ETSY","ROST","DG","DLTR","BBY",
  "BRK-B","TRV","ALL","CB","AON","MMC","MET","PRU","AFL",
  "PLTR","RBLX","COIN","HOOD","SOFI","UPST","AFRM","SHOP","SQ","PYPL","UBER","LYFT","DASH","RIVN","LCID",
  "ASML","TSM","SAP","TM","SONY","NVO","UL","BP","SHEL",
];

interface FmpScreenerStock {
  symbol?: string;
  companyName?: string;
  marketCap?: number | null;
  sector?: string | null;
  industry?: string | null;
  beta?: number | null;
  price?: number | null;
  lastAnnualDividend?: number | null;
  volume?: number | null;
  exchange?: string | null;
  exchangeShortName?: string | null;
  country?: string | null;
  isEtf?: boolean;
  isFund?: boolean;
  isActivelyTrading?: boolean;
}

interface FinnhubProfile {
  ticker?: string;
  name?: string;
  finnhubIndustry?: string;
  marketCapitalization?: number; // millions
  shareOutstanding?: number;
  exchange?: string;
  country?: string;
  weburl?: string;
}

interface ScreenerStock {
  symbol: string;
  companyName: string;
  marketCap: number | null;
  sector: string | null;
  industry: string | null;
  beta: number | null;
  price: number | null;
  lastAnnualDividend: number | null;
  volume: number | null;
  exchange: string | null;
  country: string | null;
  isEtf: boolean;
  isActivelyTrading: boolean;
  pe: number | null;
  eps: number | null;
  priceToBook: number | null;
  dividendYield: number | null;
  debtToEquity: number | null;
  revenueGrowth: number | null;
  image: string | null;
  dayChange: number | null;
  dayChangePct: number | null;
  vsMA50: number | null;
  vsMA200: number | null;
  vs52wkHigh: number | null;
  vs52wkLow: number | null;
}

/** Translate the client's filter params into FMP screener params. */
async function fetchUniverseFromFMP(
  fmpKey: string,
  client: URLSearchParams
): Promise<FmpScreenerStock[]> {
  const fmp = new URLSearchParams();
  const passthrough = [
    "marketCapMoreThan",
    "marketCapLowerThan",
    "priceMoreThan",
    "priceLowerThan",
    "betaMoreThan",
    "betaLowerThan",
    "volumeMoreThan",
    "dividendMoreThan",
  ];
  for (const k of passthrough) {
    const v = client.get(k);
    if (v) fmp.set(k, v);
  }
  const sector = client.get("sector");
  if (sector && !sector.includes(",")) fmp.set("sector", sector);
  const country = client.get("country");
  if (country) fmp.set("country", country);
  const exchange = client.get("exchange");
  if (exchange) fmp.set("exchange", exchange);
  fmp.set("isActivelyTrading", "true");
  fmp.set("isEtf", "false");
  fmp.set("isFund", "false");
  fmp.set("limit", "5000");
  fmp.set("apikey", fmpKey);

  try {
    const url = `${FMP_BASE}/stock-screener?${fmp.toString()}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.error("[screener] FMP", res.status, (await res.text().catch(() => "")).slice(0, 200));
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? (data as FmpScreenerStock[]) : [];
  } catch (e) {
    console.error("[screener] FMP fetch error", e);
    return [];
  }
}

function mapFmpToScreener(s: FmpScreenerStock): ScreenerStock | null {
  if (!s.symbol || s.price == null || s.price <= 0) return null;
  return {
    symbol: s.symbol,
    companyName: s.companyName ?? s.symbol,
    marketCap: typeof s.marketCap === "number" ? s.marketCap : null,
    sector: s.sector ?? null,
    industry: s.industry ?? null,
    beta: typeof s.beta === "number" ? s.beta : null,
    price: s.price,
    lastAnnualDividend: typeof s.lastAnnualDividend === "number" ? s.lastAnnualDividend : null,
    volume: typeof s.volume === "number" ? s.volume : null,
    exchange: s.exchangeShortName ?? s.exchange ?? null,
    country: s.country ?? null,
    isEtf: !!s.isEtf,
    isActivelyTrading: !!s.isActivelyTrading,
    pe: null,
    eps: null,
    priceToBook: null,
    dividendYield:
      typeof s.lastAnnualDividend === "number" && s.price > 0
        ? (s.lastAnnualDividend / s.price) * 100
        : null,
    debtToEquity: null,
    revenueGrowth: null,
    image: `https://financialmodelingprep.com/image-stock/${s.symbol}.png`,
    dayChange: null,
    dayChangePct: null,
    vsMA50: null,
    vsMA200: null,
    vs52wkHigh: null,
    vs52wkLow: null,
  };
}

/** Fallback path: build the universe from a hardcoded popular-stocks list,
 *  using Finnhub's `/stock/profile2` for company / sector / market-cap data
 *  and `/quote` for live price. Runs when FMP returns nothing so the page is
 *  never blank purely because of a config or quota issue. */
/** Finnhub metric response — `/stock/metric?metric=all` returns fundamentals
 *  that FMP's now-deprecated v3 endpoints no longer provide. Free tier. */
type FinnhubMetric = {
  metric?: {
    "52WeekHigh"?: number;
    "52WeekLow"?: number;
    beta?: number;
    dividendYieldIndicatedAnnual?: number;
    peBasicExclExtraTTM?: number;
    epsBasicExclExtraItemsTTM?: number;
    "10DayAverageTradingVolume"?: number;
    revenueGrowthTTMYoy?: number;
  };
};

async function fetchUniverseFromFinnhub(finnhubKey: string): Promise<ScreenerStock[]> {
  const symbols = Array.from(new Set(FALLBACK_UNIVERSE));
  const BATCH = 15; // smaller batches (3 calls per stock × 15 = 45 concurrent)
  const out: ScreenerStock[] = [];

  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const rows = await Promise.all(
      batch.map(async (sym) => {
        try {
          // Fetch profile (company info), quote (live price), AND metric
          // (fundamentals: PE, EPS, beta, dividend yield, 52wk range).
          const [profileRes, quoteRes, metricRes] = await Promise.all([
            fetch(`${FINNHUB_BASE}/stock/profile2?symbol=${encodeURIComponent(sym)}&token=${finnhubKey}`, {
              next: { revalidate: 86400 },
            }),
            fetch(`${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(sym)}&token=${finnhubKey}`, {
              next: { revalidate: 600 },
            }),
            fetch(`${FINNHUB_BASE}/stock/metric?symbol=${encodeURIComponent(sym)}&metric=all&token=${finnhubKey}`, {
              next: { revalidate: 3600 },
            }),
          ]);
          const profile: FinnhubProfile = profileRes.ok ? await profileRes.json() : {};
          const quote: { c?: number; d?: number; dp?: number; h?: number; l?: number } =
            quoteRes.ok ? await quoteRes.json() : {};
          const metricData: FinnhubMetric = metricRes.ok ? await metricRes.json() : {};
          const m = metricData.metric ?? {};

          if (!quote.c || quote.c <= 0) return null;
          const mcMillions = typeof profile.marketCapitalization === "number" ? profile.marketCapitalization : null;
          const price = quote.c;
          const high52 = typeof m["52WeekHigh"] === "number" ? m["52WeekHigh"] : null;
          const low52 = typeof m["52WeekLow"] === "number" ? m["52WeekLow"] : null;

          return {
            symbol: sym,
            companyName: profile.name ?? sym,
            marketCap: mcMillions != null ? mcMillions * 1_000_000 : null,
            sector: profile.finnhubIndustry ?? null,
            industry: profile.finnhubIndustry ?? null,
            beta: typeof m.beta === "number" ? m.beta : null,
            price,
            lastAnnualDividend: null,
            volume: typeof m["10DayAverageTradingVolume"] === "number"
              ? Math.round(m["10DayAverageTradingVolume"] * 1_000_000) // Finnhub returns in millions
              : null,
            exchange: profile.exchange ?? null,
            country: profile.country ?? "US",
            isEtf: false,
            isActivelyTrading: true,
            pe: typeof m.peBasicExclExtraTTM === "number" ? m.peBasicExclExtraTTM : null,
            eps: typeof m.epsBasicExclExtraItemsTTM === "number" ? m.epsBasicExclExtraItemsTTM : null,
            priceToBook: null,
            dividendYield: typeof m.dividendYieldIndicatedAnnual === "number" ? m.dividendYieldIndicatedAnnual : null,
            debtToEquity: null,
            revenueGrowth: typeof m.revenueGrowthTTMYoy === "number" ? m.revenueGrowthTTMYoy : null,
            image: `https://financialmodelingprep.com/image-stock/${sym}.png`,
            dayChange: typeof quote.d === "number" ? quote.d : null,
            dayChangePct: typeof quote.dp === "number" ? quote.dp : null,
            vsMA50: null,
            vsMA200: null,
            vs52wkHigh: high52 != null && high52 > 0 ? ((price - high52) / high52) * 100 : null,
            vs52wkLow: low52 != null && low52 > 0 ? ((price - low52) / low52) * 100 : null,
          } satisfies ScreenerStock;
        } catch {
          return null;
        }
      })
    );
    for (const r of rows) {
      if (r) out.push(r);
    }
  }
  return out;
}

/** Enrich the top stocks with live USD price, day change, and authoritative
 *  USD market cap via FMP's batch `/quote` endpoint.
 *
 *  Why FMP /quote and not Finnhub: Finnhub's `profile2.shareOutstanding`
 *  reports the underlying foreign-company share count for ADRs (TSM, SONY,
 *  ASML, etc.). Each ADR represents a fixed ratio of underlying shares
 *  (TSM: 1 ADR = 5 common; SONY: 1 ADR = 1 common). Multiplying ADR price
 *  by underlying-share count overcounts by the ratio — that's why TSM was
 *  showing $54T instead of ~$1T. FMP's quote.marketCap already accounts
 *  for the ratio and is denominated in USD.
 */
async function enrichWithLiveQuotes(
  stocks: ScreenerStock[],
  fmpKey: string | undefined,
  finnhubKey: string | undefined
): Promise<ScreenerStock[]> {
  const result = [...stocks];
  // Enrich top 500 by market cap — FMP /quote returns pe, eps, moving-
  // average prices, and 52-wk extremes alongside the live quote. Without
  // this, PE/P-B/MA filters always get null → templates like "Buffett Value"
  // show "no stocks". 500 stocks × 50/batch = 10 FMP calls — cached 1 min.
  const top = result
    .map((s, idx) => ({ s, idx, mc: s.marketCap ?? 0 }))
    .sort((a, b) => b.mc - a.mc)
    .slice(0, 500);

  // Index by symbol so we can apply FMP-quote results back to the original array.
  const indexBySymbol = new Map<string, number>();
  for (const { s, idx } of top) indexBySymbol.set(s.symbol, idx);

  if (fmpKey) {
    // FMP supports batched comma-separated symbols on /quote. ~50 symbols per
    // call keeps URL length well within limits and reduces fan-out.
    const SYMBOLS_PER_CALL = 50;
    const symbolBatches: string[][] = [];
    for (let i = 0; i < top.length; i += SYMBOLS_PER_CALL) {
      symbolBatches.push(top.slice(i, i + SYMBOLS_PER_CALL).map((t) => t.s.symbol));
    }
    type FmpQuote = {
      symbol?: string;
      price?: number;
      change?: number;
      changesPercentage?: number;
      marketCap?: number;
      pe?: number | null;
      eps?: number | null;
      priceAvg50?: number | null;
      priceAvg200?: number | null;
      yearHigh?: number | null;
      yearLow?: number | null;
    };
    let enrichmentWorked = false;
    const allQuotes: FmpQuote[] = (
      await Promise.all(
        symbolBatches.map(async (syms) => {
          // Try batched v3 /quote, then stable /quote
          for (const url of [
            `${FMP_BASE}/quote/${syms.map(encodeURIComponent).join(",")}?apikey=${fmpKey}`,
            `https://financialmodelingprep.com/stable/quote/${syms.map(encodeURIComponent).join(",")}?apikey=${fmpKey}`,
          ]) {
            try {
              const res = await fetch(url, { next: { revalidate: 600 } });
              if (!res.ok) continue;
              const data = await res.json();
              const arr = Array.isArray(data) ? (data as FmpQuote[]) : [];
              if (arr.length > 0) { enrichmentWorked = true; return arr; }
            } catch {
              continue;
            }
          }
          return [] as FmpQuote[];
        })
      )
    ).flat();
    if (!enrichmentWorked) {
      console.warn("[screener] FMP quote enrichment failed on all tiers — PE/EPS/MA fields will be null");
    }

    for (const q of allQuotes) {
      if (!q.symbol) continue;
      const idx = indexBySymbol.get(q.symbol);
      if (idx == null) continue;
      const target = result[idx];
      if (typeof q.price === "number" && q.price > 0) target.price = q.price;
      if (typeof q.change === "number") target.dayChange = q.change;
      if (typeof q.changesPercentage === "number") target.dayChangePct = q.changesPercentage;
      if (typeof q.marketCap === "number" && q.marketCap > 0) target.marketCap = q.marketCap;
      // Fundamentals + technicals from /quote — fills the nulls that the
      // screener-source leaves so PE/MA/52wk filters actually work.
      if (typeof q.pe === "number") target.pe = q.pe;
      if (typeof q.eps === "number") target.eps = q.eps;
      if (typeof q.priceAvg50 === "number" && q.priceAvg50 > 0 && target.price) {
        target.vsMA50 = ((target.price - q.priceAvg50) / q.priceAvg50) * 100;
      }
      if (typeof q.priceAvg200 === "number" && q.priceAvg200 > 0 && target.price) {
        target.vsMA200 = ((target.price - q.priceAvg200) / q.priceAvg200) * 100;
      }
      if (typeof q.yearHigh === "number" && q.yearHigh > 0 && target.price) {
        target.vs52wkHigh = ((target.price - q.yearHigh) / q.yearHigh) * 100;
      }
      if (typeof q.yearLow === "number" && q.yearLow > 0 && target.price) {
        target.vs52wkLow = ((target.price - q.yearLow) / q.yearLow) * 100;
      }
    }
  }

  // Fallback for stocks we still don't have live price for: hit Finnhub /quote
  // (price-only — don't trust marketCapitalization here for the ADR reasons
  // above). Helps when FMP's quota is exhausted or symbol is missing there.
  if (finnhubKey) {
    const missing = top.filter(({ idx }) => result[idx].price == null);
    const BATCH = 30;
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      const quotes = await Promise.all(
        batch.map(async ({ s }) => {
          try {
            const res = await fetch(
              `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(s.symbol)}&token=${finnhubKey}`,
              { next: { revalidate: 600 } }
            );
            if (!res.ok) return null;
            return (await res.json()) as { c?: number; d?: number; dp?: number };
          } catch {
            return null;
          }
        })
      );
      quotes.forEach((q, j) => {
        if (!q) return;
        const target = result[batch[j].idx];
        if (typeof q.c === "number" && q.c > 0) target.price = q.c;
        if (typeof q.d === "number") target.dayChange = q.d;
        if (typeof q.dp === "number") target.dayChangePct = q.dp;
      });
    }
  }

  return result;
}

// Backwards-compat shim — keeps other callers (if any) working while we move
// to the new name.
const enrichWithFinnhub = enrichWithLiveQuotes;
void enrichWithFinnhub;

/** Build minimal ScreenerStock rows for a list of tickers via FMP `/quote`
 *  (batched comma-separated, ≤50 per call). Used to backfill any whitelist
 *  members that the broad screener-source missed — guarantees an index like
 *  Dow 30 actually shows all 30 stocks rather than the intersection-with-
 *  universe count (was showing 26). */
async function fetchStocksBySymbols(symbols: string[], fmpKey: string): Promise<ScreenerStock[]> {
  if (symbols.length === 0) return [];
  const SYMBOLS_PER_CALL = 50;
  const batches: string[][] = [];
  for (let i = 0; i < symbols.length; i += SYMBOLS_PER_CALL) {
    batches.push(symbols.slice(i, i + SYMBOLS_PER_CALL));
  }
  type FmpQuote = {
    symbol?: string;
    name?: string;
    price?: number;
    change?: number;
    changesPercentage?: number;
    marketCap?: number;
    exchange?: string;
    volume?: number;
  };
  const allQuotes: FmpQuote[] = (
    await Promise.all(
      batches.map(async (syms) => {
        try {
          const url = `${FMP_BASE}/quote/${syms.map(encodeURIComponent).join(",")}?apikey=${fmpKey}`;
          const res = await fetch(url, { next: { revalidate: 3600 } });
          if (!res.ok) return [] as FmpQuote[];
          const data = await res.json();
          return Array.isArray(data) ? (data as FmpQuote[]) : [];
        } catch {
          return [] as FmpQuote[];
        }
      })
    )
  ).flat();

  return allQuotes
    .filter((q) => q.symbol && q.price && q.price > 0)
    .map<ScreenerStock>((q) => ({
      symbol: q.symbol!,
      companyName: q.name ?? q.symbol!,
      marketCap: typeof q.marketCap === "number" ? q.marketCap : null,
      // /quote doesn't include sector/industry — sector filter won't work for
      // backfilled stocks, but the index member view doesn't need sector data.
      sector: null,
      industry: null,
      beta: null,
      price: q.price!,
      lastAnnualDividend: null,
      volume: typeof q.volume === "number" ? q.volume : null,
      exchange: q.exchange ?? null,
      country: "US",
      isEtf: false,
      isActivelyTrading: true,
      pe: null,
      eps: null,
      priceToBook: null,
      dividendYield: null,
      debtToEquity: null,
      revenueGrowth: null,
      image: `https://financialmodelingprep.com/image-stock/${q.symbol}.png`,
      dayChange: typeof q.change === "number" ? q.change : null,
      dayChangePct: typeof q.changesPercentage === "number" ? q.changesPercentage : null,
      vsMA50: null,
      vsMA200: null,
      vs52wkHigh: null,
      vs52wkLow: null,
    }));
}

export async function GET(request: NextRequest) {
  const fmpKey = process.env.FMP_API_KEY?.trim();
  const finnhubKey = process.env.FINNHUB_API_KEY?.trim();

  let stocks: ScreenerStock[] = [];

  if (fmpKey) {
    const fmpStocks = await fetchUniverseFromFMP(fmpKey, request.nextUrl.searchParams);
    stocks = fmpStocks
      .map(mapFmpToScreener)
      .filter((s): s is ScreenerStock => s !== null);
    if (stocks.length === 0) {
      console.warn("[screener] FMP screener returned 0 stocks — falling back to Finnhub universe");
    } else {
      console.log(`[screener] FMP returned ${stocks.length} stocks. Sample fields:`,
        stocks[0] ? { pe: stocks[0].pe, beta: stocks[0].beta, vol: stocks[0].volume, divY: stocks[0].dividendYield } : "none");
    }
  }

  // Fallback: rebuild universe from hardcoded popular-stocks list when FMP
  // produces nothing (no key, quota exhausted, exchange-name mismatch, etc.).
  if (stocks.length === 0 && finnhubKey) {
    stocks = await fetchUniverseFromFinnhub(finnhubKey);
  }

  // Backfill any whitelist members the broad universe missed. The screener
  // route receives `whitelist=AAPL,MSFT,...` from the client when an index
  // preset is active; we then ensure every requested ticker is present.
  // Without this the index display showed only the intersection (Dow 30
  // came back as 26, S&P 500 as 108, etc.).
  const whitelistParam = request.nextUrl.searchParams.get("whitelist");
  if (whitelistParam && fmpKey) {
    const requested = whitelistParam
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const present = new Set(stocks.map((s) => s.symbol.toUpperCase()));
    const missing = requested.filter((t) => !present.has(t));
    if (missing.length > 0) {
      const extra = await fetchStocksBySymbols(missing, fmpKey);
      stocks.push(...extra);
    }
  }

  // Dedupe dual-class shares with an explicit drop list. Case-insensitive +
  // trimmed so we catch FMP's occasional variant casings.
  const DUAL_CLASS_DROP = new Set<string>([
    "GOOG",     // keep GOOGL (Class A, voting)
    "BRK-A",    // keep BRK-B (much higher liquidity)
    "FOX",      // keep FOXA (voting)
    "NWS",      // keep NWSA
    "DISCA",
    "DISCB",
    "LBTYA",    // keep LBTYK
    "LBRDA",    // keep LBRDK
  ]);
  stocks = stocks.filter((s) => !DUAL_CLASS_DROP.has(s.symbol.trim().toUpperCase()));

  // Enrich top-200 with live FMP quotes (primary — accurate USD market cap
  // for ADRs) and Finnhub quotes (fallback for missing prices).
  const enriched =
    fmpKey || finnhubKey ? await enrichWithLiveQuotes(stocks, fmpKey, finnhubKey) : stocks;

  // Sanity guard: any single-stock USD market cap above $10T is wrong (real-
  // world max is ~$5T as of 2026). Foreign-listed names like TSM/SONY can
  // still surface bad numbers if both FMP /quote and the recompute path miss.
  // Null them rather than show absurd "$54T" cells.
  const SANITY_MAX_MCAP = 10_000_000_000_000;
  for (const s of enriched) {
    if (s.marketCap != null && s.marketCap > SANITY_MAX_MCAP) {
      s.marketCap = null;
    }
  }

  return NextResponse.json(enriched);
}
