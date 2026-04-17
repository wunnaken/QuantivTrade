import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

/**
 * Dividend calendar built from KNOWN payment schedules of major US stocks.
 *
 * Why hardcoded: FMP's per-stock dividend history endpoints
 * (`/api/v3/historical-price-full/stock_dividend/` and
 * `/stable/historical-dividends-full/`) both return 403 on the user's free-
 * tier key. Rather than show nothing, we use the companies' publicly
 * published ex-dividend month patterns (which are stable year-over-year).
 *
 * Each entry includes the typical ex-div months and the last known per-share
 * amount. The route computes approximate next ex-div dates by finding the
 * nearest upcoming month in the pattern.
 */

type ScheduleEntry = {
  symbol: string;
  company: string;
  /** 0-indexed months in which ex-div typically falls. */
  months: number[];
  freq: "Monthly" | "Quarterly" | "Semi-Annual";
  /** Approximate most-recent per-share amount. */
  amount: number;
};

// Real payment patterns sourced from company IR pages / SEC filings.
// Amounts are approximate recent per-share figures.
const SCHEDULES: ScheduleEntry[] = [
  { symbol: "AAPL",  company: "Apple Inc.",             months: [1,4,7,10],       freq: "Quarterly", amount: 0.25 },
  { symbol: "MSFT",  company: "Microsoft Corp.",        months: [1,4,7,10],       freq: "Quarterly", amount: 0.83 },
  { symbol: "JNJ",   company: "Johnson & Johnson",      months: [2,5,8,11],       freq: "Quarterly", amount: 1.24 },
  { symbol: "PG",    company: "Procter & Gamble",       months: [0,3,6,9],        freq: "Quarterly", amount: 1.0065 },
  { symbol: "KO",    company: "Coca-Cola Co.",          months: [2,5,8,11],       freq: "Quarterly", amount: 0.485 },
  { symbol: "PEP",   company: "PepsiCo Inc.",           months: [2,5,8,11],       freq: "Quarterly", amount: 1.355 },
  { symbol: "XOM",   company: "ExxonMobil Corp.",       months: [1,4,7,10],       freq: "Quarterly", amount: 0.99 },
  { symbol: "CVX",   company: "Chevron Corp.",          months: [1,4,7,10],       freq: "Quarterly", amount: 1.63 },
  { symbol: "JPM",   company: "JPMorgan Chase",         months: [0,3,6,9],        freq: "Quarterly", amount: 1.25 },
  { symbol: "BAC",   company: "Bank of America",        months: [2,5,8,11],       freq: "Quarterly", amount: 0.26 },
  { symbol: "T",     company: "AT&T Inc.",              months: [0,3,6,9],        freq: "Quarterly", amount: 0.2775 },
  { symbol: "VZ",    company: "Verizon Comm.",          months: [0,3,6,9],        freq: "Quarterly", amount: 0.6775 },
  { symbol: "ABBV",  company: "AbbVie Inc.",            months: [0,3,6,9],        freq: "Quarterly", amount: 1.64 },
  { symbol: "MRK",   company: "Merck & Co.",            months: [2,5,8,11],       freq: "Quarterly", amount: 0.77 },
  { symbol: "HD",    company: "Home Depot",             months: [2,5,8,11],       freq: "Quarterly", amount: 2.25 },
  { symbol: "MCD",   company: "McDonald's Corp.",       months: [2,5,8,11],       freq: "Quarterly", amount: 1.77 },
  { symbol: "WMT",   company: "Walmart Inc.",           months: [2,5,8,11],       freq: "Quarterly", amount: 0.2075 },
  { symbol: "IBM",   company: "IBM Corp.",              months: [2,5,8,11],       freq: "Quarterly", amount: 1.67 },
  { symbol: "CAT",   company: "Caterpillar Inc.",       months: [0,3,6,9],        freq: "Quarterly", amount: 1.41 },
  { symbol: "MMM",   company: "3M Company",             months: [2,5,8,11],       freq: "Quarterly", amount: 0.70 },
  { symbol: "O",     company: "Realty Income",          months: [0,1,2,3,4,5,6,7,8,9,10,11], freq: "Monthly", amount: 0.2685 },
  { symbol: "MAIN",  company: "Main Street Capital",    months: [0,1,2,3,4,5,6,7,8,9,10,11], freq: "Monthly", amount: 0.245 },
  { symbol: "STAG",  company: "STAG Industrial",        months: [0,1,2,3,4,5,6,7,8,9,10,11], freq: "Monthly", amount: 0.1233 },
  { symbol: "SCHD",  company: "Schwab US Div ETF",      months: [2,5,8,11],       freq: "Quarterly", amount: 0.62 },
  { symbol: "VYM",   company: "Vanguard Hi Div ETF",    months: [2,5,8,11],       freq: "Quarterly", amount: 0.85 },
];

export async function GET() {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  type CalEntry = {
    symbol: string;
    company: string;
    exDiv: string;
    payDate: string;
    amount: string;
    yield: string;
    freq: string;
    daysAway: number;
  };

  const entries: CalEntry[] = [];

  for (const s of SCHEDULES) {
    // Find the next month in the pattern that's ≥ current month.
    // If none left this year, wrap to first month next year.
    let nextMonth = s.months.find((m) => m >= currentMonth);
    let nextYear = currentYear;
    if (nextMonth === undefined) {
      nextMonth = s.months[0];
      nextYear = currentYear + 1;
    }

    // Approximate ex-div as the 15th of that month (a common mid-month pattern).
    const exDate = new Date(nextYear, nextMonth, 15);
    const daysAway = Math.round(
      (exDate.getTime() - today.getTime()) / 86400000
    );

    if (daysAway < 0 || daysAway > 180) continue;

    entries.push({
      symbol: s.symbol,
      company: s.company,
      exDiv: exDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      payDate: "~2-3 weeks later",
      amount: `$${s.amount.toFixed(4).replace(/\.?0+$/, "")}`,
      yield: "—",
      freq: s.freq,
      daysAway,
    });
  }

  entries.sort((a, b) => a.daysAway - b.daysAway);

  return NextResponse.json({ entries });
}
