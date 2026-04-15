"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { UnavailablePlaceholder } from "./UnavailablePlaceholder";

// Recharts loaded client-side only
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const ReferenceLine = dynamic(() => import("recharts").then((m) => m.ReferenceLine), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

type DetailData = {
  profile?: {
    name?: string;
    country?: string;
    currency?: string;
    exchange?: string;
    ipo?: string;
    marketCapitalization?: number;
    shareOutstanding?: number;
    weburl?: string;
    logo?: string;
    finnhubIndustry?: string;
    employeeTotal?: number;
  } | null;
  metrics?: {
    metric?: Record<string, number | string | null>;
  } | null;
  earnings?: Array<{
    actual?: number | null;
    estimate?: number | null;
    period?: string;
    surprise?: number | null;
    surprisePercent?: number | null;
  }> | null;
  dividends?: Array<{
    amount?: number;
    date?: string;
    payDate?: string;
    declarationDate?: string;
    freq?: string;
  }> | null;
  nextEarningsDate?: string | null;
  cryptoData?: {
    name?: string;
    symbol?: string;
    description?: { en?: string };
    image?: { large?: string };
    genesis_date?: string | null;
    hashing_algorithm?: string | null;
    categories?: string[];
    links?: { homepage?: string[]; blockchain_site?: string[] };
    market_data?: {
      current_price?: { usd?: number };
      market_cap?: { usd?: number };
      total_volume?: { usd?: number };
      circulating_supply?: number | null;
      total_supply?: number | null;
      max_supply?: number | null;
      ath?: { usd?: number };
      atl?: { usd?: number };
      price_change_percentage_24h?: number | null;
      price_change_percentage_7d?: number | null;
      price_change_percentage_30d?: number | null;
    };
  } | null;
};

type TechnicalsData = {
  price?: number;
  rsi?: number | null;
  macd?: { macd: number | null; signal: number | null; histogram: number | null } | null;
  stoch?: { k: number | null; d: number | null } | null;
  cci?: number | null;
  sma10?: number | null; sma20?: number | null; sma50?: number | null; sma200?: number | null;
  ema10?: number | null; ema20?: number | null; ema50?: number | null; ema200?: number | null;
  bollingerBands?: { upper: number | null; middle: number | null; lower: number | null } | null;
  sharpe?: number | null;
  sortino?: number | null;
  maxDrawdown?: number | null;
  var95?: number | null;
  supports?: number[];
  resistances?: number[];
  pivotPoints?: { p: number; r1: number; r2: number; s1: number; s2: number } | null;
  correlationSPY?: number | null;
  correlationQQQ?: number | null;
  beta?: number | null;
  expectedMove?: number | null;
  gaugeScore?: number;
  gaugeLabel?: string;
};

type InsiderTx = {
  name: string;
  type: "Purchase" | "Sale";
  shares: number;
  price: number;
  value: number;
  date: string;
};

type NewsItem = {
  headline: string;
  summary?: string;
  url: string;
  datetime: number;
  source?: string;
  sentiment?: string;
};

type Post = { id: string; content: string; created_at: string; user_id: string };

type OptionsItem = { label: string; reason: string; provider?: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 2, prefix = ""): string {
  if (n == null || isNaN(n)) return "—";
  return prefix + n.toFixed(decimals);
}

function fmtLarge(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(0)}`;
}

function fmtShares(n: number | null | undefined): string {
  if (n == null) return "—";
  // Finnhub returns shares in millions
  if (n >= 1000) return `${(n / 1000).toFixed(2)}B`;
  return `${n.toFixed(2)}M`;
}

function signalBadge(signal: "Buy" | "Sell" | "Neutral" | "Strong Buy" | "Strong Sell" | string) {
  const s = signal.toLowerCase();
  if (s.includes("strong buy")) return { color: "#22c55e", bg: "rgba(34,197,94,0.15)", label: signal };
  if (s.includes("buy")) return { color: "#4ade80", bg: "rgba(74,222,128,0.12)", label: signal };
  if (s.includes("strong sell")) return { color: "#ef4444", bg: "rgba(239,68,68,0.15)", label: signal };
  if (s.includes("sell")) return { color: "#f87171", bg: "rgba(248,113,113,0.12)", label: signal };
  return { color: "#a1a1aa", bg: "rgba(161,161,170,0.1)", label: signal };
}

function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 animate-pulse rounded bg-white/10" style={{ width: `${60 + (i * 13) % 40}%` }} />
      ))}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-xs font-medium text-zinc-200 text-right">{value}</span>
    </div>
  );
}

// ─── Gauge SVG ────────────────────────────────────────────────────────────────

function GaugeSVG({ score }: { score: number }) {
  // score: -8 to +8, needle goes from 180° (far left) to 0° (far right)
  const norm = (score + 8) / 16; // 0 to 1
  const angle = 180 - norm * 180; // 180 (left) to 0 (right)
  const rad = (angle * Math.PI) / 180;
  const cx = 80, cy = 70, r = 55;
  const nx = cx + r * Math.cos(rad);
  const ny = cy - r * Math.sin(rad);

  const zones = [
    { from: 0, to: 36, color: "#ef4444", label: "Strong Sell" },
    { from: 36, to: 72, color: "#f97316", label: "Sell" },
    { from: 72, to: 108, color: "#a1a1aa", label: "Neutral" },
    { from: 108, to: 144, color: "#4ade80", label: "Buy" },
    { from: 144, to: 180, color: "#22c55e", label: "Strong Buy" },
  ];

  function arcPath(startDeg: number, endDeg: number, radius: number) {
    const s = ((180 - startDeg) * Math.PI) / 180;
    const e = ((180 - endDeg) * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(s);
    const y1 = cy - radius * Math.sin(s);
    const x2 = cx + radius * Math.cos(e);
    const y2 = cy - radius * Math.sin(e);
    const large = endDeg - startDeg > 90 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 0 ${x2} ${y2}`;
  }

  const label = score >= 5 ? "Strong Buy" : score >= 2 ? "Buy" : score >= -1 ? "Neutral" : score >= -4 ? "Sell" : "Strong Sell";
  const labelColor = score >= 2 ? "#22c55e" : score >= -1 ? "#a1a1aa" : "#ef4444";

  return (
    <div className="flex flex-col items-center">
      <svg width="160" height="90" viewBox="0 0 160 90">
        {zones.map((z) => (
          <path
            key={z.label}
            d={arcPath(z.from, z.to, 55)}
            fill="none"
            stroke={z.color}
            strokeWidth="10"
            strokeOpacity="0.35"
          />
        ))}
        {/* Active zone highlight */}
        {zones.map((z) => {
          const mid = (z.from + z.to) / 2;
          const active = norm * 180 >= z.from && norm * 180 < z.to;
          return active ? (
            <path
              key={z.label + "-active"}
              d={arcPath(z.from, z.to, 55)}
              fill="none"
              stroke={z.color}
              strokeWidth="10"
              strokeOpacity="0.9"
            />
          ) : null;
        })}
        {/* Needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="white" strokeWidth="2" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="4" fill="white" />
        {/* Zone labels */}
        <text x="8" y="80" fontSize="7" fill="#ef4444" opacity="0.7">Strong{"\n"}Sell</text>
        <text x="125" y="80" fontSize="7" fill="#22c55e" opacity="0.7">Strong{"\n"}Buy</text>
      </svg>
      <p className="text-base font-bold mt-1" style={{ color: labelColor }}>{label}</p>
      <p className="text-xs text-zinc-500">Score: {score > 0 ? "+" : ""}{score}</p>
    </div>
  );
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

const chartStyle = {
  backgroundColor: "rgba(15,21,32,0.95)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "8px",
  fontSize: "11px",
  color: "#e4e4e7",
};

const tooltipCursor = { fill: "rgba(255,255,255,0.04)" };

// ─── Section: Company Overview ────────────────────────────────────────────────

function CompanyOverviewSection({ detail, ticker }: { detail: DetailData; ticker: string }) {
  const p = detail.profile;
  const m = detail.metrics?.metric;

  const marketCap = p?.marketCapitalization ? p.marketCapitalization * 1e6 : null;
  const shares = p?.shareOutstanding ? p.shareOutstanding * 1e6 : null;
  const employees = p?.employeeTotal;
  const revenue = m?.["revenueTTM"] as number | null | undefined;
  const netIncome = m?.["netIncomeTTM"] as number | null | undefined;

  const rows = [
    { label: "Exchange", value: p?.exchange ?? "—" },
    { label: "Country", value: p?.country ?? "—" },
    { label: "Industry", value: p?.finnhubIndustry ?? "—" },
    { label: "IPO Date", value: p?.ipo ?? "—" },
    { label: "Market Cap", value: fmtLarge(marketCap) },
    { label: "Shares Outstanding", value: fmtShares(p?.shareOutstanding) },
    { label: "Employees (FY)", value: employees ? employees.toLocaleString() : "—" },
    {
      label: "Revenue / Employee",
      value: revenue && employees ? fmtLarge((revenue as number) / employees) : "—",
    },
    {
      label: "Net Income / Employee",
      value: netIncome && employees ? fmtLarge((netIncome as number) / employees) : "—",
    },
    { label: "CEO", value: <span className="text-zinc-400">Not in free API tier</span> },
    { label: "Website", value: p?.weburl ? <a href={p.weburl} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-color)] hover:underline truncate max-w-[160px] inline-block">{p.weburl.replace(/^https?:\/\//, "")}</a> : "—" },
    { label: "52W High", value: m?.["52WeekHigh"] ? `$${(m["52WeekHigh"] as number).toFixed(2)}` : "—" },
    { label: "52W Low", value: m?.["52WeekLow"] ? `$${(m["52WeekLow"] as number).toFixed(2)}` : "—" },
    { label: "P/E (TTM)", value: m?.["peBasicExclExtraTTM"] ? (m["peBasicExclExtraTTM"] as number).toFixed(2) : "—" },
    { label: "P/B", value: m?.["pbAnnual"] ? (m["pbAnnual"] as number).toFixed(2) : "—" },
    { label: "P/S", value: m?.["psAnnual"] ? (m["psAnnual"] as number).toFixed(2) : "—" },
    { label: "Dividend Yield", value: m?.["dividendYieldIndicatedAnnual"] ? `${(m["dividendYieldIndicatedAnnual"] as number).toFixed(2)}%` : "—" },
    { label: "EPS (TTM)", value: m?.["epsBasicExclExtraItemsTTM"] ? `$${(m["epsBasicExclExtraItemsTTM"] as number).toFixed(2)}` : "—" },
    { label: "Revenue Growth (YoY)", value: m?.["revenueGrowthQuarterlyYoy"] ? `${(m["revenueGrowthQuarterlyYoy"] as number).toFixed(2)}%` : "—" },
  ];

  // Crypto profile — render CoinGecko data when Finnhub profile is unavailable
  if (!p && !m) {
    const cd = detail.cryptoData;
    if (cd) {
      const md = cd.market_data;
      const pct24h = md?.price_change_percentage_24h;
      const pct7d = md?.price_change_percentage_7d;
      const pct30d = md?.price_change_percentage_30d;
      const homepage = cd.links?.homepage?.find(Boolean);
      const cryptoRows = [
        { label: "Symbol", value: cd.symbol?.toUpperCase() ?? "—" },
        { label: "Categories", value: cd.categories?.slice(0, 3).join(", ") || "—" },
        { label: "Genesis Date", value: cd.genesis_date ?? "—" },
        { label: "Algorithm", value: cd.hashing_algorithm ?? "—" },
        { label: "Market Cap", value: md?.market_cap?.usd != null ? fmtLarge(md.market_cap.usd) : "—" },
        { label: "24h Volume", value: md?.total_volume?.usd != null ? fmtLarge(md.total_volume.usd) : "—" },
        { label: "Circulating Supply", value: md?.circulating_supply != null ? fmtLarge(md.circulating_supply) : "—" },
        { label: "Total Supply", value: md?.total_supply != null ? fmtLarge(md.total_supply) : "—" },
        { label: "Max Supply", value: md?.max_supply != null ? fmtLarge(md.max_supply) : "∞" },
        { label: "All-Time High", value: md?.ath?.usd != null ? `$${md.ath.usd.toLocaleString()}` : "—" },
        { label: "All-Time Low", value: md?.atl?.usd != null ? `$${md.atl.usd.toLocaleString()}` : "—" },
        {
          label: "24h Change",
          value: pct24h != null ? (
            <span className={pct24h >= 0 ? "text-emerald-400" : "text-red-400"}>{pct24h >= 0 ? "+" : ""}{pct24h.toFixed(2)}%</span>
          ) : "—",
        },
        {
          label: "7d Change",
          value: pct7d != null ? (
            <span className={pct7d >= 0 ? "text-emerald-400" : "text-red-400"}>{pct7d >= 0 ? "+" : ""}{pct7d.toFixed(2)}%</span>
          ) : "—",
        },
        {
          label: "30d Change",
          value: pct30d != null ? (
            <span className={pct30d >= 0 ? "text-emerald-400" : "text-red-400"}>{pct30d >= 0 ? "+" : ""}{pct30d.toFixed(2)}%</span>
          ) : "—",
        },
        {
          label: "Website",
          value: homepage ? (
            <a href={homepage} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-color)] hover:underline truncate max-w-[160px] inline-block">
              {homepage.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          ) : "—",
        },
      ];
      const desc = cd.description?.en?.replace(/<[^>]*>/g, "").slice(0, 400);
      return (
        <div>
          <div className="flex items-center gap-3 mb-4">
            {cd.image?.large && (
              <img src={cd.image.large} alt={cd.name} className="h-8 w-8 rounded-full object-contain" />
            )}
            <div>
              <p className="text-sm font-semibold text-zinc-200">{cd.name}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{cd.symbol} · via CoinGecko</p>
            </div>
          </div>
          {desc && (
            <p className="mb-4 text-xs text-zinc-400 leading-relaxed line-clamp-4">{desc}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            {cryptoRows.map(({ label, value }) => (
              <DataRow key={label} label={label} value={value} />
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <UnavailablePlaceholder
          label="Profile unavailable"
          reason="No profile data found for this ticker."
        />
      </div>
    );
  }

  return (
    <div>
      {p?.name && (
        <div className="flex items-center gap-3 mb-4">
          {p.logo && (
            <img src={p.logo} alt={p.name} className="h-8 w-8 rounded-md object-contain bg-white/5 p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <p className="text-sm font-semibold text-zinc-200">{p.name}</p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
        {rows.map(({ label, value }) => (
          <DataRow key={label} label={label} value={value} />
        ))}
      </div>
    </div>
  );
}

// ─── Section: Financials ──────────────────────────────────────────────────────

type FinancialTab = "income" | "eps" | "risk";

function FinancialsSection({ detail, tech }: { detail: DetailData; tech: TechnicalsData | null }) {
  const [tab, setTab] = useState<FinancialTab>("eps");
  const m = detail.metrics?.metric;
  const earnings = detail.earnings ?? [];
  const nextDate = detail.nextEarningsDate;

  const epsData = earnings
    .filter((e) => e.period && (e.actual != null || e.estimate != null))
    .slice(0, 8)
    .reverse()
    .map((e) => ({
      period: e.period?.slice(0, 7) ?? "",
      actual: e.actual ?? null,
      estimate: e.estimate ?? null,
      surprise: e.surprisePercent,
    }));

  const tabs: { key: FinancialTab; label: string }[] = [
    { key: "eps", label: "EPS vs Estimate" },
    { key: "income", label: "Key Metrics" },
    { key: "risk", label: "Risk Metrics" },
  ];

  const incomeRows = [
    { label: "Revenue (TTM)", value: m?.["revenueTTM"] ? fmtLarge(m["revenueTTM"] as number) : "—" },
    { label: "Net Income (TTM)", value: m?.["netIncomeTTM"] ? fmtLarge(m["netIncomeTTM"] as number) : "—" },
    { label: "Net Margin (TTM)", value: m?.["netProfitMarginTTM"] ? `${(m["netProfitMarginTTM"] as number).toFixed(2)}%` : "—" },
    { label: "Gross Margin (TTM)", value: m?.["grossMarginTTM"] ? `${(m["grossMarginTTM"] as number).toFixed(2)}%` : "—" },
    { label: "Operating Margin (TTM)", value: m?.["operatingMarginTTM"] ? `${(m["operatingMarginTTM"] as number).toFixed(2)}%` : "—" },
    { label: "ROE (Annual)", value: m?.["roeRfy"] ? `${(m["roeRfy"] as number).toFixed(2)}%` : "—" },
    { label: "ROA (Annual)", value: m?.["roaRfy"] ? `${(m["roaRfy"] as number).toFixed(2)}%` : "—" },
    { label: "Total Debt / Equity", value: m?.["totalDebt/totalEquityAnnual"] ? (m["totalDebt/totalEquityAnnual"] as number).toFixed(2) : "—" },
    { label: "Current Ratio", value: m?.["currentRatioAnnual"] ? (m["currentRatioAnnual"] as number).toFixed(2) : "—" },
    { label: "Free Cash Flow (TTM)", value: m?.["freeCashFlowTTM"] ? fmtLarge(m["freeCashFlowTTM"] as number) : "—" },
  ];

  return (
    <div>
      {nextDate && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/10 px-3 py-1.5">
          <svg className="h-3 w-3 text-[var(--accent-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs font-medium text-[var(--accent-color)]">Next earnings: {nextDate}</span>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === t.key ? "bg-white/10 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "eps" && (
        <div>
          {epsData.length === 0 ? (
            <UnavailablePlaceholder
              label="EPS data unavailable"
              reason="No earnings data returned from Finnhub for this ticker."
            />
          ) : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={epsData} margin={{ top: 4, right: 8, bottom: 20, left: 8 }}>
                  <XAxis dataKey="period" tick={{ fill: "#71717a", fontSize: 10 }} angle={-30} textAnchor="end" />
                  <YAxis tick={{ fill: "#71717a", fontSize: 10 }} />
                  <Tooltip contentStyle={chartStyle} cursor={tooltipCursor} formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(2) : String(v ?? ""))} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                  <Bar dataKey="estimate" fill="rgba(255,255,255,0.15)" name="Estimate" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="actual" fill="var(--accent-color)" name="Actual" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-2 space-y-1">
            {epsData.map((d) => (
              <div key={d.period} className="flex justify-between text-xs py-1 border-b border-white/5">
                <span className="text-zinc-500">{d.period}</span>
                <span className="text-zinc-400">Est: {d.estimate?.toFixed(2) ?? "—"}</span>
                <span className={d.actual != null && d.estimate != null ? (d.actual >= d.estimate ? "text-emerald-400" : "text-red-400") : "text-zinc-400"}>
                  Act: {d.actual?.toFixed(2) ?? "—"}
                </span>
                <span className={d.surprise != null ? (d.surprise >= 0 ? "text-emerald-400" : "text-red-400") : "text-zinc-600"}>
                  {d.surprise != null ? `${d.surprise >= 0 ? "+" : ""}${d.surprise.toFixed(1)}%` : "—"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <UnavailablePlaceholder
              label="Full Income Statement / Balance Sheet / Cash Flow (line items)"
              reason="Detailed financial statements require Finnhub Standard plan or a Financial Modeling Prep API key."
              provider="financialmodelingprep.com"
            />
          </div>
        </div>
      )}

      {tab === "income" && (
        <div>
          {incomeRows.map(({ label, value }) => (
            <DataRow key={label} label={label} value={value} />
          ))}
        </div>
      )}

      {tab === "risk" && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Sharpe Ratio", value: tech?.sharpe != null ? tech.sharpe.toFixed(3) : "—", hint: "Higher is better. >1 = good" },
            { label: "Sortino Ratio", value: tech?.sortino != null ? tech.sortino.toFixed(3) : "—", hint: "Like Sharpe, but penalizes downside only" },
            { label: "Max Drawdown", value: tech?.maxDrawdown != null ? `${tech.maxDrawdown.toFixed(2)}%` : "—", hint: "Worst peak-to-trough loss (1Y)" },
            { label: "VaR (95%, 1-day)", value: tech?.var95 != null ? `$${tech.var95.toFixed(2)}` : "—", hint: "Expected max daily loss with 95% confidence" },
          ].map(({ label, value, hint }) => (
            <div key={label} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="text-lg font-semibold text-zinc-100 mt-1">{value}</p>
              <p className="text-[10px] text-zinc-600 mt-1">{hint}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section: Dividends ───────────────────────────────────────────────────────

function DividendsSection({ detail }: { detail: DetailData }) {
  const divs = detail.dividends ?? [];
  const m = detail.metrics?.metric;

  if (divs.length === 0) {
    return (
      <UnavailablePlaceholder
        label="No dividend data found"
        reason="This ticker may not pay dividends, or dividend data is unavailable from Finnhub for this symbol."
      />
    );
  }

  const sorted = [...divs].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")).slice(-12);
  const chartData = sorted.map((d) => ({ date: d.date?.slice(0, 7) ?? "", amount: d.amount ?? 0 }));
  const yield_ = m?.["dividendYieldIndicatedAnnual"] as number | null | undefined;
  const payout = m?.["payoutRatioAnnual"] as number | null | undefined;
  const nextEx = sorted[sorted.length - 1]?.date;

  return (
    <div>
      <div className="flex gap-6 mb-4">
        <div>
          <p className="text-xs text-zinc-500">Yield</p>
          <p className="text-lg font-semibold text-zinc-100">{yield_ != null ? `${yield_.toFixed(2)}%` : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Payout Ratio</p>
          <p className="text-lg font-semibold text-zinc-100">{payout != null ? `${payout.toFixed(1)}%` : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Last Ex-Div Date</p>
          <p className="text-lg font-semibold text-zinc-100">{nextEx ?? "—"}</p>
        </div>
      </div>
      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 20, left: 8 }}>
            <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 9 }} angle={-30} textAnchor="end" />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} />
            <Tooltip contentStyle={chartStyle} cursor={tooltipCursor} formatter={(v: unknown) => typeof v === "number" ? `$${v.toFixed(4)}` : String(v ?? "")} />
            <Bar dataKey="amount" fill="var(--accent-color)" name="Dividend" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Section: Technicals ─────────────────────────────────────────────────────

function TechnicalsSection({ tech, ticker }: { tech: TechnicalsData; ticker: string }) {
  const price = tech.price ?? 0;

  function osc(val: number | null | undefined, low: number, high: number): string {
    if (val == null) return "Neutral";
    if (val < low) return "Buy";
    if (val > high) return "Sell";
    return "Neutral";
  }

  const oscillators = [
    { label: "RSI (14)", value: tech.rsi != null ? tech.rsi.toFixed(1) : "—", signal: osc(tech.rsi, 30, 70) },
    { label: "MACD Histogram", value: tech.macd?.histogram != null ? tech.macd.histogram.toFixed(4) : "—", signal: tech.macd?.histogram != null ? (tech.macd.histogram > 0 ? "Buy" : "Sell") : "Neutral" },
    { label: "Stochastic %K", value: tech.stoch?.k != null ? tech.stoch.k.toFixed(1) : "—", signal: osc(tech.stoch?.k, 20, 80) },
    { label: "CCI (20)", value: tech.cci != null ? tech.cci.toFixed(1) : "—", signal: osc(tech.cci, -100, 100) },
  ];

  const maRows = [
    { label: "SMA 10", value: tech.sma10 },
    { label: "SMA 20", value: tech.sma20 },
    { label: "SMA 50", value: tech.sma50 },
    { label: "SMA 200", value: tech.sma200 },
    { label: "EMA 10", value: tech.ema10 },
    { label: "EMA 20", value: tech.ema20 },
    { label: "EMA 50", value: tech.ema50 },
    { label: "EMA 200", value: tech.ema200 },
  ];

  const bb = tech.bollingerBands;

  return (
    <div className="space-y-6">
      {/* Gauge */}
      <div className="flex flex-col items-center">
        <GaugeSVG score={tech.gaugeScore ?? 0} />
        <p className="text-xs text-zinc-500 mt-1">Based on RSI, MACD, Stochastic, and Moving Averages</p>
      </div>

      {/* Oscillators */}
      <div>
        <p className="text-xs text-zinc-600 font-medium uppercase tracking-wider mb-2">Oscillators</p>
        <div className="rounded-xl border border-white/8 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-3 py-2 text-zinc-500 font-medium">Indicator</th>
                <th className="text-right px-3 py-2 text-zinc-500 font-medium">Value</th>
                <th className="text-right px-3 py-2 text-zinc-500 font-medium">Signal</th>
              </tr>
            </thead>
            <tbody>
              {oscillators.map(({ label, value, signal }) => {
                const badge = signalBadge(signal);
                return (
                  <tr key={label} className="border-b border-white/5 last:border-0">
                    <td className="px-3 py-2 text-zinc-400">{label}</td>
                    <td className="px-3 py-2 text-right text-zinc-300 font-mono">{value}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ color: badge.color, backgroundColor: badge.bg }}>
                        {signal}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Moving Averages */}
      <div>
        <p className="text-xs text-zinc-600 font-medium uppercase tracking-wider mb-2">Moving Averages</p>
        <div className="rounded-xl border border-white/8 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-3 py-2 text-zinc-500 font-medium">MA</th>
                <th className="text-right px-3 py-2 text-zinc-500 font-medium">Value</th>
                <th className="text-right px-3 py-2 text-zinc-500 font-medium">Signal</th>
              </tr>
            </thead>
            <tbody>
              {maRows.map(({ label, value }) => {
                const signal = value != null ? (price > value ? "Price Above" : "Price Below") : "—";
                const badge = value != null ? signalBadge(price > value ? "Buy" : "Sell") : { color: "#71717a", bg: "transparent" };
                return (
                  <tr key={label} className="border-b border-white/5 last:border-0">
                    <td className="px-3 py-2 text-zinc-400">{label}</td>
                    <td className="px-3 py-2 text-right text-zinc-300 font-mono">{value != null ? `$${value.toFixed(2)}` : "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {value != null && (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ color: badge.color, backgroundColor: badge.bg }}>
                          {signal}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Support / Resistance */}
      {((tech.supports?.length ?? 0) > 0 || (tech.resistances?.length ?? 0) > 0) && (
        <div>
          <p className="text-xs text-zinc-600 font-medium uppercase tracking-wider mb-2">Support & Resistance</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-zinc-500 w-20">Resistance</span>
              {tech.resistances?.map((r) => (
                <span key={r} className="rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                  ${r.toFixed(2)}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-zinc-500 w-20">Support</span>
              {tech.supports?.map((s) => (
                <span key={s} className="rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  ${s.toFixed(2)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pivot Points */}
      {tech.pivotPoints && (
        <div>
          <p className="text-xs text-zinc-600 font-medium uppercase tracking-wider mb-2">Pivot Points (Classic)</p>
          <div className="flex gap-2 flex-wrap">
            {[
              { k: "S2", v: tech.pivotPoints.s2, c: "#ef4444" },
              { k: "S1", v: tech.pivotPoints.s1, c: "#f87171" },
              { k: "P", v: tech.pivotPoints.p, c: "#a1a1aa" },
              { k: "R1", v: tech.pivotPoints.r1, c: "#4ade80" },
              { k: "R2", v: tech.pivotPoints.r2, c: "#22c55e" },
            ].map(({ k, v, c }) => (
              <div key={k} className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-center min-w-[60px]">
                <p className="text-[10px] font-medium" style={{ color: c }}>{k}</p>
                <p className="text-xs text-zinc-300 font-mono mt-0.5">${v.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bollinger Bands */}
      {bb && (
        <div>
          <p className="text-xs text-zinc-600 font-medium uppercase tracking-wider mb-2">Bollinger Bands (20, 2σ)</p>
          <div className="flex gap-3">
            {[
              { label: "Upper", value: bb.upper },
              { label: "Middle", value: bb.middle },
              { label: "Lower", value: bb.lower },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                <p className="text-[10px] text-zinc-500">{label}</p>
                <p className="text-xs text-zinc-300 font-mono">{value != null ? `$${value.toFixed(2)}` : "—"}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Beta / Correlation / Expected Move */}
      <div>
        <p className="text-xs text-zinc-600 font-medium uppercase tracking-wider mb-2">Beta & Correlation</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Beta (vs SPY)", value: tech.beta != null ? tech.beta.toFixed(3) : "—" },
            { label: "Corr. to SPY", value: tech.correlationSPY != null ? tech.correlationSPY.toFixed(3) : "—" },
            { label: "Corr. to QQQ", value: tech.correlationQQQ != null ? tech.correlationQQQ.toFixed(3) : "—" },
            { label: "Expected Move (30d)", value: tech.expectedMove != null ? `±$${tech.expectedMove.toFixed(2)}` : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
              <p className="text-[10px] text-zinc-500">{label}</p>
              <p className="text-sm font-semibold text-zinc-200 mt-1">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Unavailable technicals */}
      <div className="space-y-2">
        <p className="text-xs text-zinc-600 font-medium uppercase tracking-wider">Unavailable</p>
        <UnavailablePlaceholder
          label="IV Rank / IV Percentile"
          reason="Requires a full options chain data provider (CBOE DataShop, Tradier, or Unusual Whales)."
          provider="cboe.com"
        />
        <UnavailablePlaceholder
          label="Expected Move into Earnings (options-based)"
          reason="Precise earnings expected move requires ATM straddle pricing from an options data API. The value above uses an ATR-based approximation."
        />
        <UnavailablePlaceholder
          label="Correlation to DXY / Yields / Sector ETF"
          reason="Sector ETF and DXY correlation require additional Finnhub candle calls. Currently limited to SPY and QQQ to avoid rate limits."
        />
        <UnavailablePlaceholder
          label="Performance in Rate Environments"
          reason="Requires historical Fed Funds Rate data cross-referenced with price history — integration with FRED API or similar macro data source needed."
          provider="fred.stlouisfed.org"
        />
      </div>
    </div>
  );
}

// ─── Section: Options & Derivatives ──────────────────────────────────────────

function OptionsSection({ unavailableItems }: { unavailableItems: OptionsItem[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-400 mb-3">
        Options flow, dark pool, and short interest data require specialized data providers not currently integrated.
      </p>
      {unavailableItems.map((item) => (
        <UnavailablePlaceholder
          key={item.label}
          label={item.label}
          reason={item.reason}
          provider={item.provider}
        />
      ))}
    </div>
  );
}

// ─── Section: Sentiment & Social ─────────────────────────────────────────────

type SentimentData = {
  reddit?: Array<{ atTime: string; mention: number; positiveMention: number; negativeMention: number }> | null;
  twitter?: Array<{ atTime: string; mention: number; positiveMention: number; negativeMention: number }> | null;
  unavailable?: boolean;
};

function SentimentSection({ sentiment, watchlistCount, news }: {
  sentiment: SentimentData | null;
  watchlistCount: number;
  news: NewsItem[];
}) {
  const reddit = sentiment?.reddit;
  const twitter = sentiment?.twitter;

  const newsSentiment = news.length > 0 ? (() => {
    const labeled = news.filter((n) => n.sentiment);
    const pos = labeled.filter((n) => n.sentiment === "positive").length;
    const neg = labeled.filter((n) => n.sentiment === "negative").length;
    const total = labeled.length;
    return total > 0 ? { pos, neg, neutral: total - pos - neg, total } : null;
  })() : null;

  return (
    <div className="space-y-6">
      {/* Quantiv Community */}
      <div className="rounded-xl border border-[var(--accent-color)]/20 bg-[var(--accent-color)]/5 px-4 py-3">
        <p className="text-xs text-zinc-500">Quantiv members watching</p>
        <p className="text-2xl font-bold text-zinc-100 mt-1">{watchlistCount > 0 ? watchlistCount.toLocaleString() : "—"}</p>
      </div>

      {/* News Sentiment */}
      {newsSentiment && (
        <div>
          <p className="text-xs text-zinc-600 font-medium uppercase tracking-wider mb-2">News Sentiment (7 days)</p>
          <div className="flex gap-3">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
              <p className="text-[10px] text-zinc-500">Positive</p>
              <p className="text-sm font-semibold text-emerald-400">{newsSentiment.pos}</p>
            </div>
            <div className="rounded-lg border border-zinc-700 bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] text-zinc-500">Neutral</p>
              <p className="text-sm font-semibold text-zinc-400">{newsSentiment.neutral}</p>
            </div>
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
              <p className="text-[10px] text-zinc-500">Negative</p>
              <p className="text-sm font-semibold text-red-400">{newsSentiment.neg}</p>
            </div>
          </div>
        </div>
      )}

      {/* Reddit */}
      {reddit && reddit.length > 0 ? (
        <div>
          <p className="text-xs text-zinc-600 font-medium uppercase tracking-wider mb-2">Reddit Mentions (30 days)</p>
          <div style={{ height: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={reddit.map((r) => ({ date: r.atTime?.slice(0, 10), mentions: r.mention, positive: r.positiveMention, negative: r.negativeMention }))} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 9 }} />
                <YAxis tick={{ fill: "#71717a", fontSize: 9 }} />
                <Tooltip contentStyle={chartStyle} cursor={tooltipCursor} />
                <Area type="monotone" dataKey="mentions" stroke="var(--accent-color)" fill="rgba(232,132,106,0.1)" strokeWidth={1.5} name="Mentions" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <UnavailablePlaceholder
          label="Reddit Mention Velocity"
          reason={sentiment?.unavailable ? "Finnhub social sentiment API returned no data for this ticker. This may require a Finnhub premium plan." : "No Reddit mention data available for this ticker in the last 30 days."}
          provider="finnhub.io"
        />
      )}

      {/* Twitter */}
      {twitter && twitter.length > 0 ? (
        <div>
          <p className="text-xs text-zinc-600 font-medium uppercase tracking-wider mb-2">X/Twitter Mentions (30 days)</p>
          <div style={{ height: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={twitter.map((t) => ({ date: t.atTime?.slice(0, 10), mentions: t.mention }))} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 9 }} />
                <YAxis tick={{ fill: "#71717a", fontSize: 9 }} />
                <Tooltip contentStyle={chartStyle} cursor={tooltipCursor} />
                <Area type="monotone" dataKey="mentions" stroke="#1d9bf0" fill="rgba(29,155,240,0.1)" strokeWidth={1.5} name="Mentions" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <UnavailablePlaceholder
          label="X/Twitter Sentiment Over Time"
          reason={sentiment?.unavailable ? "Finnhub social sentiment API returned no data. This may require a premium plan." : "No Twitter/X data available for this ticker."}
          provider="finnhub.io"
        />
      )}

      {/* Unavailable */}
      <div className="space-y-2">
        <UnavailablePlaceholder
          label="Google Trends"
          reason="Requires a SerpAPI or DataForSEO subscription to access Google Trends data programmatically."
          provider="serpapi.com"
        />
        <UnavailablePlaceholder
          label="StockTwits Bull/Bear Ratio"
          reason="Requires a StockTwits API key. Apply at api.stocktwits.com."
          provider="api.stocktwits.com"
        />
      </div>

      {/* Recent News */}
      {news.length > 0 && (
        <div>
          <p className="text-xs text-zinc-600 font-medium uppercase tracking-wider mb-2">Recent News</p>
          <div className="space-y-2">
            {news.slice(0, 5).map((n, i) => (
              <a
                key={i}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 hover:bg-white/5 transition-colors"
              >
                <p className="text-xs text-zinc-200 line-clamp-1">{n.headline}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">{n.source} · {n.datetime ? new Date(n.datetime * 1000).toLocaleDateString() : ""}</p>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Insider & Institutional ────────────────────────────────────────

type InstitutionalData = {
  ownership?: unknown[] | null;
  fundOwnership?: Array<Record<string, unknown>> | null;
  thirteenFUnavailable?: boolean;
  thirteenFReason?: string | null;
};

function InsiderSection({ transactions, purchases, sales, congressTrades, institutional, ticker }: {
  transactions: InsiderTx[];
  purchases: number;
  sales: number;
  congressTrades: Array<Record<string, unknown>>;
  institutional: InstitutionalData | null;
  ticker: string;
}) {
  const fundOwnership = institutional?.fundOwnership;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex gap-4">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <p className="text-[10px] text-zinc-500">Insider Buys (90d)</p>
          <p className="text-lg font-semibold text-emerald-400">{purchases}</p>
        </div>
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
          <p className="text-[10px] text-zinc-500">Insider Sales (90d)</p>
          <p className="text-lg font-semibold text-red-400">{sales}</p>
        </div>
      </div>

      {/* Transactions table */}
      {transactions.length > 0 ? (
        <div>
          <p className="text-xs text-zinc-600 font-medium uppercase tracking-wider mb-2">Recent Insider Transactions</p>
          <div className="rounded-xl border border-white/8 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-3 py-2 text-zinc-500">Insider</th>
                  <th className="text-left px-3 py-2 text-zinc-500">Type</th>
                  <th className="text-right px-3 py-2 text-zinc-500">Shares</th>
                  <th className="text-right px-3 py-2 text-zinc-500">Value</th>
                  <th className="text-right px-3 py-2 text-zinc-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 10).map((t, i) => (
                  <tr key={i} className={`border-b border-white/5 last:border-0 ${t.type === "Purchase" ? "bg-emerald-500/[0.03]" : "bg-red-500/[0.03]"}`}>
                    <td className="px-3 py-2 text-zinc-300 truncate max-w-[120px]">{t.name}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${t.type === "Purchase" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-400 font-mono">{t.shares?.toLocaleString() ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-zinc-400">{t.value ? fmtLarge(t.value) : "—"}</td>
                    <td className="px-3 py-2 text-right text-zinc-500">{t.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <UnavailablePlaceholder
          label="No insider transactions found (90 days)"
          reason="No open-market purchases or sales were reported for this ticker in the last 90 days."
        />
      )}

      {/* Congress trades */}
      {congressTrades.length > 0 ? (
        <div>
          <p className="text-xs text-zinc-600 font-medium uppercase tracking-wider mb-2">Congress Trades</p>
          <div className="rounded-xl border border-white/8 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-3 py-2 text-zinc-500">Representative</th>
                  <th className="text-left px-3 py-2 text-zinc-500">Type</th>
                  <th className="text-right px-3 py-2 text-zinc-500">Range</th>
                  <th className="text-right px-3 py-2 text-zinc-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {congressTrades.slice(0, 8).map((t, i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0">
                    <td className="px-3 py-2 text-zinc-300 truncate max-w-[140px]">{t.Representative as string}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${(t.Transaction as string)?.includes("Purchase") ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                        {t.Transaction as string}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-400">{t.Range as string}</td>
                    <td className="px-3 py-2 text-right text-zinc-500">{t.TransactionDate as string}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <UnavailablePlaceholder
          label="No congressional trades found for this ticker"
          reason="No trades found in the QuiverQuant congress trading data for this symbol."
        />
      )}

      {/* Fund Ownership */}
      {fundOwnership && fundOwnership.length > 0 ? (
        <div>
          <p className="text-xs text-zinc-600 font-medium uppercase tracking-wider mb-2">Top Fund Holdings</p>
          <div className="space-y-1">
            {fundOwnership.map((f, i) => (
              <div key={i} className="flex justify-between items-center py-1.5 border-b border-white/5">
                <span className="text-xs text-zinc-400 truncate max-w-[200px]">{(f.name ?? f.fundName ?? f.fund) as string}</span>
                <span className="text-xs text-zinc-300">{f.share != null ? `${(f.share as number).toFixed(2)}%` : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 13F placeholder */}
      {institutional?.thirteenFUnavailable && (
        <UnavailablePlaceholder
          label="13F Institutional Holdings (fund-by-fund, QoQ changes)"
          reason={institutional.thirteenFReason ?? "Requires Finnhub premium or SEC EDGAR API integration."}
          provider="sec.gov/cgi-bin/browse-edgar"
        />
      )}

      {/* Institutional ownership % */}
      <UnavailablePlaceholder
        label="Institutional Ownership % (precise)"
        reason="Aggregate institutional ownership percentage requires Finnhub premium tier or a dedicated data vendor."
        provider="finnhub.io"
      />
    </div>
  );
}

// ─── Section: Macro & Risk ────────────────────────────────────────────────────

function MacroSection({ ticker, industry }: { ticker: string; industry?: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-400 mb-3">
        Macro & Risk analysis requires cross-asset historical data not currently integrated.
      </p>
      <UnavailablePlaceholder
        label="Correlation Matrix vs Benchmarks (DXY, Yields, Sector ETF)"
        reason="Requires FRED API for yield data, plus additional Finnhub candle calls for DXY/sector ETFs beyond current rate limits."
        provider="fred.stlouisfed.org"
      />
      <UnavailablePlaceholder
        label="Supply Chain Country & Supplier Exposure"
        reason="Requires specialized supply chain data (Tegus, AlphaSense, or FactSet Supply Chain). No free/low-cost API exists."
        provider="tegus.com"
      />
      <UnavailablePlaceholder
        label="Performance During Rate Hike / Recession / Dollar Strength Cycles"
        reason="Requires FRED Fed Funds Rate history cross-referenced with price history and NBER recession dates. Planned via FRED API integration."
        provider="fred.stlouisfed.org"
      />
      {industry && (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 mt-2">
          <p className="text-xs text-zinc-400">
            <span className="font-medium text-zinc-300">{industry}</span> — sector-level macro sensitivity analysis coming soon.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Section: Alternative Data ────────────────────────────────────────────────

function AltDataSection() {
  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-400 mb-3">Alternative data sources require third-party API integrations not currently active.</p>
      <UnavailablePlaceholder
        label="Web Traffic Trends"
        reason="Requires SimilarWeb API. Plans start at ~$500/month."
        provider="similarweb.com"
      />
      <UnavailablePlaceholder
        label="App Store Ranking Trends"
        reason="Requires App Annie / data.ai API. Enterprise pricing only."
        provider="data.ai"
      />
      <UnavailablePlaceholder
        label="Patent Filings"
        reason="Requires USPTO Patent Full-Text Database API integration. Data is public but complex to parse and normalize."
        provider="patentsview.org"
      />
      <UnavailablePlaceholder
        label="Job Posting Growth"
        reason="Requires Burning Glass / Lightcast or LinkedIn API. Not publicly available without a partnership."
        provider="lightcast.io"
      />
    </div>
  );
}

// ─── Section: Quantiv-Specific ────────────────────────────────────────────────

function QuantivSection({ ticker, watchlistCount, posts }: {
  ticker: string;
  watchlistCount: number;
  posts: Post[];
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <p className="text-xs text-zinc-500">Members watching {ticker}</p>
          <p className="text-2xl font-bold text-zinc-100 mt-1">{watchlistCount > 0 ? watchlistCount.toLocaleString() : "—"}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <p className="text-xs text-zinc-500">Community posts mentioning {ticker}</p>
          <p className="text-2xl font-bold text-zinc-100 mt-1">{posts.length}</p>
          {posts.length > 0 && <p className="text-[10px] text-zinc-600 mt-1">Last 5 shown below</p>}
        </div>
      </div>

      {/* Community posts */}
      {posts.length > 0 && (
        <div>
          <p className="text-xs text-zinc-600 font-medium uppercase tracking-wider mb-2">Community Posts</p>
          <div className="space-y-2">
            {posts.map((p) => (
              <div key={p.id} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                <p className="text-xs text-zinc-300 line-clamp-2">{p.content}</p>
                <p className="text-[10px] text-zinc-600 mt-1">{new Date(p.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Backtest link */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
        <p className="text-sm font-medium text-zinc-200">Quick Backtest</p>
        <p className="text-xs text-zinc-500 mt-1">Run a SMA crossover backtest on {ticker} using the full backtesting engine.</p>
        <a
          href={`/backtest?ticker=${ticker}`}
          className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-[#020308] transition hover:opacity-90"
          style={{ backgroundColor: "var(--accent-color)" }}
        >
          Open Backtest
        </a>
      </div>

      {/* Prediction markets */}
      <UnavailablePlaceholder
        label="Active Prediction Markets on this ticker"
        reason="No prediction markets are currently linked to individual tickers. Cross-referencing predict markets by ticker keyword is not yet implemented."
      />

      {/* Trader leaderboard */}
      <UnavailablePlaceholder
        label="Top Quantiv Traders Holding this Ticker"
        reason="Portfolio visibility requires users to have made their portfolio public. Leaderboard ranking by ticker is not yet implemented."
      />
    </div>
  );
}

// ─── Section divider ─────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{label}</span>
      <div className="flex-1 h-px bg-white/6" />
    </div>
  );
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

export function TickerDetailSections({ ticker, aiSlot }: { ticker: string; aiSlot?: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [tech, setTech] = useState<TechnicalsData | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [insider, setInsider] = useState<{ transactions: InsiderTx[]; purchases: number; sales: number } | null>(null);
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [community, setCommunity] = useState<{ watchlistCount: number; posts: Post[] } | null>(null);
  const [options, setOptions] = useState<{ unavailableItems: OptionsItem[] } | null>(null);
  const [institutional, setInstitutional] = useState<InstitutionalData | null>(null);
  const [congressTrades, setCongressTrades] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);

    Promise.allSettled([
      fetch(`/api/ticker-detail?ticker=${encodeURIComponent(ticker)}`).then((r) => r.json()),
      fetch(`/api/ticker-technicals?ticker=${encodeURIComponent(ticker)}`).then((r) => r.json()),
      fetch(`/api/ticker-news?ticker=${encodeURIComponent(ticker)}`).then((r) => r.json()),
      fetch(`/api/ticker-insider?ticker=${encodeURIComponent(ticker)}`).then((r) => r.json()),
      fetch(`/api/ticker-sentiment?ticker=${encodeURIComponent(ticker)}`).then((r) => r.json()),
      fetch(`/api/ticker-community?ticker=${encodeURIComponent(ticker)}`).then((r) => r.json()),
      fetch(`/api/ticker-options?ticker=${encodeURIComponent(ticker)}`).then((r) => r.json()),
      fetch(`/api/ticker-institutional?ticker=${encodeURIComponent(ticker)}`).then((r) => r.json()),
      fetch(`/api/insider-trades/congress`).then((r) => r.json()),
    ]).then(([detailRes, techRes, newsRes, insiderRes, sentRes, commRes, optRes, instRes, congRes]) => {
      if (detailRes.status === "fulfilled") setDetail(detailRes.value);
      if (techRes.status === "fulfilled") setTech(techRes.value);
      if (newsRes.status === "fulfilled") setNews(newsRes.value?.news ?? []);
      if (insiderRes.status === "fulfilled") setInsider(insiderRes.value);
      if (sentRes.status === "fulfilled") setSentiment(sentRes.value);
      if (commRes.status === "fulfilled") setCommunity(commRes.value);
      if (optRes.status === "fulfilled") setOptions({ unavailableItems: optRes.value?.unavailableItems ?? [] });
      if (instRes.status === "fulfilled") setInstitutional(instRes.value);
      if (congRes.status === "fulfilled") {
        const all: Array<Record<string, unknown>> = congRes.value?.trades ?? [];
        setCongressTrades(all.filter((t) => (t.Ticker as string)?.toUpperCase() === ticker.toUpperCase()));
      }
      setLoading(false);
    });
  }, [ticker]);

  const insiderNode = loading ? <Skeleton /> : (
    <InsiderSection
      transactions={insider?.transactions ?? []}
      purchases={insider?.purchases ?? 0}
      sales={insider?.sales ?? 0}
      congressTrades={congressTrades}
      institutional={institutional}
      ticker={ticker}
    />
  );

  return (
    <div className="overflow-y-auto h-full px-4 py-3 space-y-4">
      <SectionDivider label="Overview" />
      {loading ? <Skeleton /> : <CompanyOverviewSection detail={detail ?? {}} ticker={ticker} />}

      <SectionDivider label="Options & Derivatives" />
      {loading ? <Skeleton /> : <OptionsSection unavailableItems={options?.unavailableItems ?? []} />}

      <SectionDivider label="Identifiers" />
      <div className="space-y-2">
        <UnavailablePlaceholder
          label="ISIN / CUSIP"
          reason="Requires Refinitiv (now LSEG) or Bloomberg Terminal API. No affordable retail-tier equivalent."
          provider="lseg.com/en/data-analytics"
        />
        <UnavailablePlaceholder
          label="FIGI (Financial Instrument Global Identifier)"
          reason="Available free via OpenFIGI API — separate integration not yet built."
          provider="openfigi.com"
        />
        <UnavailablePlaceholder
          label="Glassdoor Rating & Job Posting Growth"
          reason="Glassdoor has no public API. Job posting data requires Burning Glass Technologies or LinkedIn Talent Insights."
          provider="burningglasstech.com"
        />
        <UnavailablePlaceholder
          label="CEO Name & HQ Location"
          reason="Requires Finnhub Premium (~$50/mo) or a financial data vendor such as Intrinio."
          provider="finnhub.io/pricing"
        />
      </div>

      <SectionDivider label="Financials" />
      {loading ? <Skeleton /> : <FinancialsSection detail={detail ?? {}} tech={tech} />}

      <SectionDivider label="Dividends" />
      {loading ? <Skeleton /> : <DividendsSection detail={detail ?? {}} />}

      <SectionDivider label="Technicals" />
      {loading || !tech ? <Skeleton lines={6} /> : <TechnicalsSection tech={tech} ticker={ticker} />}

      <SectionDivider label="Sentiment & Social" />
      {loading ? <Skeleton /> : <SentimentSection sentiment={sentiment} watchlistCount={community?.watchlistCount ?? 0} news={news} />}

      <SectionDivider label="Insider & Institutional" />
      {insiderNode}

      <SectionDivider label="Macro & Risk" />
      {loading ? <Skeleton /> : <MacroSection ticker={ticker} industry={detail?.profile?.finnhubIndustry} />}

      <SectionDivider label="Alternative Data" />
      <AltDataSection />

      <SectionDivider label="Quantiv" />
      {loading ? <Skeleton /> : <QuantivSection ticker={ticker} watchlistCount={community?.watchlistCount ?? 0} posts={community?.posts ?? []} />}

      <SectionDivider label="Market Analysis" />
      {aiSlot}
    </div>
  );
}
