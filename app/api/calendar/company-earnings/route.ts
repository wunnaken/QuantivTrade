import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type FinnhubProfile = {
  name?: string;
  finnhubIndustry?: string;
  // marketCapitalization is in USD millions (Finnhub convention).
  marketCapitalization?: number;
  // shareOutstanding is in MILLIONS of shares.
  shareOutstanding?: number;
  logo?: string;
  weburl?: string;
  country?: string;
  currency?: string;
  exchange?: string;
};

type FinnhubQuote = {
  c?: number; // current price
  pc?: number; // previous close
  t?: number; // unix timestamp
};

type EarningsItem = {
  actual?: number | null;
  estimate?: number | null;
  period?: string;
  quarter?: number;
  year?: number;
  surprise?: number | null;
  surprisePercent?: number | null;
};

type FmpSurprise = {
  date: string;
  symbol: string;
  actualEarningResult: number | null;
  estimatedEarning: number | null;
};

function quarterOf(dateIso: string): { quarter: number; year: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const quarter = Math.ceil(month / 3);
  return { quarter, year };
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  const token = process.env.FINNHUB_API_KEY;
  const fmpKey = process.env.FMP_API_KEY?.trim();
  if (!token) {
    return NextResponse.json({ error: "FINNHUB_API_KEY not set" }, { status: 500 });
  }

  const [profileRes, earningsRes, fmpRes, quoteRes] = await Promise.allSettled([
    fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${token}`,
      { next: { revalidate: 3600 } }
    ),
    fetch(
      `https://finnhub.io/api/v1/stock/earnings?symbol=${encodeURIComponent(symbol)}&limit=40&token=${token}`,
      { next: { revalidate: 900 } }
    ),
    fmpKey
      ? fetch(
          `https://financialmodelingprep.com/api/v3/earnings-surprises/${encodeURIComponent(symbol)}?apikey=${fmpKey}`,
          { next: { revalidate: 86400 } }
        )
      : Promise.resolve(null as unknown as Response),
    // Live-ish quote (60s revalidate) so the modal's market cap reflects today's
    // price × sharesOutstanding rather than Finnhub's daily-stale cached mcap.
    fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`,
      { next: { revalidate: 60 } }
    ),
  ]);

  let profile: FinnhubProfile = {};
  if (profileRes.status === "fulfilled" && profileRes.value.ok) {
    try {
      profile = (await profileRes.value.json()) as FinnhubProfile;
    } catch {}
  }

  // If we have a live quote AND shareOutstanding, recompute market cap so it's
  // current. Finnhub's profile.marketCapitalization can be 1-2 days stale.
  if (quoteRes.status === "fulfilled" && quoteRes.value.ok) {
    try {
      const quote = (await quoteRes.value.json()) as FinnhubQuote;
      const price = quote.c;
      const shares = profile.shareOutstanding; // in millions
      if (price && price > 0 && shares && shares > 0) {
        // Both in millions (price * shares-in-millions = mcap-in-millions).
        profile.marketCapitalization = price * shares;
      }
    } catch {}
  }

  // Build map keyed by `${year}-Q${quarter}` so Finnhub data takes precedence
  // (it carries surprisePercent), then fill in older quarters from FMP.
  const byKey = new Map<string, EarningsItem>();

  if (earningsRes.status === "fulfilled" && earningsRes.value.ok) {
    try {
      const arr = (await earningsRes.value.json()) as EarningsItem[];
      for (const e of arr) {
        const key = e.year && e.quarter ? `${e.year}-Q${e.quarter}` : (e.period ?? "");
        if (!key) continue;
        byKey.set(key, e);
      }
    } catch {}
  }

  if (fmpRes && fmpRes.status === "fulfilled" && fmpRes.value && fmpRes.value.ok) {
    try {
      const arr = (await fmpRes.value.json()) as FmpSurprise[];
      for (const s of arr) {
        const q = quarterOf(s.date);
        if (!q) continue;
        const key = `${q.year}-Q${q.quarter}`;
        if (byKey.has(key)) continue; // Finnhub wins when both have data
        const actual = s.actualEarningResult;
        const estimate = s.estimatedEarning;
        const surprise = actual != null && estimate != null ? actual - estimate : null;
        const surprisePercent =
          actual != null && estimate != null && estimate !== 0
            ? ((actual - estimate) / Math.abs(estimate)) * 100
            : null;
        byKey.set(key, {
          actual,
          estimate,
          period: s.date,
          quarter: q.quarter,
          year: q.year,
          surprise,
          surprisePercent,
        });
      }
    } catch {}
  }

  const earningsHistory = Array.from(byKey.values()).sort((a, b) => {
    const ay = a.year ?? 0;
    const by = b.year ?? 0;
    if (ay !== by) return ay - by;
    return (a.quarter ?? 0) - (b.quarter ?? 0);
  });

  return NextResponse.json({ profile, earningsHistory });
}
