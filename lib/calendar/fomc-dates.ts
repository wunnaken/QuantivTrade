/**
 * Authoritative FOMC meeting dates (rate-decision day = the day the Press
 * Release publishes, typically the second day of the two-day meeting).
 *
 * Why hardcoded: FRED's `/release/dates?release_id=…` returns release-CHANGE
 * timestamps (often one per day FRED touches a release's metadata), not
 * scheduled meeting days. FMP's free economic_calendar truncates year-long
 * ranges. The Fed itself publishes the schedule a full year ahead at
 * https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm and dates
 * almost never change once published — so a small hardcoded table is the
 * most reliable source.
 *
 * UPDATE EACH NOVEMBER when the Fed publishes the next year's calendar.
 *
 * Used by:
 *   - app/api/calendar/economic/route.ts        (filter spurious daily FOMC entries)
 *   - app/api/calendar/year-event-counts/route.ts  (fed-meeting count per month)
 */

const HARDCODED_FOMC_DATES_BY_YEAR: Record<number, string[]> = {
  2024: [
    "2024-01-31", "2024-03-20", "2024-05-01", "2024-06-12",
    "2024-07-31", "2024-09-18", "2024-11-07", "2024-12-18",
  ],
  2025: [
    "2025-01-29", "2025-03-19", "2025-05-07", "2025-06-18",
    "2025-07-30", "2025-09-17", "2025-10-29", "2025-12-10",
  ],
  2026: [
    "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17",
    "2026-07-29", "2026-09-16", "2026-10-28", "2026-12-09",
  ],
  2027: [
    "2027-01-27", "2027-03-17", "2027-05-05", "2027-06-16",
    "2027-07-28", "2027-09-22", "2027-10-27", "2027-12-08",
  ],
  2028: [
    "2028-01-26", "2028-03-15", "2028-05-03", "2028-06-14",
    "2028-07-26", "2028-09-20", "2028-11-01", "2028-12-13",
  ],
};

/** Returns scheduled FOMC meeting days for the given year (YYYY-MM-DD).
 *  fredKey is accepted but unused — kept for API compatibility with
 *  callers that previously passed it. Empty array if year isn't in the
 *  hardcoded table. */
export async function fetchFOMCDates(year: number, _fredKey?: string): Promise<string[]> {
  void _fredKey;
  return HARDCODED_FOMC_DATES_BY_YEAR[year] ?? [];
}

/** True for any indicator name a user would think of as "FOMC meeting" —
 *  Statement, Press Conference, Rate Decision, etc. Excludes "minutes". */
export function isFOMCRelated(name: string): boolean {
  const n = name.toLowerCase();
  if (n.includes("minutes")) return false;
  return /fomc|federal open market committee|federal funds rate|fed interest|interest rate decision|rate decision/.test(n);
}
