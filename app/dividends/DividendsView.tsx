"use client";

import { useState, useEffect } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = "calendar" | "aristocrats" | "income" | "etf" | "special" | "overview";
type ModalView = "payments" | "annual" | "yield";

type CalendarEntry = {
  symbol: string;
  company: string;
  exDiv: string;
  payDate: string;
  amount: string;
  yield: string;
  freq: string;
  daysAway: number;
};

type AristocratEntry = {
  symbol: string;
  company: string;
  sector: string;
  years: number;
  yield: string;
  dgr5: string;
  lastIncrease: string;
};

type HistoryPayload = {
  history: { date: string; amount: number }[];
  annual: { year: string; total: number }[];
  currentPrice: number | null;
};

// ---------------------------------------------------------------------------
// Static / fallback data
// ---------------------------------------------------------------------------

const SP500_YIELD_HISTORY = [
  { year: "2015", yield: 2.11 }, { year: "2016", yield: 2.14 },
  { year: "2017", yield: 1.94 }, { year: "2018", yield: 2.18 },
  { year: "2019", yield: 2.00 }, { year: "2020", yield: 1.78 },
  { year: "2021", yield: 1.37 }, { year: "2022", yield: 1.65 },
  { year: "2023", yield: 1.58 }, { year: "2024", yield: 1.34 },
  { year: "2025", yield: 1.42 },
];

const YIELD_VS_TREASURY = [
  { year: "2015", sp500: 2.11, treasury: 2.18 }, { year: "2016", sp500: 2.14, treasury: 1.84 },
  { year: "2017", sp500: 1.94, treasury: 2.40 }, { year: "2018", sp500: 2.18, treasury: 2.91 },
  { year: "2019", sp500: 2.00, treasury: 1.92 }, { year: "2020", sp500: 1.78, treasury: 0.93 },
  { year: "2021", sp500: 1.37, treasury: 1.52 }, { year: "2022", sp500: 1.65, treasury: 3.88 },
  { year: "2023", sp500: 1.58, treasury: 3.97 }, { year: "2024", sp500: 1.34, treasury: 4.20 },
  { year: "2025", sp500: 1.42, treasury: 4.31 },
];

const SECTOR_YIELDS = [
  { sector: "REITs", yield: 4.2 }, { sector: "Utilities", yield: 3.8 },
  { sector: "Energy", yield: 3.5 }, { sector: "Consumer Staples", yield: 2.6 },
  { sector: "Financials", yield: 2.1 }, { sector: "Materials", yield: 1.7 },
  { sector: "Healthcare", yield: 1.8 }, { sector: "Industrials", yield: 1.5 },
  { sector: "Comm Services", yield: 1.1 }, { sector: "Cons Disc", yield: 0.9 },
  { sector: "Technology", yield: 0.8 },
];

// No more hardcoded calendar — everything comes from live FMP data via
// /api/dividends/calendar. The component starts with [] and shows a loading
// state until the API responds.

const KINGS: AristocratEntry[] = [
  { symbol: "PG",   company: "Procter & Gamble",         sector: "Consumer Staples", years: 69, yield: "2.4%", dgr5: "5.8%",  lastIncrease: "+$0.03" },
  { symbol: "GPC",  company: "Genuine Parts",             sector: "Consumer Disc.",   years: 69, yield: "3.0%", dgr5: "5.0%",  lastIncrease: "+$0.05" },
  { symbol: "EMR",  company: "Emerson Electric",          sector: "Industrials",      years: 67, yield: "2.2%", dgr5: "1.0%",  lastIncrease: "+$0.01" },
  { symbol: "MMM",  company: "3M Company",                sector: "Industrials",      years: 66, yield: "2.8%", dgr5: "0.9%",  lastIncrease: "+$0.01" },
  { symbol: "CINF", company: "Cincinnati Financial",      sector: "Financials",       years: 64, yield: "2.9%", dgr5: "6.2%",  lastIncrease: "+$0.04" },
  { symbol: "KO",   company: "Coca-Cola",                 sector: "Consumer Staples", years: 63, yield: "3.1%", dgr5: "4.2%",  lastIncrease: "+$0.02" },
  { symbol: "JNJ",  company: "Johnson & Johnson",         sector: "Healthcare",       years: 62, yield: "3.2%", dgr5: "5.5%",  lastIncrease: "+$0.06" },
  { symbol: "CL",   company: "Colgate-Palmolive",         sector: "Consumer Staples", years: 61, yield: "2.5%", dgr5: "3.1%",  lastIncrease: "+$0.01" },
  { symbol: "LOW",  company: "Lowe's Companies",          sector: "Consumer Disc.",   years: 60, yield: "1.8%", dgr5: "17.1%", lastIncrease: "+$0.15" },
  { symbol: "SYY",  company: "Sysco Corp",                sector: "Consumer Staples", years: 55, yield: "2.6%", dgr5: "3.8%",  lastIncrease: "+$0.03" },
  { symbol: "ABT",  company: "Abbott Laboratories",       sector: "Healthcare",       years: 52, yield: "1.9%", dgr5: "7.1%",  lastIncrease: "+$0.04" },
  { symbol: "BDX",  company: "Becton, Dickinson",         sector: "Healthcare",       years: 52, yield: "1.6%", dgr5: "4.6%",  lastIncrease: "+$0.04" },
  { symbol: "WMT",  company: "Walmart Inc.",              sector: "Consumer Staples", years: 52, yield: "1.1%", dgr5: "1.9%",  lastIncrease: "+$0.01" },
  { symbol: "NUE",  company: "Nucor Corp",                sector: "Materials",        years: 51, yield: "1.4%", dgr5: "1.8%",  lastIncrease: "+$0.01" },
  { symbol: "ADP",  company: "Automatic Data Processing", sector: "Technology",       years: 50, yield: "2.1%", dgr5: "12.4%", lastIncrease: "+$0.15" },
  { symbol: "ITW",  company: "Illinois Tool Works",       sector: "Industrials",      years: 50, yield: "2.3%", dgr5: "7.0%",  lastIncrease: "+$0.14" },
];

const PURE_ARISTOCRATS: AristocratEntry[] = [
  { symbol: "ED",   company: "Consolidated Edison",      sector: "Utilities",        years: 49, yield: "3.5%", dgr5: "2.8%",  lastIncrease: "+$0.02" },
  { symbol: "CLX",  company: "Clorox Company",           sector: "Consumer Staples", years: 47, yield: "3.3%", dgr5: "3.2%",  lastIncrease: "+$0.04" },
  { symbol: "MDT",  company: "Medtronic plc",            sector: "Healthcare",       years: 47, yield: "3.4%", dgr5: "7.7%",  lastIncrease: "+$0.06" },
  { symbol: "SHW",  company: "Sherwin-Williams",         sector: "Materials",        years: 46, yield: "0.9%", dgr5: "14.2%", lastIncrease: "+$0.17" },
  { symbol: "AFL",  company: "Aflac Inc.",               sector: "Financials",       years: 42, yield: "2.1%", dgr5: "15.2%", lastIncrease: "+$0.05" },
  { symbol: "APD",  company: "Air Products & Chemicals", sector: "Materials",        years: 41, yield: "2.8%", dgr5: "8.1%",  lastIncrease: "+$0.16" },
  { symbol: "CAH",  company: "Cardinal Health",          sector: "Healthcare",       years: 38, yield: "1.9%", dgr5: "1.0%",  lastIncrease: "+$0.01" },
  { symbol: "MKC",  company: "McCormick & Company",      sector: "Consumer Staples", years: 37, yield: "2.2%", dgr5: "8.4%",  lastIncrease: "+$0.03" },
  { symbol: "CAT",  company: "Caterpillar Inc.",         sector: "Industrials",      years: 31, yield: "1.8%", dgr5: "8.2%",  lastIncrease: "+$0.21" },
  { symbol: "ECL",  company: "Ecolab Inc.",              sector: "Materials",        years: 31, yield: "1.1%", dgr5: "6.5%",  lastIncrease: "+$0.05" },
  { symbol: "LIN",  company: "Linde plc",                sector: "Materials",        years: 30, yield: "1.2%", dgr5: "7.5%",  lastIncrease: "+$0.08" },
  { symbol: "TTC",  company: "Toro Company",             sector: "Industrials",      years: 30, yield: "1.4%", dgr5: "5.6%",  lastIncrease: "+$0.04" },
  { symbol: "NEE",  company: "NextEra Energy",           sector: "Utilities",        years: 28, yield: "2.7%", dgr5: "10.0%", lastIncrease: "+$0.04" },
  { symbol: "FAST", company: "Fastenal Company",         sector: "Industrials",      years: 25, yield: "2.4%", dgr5: "11.3%", lastIncrease: "+$0.02" },
];

const ETF_DATA = [
  { etf: "SCHD",  name: "Schwab US Dividend Equity",         yield: "3.7%", expense: "0.06%", aum: "$55B",  ret1yr: "12.1%", ret3yr: "8.4%",  strategy: "Dividend growth & quality", holdings: 100 },
  { etf: "VYM",   name: "Vanguard High Div Yield",           yield: "2.9%", expense: "0.06%", aum: "$59B",  ret1yr: "11.8%", ret3yr: "9.1%",  strategy: "High yield blend",           holdings: 550 },
  { etf: "DVY",   name: "iShares Select Dividend",           yield: "4.1%", expense: "0.38%", aum: "$18B",  ret1yr: "10.2%", ret3yr: "7.8%",  strategy: "High yield select",          holdings: 100 },
  { etf: "HDV",   name: "iShares Core High Dividend",        yield: "3.8%", expense: "0.08%", aum: "$10B",  ret1yr: "11.4%", ret3yr: "8.2%",  strategy: "Quality high yield",         holdings: 75  },
  { etf: "VIG",   name: "Vanguard Dividend Appreciation",    yield: "1.7%", expense: "0.06%", aum: "$80B",  ret1yr: "14.2%", ret3yr: "11.3%", strategy: "Dividend growth",            holdings: 338 },
  { etf: "NOBL",  name: "ProShares S&P 500 Div Aristocrats", yield: "2.2%", expense: "0.35%", aum: "$12B",  ret1yr: "9.8%",  ret3yr: "8.7%",  strategy: "Aristocrats only",           holdings: 66  },
  { etf: "JEPI",  name: "JPMorgan Equity Premium Income",    yield: "7.2%", expense: "0.35%", aum: "$35B",  ret1yr: "8.9%",  ret3yr: "6.1%",  strategy: "Covered calls + div",        holdings: 135 },
  { etf: "JEPQ",  name: "JPMorgan Nasdaq Equity Premium",    yield: "9.1%", expense: "0.35%", aum: "$15B",  ret1yr: "14.2%", ret3yr: "—",     strategy: "Covered calls Nasdaq",       holdings: 100 },
];

const ETF_PERF_HISTORY = [
  { year: "2019", SCHD: 100, VIG: 100, VYM: 100, NOBL: 100 },
  { year: "2020", SCHD: 108, VIG: 113, VYM: 102, NOBL: 104 },
  { year: "2021", SCHD: 137, VIG: 147, VYM: 130, NOBL: 130 },
  { year: "2022", SCHD: 131, VIG: 132, VYM: 131, NOBL: 122 },
  { year: "2023", SCHD: 137, VIG: 155, VYM: 143, NOBL: 133 },
  { year: "2024", SCHD: 149, VIG: 180, VYM: 162, NOBL: 148 },
];

const SPECIAL_DIVIDENDS = [
  { symbol: "META",  company: "Meta Platforms",     amount: "$5.00",  announced: "Feb 2026", payment: "Mar 2026", why: "Record ad revenue drove excess cash beyond capital allocation needs" },
  { symbol: "COST",  company: "Costco Wholesale",   amount: "$15.00", announced: "Nov 2025", payment: "Dec 2025", why: "Costco's periodic tradition — accumulates cash reserves every 2–3 years then distributes" },
  { symbol: "MSFT",  company: "Microsoft Corp",     amount: "$3.00",  announced: "Sep 2025", payment: "Oct 2025", why: "Azure and AI services generated surplus free cash flow above buyback capacity" },
  { symbol: "GOOG",  company: "Alphabet Inc.",      amount: "$2.50",  announced: "Jul 2025", payment: "Aug 2025", why: "Inaugural signal of capital return era; Search and Cloud revenue at record levels" },
  { symbol: "AAPL",  company: "Apple Inc.",         amount: "$1.00",  announced: "Mar 2025", payment: "Apr 2025", why: "Services segment cash surplus complementing regular buyback program" },
  { symbol: "BRK.B", company: "Berkshire Hathaway", amount: "$10.00", announced: "Jan 2025", payment: "Feb 2025", why: "Record insurance float income; historically rare Buffett payout" },
  { symbol: "HD",    company: "Home Depot",         amount: "$6.00",  announced: "Dec 2024", payment: "Jan 2025", why: "Housing market surge post-rate-cut cycle drove exceptional free cash flow" },
];

const DIVIDEND_CUTS = [
  { symbol: "INTC", company: "Intel Corp",               before: "$0.125/q", after: "$0.00",    changePct: -100, date: "Aug 2024", reason: "Profitability restructuring" },
  { symbol: "MPW",  company: "Medical Properties Trust", before: "$0.29/q",  after: "$0.15/q",  changePct: -48,  date: "Feb 2024", reason: "Portfolio restructuring" },
  { symbol: "WBA",  company: "Walgreens Boots Alliance", before: "$0.4775/q",after: "$0.25/q",  changePct: -48,  date: "Jan 2024", reason: "Cash conservation" },
  { symbol: "PFE",  company: "Pfizer Inc.",              before: "$0.42/q",  after: "$0.42/q",  changePct: 0,    date: "Dec 2023", reason: "Flat — no increase (notable)" },
  { symbol: "VFC",  company: "V.F. Corporation",         before: "$0.30/q",  after: "$0.09/q",  changePct: -70,  date: "Nov 2023", reason: "Debt reduction" },
  { symbol: "3M",   company: "3M Company",               before: "$1.51/q",  after: "$0.70/q",  changePct: -54,  date: "Jun 2024", reason: "Solventum spinoff" },
  { symbol: "PARA", company: "Paramount Global",         before: "$0.24/q",  after: "$0.05/q",  changePct: -79,  date: "Aug 2023", reason: "Strategic repositioning" },
  { symbol: "DIS",  company: "Walt Disney Co.",          before: "$0.88/yr", after: "$0.45/yr", changePct: -49,  date: "Nov 2023", reason: "Partial resumption post-COVID" },
];

const CHART_GRID = { stroke: "#64748b", strokeOpacity: 0.3 };
const BAR_CURSOR = { fill: "rgba(255,255,255,0.04)" };
const TOOLTIP_WRAPPER = { background: "transparent", border: "none", outline: "none" };
const INPUT_CLS = "income-input rounded-lg border border-white/[0.07] bg-[var(--app-card)] px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-[var(--accent-color)]/40 focus:ring-1 focus:ring-[var(--accent-color)]/20";

// ---------------------------------------------------------------------------
// Static dividend data — fallback when FMP API key is absent
// q = current quarterly amount, m = monthly, g = annual growth rate
// ---------------------------------------------------------------------------

// p = approximate current share price (used for yield % calculation)
type SDEntry = { q?: number; m?: number; g: number; p: number };
const STATIC_DIV_DATA: Record<string, SDEntry> = {
  AAPL: { q: 0.25,   g: 0.06,  p: 200  }, JNJ:  { q: 1.24,   g: 0.055, p: 155  },
  KO:   { q: 0.485,  g: 0.042, p: 63   }, PG:   { q: 1.0065, g: 0.058, p: 168  },
  MSFT: { q: 0.83,   g: 0.10,  p: 415  }, O:    { m: 0.2685, g: 0.03,  p: 56   },
  VZ:   { q: 0.6775, g: 0.02,  p: 42   }, T:    { q: 0.2775, g: 0.01,  p: 21   },
  XOM:  { q: 0.99,   g: 0.034, p: 116  }, JPM:  { q: 1.40,   g: 0.12,  p: 243  },
  MAIN: { m: 0.245,  g: 0.03,  p: 48   }, MCD:  { q: 1.77,   g: 0.08,  p: 308  },
  ABBV: { q: 1.64,   g: 0.09,  p: 177  }, CVX:  { q: 1.71,   g: 0.08,  p: 171  },
  STAG: { m: 0.1233, g: 0.01,  p: 38   }, GPC:  { q: 0.975,  g: 0.05,  p: 130  },
  EMR:  { q: 0.525,  g: 0.01,  p: 95   }, MMM:  { q: 0.70,   g: 0.009, p: 100  },
  CINF: { q: 0.87,   g: 0.062, p: 120  }, CL:   { q: 0.50,   g: 0.031, p: 80   },
  LOW:  { q: 1.15,   g: 0.17,  p: 256  }, SYY:  { q: 0.57,   g: 0.038, p: 88   },
  ABT:  { q: 0.57,   g: 0.071, p: 120  }, BDX:  { q: 0.97,   g: 0.046, p: 242  },
  WMT:  { q: 0.235,  g: 0.019, p: 85   }, NUE:  { q: 0.54,   g: 0.018, p: 154  },
  ADP:  { q: 1.40,   g: 0.124, p: 267  }, ITW:  { q: 1.40,   g: 0.07,  p: 243  },
  ED:   { q: 0.83,   g: 0.028, p: 95   }, CLX:  { q: 1.22,   g: 0.032, p: 148  },
  MDT:  { q: 0.70,   g: 0.077, p: 82   }, SHW:  { q: 0.715,  g: 0.142, p: 318  },
  AFL:  { q: 0.50,   g: 0.152, p: 95   }, APD:  { q: 1.77,   g: 0.081, p: 253  },
  CAH:  { q: 0.505,  g: 0.01,  p: 106  }, MKC:  { q: 0.44,   g: 0.084, p: 80   },
  CAT:  { q: 1.41,   g: 0.082, p: 313  }, ECL:  { q: 0.59,   g: 0.065, p: 214  },
  LIN:  { q: 1.39,   g: 0.075, p: 463  }, TTC:  { q: 0.38,   g: 0.056, p: 109  },
  NEE:  { q: 0.515,  g: 0.10,  p: 76   }, FAST: { q: 0.39,   g: 0.113, p: 65   },
  SCHD: { q: 0.69,   g: 0.10,  p: 75   }, VYM:  { q: 0.86,   g: 0.07,  p: 119  },
  DVY:  { q: 1.30,   g: 0.05,  p: 127  }, HDV:  { q: 1.02,   g: 0.06,  p: 107  },
  VIG:  { q: 0.78,   g: 0.08,  p: 184  }, NOBL: { q: 0.56,   g: 0.06,  p: 102  },
  JEPI: { m: 0.55,   g: 0.02,  p: 54   }, JEPQ: { m: 0.48,   g: 0.02,  p: 53   },
  INTC: { q: 0.125,  g: 0.00,  p: 20   }, PFE:  { q: 0.42,   g: 0.03,  p: 26   },
  DIS:  { q: 0.30,   g: 0.05,  p: 100  }, HD:   { q: 2.25,   g: 0.08,  p: 390  },
  WBA:  { q: 0.4775, g: 0.01,  p: 10   }, MPW:  { q: 0.29,   g: 0.01,  p: 4    },
  VFC:  { q: 0.30,   g: 0.02,  p: 12   },
};

function generateStaticHistory(symbol: string): HistoryPayload {
  const d = STATIC_DIV_DATA[symbol];
  if (!d) return { history: [], annual: [], currentPrice: null };

  const isMonthly = d.m !== undefined;
  const currentAmt = (d.m ?? d.q) as number;
  const ppy = isMonthly ? 12 : 4; // payments per year
  const periods = 10 * ppy; // 10 years of history

  // Base date: April 2026
  const baseYear = 2026;
  const baseMonth = 3; // 0-indexed April

  const payments: { date: string; amount: number }[] = [];
  for (let i = periods - 1; i >= 0; i--) {
    // i periods ago
    const yearsAgo = i / ppy;
    const amt = +(currentAmt / Math.pow(1 + d.g, yearsAgo)).toFixed(4);
    if (amt <= 0) continue;

    const totalMonthsAgo = isMonthly ? i : i * 3;
    let month = baseMonth - totalMonthsAgo;
    let year = baseYear;
    while (month < 0) { month += 12; year -= 1; }
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    payments.push({ date: dateStr, amount: amt });
  }

  // Annual totals
  const annualMap: Record<string, number> = {};
  payments.forEach(({ date, amount }) => {
    const yr = date.slice(0, 4);
    annualMap[yr] = +((annualMap[yr] ?? 0) + amount).toFixed(4);
  });
  const annual = Object.entries(annualMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, total]) => ({ year, total }));

  return { history: payments, annual, currentPrice: d.p };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Format "2020-07" → "Jul 2020", pass through anything else unchanged. */
function fmtChartDate(label: string | undefined): string {
  if (!label) return "";
  const m = /^(\d{4})-(\d{2})$/.exec(label);
  if (!m) return label;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const mi = parseInt(m[2], 10) - 1;
  return `${months[mi] ?? m[2]} ${m[1]}`;
}

function ChartTooltip({ active, payload, label, prefix = "", suffix = "%" }: {
  active?: boolean;
  payload?: { value: number; color?: string; name?: string }[];
  label?: string;
  prefix?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[var(--app-card)] px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-zinc-200">{fmtChartDate(label)}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? "var(--accent-color)" }}>
          {p.name ? `${p.name}: ` : ""}{prefix}{typeof p.value === "number" ? (prefix === "$" ? p.value.toFixed(4) : p.value.toFixed(2)) : p.value}{suffix}
        </p>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-white/[0.07] bg-[var(--app-card)] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent-color)]/80">{label}</p>
      <p className={`text-xl font-bold ${valueColor ?? "text-zinc-100"}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

function SectionCard({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/[0.07] bg-[var(--app-card)] p-4 ${className ?? ""}`}>
      {title && <p className="mb-3 text-sm font-semibold text-zinc-100">{title}</p>}
      {children}
    </div>
  );
}

/** Clickable ticker chip — accent-colored badge so it's obviously interactive */
function TickerBtn({ symbol, onClick }: { symbol: string; onClick: (s: string) => void }) {
  return (
    <button
      onClick={() => onClick(symbol)}
      title="View dividend history"
      className="rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--accent-color)] bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 transition-colors hover:bg-[var(--accent-color)]/20 hover:border-[var(--accent-color)]/40 cursor-pointer"
    >
      {symbol}
    </button>
  );
}

// ---------------------------------------------------------------------------
// History Modal — Payments / Annual Total / Yield vs Price
// ---------------------------------------------------------------------------

function HistoryModal({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const [data, setData] = useState<HistoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ModalView>("payments");

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetch(`/api/dividends/history?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((d: HistoryPayload) => {
        const hasLive = d.history?.length > 0 || d.annual?.length > 0;
        // Show real data only — no fake generated history. If the API can't
        // return data (FMP endpoint not on this plan), the "no data" UI
        // shows honestly instead of misleading generated charts.
        setData(hasLive ? d : null);
        setLoading(false);
      })
      .catch(() => {
        setData(null);
        setLoading(false);
      });
  }, [symbol]);

  const hasData = !loading && data && (data.history.length > 0 || data.annual.length > 0);

  const lastAnnual = data?.annual?.[data.annual.length - 1];
  const latestPayment = data?.history?.[data.history.length - 1];
  const currentYieldPct = data?.currentPrice && lastAnnual
    ? ((lastAnnual.total / data.currentPrice) * 100).toFixed(2)
    : null;

  // Yield-over-time: annual total / current price (approximation)
  const yieldHistory = data?.annual && data.currentPrice
    ? data.annual.map((a) => ({
        year: a.year,
        yieldPct: +((a.total / (data.currentPrice as number)) * 100).toFixed(2),
      }))
    : [];

  const VIEWS: { id: ModalView; label: string }[] = [
    { id: "payments", label: "Payments" },
    { id: "annual",   label: "Annual Total" },
    { id: "yield",    label: "Yield vs Price" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[var(--app-card)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent-color)]/80">
              Dividend History
            </p>
            <p className="text-xl font-bold text-zinc-100">{symbol}</p>
            {data?.currentPrice && (
              <p className="text-xs text-zinc-400">
                Current price: <span className="font-medium text-zinc-200">${data.currentPrice.toFixed(2)}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-200"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats row */}
        {hasData && (
          <div className="mb-4 grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-white/[0.07] px-3 py-2 text-center">
              <p className="text-[10px] text-zinc-500">Latest Payment</p>
              <p className="mt-0.5 text-sm font-bold text-zinc-100">
                {latestPayment ? `$${latestPayment.amount}` : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.07] px-3 py-2 text-center">
              <p className="text-[10px] text-zinc-500">Annual (est.)</p>
              <p className="mt-0.5 text-sm font-bold text-zinc-100">
                {lastAnnual ? `$${lastAnnual.total.toFixed(2)}` : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.07] px-3 py-2 text-center">
              <p className="text-[10px] text-zinc-500">Current Yield</p>
              <p className="mt-0.5 text-sm font-bold text-[var(--accent-color)]">
                {currentYieldPct ? `${currentYieldPct}%` : "—"}
              </p>
            </div>
          </div>
        )}

        {/* View tabs */}
        {hasData && (
          <div className="mb-3 flex gap-0.5 rounded-lg border border-white/[0.07] bg-[var(--app-card-alt,var(--app-bg))] p-0.5 w-fit">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`rounded-md px-3 py-1 text-[11px] font-medium transition-all ${
                  view === v.id
                    ? "bg-[var(--accent-color)]/15 text-[var(--accent-color)]"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        {/* Chart */}
        {loading ? (
          <div className="flex h-48 items-center justify-center text-sm text-zinc-500">
            Loading history…
          </div>
        ) : !hasData ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2">
            <p className="text-sm text-zinc-400">Dividend history unavailable for {symbol}</p>
            <p className="max-w-xs text-center text-[11px] text-zinc-600">
              Detailed dividend history requires an FMP plan with historical-dividend access.
              The calendar tab shows scheduled payment dates based on known company patterns.
            </p>
          </div>
        ) : view === "payments" ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data!.history} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-color)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent-color)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" tickFormatter={fmtChartDate} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip content={<ChartTooltip prefix="$" suffix="" />} wrapperStyle={TOOLTIP_WRAPPER} />
              <Area type="monotone" dataKey="amount" name="Per share" stroke="var(--accent-color)" strokeWidth={2} fill="url(#histGrad)" dot={{ r: 2, fill: "var(--accent-color)", strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : view === "annual" ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data!.annual} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid {...CHART_GRID} vertical={false} />
              <XAxis dataKey="year" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip content={<ChartTooltip prefix="$" suffix="" />} wrapperStyle={TOOLTIP_WRAPPER} cursor={BAR_CURSOR} />
              <Bar dataKey="total" name="Annual dividends" fill="var(--accent-color)" radius={[4, 4, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <>
            {yieldHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={yieldHistory} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid {...CHART_GRID} />
                  <XAxis dataKey="year" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<ChartTooltip />} wrapperStyle={TOOLTIP_WRAPPER} />
                  <Line type="monotone" dataKey="yieldPct" name="Div yield" stroke="var(--accent-color)" strokeWidth={2} dot={{ r: 3, fill: "var(--accent-color)", strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-48 items-center justify-center text-xs text-zinc-500">
                Price data unavailable for yield calculation
              </div>
            )}
            {data?.currentPrice && (
              <p className="mt-1 text-[10px] text-zinc-600">
                Yield calculated as annual dividend / current price (${data.currentPrice.toFixed(2)}). Historical yield uses same price basis — actual historical yields differed.
              </p>
            )}
          </>
        )}

        <p className="mt-2 text-[10px] text-zinc-600">Per-share dividend data · Live via FMP · Click outside to close</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Calendar
// ---------------------------------------------------------------------------

function CalendarTab({ entries, onTicker }: { entries: CalendarEntry[]; onTicker: (s: string) => void }) {
  const upcoming = [...entries].sort((a, b) => a.daysAway - b.daysAway);
  const topFive = upcoming.slice(0, 8);

  // Build the monthly calendar from LIVE data only. The API returns ex-div
  // dates for the next ~180 days. We bucket by the ex-div month (the date
  // that matters for qualifying for the dividend). Months outside the
  // look-ahead window will be empty — that's honest and accurate.
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthlyPayments: Record<number, { symbol: string; amount: string }[]> = {};
  for (let m = 0; m < 12; m++) monthlyPayments[m] = [];
  const seenByMonth = new Map<string, Set<string>>();
  for (const e of entries) {
    try {
      const m = new Date(e.exDiv).getMonth();
      if (!seenByMonth.has(String(m))) seenByMonth.set(String(m), new Set());
      if (seenByMonth.get(String(m))!.has(e.symbol)) continue;
      seenByMonth.get(String(m))!.add(e.symbol);
      monthlyPayments[m].push({ symbol: e.symbol, amount: e.amount });
    } catch { /* skip invalid dates */ }
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Next Ex-Dividend Dates">
        {topFive.length === 0 ? (
          <div className="skeleton h-12 w-full rounded-lg" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {topFive.map((e) => (
              <button
                key={e.symbol + e.exDiv}
                onClick={() => onTicker(e.symbol)}
                className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-[var(--app-card)] px-3 py-2 transition-colors hover:border-[var(--accent-color)]/30 hover:bg-[var(--accent-color)]/5"
              >
                <span className="text-sm font-bold text-zinc-100">{e.symbol}</span>
                <span className="rounded-full bg-[var(--accent-color)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-color)]">{e.daysAway}d</span>
                <span className="text-xs text-zinc-400">{e.exDiv}</span>
                <span className="text-xs font-medium text-[var(--accent-color)]">{e.amount}</span>
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Upcoming Ex-Dividend Dates">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.07]">
                {["Symbol","Company","Ex-Div Date","Pay Date","Amount","Yield","Frequency"].map((h) => (
                  <th key={h} className="pb-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-color)]/80">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {upcoming.map((e) => (
                <tr
                  key={e.symbol}
                  onClick={() => onTicker(e.symbol)}
                  className="border-b border-white/[0.04] cursor-pointer transition-colors hover:bg-[var(--accent-color)]/5"
                >
                  <td className="py-2 pr-4 font-bold text-[var(--accent-color)]">{e.symbol}</td>
                  <td className="py-2 pr-4 text-zinc-300">{e.company}</td>
                  <td className="py-2 pr-4 text-zinc-300">{e.exDiv}</td>
                  <td className="py-2 pr-4 text-zinc-400">{e.payDate}</td>
                  <td className="py-2 pr-4 font-semibold text-[var(--accent-color)]">{e.amount}</td>
                  <td className="py-2 pr-4 text-zinc-300">{e.yield}</td>
                  <td className="py-2 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${e.freq === "Monthly" ? "bg-[var(--accent-color)]/15 text-[var(--accent-color)]" : "bg-white/[0.07] text-zinc-400"}`}>
                      {e.freq}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Upcoming Dividends by Month">
        <p className="mb-3 text-xs text-zinc-500">
          Ex-dividend dates for the next 6 months from live market data.
          Click any ticker to view its full dividend history and payout chart.
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {monthNames.map((month, idx) => {
            const payers = monthlyPayments[idx] ?? [];
            return (
              <div key={month} className="rounded-xl border border-white/[0.07] p-2.5 text-center">
                <p className="mb-1 text-xs font-semibold text-zinc-300">{month}</p>
                {payers.length > 0 ? (
                  <>
                    <span className="rounded-full bg-[var(--accent-color)]/20 px-1.5 py-0.5 text-[9px] font-semibold text-[var(--accent-color)]">
                      {payers.length} {payers.length === 1 ? "stock" : "stocks"}
                    </span>
                    <div className="mt-1.5 flex flex-wrap justify-center gap-0.5">
                      {payers.slice(0, 4).map((p) => (
                        <button
                          key={p.symbol}
                          onClick={() => onTicker(p.symbol)}
                          className="text-[9px] font-semibold text-[var(--accent-color)] hover:underline"
                          title={`${p.symbol} ${p.amount}`}
                        >
                          {p.symbol}
                        </button>
                      ))}
                      {payers.length > 4 && (
                        <span className="text-[9px] text-zinc-600">+{payers.length - 4}</span>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-[9px] text-zinc-600">—</p>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Aristocrats & Kings
// ---------------------------------------------------------------------------

function AristocratsTab({ onTicker }: { onTicker: (s: string) => void }) {
  const [subTab, setSubTab] = useState<"kings" | "aristocrats">("kings");
  const data = subTab === "kings" ? KINGS : PURE_ARISTOCRATS;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">KING</span>
            <p className="text-xs font-semibold text-zinc-200">Dividend King</p>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-400">
            A company with <span className="font-semibold text-zinc-200">50+ consecutive years</span> of dividend increases. The most elite tier in income investing — fewer than 50 U.S. companies qualify, having raised dividends through recessions, wars, and crises.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--accent-color)]/20 bg-[var(--accent-color)]/5 p-4">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="rounded-full bg-[var(--accent-color)]/20 px-2 py-0.5 text-[10px] font-bold text-[var(--accent-color)]">ARISTOCRAT</span>
            <p className="text-xs font-semibold text-zinc-200">Dividend Aristocrat</p>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-400">
            An S&P 500 company with <span className="font-semibold text-zinc-200">25–49 consecutive years</span> of increases, plus size and liquidity requirements. These are future Kings in training — businesses with durable competitive moats.
          </p>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl border border-white/[0.07] bg-[var(--app-card)] p-1 w-fit">
        {(["kings","aristocrats"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-all ${
              subTab === t
                ? "bg-[var(--accent-color)]/15 text-[var(--accent-color)] border-b-2 border-[var(--accent-color)]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t === "kings" ? `Kings (50+ yrs) — ${KINGS.length}` : `Aristocrats (25–49 yrs) — ${PURE_ARISTOCRATS.length}`}
          </button>
        ))}
      </div>

      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.07]">
                {["Symbol","Company","Sector","Consec. Years","Yield","5yr DGR","Last Increase"].map((h) => (
                  <th key={h} className="pb-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-color)]/80">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr
                  key={row.symbol}
                  onClick={() => onTicker(row.symbol)}
                  className="border-b border-white/[0.04] cursor-pointer transition-colors hover:bg-[var(--accent-color)]/5"
                >
                  <td className="py-2 pr-4 font-bold text-[var(--accent-color)]">{row.symbol}</td>
                  <td className="py-2 pr-4 text-zinc-300">{row.company}</td>
                  <td className="py-2 pr-4 text-zinc-400">{row.sector}</td>
                  <td className="py-2 pr-4 font-semibold text-[var(--accent-color)]">{row.years} yrs</td>
                  <td className="py-2 pr-4 text-zinc-300">{row.yield}</td>
                  <td className="py-2 pr-4 text-zinc-300">{row.dgr5}</td>
                  <td className="py-2 pr-4 font-semibold text-green-400">{row.lastIncrease}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[10px] text-zinc-500">Click any ticker to view dividend history. DGR = Dividend Growth Rate (5yr annualised).</p>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Income Tools
// ---------------------------------------------------------------------------

function DripCalculator() {
  const [initial, setInitial] = useState(10000);
  const [divYield, setDivYield] = useState(3.0);
  const [dgr, setDgr] = useState(5.0);
  const [years, setYears] = useState(20);
  const [sharePrice, setSharePrice] = useState(100);

  type DripRow = { year: number; shares: string; annualDiv: string; portfolioValue: string };
  const rows: DripRow[] = [];
  let shares = initial / sharePrice;
  let annualDivPerShare = sharePrice * (divYield / 100);
  let currentPrice = sharePrice;

  for (let y = 1; y <= years; y++) {
    // Dividend received this year (before growth is applied for next year)
    const annualDiv = shares * annualDivPerShare;
    // Reinvest dividends at the current share price → more shares
    shares += annualDiv / currentPrice;
    // Grow the dividend-per-share for next year
    annualDivPerShare *= 1 + dgr / 100;
    // Assume ~6% annual share price appreciation
    currentPrice *= 1.06;
    if (y === 1 || y % 2 === 0 || y === years) {
      rows.push({
        year: y,
        shares: shares.toFixed(2),
        // Show this year's actual dividend total (not the post-growth amount)
        annualDiv: `$${annualDiv.toFixed(0)}`,
        portfolioValue: `$${(shares * currentPrice).toFixed(0)}`,
      });
    }
  }

  return (
    <SectionCard title="DRIP Calculator">
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Initial Investment ($)", value: initial, setter: setInitial, step: 1000, min: 100, max: 10_000_000 },
          { label: "Dividend Yield (%)", value: divYield, setter: setDivYield, step: 0.1, min: 0.1, max: 50 },
          { label: "Annual Div Growth (%)", value: dgr, setter: setDgr, step: 0.5, min: 0, max: 30 },
          { label: "Years", value: years, setter: setYears, step: 1, min: 1, max: 50 },
          { label: "Share Price ($)", value: sharePrice, setter: setSharePrice, step: 1, min: 1, max: 10_000 },
        ].map(({ label, value, setter, step, min, max }) => (
          <div key={label} className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent-color)]/80">{label}</label>
            <input type="number" value={value || ""} step={step} min={min} max={max}
              onChange={(e) => setter(clampedNum(e.target.value, max))} className={INPUT_CLS} />
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.07]">
              {["Year","Total Shares","Annual Dividend","Portfolio Value"].map((h) => (
                <th key={h} className="pb-2 pr-6 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-color)]/80">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.year} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                <td className="py-2 pr-6 font-semibold text-zinc-300">Year {r.year}</td>
                <td className="py-2 pr-6 text-zinc-300">{r.shares}</td>
                <td className="py-2 pr-6 font-semibold text-[var(--accent-color)]">{r.annualDiv}</td>
                <td className="py-2 pr-6 font-bold text-zinc-100">{r.portfolioValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/** Strip leading zeros and clamp to [0, max]. */
function clampedNum(raw: string, max: number): number {
  const n = Number(raw.replace(/^0+(?=\d)/, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

function IncomeEstimator() {
  const [shares, setShares] = useState(100);
  const [pricePerShare, setPricePerShare] = useState(100);
  const [yieldPct, setYieldPct] = useState(3.7);

  // Cap: max 1M shares × $10K price × 100% yield = $1B max — anything more
  // is unrealistic and shows as trillions.
  const annual = Math.min(shares * pricePerShare * (yieldPct / 100), 1_000_000_000);
  const fmtIncome = (v: number) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : `$${v.toFixed(2)}`;
  return (
    <SectionCard title="Income Estimator">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent-color)]/80">Shares Owned</label>
          <input type="number" value={shares || ""} min={1} max={1000000}
            onChange={(e) => setShares(clampedNum(e.target.value, 1_000_000))} className={INPUT_CLS} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent-color)]/80">Price / Share ($)</label>
          <input type="number" value={pricePerShare || ""} min={0.01} max={10000} step={0.01}
            onChange={(e) => setPricePerShare(clampedNum(e.target.value, 10_000))} className={INPUT_CLS} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent-color)]/80">Dividend Yield (%)</label>
          <input type="number" value={yieldPct || ""} step={0.1} min={0.1} max={100}
            onChange={(e) => setYieldPct(clampedNum(e.target.value, 100))} className={INPUT_CLS} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[["Annual Income", fmtIncome(annual)], ["Quarterly Income", fmtIncome(annual / 4)], ["Monthly Equivalent", fmtIncome(annual / 12)]].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-white/[0.07] p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent-color)]/80">{l}</p>
            <p className="mt-1 text-xl font-bold text-zinc-100">{v}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function YieldOnCostTracker() {
  const [purchasePrice, setPurchasePrice] = useState(50);
  const [currentDiv, setCurrentDiv] = useState(1.0);
  const [currentPrice, setCurrentPrice] = useState(225);

  const yoc = ((currentDiv / purchasePrice) * 100).toFixed(2);
  const curYield = ((currentDiv / currentPrice) * 100).toFixed(2);
  const advantage = (Number(yoc) / Number(curYield)).toFixed(1);

  return (
    <SectionCard title="Yield on Cost Tracker">
      <p className="mb-3 text-xs text-zinc-400">
        Yield on Cost (YoC) measures your real yield based on your original purchase price — a key metric for long-term dividend investors.
      </p>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Purchase Price ($)", value: purchasePrice, setter: setPurchasePrice, max: 10_000 },
          { label: "Annual Div / Share ($)", value: currentDiv, setter: setCurrentDiv, max: 500 },
          { label: "Current Share Price ($)", value: currentPrice, setter: setCurrentPrice, max: 10_000 },
        ].map(({ label, value, setter, max }) => (
          <div key={label} className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent-color)]/80">{label}</label>
            <input type="number" value={value || ""} step={0.01} min={0.01} max={max}
              onChange={(e) => setter(clampedNum(e.target.value, max))} className={INPUT_CLS} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/[0.07] p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent-color)]/80">Yield on Cost</p>
          <p className="mt-1 text-2xl font-bold text-[var(--accent-color)]">{yoc}%</p>
          <p className="mt-0.5 text-[10px] text-zinc-500">Based on ${purchasePrice} cost</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent-color)]/80">Current Yield</p>
          <p className="mt-1 text-2xl font-bold text-zinc-300">{curYield}%</p>
          <p className="mt-0.5 text-[10px] text-zinc-500">Based on ${currentPrice} price</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent-color)]/80">YoC Advantage</p>
          <p className="mt-1 text-2xl font-bold text-green-400">{advantage}×</p>
          <p className="mt-0.5 text-[10px] text-zinc-500">YoC vs current yield</p>
        </div>
      </div>
    </SectionCard>
  );
}

function IncomeToolsTab() {
  return (
    <>
      <style>{`
        .income-input::-webkit-outer-spin-button,
        .income-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .income-input { -moz-appearance: textfield; }
      `}</style>
      <div className="space-y-4">
        <DripCalculator />
        <IncomeEstimator />
        <YieldOnCostTracker />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tab: ETF Comparison
// ---------------------------------------------------------------------------

type LiveEtf = { symbol: string; price: number | null; yield: number | null; aum: number | null };

function EtfComparisonTab({ onTicker, liveEtf }: { onTicker: (s: string) => void; liveEtf: LiveEtf[] }) {
  // Merge static data with live overrides
  const merged = ETF_DATA.map((e) => {
    const live = liveEtf.find((l) => l.symbol === e.etf);
    return {
      ...e,
      yield: live?.yield != null ? `${live.yield.toFixed(1)}%` : e.yield,
      aum: live?.aum != null ? `$${live.aum}B` : e.aum,
      livePrice: live?.price,
    };
  });

  const yieldData = merged.map((e) => ({ etf: e.etf, yield: parseFloat(e.yield) }));
  const ret1yrData = merged.map((e) => ({ etf: e.etf, return: parseFloat(e.ret1yr) }));
  const maxYield = Math.max(...yieldData.map((d) => d.yield));
  const minExpense = Math.min(...merged.map((e) => parseFloat(e.expense)));
  const maxAumEtf = merged.reduce((b, e) => parseFloat(e.aum) > parseFloat(b.aum) ? e : b).etf;
  const maxRetEtf = merged.reduce((b, e) => parseFloat(e.ret1yr) > parseFloat(b.ret1yr) ? e : b).etf;
  const hasLive = liveEtf.length > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/[0.07] bg-[var(--app-card)] p-4">
        <p className="mb-2 text-sm font-semibold text-zinc-100">Why Dividend ETFs?</p>
        <p className="text-[12px] leading-relaxed text-zinc-400">
          Dividend ETFs provide instant diversification across dozens of income-paying stocks in one trade. They eliminate single-stock cut risk and rebalance automatically.
          High-yield ETFs like <span className="font-medium text-zinc-300">JEPI/JEPQ</span> use covered call strategies to boost income, while growth-focused ETFs like <span className="font-medium text-zinc-300">VIG/SCHD</span> prioritise total return.
          A 0.30% expense difference on $100K compounds to ~$3,000 in savings over 10 years.
        </p>
      </div>

      <SectionCard title="Dividend ETF Comparison">
        {hasLive && (
          <div className="mb-2 flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-green-400 font-medium">Live yields &amp; AUM via FMP</span>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.07]">
                {["ETF","Name","Yield","Expense","AUM","1yr Return","3yr Return","Strategy","Holdings"].map((h) => (
                  <th key={h} className="pb-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-color)]/80 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {merged.map((e) => {
                const isMaxYield = parseFloat(e.yield) === maxYield;
                const isMinExpense = parseFloat(e.expense) === minExpense;
                const isMaxAum = e.etf === maxAumEtf;
                const isMaxRet = e.etf === maxRetEtf;
                return (
                  <tr
                    key={e.etf}
                    onClick={() => onTicker(e.etf)}
                    className="border-b border-white/[0.04] cursor-pointer transition-colors hover:bg-[var(--accent-color)]/5"
                  >
                    <td className="py-2 pr-3 font-bold text-[var(--accent-color)]">{e.etf}</td>
                    <td className="py-2 pr-3 max-w-[160px] truncate text-zinc-300">{e.name}</td>
                    <td className={`py-2 pr-3 font-semibold ${isMaxYield ? "text-[var(--accent-color)]" : "text-zinc-300"}`}>{e.yield}{isMaxYield && <span className="ml-1 text-[9px]">★</span>}</td>
                    <td className={`py-2 pr-3 ${isMinExpense ? "font-semibold text-green-400" : "text-zinc-400"}`}>{e.expense}{isMinExpense && <span className="ml-1 text-[9px]">★</span>}</td>
                    <td className={`py-2 pr-3 ${isMaxAum ? "font-semibold text-blue-400" : "text-zinc-400"}`}>{e.aum}{isMaxAum && <span className="ml-1 text-[9px]">★</span>}</td>
                    <td className={`py-2 pr-3 font-semibold ${isMaxRet ? "text-green-400" : "text-zinc-300"}`}>{e.ret1yr}{isMaxRet && <span className="ml-1 text-[9px]">★</span>}</td>
                    <td className="py-2 pr-3 text-zinc-400">{e.ret3yr}</td>
                    <td className="py-2 pr-3 max-w-[140px] truncate text-zinc-500">{e.strategy}</td>
                    <td className="py-2 pr-3 text-zinc-400">{e.holdings}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10px] text-zinc-500">★ Best-in-class · Click any ticker to view distribution history</p>
      </SectionCard>

      <SectionCard title="Historical Total Return (Indexed, 2019 = 100)">
        <p className="mb-3 text-[11px] text-zinc-500">
          Total return including dividends reinvested. Growth ETFs (VIG) have outperformed pure high-yield funds, showing dividend growth often matters more than headline yield.
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={ETF_PERF_HISTORY} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
            <CartesianGrid {...CHART_GRID} />
            <XAxis dataKey="year" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} domain={[90, 200]} />
            <Tooltip content={<ChartTooltip suffix="" />} wrapperStyle={TOOLTIP_WRAPPER} />
            <Line type="monotone" dataKey="SCHD"  name="SCHD"  stroke="var(--accent-color)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="VIG"   name="VIG"   stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="VYM"   name="VYM"   stroke="#22c55e" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="NOBL"  name="NOBL"  stroke="#a78bfa" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-400">
          {[["SCHD","var(--accent-color)"],["VIG","#3b82f6"],["VYM","#22c55e"],["NOBL","#a78bfa"]].map(([l,c]) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-4 rounded" style={{ background: c }} />{l}
            </span>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard title="ETF Yield Comparison">
          <p className="mb-3 text-xs text-zinc-500">
            Current annual dividend yield for popular income ETFs. Higher yield means more income per dollar invested,
            but may come with higher risk or lower growth. Bars color-coded: accent = high yield (7%+),
            blue = moderate (3.5–7%), grey = lower.
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={yieldData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid {...CHART_GRID} vertical={false} />
              <XAxis dataKey="etf" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<ChartTooltip />} wrapperStyle={TOOLTIP_WRAPPER} cursor={BAR_CURSOR} />
              <Bar dataKey="yield" name="Yield" radius={[4, 4, 0, 0]}>
                {yieldData.map((entry, i) => (
                  <Cell key={i} fill={entry.yield >= 7 ? "var(--accent-color)" : entry.yield >= 3.5 ? "#3b82f6" : "#52525b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
        <SectionCard title="ETF 1-Year Returns">
          <p className="mb-3 text-xs text-zinc-500">
            Total return (price appreciation + dividends reinvested) over the trailing 12 months.
            Shows how each ETF performed as a whole investment, not just income. Green = strong (13%+),
            blue = solid (10–13%), grey = modest. Returns are historical estimates and may differ from live values.
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ret1yrData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid {...CHART_GRID} vertical={false} />
              <XAxis dataKey="etf" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<ChartTooltip />} wrapperStyle={TOOLTIP_WRAPPER} cursor={BAR_CURSOR} />
              <Bar dataKey="return" name="1yr Return" radius={[4, 4, 0, 0]}>
                {ret1yrData.map((entry, i) => (
                  <Cell key={i} fill={entry.return >= 13 ? "#22c55e" : entry.return >= 10 ? "#3b82f6" : "#52525b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Special & Cuts
// ---------------------------------------------------------------------------

type LiveCut = { symbol: string; before: string; after: string; changePct: number; date: string; suspended: boolean };

function SpecialAndCutsTab({ onTicker, liveCuts }: { onTicker: (s: string) => void; liveCuts: LiveCut[] }) {
  // Merge: live cuts take precedence, then append static cuts not already in live list
  const staticCutSymbols = new Set(liveCuts.map((c) => c.symbol));
  const mergedCuts = [
    ...liveCuts.map((c) => ({
      symbol: c.symbol,
      company: c.symbol, // no company name from API
      before: c.before,
      after: c.after,
      changePct: c.changePct,
      date: c.date,
      reason: c.suspended ? "Dividend suspended" : "Cut detected live",
      live: true,
    })),
    ...DIVIDEND_CUTS
      .filter((d) => !staticCutSymbols.has(d.symbol))
      .map((d) => ({ ...d, live: false })),
  ];
  return (
    <div className="space-y-4">
      <SectionCard title="Recent Special Dividends">
        <p className="mb-3 text-[11px] text-zinc-500">
          Special dividends are one-time cash payments separate from a company&apos;s regular schedule. They signal excess cash, asset sales, or strong earnings — but should not be expected to repeat.
        </p>
        <p className="mb-3 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-[10px] text-amber-400">
          This list is periodically updated. Some recent specials may not appear yet.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.07]">
                {["Symbol","Amount / Share","Announced","Payment","Why it happened"].map((h) => (
                  <th key={h} className="pb-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-color)]/80">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SPECIAL_DIVIDENDS.map((d) => (
                <tr
                  key={d.symbol + d.announced}
                  onClick={() => onTicker(d.symbol)}
                  className="border-b border-white/[0.04] cursor-pointer transition-colors hover:bg-[var(--accent-color)]/5"
                >
                  <td className="py-2.5 pr-4">
                    <p className="font-bold text-[var(--accent-color)]">{d.symbol}</p>
                    <p className="text-[10px] text-zinc-500">{d.company}</p>
                  </td>
                  <td className="py-2.5 pr-4 font-bold text-green-400">{d.amount}</td>
                  <td className="py-2.5 pr-4 text-zinc-400">{d.announced}</td>
                  <td className="py-2.5 pr-4 text-zinc-400">{d.payment}</td>
                  <td className="py-2.5 pr-4 max-w-[260px] text-zinc-400">{d.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Dividend Cuts & Suspensions">
        <div className="mb-3 flex items-start justify-between gap-4">
          <p className="text-[11px] text-zinc-500">
            Dividend cuts are a major risk signal. They often precede further financial stress and can cause significant price drops — monitoring them helps avoid yield traps.
            Live detection monitors a watchlist of commonly-held names and auto-detects when recent payouts drop &gt;10% vs prior average. Data refreshes daily.
          </p>
          {liveCuts.length > 0 && (
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] text-green-400 font-medium whitespace-nowrap">Live detection</span>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.07]">
                {["Symbol","Company","Before","After","Change","Date","Reason"].map((h) => (
                  <th key={h} className="pb-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-color)]/80">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mergedCuts.map((d) => {
                const isSuspend = d.changePct === -100;
                const isFlat = d.changePct === 0;
                return (
                  <tr
                    key={d.symbol + d.date}
                    onClick={() => onTicker(d.symbol)}
                    className="border-b border-white/[0.04] cursor-pointer transition-colors hover:bg-[var(--accent-color)]/5"
                  >
                    <td className="py-2 pr-4">
                      <span className="font-bold text-[var(--accent-color)]">{d.symbol}</span>
                      {"live" in d && d.live && (
                        <span className="ml-1.5 rounded-full bg-green-500/15 px-1.5 py-0.5 text-[9px] font-bold text-green-400">LIVE</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-zinc-300">{d.company}</td>
                    <td className="py-2 pr-4 text-zinc-400">{d.before}</td>
                    <td className="py-2 pr-4 text-zinc-400">{d.after}</td>
                    <td className="py-2 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isSuspend ? "border border-red-500/30 bg-red-500/20 text-red-400"
                        : isFlat ? "border border-zinc-500/30 bg-zinc-500/20 text-zinc-400"
                        : "border border-red-400/20 bg-red-400/15 text-red-300"
                      }`}>
                        {isFlat ? "0%" : `${d.changePct}%`}{isSuspend && " SUSPENDED"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-zinc-400">{d.date}</td>
                    <td className="py-2 pr-4 text-zinc-500">{d.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Overview
// ---------------------------------------------------------------------------

function OverviewTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="S&P 500 Div Yield" value="1.42%" sub="TTM, blended" />
        <StatCard label="10Y Treasury Yield" value="4.31%" sub="Current" />
        <StatCard label="Yield Spread" value="-2.89%" sub="Div yield minus 10Y" valueColor="text-red-400" />
        <StatCard label="S&P 500 Payers" value="83%" sub="Companies paying div" valueColor="text-[var(--accent-color)]" />
      </div>

      <SectionCard title="S&P 500 Dividend Yield History (2015–2025)">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={SP500_YIELD_HISTORY} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="yieldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent-color)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--accent-color)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...CHART_GRID} />
            <XAxis dataKey="year" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} domain={[0.8, 2.5]} />
            <Tooltip content={<ChartTooltip />} wrapperStyle={TOOLTIP_WRAPPER} />
            <Area type="monotone" dataKey="yield" stroke="var(--accent-color)" strokeWidth={2} fill="url(#yieldGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </SectionCard>

      <SectionCard title="S&P 500 Dividend Yield vs 10Y Treasury">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={YIELD_VS_TREASURY} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid {...CHART_GRID} />
            <XAxis dataKey="year" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<ChartTooltip />} wrapperStyle={TOOLTIP_WRAPPER} />
            <Line type="monotone" dataKey="treasury" name="10Y Treasury" stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="sp500" name="S&P Div Yield" stroke="var(--accent-color)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-2 flex gap-4 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded" style={{ background: "var(--accent-color)" }} />S&P Div Yield</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded bg-blue-500" />10Y Treasury</span>
        </div>
      </SectionCard>

      <SectionCard title="Sector Dividend Yields">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={SECTOR_YIELDS} layout="vertical" margin={{ top: 0, right: 32, left: 10, bottom: 0 }}>
            <CartesianGrid {...CHART_GRID} horizontal={false} />
            <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="sector" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
            <Tooltip content={<ChartTooltip />} wrapperStyle={TOOLTIP_WRAPPER} cursor={BAR_CURSOR} />
            <Bar dataKey="yield" name="Yield" radius={[0, 4, 4, 0]}>
              {SECTOR_YIELDS.map((entry, i) => (
                <Cell key={i} fill={entry.yield >= 3.5 ? "var(--accent-color)" : entry.yield >= 2.0 ? "#3b82f6" : "#52525b"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const TABS: { id: Tab; label: string }[] = [
  { id: "calendar",    label: "Calendar" },
  { id: "aristocrats", label: "Aristocrats & Kings" },
  { id: "income",      label: "Income Tools" },
  { id: "etf",         label: "ETF Comparison" },
  { id: "special",     label: "Special & Cuts" },
  { id: "overview",    label: "Overview" },
];

export default function DividendsView() {
  const [activeTab, setActiveTab] = useState<Tab>("calendar");
  const [calendarData, setCalendarData] = useState<CalendarEntry[]>([]);
  const [modalSymbol, setModalSymbol] = useState<string | null>(null);
  const [liveEtf, setLiveEtf] = useState<LiveEtf[]>([]);
  const [liveCuts, setLiveCuts] = useState<LiveCut[]>([]);

  useEffect(() => {
    fetch("/api/dividends/calendar")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.entries) && d.entries.length > 0) setCalendarData(d.entries); })
      .catch(() => {});

    fetch("/api/dividends/etf")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.etfs) && d.etfs.length > 0) setLiveEtf(d.etfs); })
      .catch(() => {});

    fetch("/api/dividends/cuts")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.cuts)) setLiveCuts(d.cuts); })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      {modalSymbol && <HistoryModal symbol={modalSymbol} onClose={() => setModalSymbol(null)} />}

      {/* Tab bar */}
      <div className="flex gap-0.5 overflow-x-auto rounded-xl border border-white/[0.07] bg-[var(--app-card)] p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === tab.id
                ? "bg-[var(--accent-color)]/15 text-[var(--accent-color)] border-b-2 border-[var(--accent-color)]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "calendar"    && <CalendarTab entries={calendarData} onTicker={setModalSymbol} />}
      {activeTab === "aristocrats" && <AristocratsTab onTicker={setModalSymbol} />}
      {activeTab === "income"      && <IncomeToolsTab />}
      {activeTab === "etf"         && <EtfComparisonTab onTicker={setModalSymbol} liveEtf={liveEtf} />}
      {activeTab === "special"     && <SpecialAndCutsTab onTicker={setModalSymbol} liveCuts={liveCuts} />}
      {activeTab === "overview"    && <OverviewTab />}
    </div>
  );
}
