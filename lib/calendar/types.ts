/**
 * Shared types for calendar API + UI.
 *
 * The API routes (app/api/calendar/*) and the page (app/calendar/CalendarView.tsx)
 * all import from here so the wire format stays in lock-step.
 */

export type EarningsItem = {
  id: string;
  ticker: string;
  name: string;
  date: string; // YYYY-MM-DD
  epsEstimate: number | null;
  revenueEstimate: number | null;
  epsActual: number | null;
  revenueActual: number | null;
  bmoAmc: "BMO" | "AMC" | null;
};

export type EconomicItem = {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  dateTimeET: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  country: string;
  previous?: string;
  estimate?: string;
  actual?: string;
  unit?: string;
};
